#!/usr/bin/env python3
"""python3 tools/orange-scan.py FILE [FILE …]   e.g.  python3 tools/orange-scan.py index.html assets/ardudim-sub.css
Lists every CSS rule whose background is one of the oranges or one of the WhatsApp greens, with the text colour the rule
itself declares ("(inherits)" = look at the other rules of that selector / its parent). A starting inventory for the
contrast work, not a verdict: decorative shapes without text on them are listed too, and text colour can come from another rule.
Also lists inline style="" attributes and JS strings that set such a background. Uses tools/cssgrep.py (loaded by path).
"""
import importlib.util
import os
import re
import sys

spec = importlib.util.spec_from_file_location('cg', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cssgrep.py'))
cg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cg)
OR = re.compile(r'(var\(--orange\)|var\(--q-orange\)|var\(--orange-dark\)|var\(--d-hot\)|var\(--orange-deep\)|var\(--d-hot-deep\)|var\(--orange-cta\)|var\(--orange-cta-hover\)|#f97316|#ea580c|#fb923c|#c2410c|#c8470b|#b45309)', re.I)
WA = re.compile(r'(var\(--whatsapp[^)]*\)|#25d366|#128c7e|#1ebe5a|#1eb353|#20bd5a|#1da851)', re.I)


def scan(path):
    text = open(path, encoding='utf-8').read()
    if path.endswith('.css'):
        blocks = [('css', 0, text)]
    else:
        blocks = []
        for n, m in enumerate(re.finditer(r'<style([^>]*)>(.*?)</style>', text, re.S), 1):
            i = re.search(r'id="([^"]+)"', m.group(1))
            blocks.append((('#' + i.group(1)) if i else 'style %d' % n, m.start(2), m.group(2)))
    n1 = n2 = 0
    for name, off, css in blocks:
        for pos, ctx, sel, body in cg.rules(cg.strip_comments(css), off):
            bgs = ' | '.join(re.findall(r'background(?:-color|-image)?\s*:\s*([^;]+)', body))
            col = re.findall(r'(?<![-\w])color\s*:\s*([^;]+)', body)
            kind = 'ORANGE' if OR.search(bgs) else ('GREEN ' if WA.search(bgs) else None)
            if not kind:
                continue
            n1 += kind == 'ORANGE'
            n2 += kind != 'ORANGE'
            line = text.count('\n', 0, pos) + 1
            print('%s %s:%d [%s]%s\n    %s\n      background: %s ; color: %s' % (kind, os.path.basename(path), line, name, (' ' + ' / '.join(ctx)) if ctx else '', sel[:160], bgs[:150], col[-1] if col else '(inherits)'))
    if not path.endswith('.css'):
        body_wo_style = re.sub(r'<style[^>]*>.*?</style>', lambda m: '\n' * m.group(0).count('\n'), text, flags=re.S)
        for m in re.finditer(r'style="([^"]*)"', body_wo_style):
            if (OR.search(m.group(1)) or WA.search(m.group(1))) and 'background' in m.group(1):
                print('INLINE %s:%d  style="%s"' % (os.path.basename(path), body_wo_style.count('\n', 0, m.start()) + 1, m.group(1)[:200]))
        for m in re.finditer(r'(?:background|backgroundColor|cssText)\s*[:=]\s*[\'"`][^\'"`\n]{0,160}', body_wo_style):
            if OR.search(m.group(0)) or WA.search(m.group(0)):
                print('JS     %s:%d  %s' % (os.path.basename(path), body_wo_style.count('\n', 0, m.start()) + 1, m.group(0)[:200]))
    print('== %s: %d orange-background rules, %d green-background rules\n' % (path, n1, n2))


for f in sys.argv[1:]:
    scan(f)
