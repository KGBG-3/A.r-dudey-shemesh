#!/usr/bin/env python3
"""python3 tools/site-check.py [--base REF] [--quiet]
Static checks of what must stay true on the eight public pages (index.html, the six subpages, 404.html): the rules of
CLAUDE.md's "Privacy, consent and accessibility (Nov 2026)" section plus parsing, structured data and the sitemap.
Values are read from the pages themselves where possible (the business number from index.html's footer line, the
provider @id from index.html's LocalBusiness, the e-mail, coordinator and phone from index.html's statement).

  --base REF   also compare with that commit (e.g. --base origin/main): const PRICES and every line that mentions
               SUPER_PRICE identical, and the WhatsApp numbers of every page identical.
  --quiet      print only the failures and the summary.

Output: one line per check, "ok" or "FAIL" with the reason. Exit code 1 on any failure. Works from any folder (it checks
the repo this file is in). Needs node (for node --check). Runs tools/check-shared.py too. The browser checks are
separate: tools/ru-check.py (Russian of the legal components) and tools/i18n-check.py (subpage translation tables).
Developer tool only: the site never runs it.
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import xml.dom.minidom
from collections import Counter
from html.parser import HTMLParser

T = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(T)
SUBPAGES = ['tikun-dahuf.html', 'mehshvon-mehirim.html', 'azorey-sherut.html', 'chromagen.html', 'guf-himum.html', 'sanan-avnit.html']
PUBLIC = ['index.html'] + SUBPAGES          # the pages of the sitemap
ALL = PUBLIC + ['404.html']                 # every page that carries the footer, the banner and the legal texts
SHARED_JS = 'assets/ardudim-sub.js'
SHARED_CSS = 'assets/ardudim-sub.css'

args = sys.argv[1:]
QUIET = '--quiet' in args
BASE = None
if '--base' in args:
    i = args.index('--base')
    if i + 1 >= len(args):
        print(__doc__)
        sys.exit(2)
    BASE = args[i + 1]
unknown = [a for k, a in enumerate(args) if a.startswith('--') and a not in ('--quiet', '--base')]
if unknown:
    print('unknown option(s): %s\n%s' % (' '.join(unknown), __doc__))
    sys.exit(2)

fails, oks = [], []


def ok(name, detail=''):
    oks.append(name)
    if not QUIET:
        print('  ok   %s%s' % (name, (' — ' + detail) if detail else ''))


def bad(name, detail=''):
    fails.append(name)
    print('  FAIL %s%s' % (name, (' — ' + detail) if detail else ''))


def check(cond, name, detail_if_bad='', detail_if_ok=''):
    if cond:
        ok(name, detail_if_ok)
    else:
        bad(name, detail_if_bad)


def section(title):
    if not QUIET:
        print(title)


def read(path):
    p = os.path.join(ROOT, path)
    return open(p, encoding='utf-8').read() if os.path.exists(p) else None


def git_show(ref, path):
    r = subprocess.run(['git', '-C', ROOT, 'show', '%s:%s' % (ref, path)], capture_output=True)
    return r.stdout.decode('utf-8') if r.returncode == 0 else None


# ---------------------------------------------------------------- helpers
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
SVG_SELF = {'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop'}
OPTIONAL_END = ('p', 'li', 'option', 'tr', 'td', 'th', 'dd', 'dt')


class Balance(HTMLParser):
    """Tag-balance anomalies: a close tag without an open one, an open tag never closed. <script>/<style> are CDATA."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.problems = [], []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, ln in self.stack[i + 1:]:
                    if t not in SVG_SELF and t not in OPTIONAL_END:
                        self.problems.append('<%s> opened at line %d not closed before </%s> at line %d' % (t, ln, tag, self.getpos()[0]))
                del self.stack[i:]
                return
        self.problems.append('</%s> at line %d without an open tag' % (tag, self.getpos()[0]))


def balance(html):
    p = Balance()
    p.feed(html)
    p.close()
    for t, ln in p.stack:
        if t not in SVG_SELF and t not in ('p', 'li', 'html', 'body'):
            p.problems.append('<%s> opened at line %d never closed' % (t, ln))
    return p.problems


def scripts(html):
    """Inline scripts: (attributes, body, line, start offset)."""
    for m in re.finditer(r'<script(?P<a>[^>]*)>(?P<b>.*?)</script>', html, re.S):
        a, b = m.group('a'), m.group('b').strip()
        if 'src=' in a or not b:
            continue
        yield a, b, html.count('\n', 0, m.start()) + 1, m.start()


def script_errors(html):
    errs = []
    for a, b, line, _ in scripts(html):
        if 'ld+json' in a:
            try:
                json.loads(b)
            except Exception as e:
                errs.append('JSON-LD block at line %d: %s' % (line, e))
            continue
        f = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8')
        f.write(b)
        f.close()
        try:
            r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
        finally:
            os.unlink(f.name)
        if r.returncode != 0:
            errs.append('script at line %d: %s' % (line, r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'error'))
    return errs


def jsonld(html):
    out = []
    for a, b, line, _ in scripts(html):
        if 'ld+json' in a:
            try:
                out.append(json.loads(b))
            except Exception:
                pass
    return out


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def types_of(n):
    t = n.get('@type')
    return t if isinstance(t, list) else [t]


def text_of(fragment):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', fragment or '')).strip()


def squash(s):
    return re.sub(r'\s+', '', s or '')


def footer(html):
    m = re.search(r'<footer\b.*?</footer>', html, re.S)
    return m.group(0) if m else ''


def block(text, start_rx):
    """From a regex match to the brace that closes the first { after it."""
    m = re.search(start_rx, text or '')
    if not m:
        return None
    i = text.find('{', m.start())
    if i < 0:
        return None
    depth, p = 1, i + 1
    while p < len(text) and depth:
        depth += text[p] == '{'
        depth -= text[p] == '}'
        p += 1
    return text[m.start():p]


def ft_ident(html):
    m = re.search(r'<span[^>]*class="ft-ident"[^>]*>(.*?)</span>', html, re.S)
    return text_of(m.group(1)) if m else None


def privacy(html):
    """(title, text from the title to the close button) of #privacy-modal."""
    m = re.search(r'id="privacy-modal".*?<h3[^>]*id="privacy-title"[^>]*>(.*?)</h3>(.*?)<button[^>]*class="privacy-close"', html, re.S)
    return (text_of(m.group(1)), m.group(2)) if m else (None, None)


def statement(html):
    """(title, body HTML, date line) of #a11y-modal."""
    m = re.search(r'id="a11y-modal".*?<h3[^>]*id="a11y-modal-title"[^>]*>(.*?)</h3>.*?<div class="a11y-modal-body">(.*?)<div class="a11y-modal-footer">(.*?)</button>', html, re.S)
    if not m:
        return None, None, None
    d = re.search(r'class="a11y-modal-footer-meta"[^>]*>(.*?)</div>', m.group(3), re.S)
    return text_of(m.group(1)), m.group(2), text_of(d.group(1)) if d else None


def consent_blocks(html):
    return [(b, start) for a, b, line, start in scripts(html) if re.search(r"gtag\(\s*'consent'\s*,\s*'default'", b)]


WA_RX = r'(?:wa\.me/|whatsapp\.com/send\?phone=|Q_WA\s*=\s*[\'"])\+?(\d{9,15})'

pages = {name: read(name) for name in ALL}
idx = pages['index.html'] or ''

# ---------------------------------------------------------------- 1. parse
section('1. Every page parses')
for name in ALL:
    html = pages[name]
    if html is None:
        bad('%s exists' % name)
        continue
    probs = balance(html)
    check(not probs, '%s: tag balance' % name, '%d anomalies: %s' % (len(probs), '; '.join(probs[:4])))
    errs = script_errors(html)
    n_inline = sum(1 for _ in scripts(html))
    check(not errs, '%s: %d inline scripts pass node --check, JSON-LD parses' % (name, n_inline), '; '.join(errs[:3]))
r = subprocess.run([sys.executable, os.path.join(T, 'check-shared.py')], capture_output=True, text=True)
check(r.returncode == 0, 'tools/check-shared.py', (r.stdout.strip() or r.stderr.strip())[:400], (r.stdout.strip().splitlines() or [''])[-1])

# ---------------------------------------------------------------- 2. links and sitemap
section('2. No javascript: links; sitemap.xml')
for name in ALL:
    n = len(re.findall(r'href\s*=\s*["\']\s*javascript:', pages[name] or '', re.I))
    check(n == 0, '%s: no href="javascript:"' % name, '%d found' % n)
canon_idx = re.search(r'<link rel="canonical" href="([^"]+)"', idx)
origin = canon_idx.group(1).rstrip('/') + '/' if canon_idx else 'https://ardudim.co.il/'
want_locs = {origin} | {origin + p for p in SUBPAGES}
try:
    dom = xml.dom.minidom.parse(os.path.join(ROOT, 'sitemap.xml'))
    locs = [n.firstChild.nodeValue.strip() for n in dom.getElementsByTagName('loc') if n.firstChild]
    ok('sitemap.xml is valid XML', '%d urls' % len(locs))
    check(len(locs) == len(set(locs)) and set(locs) == want_locs, 'sitemap.xml lists exactly the seven public pages',
          'missing: %s; extra: %s; duplicates: %d' % (sorted(want_locs - set(locs)), sorted(set(locs) - want_locs), len(locs) - len(set(locs))))
    check(not any('404' in l for l in locs), 'sitemap.xml does not list 404.html')
except Exception as e:
    bad('sitemap.xml is valid XML', str(e))

# ---------------------------------------------------------------- 3. footer and business number
section('3. Footer: identity line, business number, "הגדרות עוגיות"')
ident_idx = ft_ident(idx)
biz_m = re.search(r'\b(\d{9})\b', ident_idx or '')
BIZ = biz_m.group(1) if biz_m else None
check(bool(BIZ), "index.html: the footer's .ft-ident line carries a 9-digit business number", repr(ident_idx), BIZ or '')
for name in ALL:
    html = pages[name] or ''
    if BIZ:
        n, nf = html.count(BIZ), footer(html).count(BIZ)
        check(n == 1 and nf == 1, '%s: business number exactly once, inside <footer>' % name, '%d time(s) in the page, %d in <footer>' % (n, nf))
        check(BIZ not in json.dumps(jsonld(html), ensure_ascii=False), '%s: business number not in JSON-LD' % name)
        pt = privacy(html)[1]
        check(pt is not None and BIZ not in text_of(pt), '%s: business number not in the privacy policy' % name, 'no privacy policy found' if pt is None else 'found')
    if name != 'index.html':
        check(ident_idx is not None and ft_ident(html) == ident_idx, '%s: footer identity line same as index.html' % name, repr(ft_ident(html)))
    ft = footer(html)
    link = re.search(r'<a\b[^>]*>\s*הגדרות עוגיות\s*</a>', ft)
    check(bool(link) and ('data-cookie-settings' in link.group(0) or 'openCookieSettings' in link.group(0)),
          '%s: footer has the "הגדרות עוגיות" link' % name, 'missing' if not link else 'not bound: ' + link.group(0)[:160])

# ---------------------------------------------------------------- 4. cookie banner
section('4. Cookie banner')
label_idx = None
m = re.search(r'<div[^>]*id="cookie-banner"[^>]*>', idx)
if m:
    lm = re.search(r'aria-label="([^"]+)"', m.group(0))
    label_idx = lm.group(1) if lm else None
for name in ALL:
    m = re.search(r'<div[^>]*id="cookie-banner"[^>]*>', pages[name] or '')
    tag = m.group(0) if m else ''
    lm = re.search(r'aria-label="([^"]+)"', tag)
    check(bool(m) and 'role="region"' in tag and bool(lm) and lm.group(1) == label_idx, '%s: #cookie-banner has role="region" and aria-label "%s"' % (name, label_idx), tag[:200] or 'no #cookie-banner')

# ---------------------------------------------------------------- 5. consent
section('5. Consent block in <head>')
ref_block = None
for name in ALL:
    html = pages[name] or ''
    bl = consent_blocks(html)
    if len(bl) != 1:
        bad('%s: exactly one consent default block' % name, '%d found' % len(bl))
        continue
    b, start = bl[0]
    if ref_block is None:
        ref_block = squash(b)
    else:
        check(squash(b) == ref_block, '%s: consent block identical to index.html (whitespace aside)' % name)
    head_end = html.find('</head>')
    gt = html.find('googletagmanager.com/gtag/js')
    check(0 <= start < head_end and (gt < 0 or start < gt), '%s: consent block is in <head>, before gtag.js' % name,
          'block at %d, gtag.js at %d, </head> at %d' % (start, gt, head_end))
    v = re.search(r"var\s+(\w+)\s*=\s*'denied'\s*;", b)
    var = v.group(1) if v else None
    granted_only_1 = bool(var) and re.search(r"localStorage\.getItem\(\s*'cookiesAccepted'\s*\)\s*===\s*'1'\s*\)\s*%s\s*=\s*'granted'" % var, b) and b.count("'granted'") == 1
    dm = re.search(r"gtag\(\s*'consent'\s*,\s*'default'\s*,\s*\{([^}]*)\}", b)
    d = dict(re.findall(r"(\w+)\s*:\s*('[^']*'|\w+)", dm.group(1))) if dm else {}
    check(bool(granted_only_1) and all(d.get(k) == var for k in ('ad_storage', 'ad_user_data', 'analytics_storage')),
          "%s: default is 'denied' unless cookiesAccepted === '1'" % name, json.dumps(d))
    check(d.get('ad_personalization') == "'denied'", "%s: default keeps ad_personalization 'denied'" % name, json.dumps(d))
    check(re.search(r"gtag\(\s*'set'\s*,\s*'ads_data_redaction'\s*,\s*true\s*\)", b) is not None, '%s: sets ads_data_redaction' % name)
for name in ALL + [SHARED_JS]:
    t = pages.get(name) if name in pages else read(name)
    check('url_passthrough' not in (t or ''), '%s: no url_passthrough' % name)
for name, t in (('index.html', idx), (SHARED_JS, read(SHARED_JS) or '')):
    fn = block(t, r'function\s+setCookieConsent\s*\(')
    ups = re.findall(r"gtag\(\s*'consent'\s*,\s*'update'\s*,\s*\{([^}]*)\}", t)
    check(bool(fn) and re.search(r"gtag\(\s*'consent'\s*,\s*'update'\s*,\s*\{[^}]*ad_personalization\s*:\s*'denied'", fn) is not None
          and bool(ups) and all(re.search(r"ad_personalization\s*:\s*'denied'", u) for u in ups),
          "%s: setCookieConsent's update (and every consent update) keeps ad_personalization 'denied'" % name,
          'no setCookieConsent' if not fn else '%d update call(s): %s' % (len(ups), ' | '.join(u.strip()[:100] for u in ups)))

# ---------------------------------------------------------------- 6. legal texts
section('6. Privacy policy and accessibility statement')
pv_title_idx, pv_idx = privacy(idx)
st_title_idx, st_idx, st_date_idx = statement(idx)
box = re.search(r'class="a11y-contact-box"(.*?)</div>', st_idx or '', re.S)
box = box.group(1) if box else ''
mail = re.search(r'href="mailto:([^"]+)"', box)
MAIL = mail.group(1) if mail else None
coord = re.search(r'<strong>רכז נגישות:</strong>\s*([^<]+)<', box)
COORD = coord.group(1).strip() if coord else None
phone = re.search(r'href="tel:([^"]+)"[^>]*>([^<]+)<', box)
PHONE = phone.group(2).strip() if phone else None
check(bool(MAIL and COORD and PHONE), "index.html: the statement's contact box names the coordinator, his phone and an e-mail",
      'coordinator %r, phone %r, e-mail %r' % (COORD, PHONE, MAIL), '%s, %s, %s' % (COORD, PHONE, MAIL))
DATE_PV = re.compile(r'עדכון אחרון:\s*\S+\s+\d{4}')
DATE_ST = re.compile(r'^תאריך עדכון אחרון:\s*\S+\s+\d{4}$')


def skip_text(html):
    m = re.search(r'<a[^>]*class="skip-link"[^>]*>(.*?)</a>', html, re.S)
    return text_of(m.group(1)) if m else None


def statement_known_points(html, body):
    """The statement's two page-dependent points, normalised to index.html's wording: the large-cursor item (only where the
    page's accessibility menu has that button) and the quote of the page's own skip link."""
    notes = []
    has_cursor_btn = re.search(r'data-i18n="ui_a11y_cursor"', html) is not None
    cursor_items = re.findall(r'<li>(?:(?!</li>).)*סמן גדול(?:(?!</li>).)*</li>', body, re.S)
    if bool(cursor_items) != has_cursor_btn:
        notes.append('large-cursor item %s but the menu %s that button' % ('listed' if cursor_items else 'missing', 'has' if has_cursor_btn else 'lacks'))
    for it in cursor_items:
        body = body.replace(it, '')
    sk = skip_text(html)
    q = re.search(r'קישור "([^"]+)" המופיע בעת ניווט במקלדת', body)
    if not q or q.group(1) != sk:
        notes.append('statement quotes the skip link as %r, the page says %r' % (q.group(1) if q else None, sk))
    sk_idx = skip_text(idx)
    if q and sk_idx:
        body = body.replace('"%s"' % q.group(1), '"%s"' % sk_idx)
    return body, notes


ref_st_sub = None
for name in ALL:
    html = pages[name] or ''
    pt, pv = privacy(html)
    if pv is None:
        bad('%s: privacy policy found' % name)
    else:
        if name != 'index.html':
            check(pt == pv_title_idx and squash(text_of(pv)) == squash(text_of(pv_idx)), '%s: privacy policy title and text same as index.html' % name)
        check(bool(MAIL) and ('mailto:%s' % MAIL) in pv, '%s: privacy policy names the e-mail %s' % (name, MAIL))
        check(DATE_PV.search(text_of(pv)) is not None, '%s: privacy policy has its "עדכון אחרון" line' % name)
    stt, st, sd = statement(html)
    if st is None:
        bad('%s: accessibility statement found' % name)
        continue
    norm, notes = statement_known_points(html, st)
    check(not notes, '%s: statement matches the page (large-cursor item, skip-link quote)' % name, '; '.join(notes))
    if name != 'index.html':
        if ref_st_sub is None:
            ref_st_sub = (name, squash(text_of(st)))
        else:
            check(squash(text_of(st)) == ref_st_sub[1], '%s: statement text same as %s' % (name, ref_st_sub[0]))
        check(stt == st_title_idx and squash(text_of(norm)) == squash(text_of(statement_known_points(idx, st_idx)[0])),
              '%s: statement title and text same as index.html apart from the two known points' % name)
    st_txt = text_of(st)
    check(bool(MAIL) and ('mailto:%s' % MAIL) in st and bool(COORD) and ('רכז נגישות: %s' % COORD) in st_txt and bool(PHONE) and PHONE in st_txt,
          '%s: statement names the coordinator, his phone and the e-mail' % name)
    check(bool(sd) and DATE_ST.match(sd) is not None and sd == st_date_idx, '%s: statement date line "%s"' % (name, st_date_idx), repr(sd))

# ---------------------------------------------------------------- 7. FAQ
section('7. FAQ buttons and FAQPage JSON-LD')
for name in ALL:
    html = pages[name] or ''
    ids = set(re.findall(r'\bid="([^"]+)"', html))
    btns = list(re.finditer(r'<button\b([^>]*class="[^"]*\bfaq-q\b[^"]*"[^>]*)>(.*?)</button>', html, re.S))
    badb = []
    for b in btns:
        a = b.group(1)
        c = re.search(r'aria-controls="([^"]+)"', a)
        if 'aria-expanded=' not in a or not c or c.group(1) not in ids:
            badb.append(text_of(b.group(2))[:50])
    qs = [text_of(b.group(2)) for b in btns]
    faq = [n for x in jsonld(html) for n in walk(x) if 'FAQPage' in types_of(n)]
    names = [text_of(q.get('name')) for f in faq for q in (f.get('mainEntity') or []) if isinstance(q, dict)]
    if name == 'index.html':
        check(bool(btns), 'index.html: has .faq-q buttons', '', '%d' % len(btns))
    if not btns and not faq:
        continue
    check(not badb, '%s: every .faq-q has aria-expanded and aria-controls pointing to an existing id' % name, ' | '.join(badb))
    check(qs == names, '%s: FAQPage JSON-LD lists the page\'s %d questions in the same order' % (name, len(qs)),
          'page: %s / JSON-LD: %s' % (qs, names))

# ---------------------------------------------------------------- 8. shared files
section('8. Shared CSS and JS version')
vs = {}
for name in SUBPAGES + ['404.html']:
    html = pages[name] or ''
    vs[name] = (sorted(set(re.findall(r'ardudim-sub\.css\?v=([\w.-]+)', html))), sorted(set(re.findall(r'ardudim-sub\.js\?v=([\w.-]+)', html))))
allv = {v for c, j in vs.values() for v in c + j}
check(all(len(c) == 1 and len(j) == 1 for c, j in vs.values()) and len(allv) == 1,
      'the six subpages and 404.html load %s and %s with one ?v= value' % (SHARED_CSS, SHARED_JS),
      json.dumps({k: {'css': c, 'js': j} for k, (c, j) in vs.items()}), ', '.join(sorted(allv)))

# ---------------------------------------------------------------- 9. structured data
section('9. Structured data; 404.html')
biz_ids = [n.get('@id') for x in jsonld(idx) for n in walk(x) if 'LocalBusiness' in types_of(n) and n.get('@id')]
PROVIDER = biz_ids[0] if biz_ids else None
check(bool(PROVIDER), 'index.html: LocalBusiness JSON-LD has an @id', '', PROVIDER or '')
for name in SUBPAGES:
    html = pages[name] or ''
    nodes = [n for x in jsonld(html) for n in walk(x)]
    tys = [t for n in nodes for t in types_of(n) if t]
    svc = [n for n in nodes if 'Service' in types_of(n)]
    check('BreadcrumbList' in tys and len(svc) >= 1, '%s: BreadcrumbList + Service JSON-LD' % name, str(sorted(set(tys))))
    can = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    can = can.group(1) if can else None
    if svc:
        s = svc[0]
        prov = s.get('provider')
        check(isinstance(prov, dict) and prov.get('@id') == PROVIDER, '%s: Service provider @id is %s' % (name, PROVIDER), json.dumps(prov, ensure_ascii=False)[:160])
        check(bool(can) and s.get('url') == can, '%s: Service url equals the canonical' % name, 'url %r, canonical %r' % (s.get('url'), can))
        check(bool(s.get('areaServed')), '%s: Service has areaServed' % name)
h404 = pages['404.html'] or ''
check(re.search(r'<meta name="robots" content="noindex', h404) is not None, '404.html is noindex')
rel = [u for u in re.findall(r'(?:href|src)="([^"]+)"', h404) if not re.match(r'(https?:)?//|/|#|tel:|mailto:|data:', u)]
check(not rel, '404.html has only absolute URLs', ', '.join(sorted(set(rel))[:6]))

# ---------------------------------------------------------------- 10. colours
section('10. Colour rule (a heuristic: it reads each CSS rule on its own, not the cascade)')
spec = importlib.util.spec_from_file_location('cssgrep', os.path.join(T, 'cssgrep.py'))
cg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cg)
PLAIN_BG = re.compile(r'var\(--(?:orange|q-orange|orange-dark|d-hot|whatsapp)\)|#f97316\b|#ea580c\b|#25d366\b', re.I)
WHITE = re.compile(r'(?<![-\w])color\s*:\s*(?:white|#fff(?:fff)?\b|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*1(?:\.0*)?\s*)?\))', re.I)


def colour_excluded(sel):
    return all(re.match(r'\s*(?:html(?:[.:#][\w-]+)*\s+)?body\.a11y-high-contrast\b', p) or re.search(r'(^|[\s>+~(])\.qs\b|#q-print-root', p)
               for p in sel.split(','))


for name in ('index.html', SHARED_CSS):
    t = read(name) or ''
    check(re.search(r'--orange-cta\s*:\s*#[0-9a-f]{3,6}\b', t, re.I) is not None, '%s defines --orange-cta' % name)
    blocks = [(0, t)] if name.endswith('.css') else [(m.start(1), m.group(1)) for m in re.finditer(r'<style[^>]*>(.*?)</style>', t, re.S)]
    hits, n = [], 0
    for off, css in blocks:
        for pos, ctx, sel, body in cg.rules(cg.strip_comments(css), off):
            n += 1
            bgs = ' '.join(re.findall(r'(?<![-\w])background(?:-color|-image)?\s*:\s*([^;]+)', body))
            if PLAIN_BG.search(bgs) and WHITE.search(body) and not colour_excluded(sel):
                hits.append('line %d: %s { %s }' % (t.count('\n', 0, pos) + 1, sel[:100], body[:140]))
    check(not hits, '%s: no rule sets white text on plain orange or WhatsApp green (%d rules read; heuristic)' % (name, n), ' | '.join(hits[:5]))

# ---------------------------------------------------------------- 11. against a base commit
if BASE:
    section('11. Compared with %s' % BASE)
    rv = subprocess.run(['git', '-C', ROOT, 'rev-parse', '--verify', '--quiet', BASE + '^{commit}'], capture_output=True, text=True)
    if rv.returncode != 0:
        bad('--base %s is a commit' % BASE, 'git does not know it (git fetch?)')
    else:
        idx0 = git_show(BASE, 'index.html') or ''
        p_now, p_old = block(idx, r'const PRICES\s*='), block(idx0, r'const PRICES\s*=')
        check(p_now is not None and p_now == p_old, 'index.html: const PRICES identical to %s' % BASE, 'length now %s, in %s %s' % (len(p_now or ''), BASE, len(p_old or '')))
        s_now = re.findall(r'[^\n]*SUPER_PRICE[^\n]*', idx)
        s_old = re.findall(r'[^\n]*SUPER_PRICE[^\n]*', idx0)
        check(bool(s_now) and s_now == s_old, 'index.html: every line that mentions SUPER_PRICE identical to %s (%d lines)' % (BASE, len(s_old)))
        for name in ALL + [SHARED_JS]:
            now = Counter(re.findall(WA_RX, (pages.get(name) if name in pages else read(name)) or ''))
            old_t = git_show(BASE, name)
            if old_t is None:
                ok('%s: WhatsApp numbers (not in %s, nothing to compare)' % (name, BASE), dict(now) and str(dict(now)) or '')
                continue
            old = Counter(re.findall(WA_RX, old_t))
            check(now == old, '%s: WhatsApp numbers identical to %s' % (name, BASE), 'now %s, in %s %s' % (dict(now), BASE, dict(old)), str(dict(now)) if now else 'none')

print()
print('%d checks passed, %d failed%s' % (len(oks), len(fails), ' (compared with %s)' % BASE if BASE else ''))
print('Note: the colour check is a heuristic (one CSS rule at a time); tools/audit-contrast.js measures the rendered page.')
sys.exit(1 if fails else 0)
