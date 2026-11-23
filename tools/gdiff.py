#!/usr/bin/env python3
"""python3 tools/gdiff.py [git diff arguments]   e.g.  python3 tools/gdiff.py origin/main..HEAD -- index.html
A readable `git diff -U2`: a changed line longer than 600 characters (index.html has minified one-line CSS blocks)
is shown rule by rule instead of whole, so the 52 KB line never floods the output. Run it inside the repo (it calls git).
"""
import difflib
import subprocess
import sys

LIMIT = 600


def chunks(s):
    out, cur = [], ''
    for ch in s:
        cur += ch
        if ch == '}':
            out.append(cur)
            cur = ''
    if cur:
        out.append(cur)
    return out


def show_long(old, new):
    a, b = chunks(old), chunks(new)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        ctx = (a[i1 - 1][-120:] if i1 else '')
        print('    … after: %s' % ctx.strip()[-120:])
        for x in a[i1:i2]:
            print('  [-] ' + (x if len(x) <= LIMIT else x[:LIMIT] + ' …[+%d chars]' % (len(x) - LIMIT)))
        for x in b[j1:j2]:
            print('  [+] ' + (x if len(x) <= LIMIT else x[:LIMIT] + ' …[+%d chars]' % (len(x) - LIMIT)))


def flush(minus, plus):
    longs_m = [l for l in minus if len(l) > LIMIT]
    longs_p = [l for l in plus if len(l) > LIMIT]
    for l in minus:
        if len(l) <= LIMIT:
            print('-' + l)
    for l in plus:
        if len(l) <= LIMIT:
            print('+' + l)
    for k in range(max(len(longs_m), len(longs_p))):
        o = longs_m[k] if k < len(longs_m) else ''
        n = longs_p[k] if k < len(longs_p) else ''
        print('~ long line changed (%d → %d characters), shown piece by piece:' % (len(o), len(n)))
        show_long(o, n)


def main():
    r = subprocess.run(['git', 'diff', '-U2'] + sys.argv[1:], capture_output=True)
    text = r.stdout.decode('utf-8', 'replace')
    minus, plus = [], []
    for line in text.split('\n'):
        if line.startswith('-') and not line.startswith('---'):
            minus.append(line[1:])
            continue
        if line.startswith('+') and not line.startswith('+++'):
            plus.append(line[1:])
            continue
        if minus or plus:
            flush(minus, plus)
            minus, plus = [], []
        print(line if len(line) <= LIMIT else line[:200] + ' …[context line of %d characters]' % len(line))
    if minus or plus:
        flush(minus, plus)


if __name__ == '__main__':
    main()
