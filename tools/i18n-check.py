#!/usr/bin/env python3
"""python3 tools/i18n-check.py [page …]   (default: the six subpages and 404.html)
The data-i18n translation table of each subpage against its HTML: runs tools/i18n-sync.js in the page through
tools/cdp.js (headless Chromium, the repo served locally; see cdp.js for what to install) and prints one line per page.
A problem is: an element whose Hebrew in the HTML differs from the table's `he` (htmlVsDict), Hebrew text or a Hebrew
aria-label / title / alt / placeholder left anywhere in Russian mode, a data-i18n key with no Russian, a Russian
<title> or description that still has Hebrew, or a title / description that does not come back exactly in Hebrew
(the keys doc_title / doc_desc must equal the page's <title> and meta description), and console errors.
The language button's Hebrew aria-label in Russian mode ("עברית — החלפת שפה", it names the language it switches to)
is intended and does not count. index.html has the other translation system (TRANSLATIONS): see tools/ru-check.py.
A failed load (404) is named by its file: the root icons (favicon.ico, favicon-16/32.png, …) must exist too, also in a
copy of the site. A run whose browser gave no answer is tried once more. An unknown option or a page that does not
exist stops it with exit code 2.
Works from any folder: it serves the repo this file is in. Exit code 1 when a page has a problem.
"""
import json
import os
import re
import subprocess
import sys

T = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(T)
PAGES = ['tikun-dahuf.html', 'mehshvon-mehirim.html', 'azorey-sherut.html', 'chromagen.html', 'guf-himum.html', 'sanan-avnit.html', '404.html']
HE = re.compile('[֐-׿]')
INTENDED = re.compile(r'^aria-label on <button#lang-btn[.>]')

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
    r = run(['node', os.path.join(T, 'cdp.js'), '--root', ROOT, '--page', page, '--width', '1280', '--height', '900',
             '--ls', 'cookiesAccepted=0', '--block', 'googletagmanager', '--eval-file', os.path.join(T, 'i18n-sync.js')])
    try:
        d = json.loads(r.stdout)
        res = d['results'][0]
        res['dataI18nElements']
    except Exception:
        print('%-24s FAIL could not run: %s %s' % (page, r.stdout[:300].replace('\n', ' '), r.stderr[:400]))
        bad += 1
        continue
    problems = []
    if res['htmlVsDict']:
        problems.append('%d element(s) whose HTML differs from the table: %s' % (len(res['htmlVsDict']), json.dumps(res['htmlVsDict'][:2], ensure_ascii=False)))
    left = [x for x in res['hebrewLeftInRussian'] if not INTENDED.match(x)]
    if left:
        problems.append('%d Hebrew string(s) left in Russian: %s' % (len(left), ' | '.join(left[:4])))
    if res['keysWithoutRussian']:
        problems.append('key(s) without Russian: %s' % ', '.join(res['keysWithoutRussian'][:8]))
    t, dsc = res['docTitle'], res['docDesc']
    if HE.search(t.get('ru') or ''):
        problems.append('Russian <title> still has Hebrew: %s' % t.get('ru'))
    if not t.get('backToHe'):
        problems.append('<title> does not come back exactly in Hebrew (doc_title.he differs from <title>)')
    if dsc.get('ruHasHebrew'):
        problems.append('Russian meta description still has Hebrew')
    if not dsc.get('backToHe'):
        problems.append('meta description does not come back exactly in Hebrew (doc_desc.he differs from the page)')
    problems += console_problems(d.get('errors', []))
    print('%-24s %s  (%d data-i18n elements)%s' % (page, 'ok' if not problems else 'FAIL', res['dataI18nElements'],
                                                  ''.join('\n    - ' + p[:420] for p in problems)))
    bad += bool(problems)
print('%d page(s) checked, %d with problems' % (len(pages), bad))
sys.exit(1 if bad else 0)
