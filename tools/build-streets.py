# Builds admin/streets/: the streets of every town, for the street picker in the admin's "new job" steps.
#   admin/streets/<town code>.txt   one street a line:  name|other words to find it by     (a line starting with ~ is
#                                    a neighbourhood or another area, not a street)
#   admin/streets/index.js           self.ARDUDIM_STREETS = "town name:code|..."   (the names as in admin/towns.js)
#
# Source: the official street list of the Population Authority on data.gov.il (resource bf185c7f-1a4e-4662-88c5-
# fa118a244bda, "רחובות וכינויים"), as packed per town by the npm package @il-address/data (MIT): its
# generated/streets/<code>.json holds for every street the official name and its other names (aliases).
# The town codes are matched to the names of admin/towns.js through the CBS localities list (cities.csv of
# data-for-change/anyway, the same file tools/build-towns.py reads).
#
# Usage:  npm pack @il-address/data && tar -xzf il-address-data-*.tgz        (data only: nothing of it is run)
#         python3 tools/build-streets.py package/generated cities.csv admin/towns.js admin/streets
#
# Why the names are changed. The street goes to Waze as text, and Waze drives to its first match. The registry
# writes people surname first ("דיין משה"), cuts some names short ("נחום" for נחום סוקולוב) and abbreviates ("שד",
# "סמ"). Tried in Waze's own search, 13.11.2026: "דיין משה 3, גבעת שמואל" gave the same street in another town
# first, "נחום 5" gave a different street of the town (סמטת נחום), and the names as on the street signs
# ("משה דיין 3", "נחום סוקולוב 5", "סמטת הרב קוק 3") gave the right address. So the name written here is the one
# on the sign as far as the registry lets it be worked out; when it does not, the official name stays as it is.
import collections, csv, json, os, re, sys

PRE = {'שד': 'שדרות', "שד'": 'שדרות', 'שדרות': 'שדרות', 'סמ': 'סמטת', "סמ'": 'סמטת', 'סמטת': 'סמטת', 'סמטה': 'סמטת', 'סמטא': 'סמטת',
       'ככר': 'כיכר', 'כיכר': 'כיכר', 'שכ': 'שכונת', "שכ'": 'שכונת', 'שכונת': 'שכונת', 'רח': 'רחוב', "רח'": 'רחוב', 'רחוב': 'רחוב',
       'ש': 'שיכון', 'שיכון': 'שיכון', 'מד': 'מדרגות', 'מדרגות': 'מדרגות', 'דרך': 'דרך', 'מבוא': 'מבוא', 'מעלה': 'מעלה', 'שביל': 'שביל',
       'רחבת': 'רחבת', 'משעול': 'משעול', 'נתיב': 'נתיב'}
# a word that stays in front of a person's name
TITLES = set('''הרב רבי ד"ר דר' פרופ' פרופ פרופסור דוקטור האדמו"ר אדמו"ר מרן הנשיא אלוף האלוף סרן סגן רס"ן סא"ל אל"מ תא"ל רא"ל השופט השופטת רבנו רבינו
הרבי הברון ברון הברונית סר לורד דון הגאון הרבנית האחים האחיות המלך המלכה הנביא הנביאה הנדיב הצדיק הקדוש סנט האב האחות השר חכם החכם מורי
המשוררת המשורר המורה הרופא הרופאה הסופר הסופרת הצייר הציירת הפסל המלחין הזמר הזמרת השחקן השחקנית האדריכל המהנדס הטייס החלוץ השומר הרועה
המייסד הנגיד המקובל החוזה הנזיר הכהן האמן המחנך המחנכת הגננת המיילדת התנא האמורא בעל מייסדים'''.split())
# first names: a name that ends with one of them and does not start with one is a surname written first
GIVEN = set('''אברהם אברם יצחק יעקב משה אהרון אהרן דוד שלמה יוסף בנימין ראובן שמעון לוי יהודה דן נפתלי גד אשר יששכר זבולון אפרים מנשה שמואל שאול יהושע
אליהו אלישע ישעיהו ירמיהו יחזקאל הושע יואל עמוס עובדיה יונה מיכה נחום חבקוק צפניה חגי זכריה מלאכי דניאל עזרא נחמיה מרדכי אסתר רות נעמי
חנה שרה רבקה רחל לאה דבורה מרים יעל דינה תמר אביגיל מיכל חוה צפורה ציפורה יוכבד שושנה גאולה גולדה הנרייטה אנה חיה חביבה ברוריה נחמה זלדה
שולמית עפרה דליה אילנה צילה פנינה רוזה אמה אלה אנדה בלה בבה סוניה מניה מרגוט לנה אלכסנדר אלכס מנחם מאיר חיים נחמן נתן נח שלום שמשון עקיבא
הלל טוביה עמרם קלמן ליפא יחיאל אלימלך חנוך אלחנן יהונתן יונתן אבנר אוריאל רפאל מיכאל גבריאל אורי אריאל יאיר אבשלום ברוך פנחס זלמן לייב
הירש הרש וולף זאב דב דוב אריה צבי שמחה בצלאל עוזי יוני יגאל גדעון עמנואל אליעזר אלעזר ישראל חנן חנניה עזריאל עוזיאל ירוחם ישי יפתח אהוד
עלי אלקנה נריה גמליאל יוחנן מתתיהו חזקיהו חזקיה אלי איתמר איתן אמנון אמיר אסף אבי אבא אביעזר אביגדור אבינועם בנציון גרשון גרשום זרח
יהודית יוסי מוטה מוטי מוטקה נסים ניסים סעדיה עמי עמיחי פסח פרץ צדוק ציון קלונימוס רחמים שבתאי שמריהו שניאור שרגא תנחום תיאודור תאודור
רוני גיורא איסר אייזיק אליקים אלפרד אלברט אדמונד ארתור ארנסט אוטו הנרי הנריך ג'ורג' ג'ון ג'ק ז'אן לואי לאון ליאון לודוויג מקס מרטין
פאול פול פרדיננד פרנץ ריכרד רוברט רודולף זיגמונד וילהלם ויקטור ולדימיר וולטר אוסקר הרמן הוגו סלומון סמי ג'יימס צ'רלס וינסטון אורד יאנוש
רנה נועם יובל עומר נתנאל חביב סלים יקותיאל יחזקאל עזר בן-ציון שייקה אריק יהורם ספי זהר פנחס משולם זונדל מנדל מנדלי שלום-עליכם
יצחק-אייזיק חיים-נחמן יוסף-חיים אברהם-יצחק שמואל-יוסף שניאור-זלמן צבי-הירש מאיר-שמחה ישראל-מאיר עובדיה-יוסף יהושע-לייב דוד-צבי
הנריטה הנריאטה ברכה מרק מארק צביה ברל ראול רחבעם סשה יורם יחיא יחייא סטפן אמיל ינוש חייקה מכס הרשל נלי גדליה אנצו היינריך יואב הרולד עליזה
איציק ליאו קרל הנס ידידיה מרסל גרטרוד בכור בוריס ירון קדיש אנדרה צארלס הדסה מסעוד דודו אדוארד קורט הילדה סולימן אילונה אורנה אפריים
איזי בועז מישל איירין ג'וזף רוברטו אנרי דניס מישאל גיאורג איגור ג'ימס אגון איזידור נילס נדב נאדין דונלד שלדון רואלד רוזלין פייבוש
זהרה סלבדור עמירם ריצארד ארנו מילטון לורנץ מישה זליג עידן הרברט קופל סנדר כלב ליאורה תרזה זוסיה זוסיא אווה ולטר ירחמיאל אשריאל מאשה גבי
גיטל כתריאל אדי פיבל הלנה מרתה בנג'מין נתאי גיימס פליקס קונרד נלסון סטיב פטר שמאי מילכה תלמה מארי אידה ויליאם זוהרה אופירה ארצ'י דויד
אליזבת מטילדה דימיטר דני מאוריציו רפי סעדיא ז'ק ארנולד מוניה אנדרי טובה פרידריך אסא דוביד דימיטרי ציונה לובה נעמן עופרה שוש ג'ו מכלוף
דורה קמיל יוברט ליונל ג'ניה מילה אנטון שרל עדה אלישבע גוטליב ג'מיל בתיה אסנת עדנה ורדה זיוה חדוה חדווה יהודית מלכה מזל נאוה נאווה
עדינה פועה צפורה רינה שפרה תרצה אביבה אהובה אורה יונינה יפה לאה'לה מינה פרידה פרומה פייגה שיינה גיטה הינדה חנה'לה רייזל בלומה
איסר אנשל גרונם הניך וועלוול זונדל זושא זעליג חצקל טודרוס יודל יוזל יענקל ליבר מענדל מאטעס נחמיה נתנאל סנדר פישל קלמן שעיה שכנא
אהרל'ה משה'לה יוסל'ה אברמל'ה דוד'ל ברוך'ל חיימקה יצחקל'ה מוישה יענקלה שמוליק שמיל שמעלקה שלומקה שלוימה יוסקה דודל חנוך-הניך'''.split())
GIVEN -= {'יפה', 'מכלוף', 'מלכה'}  # more often a surname in a street's name: "יפה אליעזר" is אליעזר יפה
# surnames that look like initials
ACRONYM_SURNAMES = {'כ"ץ', 'ש"ץ', 'ב"ק', 'ז"ק'}
# both words are first names, so no rule can tell: the few well-known ones
KNOWN = {('אלעזר', 'דוד'): ['דוד', 'אלעזר'], ('ניסים', 'יצחק'): ['יצחק', 'ניסים']}
# a first word that is a thing, a place or a book and never a surname: "מנחת שלמה", "אור יחזקאל", "נוה יעקב"
NOUNS = set('''אור אהל אוהל בית באר גן גני גבעת הר זכרון חזון יד כרם כפר מגדל נוה נווה נחלת עין עמק קרית קריית רמת שער שערי תל תפארת נצח עטרת אהבת ברכת
חסד תורת משכן משכנות מעלות מעלה מצפה נאות קהילת שבט שבטי כנסת מלכי עץ פרי שיבת שבי אבני זכר קול מגן מעוז נר אמרי דברי ספר חפץ מנחת משנת עקדת
תולדות ישועות אגרות מצודת דרכי ברכי פני מטה מטות ילקוט אשל ברית גאון פחד פורת עצמות עיר קרן שומר אוהב אוהבי שפת נועם ויואל עולי חובבי לוחמי
גבורי גיבורי חסידי שומרי רודפי מבצע בני בנות נופי מרום מרומי מעין מעיין נחל שדרות שדות כוכב נוות טירת מושב קיבוץ קבוץ מחנה גשר צומת פארק פרדס
חורשת יער גבעה שכונת שיכון רחוב סמטת כיכר ככר מתחם אזור קבר מערת מקוה מקווה ישיבת תלמוד מדרש היכל אוצר שארית שאר אחוזת נתיב נתיבות משעול
שביל מבוא רחבת גינת חצר בוסתן מגרש בנין בניין מרכז קניון שוק תחנת עזרת ישע שמע אמונת אמונה תקות תקוות חיי חכמת בינת דעת יסוד כתר מלכות
הוד גבורת רחמי אורות נהר ים חוף מי מעיינות עינות תלמי אבן'''.split())
# part of a surname: "בן יוסף שלמה" is שלמה בן יוסף
PARTICLES = {'בן', 'בר', 'אבן', 'אבו', 'בת', 'דה', 'די', 'ון', 'פון', 'לה', 'אל', 'ואן', 'מק', 'סן', 'דל', 'דלה'}


def clean(s):
    s = re.sub(r'\)([^()]*)\(', r'(\1)', s)  # the registry writes brackets the wrong way round
    return re.sub(r'\s+', ' ', s).strip()


def split(name):
    """the kind of street (שדרות), a title (הרב), and the words of the name; what is in brackets is left out"""
    ws = re.sub(r'\([^()]*\)', ' ', clean(name)).replace('(', ' ').replace(')', ' ').split()
    pre = title = ''
    if len(ws) > 1 and ws[0] in PRE:
        pre, ws = PRE[ws[0]], ws[1:]
    if len(ws) > 1 and ws[0] in TITLES:
        title, ws = ws[0], ws[1:]
    return pre, title, ws


def join(pre, title, ws):
    # "רח הרצל" is הרצל; "רח 12" is רחוב 12
    if pre == 'רחוב' and not (ws and re.match(r'^\d', ws[0])):
        pre = ''
    return ' '.join(x for x in [pre, title, *ws] if x)


def initials(w):  # ש"י, י.ל.
    bare = re.sub(r'["\'.׳״]', '', w)
    return 1 <= len(bare) <= 2 and bare != w and w not in ACRONYM_SURNAMES


def given(w):
    return w in GIVEN or initials(w)


def nq(ws):
    return tuple(re.sub(r'["\'׳״]', '', w) for w in ws)


ELSEWHERE = {}  # a name the aliases of another town settled: "אלון יגאל" is יגאל אלון everywhere


def natural(official, aliases):
    """the name as on the street sign, as far as the official name and the aliases show it"""
    pre, title, core = split(official)
    cores = {nq(split(a)[2]) for a in aliases}
    was = tuple(core)
    if was in KNOWN:
        core = KNOWN[was]
    elif len(core) >= 2 and core[0] not in NOUNS:
        done = False
        # the surname alone is one of the aliases and the official name starts with it: "בגין מנחם" + "בגין"
        for k in range(1, len(core)):
            head, rest = core[:k], core[k:]
            if k == 1 and head[0] in PARTICLES:
                continue
            if any(given(w) for w in head) and head[0] not in PARTICLES:
                break
            if nq(head) in cores and all(given(w) for w in rest):
                core, done = rest + head, True
                break
        # the first name is last, and the registry lists the name the other way round too: "סנש חנה" + "חנה סנש"
        if not done and core[-1] in GIVEN and not given(core[0]):
            rot = core[-1:] + core[:-1]
            if (core[0] in PARTICLES and len(core) >= 3) or (core[0] not in PARTICLES and nq(rot) in cores):
                core = rot
    if tuple(core) == was and ELSEWHERE.get(was):
        core = list(ELSEWHERE[was])
    return pre, title, core


def build_town(streets):
    """[(area?, name, extra words)] for one town"""
    rows = []
    for x in streets:
        if x['code'] == 9000:  # the town itself
            continue
        pre, title, core = natural(x['nameHe'], x['aliases'])
        if not core:
            continue
        rows.append({'code': x['code'], 'pre': pre, 'title': title, 'core': core, 'aliases': [clean(a) for a in x['aliases']], 'official': clean(x['nameHe'])})
    # a one-word name that is also a word of another street of the town ("נחום" next to "סמטת נחום"): the longer
    # alias, when it is the same name with a surname or a first name added and nothing else
    words = collections.Counter()
    for r in rows:
        for w in set(nq(r['core'])):
            words[w] += 1
    for r in rows:
        core = r['core']
        if len(core) == 1 and not r['pre'] and not r['title'] and words[nq(core)[0]] > 1:
            w = core[0]
            best = None
            for a in r['aliases']:
                ap, at, ac = split(a)
                if ap or at or len(ac) != 2 or w not in ac or any(len(re.sub(r'["\'.׳״]', '', t)) < 2 for t in ac):
                    continue
                other = ac[0] if ac[1] == w else ac[1]
                if given(w) == given(other):
                    continue
                cand = [w, other] if given(w) else [other, w]
                if best is None:
                    best = cand
                elif best != cand:
                    best = False
            if best:
                r['core'] = best
        # only letters ("א ד ג"): the alias that spells the last one out ("א ד גורדון")
        if all(len(re.sub(r'["\'.׳״]', '', t)) == 1 for t in core) and len(core) >= 2:
            for a in r['aliases']:
                ac = split(a)[2]
                if len(ac) == len(core) and ac[:-1] == core[:-1] and len(ac[-1]) >= 3 and ac[-1].startswith(core[-1][0]):
                    r['core'] = ac
                    break
    out = {}
    for r in rows:
        name = join(r['pre'], r['title'], r['core'])
        if not name or len(name) > 60:
            continue
        have = set(nq(name.split()))
        extra = []
        for src in [r['official'], *r['aliases']]:
            for w in re.sub(r'[()]', ' ', src).split():
                k = nq([w])[0]
                if k in have or w in PRE or len(re.sub(r'["\'.׳״\-]', '', w)) < 2 or re.fullmatch(r'\d+', w):
                    continue
                have.add(k)
                extra.append(w)
        area = r['code'] >= 6000 or r['pre'] in ('שכונת', 'שיכון')
        if name in out:  # two entries of one name: keep the street, and the words of both
            out[name]['extra'] += [w for w in extra if w not in out[name]['extra']]
            out[name]['area'] = out[name]['area'] and area
        else:
            out[name] = {'area': area, 'extra': extra}
    return out


def main():
    gen, cities_csv, towns_js, dest = sys.argv[1:5]
    town_names = set()
    body = re.search(r'ARDUDIM_TOWNS = "(.*)";', open(towns_js, encoding='utf-8').read()).group(1)
    for s in body.split('|'):
        town_names.add(s[:s.rindex(':')])
    by_code = {}
    for r in csv.DictReader(open(cities_csv, encoding='utf-8')):
        name = re.sub(r'\s+', ' ', r['NAME'].replace('*', '')).strip()
        if name in town_names:
            by_code[str(int(r['SEMEL']))] = name
    os.makedirs(dest, exist_ok=True)
    for f in os.listdir(dest):
        if re.fullmatch(r'\d+\.txt', f):
            os.remove(os.path.join(dest, f))
    files = sorted(os.listdir(os.path.join(gen, 'streets')), key=lambda x: int(x.split('.')[0]))
    data = {f: json.load(open(os.path.join(gen, 'streets', f), encoding='utf-8')) for f in files}
    seen = collections.defaultdict(set)
    for streets in data.values():
        for x in streets:
            was = tuple(split(x['nameHe'])[2])
            now = tuple(natural(x['nameHe'], x['aliases'])[2])
            if now != was:
                seen[was].add(now)
    ELSEWHERE.update({was: next(iter(nows)) for was, nows in seen.items() if len(nows) == 1})
    index, total, size, skipped = [], 0, 0, 0
    for f in files:
        code = f.split('.')[0]
        town = by_code.get(code)
        streets = data[f]
        out = build_town(streets)
        if not town or sum(1 for v in out.values() if not v['area']) < 3:
            skipped += 1
            continue
        lines = []
        for name in sorted(out):
            v = out[name]
            assert '|' not in name and '\n' not in name and '~' not in name
            lines.append(('~' if v['area'] else '') + name + ('|' + ' '.join(v['extra'][:12]) if v['extra'] else ''))
        text = '\n'.join(lines) + '\n'
        with open(os.path.join(dest, code + '.txt'), 'w', encoding='utf-8') as o:
            o.write(text)
        index.append(f'{town}:{code}')
        total += len(lines)
        size += len(text.encode())
    manifest = json.load(open(os.path.join(gen, '..', 'manifest.json'), encoding='utf-8'))
    when = manifest['sources']['streets']['lastModified'][:10]
    with open(os.path.join(dest, 'index.js'), 'w', encoding='utf-8') as o:
        o.write('// היישובים שיש להם רשימת רחובות (streets/<קוד>.txt). נבנה על ידי tools/build-streets.py מרשימת הרחובות הרשמית\n')
        o.write(f'// של רשות האוכלוסין (data.gov.il), כפי שעודכנה ב-{when}.\n')
        o.write('self.ARDUDIM_STREETS = ' + json.dumps('|'.join(index), ensure_ascii=False) + ';\n')
    print(len(index), 'towns,', total, 'streets,', size, 'bytes;', skipped, 'towns without a list; registry of', when)


if __name__ == '__main__':
    main()
