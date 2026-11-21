#!/usr/bin/env python3
"""python3 tools/ru-check.py [page …]   (default: index.html, the six subpages and 404.html)
Russian coverage of the shared legal components: in Russian mode no Hebrew text (nor Hebrew aria-label / title / alt) is
left in the privacy policy (#privacy-modal), the accessibility statement (#a11y-modal), the cookie banner and the footer;
switching back gives exactly the Hebrew of before, and a second switch to Russian gives the same Russian. Also lists the
page's Russian <title> and the language button's text / aria-label in both languages, and console errors.
Runs tools/ru-check.js in each page through tools/cdp.js (headless Chromium, the repo served locally; see cdp.js for
what to install). Works from any folder: it serves the repo this file is in. Exit code 1 when something is wrong.
"""
import json
import os
import subprocess
import sys

T = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(T)
PAGES = ['index.html', 'tikun-dahuf.html', 'mehshvon-mehirim.html', 'azorey-sherut.html', 'chromagen.html', 'guf-himum.html', 'sanan-avnit.html', '404.html']
pages = [a for a in sys.argv[1:] if not a.startswith('--')] or [p for p in PAGES if os.path.exists(os.path.join(ROOT, p))]
bad = 0
for page in pages:
    r = subprocess.run(['node', os.path.join(T, 'cdp.js'), '--root', ROOT, '--page', page, '--width', '1280', '--height', '900', '--ls', 'cookiesAccepted=0',
                        '--block', 'googletagmanager', '--eval-file', os.path.join(T, 'ru-check.js')], capture_output=True, text=True)
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
    errs = [e for e in d.get('errors', []) if 'ERR_BLOCKED_BY_CLIENT' not in e and 'net::ERR' not in e]
    if errs:
        problems.append('console errors: ' + ' | '.join(errs[:3]))
    counts = ', '.join('%s %d' % (s, c['textNodes']) for s, c in res['containers'].items() if c != 'MISSING')
    print('%-24s %s  (text nodes: %s)' % (page, 'OK' if not problems else 'PROBLEMS', counts))
    print('    title in Russian: %s%s' % (res['title']['ru'][:70], '   [still Hebrew]' if res['title']['ruHasHebrew'] else ''))
    print('    language button: %s' % json.dumps(res['langBtn'], ensure_ascii=False))
    for p in problems:
        print('    - ' + p[:420])
    bad += bool(problems)
print('%d page(s) checked, %d with problems' % (len(pages), bad))
sys.exit(1 if bad else 0)
