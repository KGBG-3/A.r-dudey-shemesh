#!/usr/bin/env python3
"""python3 tools/ru-check.py [page …]   (default: index.html, the six subpages and 404.html)
Russian coverage of the shared legal components: in Russian mode no Hebrew text (nor Hebrew aria-label / title / alt) is
left in the privacy policy (#privacy-modal), the accessibility statement (#a11y-modal), the cookie banner and the footer;
switching back gives exactly the Hebrew of before, and a second switch to Russian gives the same Russian. Also lists the
page's Russian <title> and the language button's text / aria-label in both languages, and console errors.
Runs tools/ru-check.js in each page through tools/cdp.js (headless Chromium, the repo served locally; see cdp.js for
what to install). A failed load (404) is named by its file: the root icons (favicon.ico, favicon-16/32.png, …) must exist too, also in a
copy of the site. A run whose browser gave no answer is tried once more. An unknown option or a page that does not
exist stops it with exit code 2.
Works from any folder: it serves the repo this file is in. Exit code 1 when something is wrong.
"""
import json
import os
import re
import subprocess
import sys

T = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(T)
PAGES = ['index.html', 'tikun-dahuf.html', 'mehshvon-mehirim.html', 'azorey-sherut.html', 'chromagen.html', 'guf-himum.html', 'sanan-avnit.html', '404.html']
args = sys.argv[1:]
opts = [a for a in args if a.startswith('-')]
if opts:
    print('unknown option(s): %s\n%s' % (' '.join(opts), __doc__))
    sys.exit(2)
nosuch = [a for a in args if not os.path.isfile(os.path.join(ROOT, re.split(r'[?#]', a)[0]))]
if nosuch:
    print('no such page in %s: %s' % (ROOT, ' '.join(nosuch)))
    sys.exit(2)
pages = args or [p for p in PAGES if os.path.exists(os.path.join(ROOT, p))]


def run(cmd):
    """cdp.js, once more when its JSON did not come (a rare hang until its hard stop, or a browser that did not start)."""
    for attempt in (1, 2):
        r = subprocess.run(cmd, capture_output=True, text=True)
        try:
            json.loads(r.stdout)
            return r
        except Exception:
            pass
    return r


def console_problems(errors):
    """Console errors, with failed loads named by their file: a 404 is a missing file (the root icons favicon.ico,
    favicon-16/32.png… too: a copy of the site needs them)."""
    errs = [e for e in errors if 'ERR_BLOCKED_BY_CLIENT' not in e and 'net::ERR' not in e]
    missing = sorted(set(re.sub(r'^https?://[^/]+', '', e.split(' @')[-1]) for e in errs if 'status of 404' in e and ' @' in e))
    other = [e for e in errs if not ('status of 404' in e and ' @' in e)]
    out = []
    if missing:
        out.append('missing file(s), 404: ' + ', '.join(missing))
    if other:
        out.append('console errors: ' + ' | '.join(other[:3]))
    return out


bad = 0
for page in pages:
    r = run(['node', os.path.join(T, 'cdp.js'), '--root', ROOT, '--page', page, '--width', '1280', '--height', '900', '--ls', 'cookiesAccepted=0',
             '--block', 'googletagmanager', '--eval-file', os.path.join(T, 'ru-check.js')])
    try:
        d = json.loads(r.stdout)
        res = d['results'][0]
    except Exception:
        print('%-24s could not run: %s %s' % (page, r.stdout[:200], r.stderr[:400]))
        bad += 1
        continue
    if not isinstance(res, dict) or 'containers' not in res:
        print('%-24s error: %s' % (page, json.dumps(res, ensure_ascii=False)[:300]))
        bad += 1
        continue
    problems = []
    for sel, c in res['containers'].items():
        if c == 'MISSING':
            problems.append('%s missing' % sel)
            continue
        if c['hebrewLeft']:
            problems.append('%s: %d Hebrew string(s) left in Russian: %s' % (sel, len(c['hebrewLeft']), ' | '.join(c['hebrewLeft'][:4])))
        if c['roundTripDiffs']:
            problems.append('%s: Hebrew differs after the round trip: %s' % (sel, json.dumps(c['roundTripDiffs'][:2], ensure_ascii=False)))
        if c['ruUnstable']:
            problems.append('%s: Russian differs on the second switch: %s' % (sel, ' | '.join(c['ruUnstable'][:2])))
    problems += console_problems(d.get('errors', []))
    counts = ', '.join('%s %d' % (s, c['textNodes']) for s, c in res['containers'].items() if c != 'MISSING')
    print('%-24s %s  (text nodes: %s)' % (page, 'OK' if not problems else 'PROBLEMS', counts))
    print('    title in Russian: %s%s' % (res['title']['ru'][:70], '   [still Hebrew]' if res['title']['ruHasHebrew'] else ''))
    print('    language button: %s' % json.dumps(res['langBtn'], ensure_ascii=False))
    for p in problems:
        print('    - ' + p[:420])
    bad += bool(problems)
print('%d page(s) checked, %d with problems' % (len(pages), bad))
sys.exit(1 if bad else 0)
