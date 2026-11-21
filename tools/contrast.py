#!/usr/bin/env python3
"""python3 tools/contrast.py FG BG [FG BG ...]   e.g.  python3 tools/contrast.py "#ffffff" "#C8470B"
WCAG 2.x contrast ratio of hex colours (#RGB / #RRGGBB): PASS at 4.5:1, pass-large-only at 3:1.
"""
import sys
def lum(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la < lb: la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)
if __name__ == '__main__':
    a = sys.argv[1:]
    for i in range(0, len(a) - 1, 2):
        r = ratio(a[i], a[i + 1])
        print('%s on %s = %.2f:1 %s' % (a[i], a[i + 1], r, 'PASS(4.5)' if r >= 4.5 else ('pass-large-only(3.0)' if r >= 3 else 'FAIL')))
