# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ardudim.co.il — א.ר דודי שמש

Website for a family solar water heater business: installation and repair of solar water heaters, electric boilers, heat exchangers and collectors. Petah Tikva / Gush Dan, authorized Chromagen installer. Hosted on GitHub Pages (`CNAME` → ardudim.co.il, repo `KGBG-3/A.r-dudey-shemesh`).

## Stack
- Static site, no build step, no package manager, no tests: plain HTML/CSS/JS. `index.html` inlines all its CSS and JS. The restyled subpages share `assets/ardudim-sub.css` and `assets/ardudim-sub.js` (see below); their page-only code stays inline.
- Hebrew + Russian, RTL. Russian switches `dir` to `ltr`. The language choice is kept in `localStorage` `ardudim_lang` on every page; accessibility settings in `a11ySettings`; the cookie choice in `cookiesAccepted` ('1' granted, '0' denied).
- This repo is public, and the deployed branch (`main`) is the live site. Anything committed is published.

## Repo map
- `index.html` — the main page (~570 KB, single file). Sections in order: hero/quick-quote (`#q-top`), `#stats`, `#calculator`, `#reviews`, `#how`, `#repairs`, `#gallery`, `#about`, `#faq`, `#contact`. ~20 `<script>` blocks; the later ones carry ids like `ardudim-motion-js`, `ardudim-design-js`, `ardudim-quote-js`, `ardudim-booking-js`, which is how to locate them.
- Standalone landing pages in the repo root: `tikun-dahuf.html` (urgent repair), `mehshvon-mehirim.html` (calculator), `azorey-sherut.html` (service areas), `chromagen.html`, `guf-himum.html` (heating element), `sanan-avnit.html` (limescale filter). They are being moved (Oct 2026) onto the main site's design through the shared files; `tikun-dahuf.html` is done, the others still carry the old inline template until they are restyled.
- `assets/ardudim-sub.css` / `assets/ardudim-sub.js` — the subpages' design and behaviour, copied from `index.html`. PART A of the CSS and every `@src … @end-src` block of the JS are word-for-word copies of `index.html`; PART B/C and the rest are subpage-only. The subpages' `<script id="ardudim-lang-boot">` and `<script id="ardudim-motion-flag">` in `<head>` are copies of index's too. `python3 tools/check-shared.py` verifies all of it (and that pages loading the shared JS have no `onclick=`). After changing a copied part of `index.html`, copy it again and bump `?v=` in the pages.
- `solar-a7f3.html` — internal `noindex` survey/fault-map tool, not part of the public site design. `solar-a7f3.html.html` is an older variant of it (not a byte duplicate).
- `images/` — WebP for the site; the `.jpg`/`.png` siblings of gallery images are sources. `images/images/gallery-12.jpg` is a stray nested copy.
- `sitemap.xml`, `robots.txt`, `googlede5fc1679626e8d1.html` (Search Console verification) — SEO plumbing.

## Commands
No build, lint or test tooling. Useful checks:

```bash
git pull                              # always first; files are edited outside Claude too
python3 -m http.server 8080           # local preview
```

Syntax-check every inline `<script>` block of a page (JSON-LD blocks will fail this and must be checked with `JSON.parse` instead):

```bash
python3 - index.html <<'PY'
import re,sys,subprocess,tempfile
html=open(sys.argv[1],encoding='utf-8').read()
for i,m in enumerate(re.finditer(r'<script(?P<a>[^>]*)>(?P<b>.*?)</script>',html,re.S)):
    a,b=m.group('a'),m.group('b').strip()
    if 'src=' in a or not b: continue
    if 'ld+json' in a:
        import json; json.loads(b); print(i,'json-ld ok'); continue
    f=tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8'); f.write(b); f.close()
    r=subprocess.run(['node','--check',f.name],capture_output=True,text=True)
    print(i,'ok' if r.returncode==0 else r.stderr[:300])
PY
```

## Hard rules
- Never push to the deployed branch without explicit approval. Commit, show the result, wait.
- Files are also edited outside Claude between sessions (sometimes directly on GitHub; most history is "Add files via upload"). Always pull and start from the latest version; never overwrite those edits.
- Change only the section you were asked to change. No unrelated edits elsewhere in the file.
- Never minify JS: jsmin breaks Hebrew strings containing geresh (׳) and truncated the gallery JS. CSS minification with csscompressor is safe.
- Two translation systems, never mix them:
  - `index.html`: `const TRANSLATIONS` dict + `translateNodes(node, toLang)` + `toggleLang()`. Text nodes only; aria-label/title go through the separate `ATTR_RU` map (never add short strings to TRANSLATIONS: keys are replaced as substrings).
  - landing pages: `data-i18n="key"` (inner HTML) / `data-i18n-attr="aria-label:key"` + the page's `var I18N = { key: { he, ru } }`; the engine (`applyLang`/`toggleLang`) and the strings shared by all subpages (`UI`) live in `assets/ardudim-sub.js`.
- WhatsApp CTAs use the business line +972545642426 with a product-specific pre-filled message starting with "היי שלום, הגעתי מהאתר". The restyled subpages and sanan-avnit do this. `index.html` currently uses 972559976041 (hard-coded in ~15 links and in `const Q_WA`); ask Moshe which number is right before touching either.
- Never use `background-attachment: fixed` or `backdrop-filter: blur`: both cause scroll jank on mobile.
- Before a large CSS replacement, commit first (git is the backup, no `.bak` files), and afterwards confirm the modal-hiding CSS survived (`#cookie-banner`, `#a11y-panel`, `#a11y-modal`, `#privacy-modal`, `#callModal` must stay hidden by default, on index and on the subpages).
- Motion classes on `<html>`, set in `<head>` before the first paint: `js` (script runs), `calm` ("עצירת אנימציות" saved or prefers-reduced-motion: nothing moves, nothing waits to appear), `motion` (otherwise: scroll entrances). Anything hidden for an animation must live under `html.motion`, so content is visible without JS, in calm mode and in print. Every dialog: `role="dialog"`, `aria-modal`, a name, a labelled close button; focus in/trapped/returned and Escape are handled by the dialog helper (`#ardudim-dialogs-js` on index, the shared JS on subpages).

## Design direction
- The price calculator is the main thing on the site. Visitors should reach it early, before they lose interest.
- Price first (31.10.2026, Moshe): visitors should see prices and build a quote before they contact. The general WhatsApp buttons (hero, phone menu, contact, footer) carry `data-wa-ask`: until the visitor has seen a full price (`html.price-seen`: a calculator quote, or a `?q=` / `?p=` view) they open the chooser `#wa-ask` (new boiler or system → calculator · fault → WhatsApp · anything else → WhatsApp), and the floating button is "מחשבון מחיר" instead of WhatsApp. Repair links and the quote's own buttons go straight to WhatsApp. A new general WhatsApp button gets `data-wa-ask` too. Code: `#ardudim-pricefirst-css` / `#ardudim-pricefirst-js`.
- The calculator's first step shows "החל מ־₪…" on each product, computed from `PRICES` through `qModel`. Never type those numbers by hand.
- The site follows the "hot/cold" design of the new price quotes (approved Sep 2026). Keep new sections consistent with it.
- New logo since Sep 2026 (`images/logo-2026.webp`). Older quote PDFs still carry the previous logo, so never take the logo from them.

## Jobs system (1.11.2026)
Moshe and Iliya's jobs calendar replaced the Google Calendar "עבודות דודים" as the main calendar (Google keeps a copy of every scheduled job). Setup steps for Moshe: `supabase/README.md` (Hebrew).
- `admin/` — the admin app at ardudim.co.il/admin (noindex, not in the sitemap). Plain files, no build: `index.html`, `app.css`, `app.js`, `sw.js` (push alerts only, no page cache), `vendor/supabase-2.117.3.js`, `towns.js` (the name and centre of every locality, built by `tools/build-towns.py` from the CBS list; the paste reader finds the town of an address with it). The Waze button sends `q` = street, number and town only (no apartment, floor or entrance: with those in the text Waze's search matched nothing and drove to a shop near the phone). Never put a town's centre in `ll`: with `q` + `ll` + `navigate=yes` Waze drives to `ll` and ignores the text (tried 12.11.2026, every job went to the middle of its town); `ll` is only for the exact point of the address. Two logins (`moshe@` / `ilya@ardudim.co.il`, names in `assets/jobs-config.js`). Israel time everywhere, whatever the phone's zone.
- Admin in Russian (12.11.2026, for Iliya): `admin/ru.js` is a Hebrew→Russian dictionary (`words` for whole texts, `rules` for texts with a number or a name). The app keeps writing Hebrew; in Russian a MutationObserver translates every text, placeholder, aria-label and title as it reaches the screen, and `ask()` does the same for questions. Customer details carry `translate="no"`; the messages to customers, the Google Calendar copy and the phone alerts stay Hebrew. Dates come from `dayLong`/`dayShort`/`ago` in both languages. The language is per user (`lang: 'ru'` in `assets/jobs-config.js`, then the user's own choice on that phone) and switched by the button next to the name. Russian is `dir="ltr"`: keep new CSS direction-neutral (logical properties) and add each new screen text to `ru.js`.
- The simple screen (13.11.2026, for Iliya, who got lost in the long job form): `simple: true` for the user in `assets/jobs-config.js`, then the user's own choice on that phone (`setSimple`, class `simple` on `<html>`). `simpleHTML` is one list instead of the tabs (today, tomorrow, waiting for a date, later, past days not marked), every job a big card (`simpleCardHTML`) with navigation, call and done on it. A new job, and an edit, is `SHEETS.wiz`: one question on a screen (what, who, where, when, check and save) with big buttons, a pasted message read straight from the clipboard (`applyMessage`, shared with the form), towns to tap or to find in Latin or Russian letters (`townSearch`: consonant skeletons; Russian names in `ru.js` `towns`), and what is typed saved as written, in any language, except the address: in Waze's own search (13.11.2026) a street in Latin letters with the Hebrew town was found in most tries (not when the spelling followed the Russian name, "Gertsl" for Herzl, and not for a street whose full name is longer than the name in use) and a street in Russian letters was found in none of five (the town itself, another town, or nothing), so `badAddress` refuses Russian letters in the street and the town (the steps, the form and the date window) and the step says so under the field at the first such letter. A step's message is scrolled into view above the buttons (`wizErrShow`). The form and the steps build the row with the same `jobRow`. The steps are closed only by their X (it asks when something was filled in), and the phone's back button goes one step back. The full screen stays one tap away, with a bar back to the simple one for a user whose own screen it is. `interactive-widget=resizes-content` in the viewport keeps the step's buttons above the Android keyboard. Every text of these screens is in `ru.js` too.
- "מילוי הפרטים מההודעה" reads a Chromagen coordination (`parseChromagen`), a request from the site (`parseSiteMsg`), or any other message (`parseFree`: name, phone, street and town by the town list, date and time when written, price, the call-before switch; the rest goes to the notes).
- `supabase/schema.sql` — tables `jobs`, `blocks`, `settings`, `admins`, `push_subs`, `server_kv`; row rules: only `admins` read or write. Visitors may only call `public_info()`, `public_days(p_city)` (open windows + "near" per day, no personal data) and `request_job(...)`: validated and size-capped; limits of 5 an hour per visitor address (`cf-connecting-ip`, stored only as a hash), 60 an hour in all, 3 a week per phone; only the same browser (its random `p_key`, stored as md5) with the same phone can update its own open request, so nobody can overwrite or probe someone else's. Safe to run again. `functions_url()` holds the project's functions address, and the file stops with an error while it is still the placeholder.
- `supabase/functions/notify/index.ts` — Edge Function, "Verify JWT" off; every op limits itself (see its header). Push alerts (VAPID keys made on first use; new-request alerts at most one per 2 minutes, the rest summed up by the hourly run), the evening list for tomorrow, and the Google Calendar copy through a Google Apps Script web app (`admin/gcal-script.txt`, its URL + token in `settings.gcal`; the script keeps the first token it receives and then accepts only that one, so nobody copies the token by hand).
- The calculator card "רוצים לקבוע מועד?" — `#jb-slot` in `#calc-result`, `#ardudim-booking-css` / `#ardudim-booking-js` (after the price-first block; wraps `showResult` and `updateDynamicLang`). Its button is a wa.me link only once the details are complete, so the Google Ads tag counts a contact only when WhatsApp opens. It says "נשלחה" only after the database confirmed the save; otherwise it asks the visitor to press send in WhatsApp. The areas, days and hours lists in that script are the fallback copy of the database's first settings; the database's own settings win when it answers.
- The repo is public: never commit customer data (names, phones, addresses), exports or test dumps.

## Calculator pricing
- `const PRICES` holds prices INCLUDING VAT (18%), in whole ₪100. Every price on the site shows one number with "כולל מע״מ": never "+ מע״מ", never a before-VAT line, never ×1.18 in code.
- Pricing method (21.10.2026, Moshe): Chromagen = Chromagen list price −28% + parts + worker ₪300 + profit, ×1.18, rounded to ₪100. Within each product family the profit equals that of its 150 L base: solar 150 = ₪3,100, heat exchanger 150 = ₪3,700, regular copper system 150 = ₪5,100 (Chromagen, incl. VAT). A bigger size is never cheaper.
- Amisragaz stays at least ₪100 under Chromagen. Yardan stays at least ₪100 under Amisragaz. Since 22.10.2026 Yardan has an extra cut: solar 80/120/150 = 2,600/2,600/2,700, electric 120/150 = 2,600/2,700, heat exchanger 80/120/120slim/150/150slim = 3,200/3,200/3,300/3,300/3,500 (incl. VAT). A bigger size is never cheaper; equal is allowed.
- תקן systems = regular + ₪600 (iron EXTRA 200: +₪700). The new galvanized stand is included in תקן, so a תקן system shows only the pipe extra.
- Extras incl. VAT: pipe ₪70/m; new stand ₪350 (regular systems; solar "אם נדרש"); tile roof +₪200.
- Chromagen = exactly the prices in the current quotes (Drive folder "הצעות מחיר חדשות").
- Promotions go through a central `PROMOTION` config object, never by editing `PRICES`. The May 2026 campaign was removed and no `PROMOTION` object exists in the file right now; recreate it when the next promotion comes.
- After regenerating any prices, cross-check them against the `const PRICES` block before showing the result.

## Product facts (each was corrected once; don't regress)
- Chromagen manufacturer warranty: 4 years, not 5.
- Chromagen copper 150L system: 6 years on the collector, 4 years on the boiler.
- Amisragaz iron collector and system: 4 years, not 5.
- Chromagen Super: closed-loop, anti-limescale, 150L only, Chromagen only. Flat roof: horizontal on a stand; tile roof: vertical. Antifreeze fluid and a water mixer included. Piping is aluminium, not copper. Warranty: 4 years + 2 years limited, including limescale damage to the collector. Site price: ₪6,800 incl. VAT; tile roof +₪200 as usual.
- Pipe insulation does not keep the heat in. Never claim it does.

## Known pitfalls
- `goStep(4)` calls `populateTiers()`, which resets `sel.brand` to `null`. Set any forced brand selection AFTER `goStep(4)`.
- RTL: `align-items: flex-end` aligns LEFT. Use `flex-start` to align right. For left-image / right-text layouts use `row`, not `row-reverse`.
- A CSS property that seems to do nothing is usually overridden by a duplicate selector later in the file. `index.html` has three `<style>` blocks; grep the whole file for the selector.
- `fadeUp` on `.hero > *` sets `transform: translateY(0)`, which overrides `transform: translateX(-50%)` on absolutely positioned children. Fix with `animation: none !important` on those elements.

## Workflow
- Build new sections as a standalone test file first (e.g. `hero-test.html`), then integrate into `index.html`. Don't commit test files.
- Before showing a change: check tag balance, parse every JSON-LD block, run `node --check` on each `<script>` block (script above), and screenshot at 1440px (desktop) and 390px (mobile).
- Broken images in headless screenshots are expected; don't flag them. Use base64 PNG data URIs for test renders (WebP renders poorly headless). Convert real site images to WebP with Pillow.
- Site images are AI-generated by choice.
- When adding or removing a public page, update `sitemap.xml` as well.

## Copy
- Tone: professional, quiet, factual. No exclamation marks, no aggressive promises, no superlative or comparative claims. Safe phrasings: "מתקין מוסמך, לא חברה גדולה", "בלי עמלות תיווך".
