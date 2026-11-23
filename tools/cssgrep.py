#!/usr/bin/env python3
"""python3 tools/cssgrep.py FILE REGEX [--body]      e.g.  python3 tools/cssgrep.py index.html "#cookie-banner"
Prints every CSS rule of FILE (an .html with <style> blocks, or a .css file) whose SELECTOR matches REGEX
(with --body: whose selector OR declarations match). For each rule: line number of the rule start, the <style> block
(id or ordinal), the @media context, the selector and the declarations. Handles the minified one-line blocks of index.html.
Also imported by tools/orange-scan.py (rules(), strip_comments()). Developer tool only: the site never runs it.
"""
import re, sys

def strip_comments(s):
    return re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), s, flags=re.S)

def rules(s, base, ctx=()):
    i, n, out = 0, len(s), []
    while i < n:
        while i < n and s[i].isspace():
            i += 1
        if i >= n: break
        j = s.find('{', i)
        if j < 0: break
        k = s.find(';', i)
        if s[i] == '@' and 0 <= k < j:
            i = k + 1; continue
        sel = re.sub(r'\s+', ' ', s[i:j]).strip()
        depth, p = 1, j + 1
        while p < n and depth:
            if s[p] == '{': depth += 1
            elif s[p] == '}': depth -= 1
            p += 1
        body = s[j + 1:p - 1]
        if sel.startswith(('@media', '@supports', '@layer')):
            out += rules(body, base + j + 1, ctx + (sel,))
        else:
            out.append((base + i, ctx, sel, re.sub(r'\s+', ' ', body).strip()))
        i = p
    return out

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    path, rx = sys.argv[1], re.compile(sys.argv[2])
    both = '--body' in sys.argv[3:]
    text = open(path, encoding='utf-8').read()
    blocks = []
    if path.endswith('.css'):
        blocks.append(('css file', 0, text))
    else:
        for n, m in enumerate(re.finditer(r'<style([^>]*)>(.*?)</style>', text, re.S), 1):
            idm = re.search(r'id="([^"]+)"', m.group(1))
            blocks.append((('#' + idm.group(1)) if idm else ('style block %d' % n), m.start(2), m.group(2)))
    hits = 0
    for name, off, css in blocks:
        for pos, ctx, sel, body in rules(strip_comments(css), off):
            if rx.search(sel) or (both and rx.search(body)):
                line = text.count('\n', 0, pos) + 1
                col = pos - (text.rfind('\n', 0, pos) + 1) + 1
                print('%s:%d:%d [%s]%s\n  %s { %s }\n' % (path.split('/')[-1], line, col, name, (' ' + ' / '.join(ctx)) if ctx else '', sel, body))
                hits += 1
    print('%d rule(s)' % hits)

if __name__ == '__main__':
    main()
