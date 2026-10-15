#!/usr/bin/env python3
"""Checks that the shared subpage files still match index.html (the source of truth).

assets/ardudim-sub.css and assets/ardudim-sub.js copy parts of index.html. Every copied part sits
between an "@src index.html ..." comment and an "@end-src" comment:
  - CSS: each rule in such a section must exist in one of index.html's <style> blocks with the same
    selector, the same declarations and the same @media.
  - JS: each such section must appear in index.html word for word (whitespace aside).
Everything outside those sections is subpage-only code and is not checked.

Run from the repo root before committing a change to index.html or to the shared files:
    python3 tools/check-shared.py
Exit code 0 = all copies match. Otherwise it lists each copy that no longer matches, so the rule can
be copied again from index.html (or the difference can be made on purpose, outside the @src sections).
No build step: the site never runs this script.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), s, flags=re.S)


def norm(t):
    return re.sub(r'\s+', ' ', t).strip()


def rules(css, ctx=()):
    """Split CSS into rules; @media / @supports blocks become the context of the rules inside them."""
    s = strip_comments(css)
    i, n, out = 0, len(s), []
    while i < n:
        while i < n and s[i].isspace():
            i += 1
        if i >= n:
            break
        j = s.find('{', i)
        if j < 0:
            break
        k = s.find(';', i)
        if s[i] == '@' and 0 <= k < j:   # @import / @charset
            i = k + 1
            continue
        sel = norm(s[i:j])
        depth, p = 1, j + 1
        while p < n and depth:
            if s[p] == '{':
                depth += 1
            elif s[p] == '}':
                depth -= 1
            p += 1
        body = s[j + 1:p - 1]
        if sel.startswith(('@media', '@supports', '@layer')):
            out += rules(body, ctx + (sel,))
        else:
            out.append((ctx, sel, norm(body)))
        i = p
    return out


def main():
    index = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    index_rules = set()
    for m in re.finditer(r'<style[^>]*>(.*?)</style>', index, re.S):
        index_rules.update(rules(m.group(1)))
    index_flat = norm(index)

    problems, checked = [], 0

    css_path = os.path.join(ROOT, 'assets', 'ardudim-sub.css')
    css = open(css_path, encoding='utf-8').read()
    for m in re.finditer(r'/\*\s*@src index\.html(.*?)\*/(.*?)/\*\s*@end-src\s*\*/', css, re.S):
        label = norm(m.group(1))
        for ctx, sel, body in rules(m.group(2)):
            checked += 1
            if (ctx, sel, body) not in index_rules:
                where = (' inside ' + ' '.join(ctx)) if ctx else ''
                problems.append(f'CSS [{label}] {sel}{where}\n      {{{body[:160]}}}')

    js_path = os.path.join(ROOT, 'assets', 'ardudim-sub.js')
    js = open(js_path, encoding='utf-8').read()
    for m in re.finditer(r'/\*\s*@src index\.html(.*?)\*/(.*?)/\*\s*@end-src\s*\*/', js, re.S):
        checked += 1
        part = norm(m.group(2))
        if part and part not in index_flat:
            problems.append(f'JS  [{norm(m.group(1))}]\n      {part[:160]}')

    # pages that load the shared script must not also wire its controls with onclick= (each click would run twice)
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.html'):
            continue
        page = open(os.path.join(ROOT, name), encoding='utf-8').read()
        if re.search(r'<script[^>]+src="assets/ardudim-sub\.js', page):
            # the head scripts that run before the first paint are copied from index.html as they are
            for sid in ('ardudim-lang-boot', 'ardudim-motion-flag'):
                want = re.search(r'<script id="%s">(.*?)</script>' % sid, index, re.S)
                have = re.search(r'<script id="%s">(.*?)</script>' % sid, page, re.S)
                checked += 1
                if not want or not have or norm(want.group(1)) != norm(have.group(1)):
                    problems.append(f'HTML {name}: <script id="{sid}"> differs from index.html (or is missing)')
            for m in re.finditer(r'\sonclick=', page):
                line = page.count('\n', 0, m.start()) + 1
                problems.append(f'HTML {name}:{line} has onclick= (the shared script binds its own listeners)')

    if problems:
        print(f'{len(problems)} problems ({checked} copied parts checked):\n')
        print('\n'.join('  - ' + p for p in problems))
        sys.exit(1)
    print(f'OK: all {checked} copied parts match index.html.')


if __name__ == '__main__':
    main()
