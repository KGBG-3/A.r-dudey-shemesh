# Builds admin/towns.js: the centre of every locality in the CBS list (הלמ"ס, רשימת היישובים, via
# data-for-change/anyway static/data/cities.csv), converted from ITM to WGS84, 3 decimals.
# Usage (needs pyproj): python3 tools/build-towns.py cities.csv admin/towns.js
import csv, json, re, sys
from pyproj import Transformer

src, out = sys.argv[1], sys.argv[2]
itm = Transformer.from_crs('EPSG:2039', 'EPSG:4326', always_xy=True)
best = {}
for r in csv.DictReader(open(src, encoding='utf-8')):
    name = re.sub(r'\s+', ' ', r['NAME'].replace('*', '')).strip()
    c = (r['CENTER'] or '').strip()
    if not re.fullmatch(r'\d{10}', c):
        continue
    if r['TZURA'] in ('510', '530') or name.startswith('אזור ') or name.startswith('נפת '):
        continue  # army camps, regional zones
    x, y = int(c[:5]) * 10, int(c[5:]) * 10
    lng, lat = itm.transform(x, y)
    if not (29.3 < lat < 33.5 and 34.2 < lng < 35.95):
        print('out of range, skipped:', name, lat, lng)
        continue
    pop = int(r['POPULATION'] or 0)
    k = name
    if k not in best or pop > best[k][0]:
        best[k] = (pop, f'{lat:.3f},{lng:.3f}')
items = sorted(best.items())
body = '|'.join(f'{n}:{v[1]}' for n, v in items)
assert ':' not in ''.join(n for n, _ in items) and '|' not in ''.join(n for n, _ in items)
with open(out, 'w', encoding='utf-8') as f:
    f.write('// מרכז כל יישוב (הלמ"ס, רשימת היישובים), כדי שוויז יחפש את הרחוב ביישוב של העבודה ולא ליד הטלפון.\n')
    f.write('// Built by build-towns.py from the CBS localities list (ITM converted to WGS84). Name:lat,lng separated by |\n')
    f.write('self.ARDUDIM_TOWNS = ' + json.dumps(body, ensure_ascii=False) + ';\n')
print(len(items), 'towns,', len(body.encode()), 'bytes')
for t in ['עמנואל', 'פתח תקווה', 'רמת גן', 'אריאל', 'תל אביב -יפו', 'גבעתיים', 'קרני שומרון']:
    print(t, best[t][1])
