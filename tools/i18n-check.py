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

pages = [a for a in sys.argv[1:] if not a.startswith('--')] or [p for p in PAGES if os.path.exists(os.path.join(ROOT, p))]
bad = 0
for page in pages:
    r = subprocess.run(['node', os.path.join(T, 'cdp.js'), '--root', ROOT, '--page', page, '--width', '1280', '--height', '900',
                        '--ls', 'cookiesAccepted=0', '--block', 'googletagmanager', '--eval-file', os.path.join(T, 'i18n-sync.js')],
                       capture_output=True, text=True)
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
    errs = [e for e in d.get('errors', []) if 'ERR_BLOCKED_BY_CLIENT' not in e and 'net::ERR' not in e]
    if errs:
        problems.append('console errors: ' + ' | '.join(errs[:3]))
    print('%-24s %s  (%d data-i18n elements)%s' % (page, 'ok' if not problems else 'FAIL', res['dataI18nElements'],
                                                  ''.join('\n    - ' + p[:420] for p in problems)))
    bad += bool(problems)
print('%d page(s) checked, %d with problems' % (len(pages), bad))
sys.exit(1 if bad else 0)
