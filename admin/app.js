/* א.ר דודי שמש · מערכת העבודות (admin/)
   Phone-first jobs calendar for Moshe and Iliya: requests from the site, Chromagen coordination,
   contractor and private jobs; WhatsApp messages to customers; reminders for tomorrow; phone alerts;
   a copy of every scheduled job in the Google Calendar "עבודות דודים" (through the server function).
   Data: Supabase (supabase/schema.sql). Plain JS, no build step. */
(function () {
'use strict';

const CFG = window.ARDUDIM_JOBS || {};
const ZONE = CFG.zone || 'Asia/Jerusalem';
const SITE = 'https://ardudim.co.il/';
const ADMIN_URL = SITE + 'admin/';
const LOGO = '../images/logo-2026.webp';

// ======================================================================
// small helpers
// ======================================================================
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtNum = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36));

const ICONS = {
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  inbox: '<path d="M3 13.5 5.6 5.4A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.4L21 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M5.1 3.5h3l1.6 4.1-2.1 1.3a11.5 11.5 0 0 0 6.5 6.5l1.3-2.1 4.1 1.6v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3.1 5.7a2 2 0 0 1 2-2.2z"/>',
  nav: '<path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5z"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 8l-4 4 4 4M5 12h10"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  undo: '<path d="M9 14.5 4 9.5l5-5"/><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5v4.6h-4.6"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
};
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
const ic = (name, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const waIc = cls => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="${WA_PATH}"/></svg>`;

// ======================================================================
// time (always Israel time, whatever the phone's own zone is)
// ======================================================================
const WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const WDS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const PARTS = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function il(ms) {
  const o = {};
  for (const p of PARTS.formatToParts(new Date(ms))) o[p.type] = p.value;
  const y = +o.year, m = +o.month, d = +o.day;
  return { y, m, d, h: (+o.hour) % 24, mi: +o.minute, key: `${o.year}-${o.month}-${o.day}`, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
const offsetAt = ms => { const p = il(ms); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000; };
function zoned(key, min) {
  const [y, m, d] = key.split('-').map(Number);
  const g = Date.UTC(y, m - 1, d, 0, min);
  let t = g - offsetAt(g);
  t = g - offsetAt(t);
  return t;
}
const todayKey = () => il(Date.now()).key;
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const wdOf = key => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const dm = key => { const [, m, d] = key.split('-').map(Number); return `${d}.${m}`; };
const hm = ms => { const p = il(ms); return `${pad(p.h)}:${pad(p.mi)}`; };
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const toHHMM = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const range = (a, b) => `\u2066${a}–${b}\u2069`;
// Russian (Iliya): the same dates in his language; WD and MONTHS stay Hebrew for the messages to customers
const WD_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WDS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_RU_OF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const lng = (he, ru) => S.lang === 'ru' ? ru : he;
const AUTO = () => lng('', ' dir="auto"'); // a field for Hebrew details on the Russian screen follows what is typed in it
const wdName = i => lng(WD[i], WD_RU[i].replace(/^./, c => c.toUpperCase()));
const wdShort = i => lng(WDS[i], WDS_RU[i]);
const monthName = m => lng(MONTHS[m - 1], MONTHS_RU[m - 1]);
const dayLong = key => { const [, m, d] = key.split('-').map(Number); return lng(`יום ${WD[wdOf(key)]}, ${d} ב${MONTHS[m - 1]}`, `${wdName(wdOf(key))}, ${d} ${MONTHS_RU_OF[m - 1]}`); };
const dayShort = key => `${wdShort(wdOf(key))} ${dm(key)}`;
const relDay = key => { const t = todayKey(); return key === t ? lng('היום', 'сегодня') : key === addDays(t, 1) ? lng('מחר', 'завтра') : key === addDays(t, -1) ? lng('אתמול', 'вчера') : dayShort(key); };
const weekStart = key => addDays(key, -wdOf(key));
function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!isFinite(s)) return '';
  if (s < 90) return lng('עכשיו', 'только что');
  if (s < 3600) return lng(`לפני ${Math.round(s / 60)} דק׳`, `${Math.round(s / 60)} мин назад`);
  if (s < 86400) { const h = Math.round(s / 3600); return lng(h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`, h === 1 ? 'час назад' : `${h} ч назад`); }
  const d = Math.round(s / 86400); return d === 1 ? lng('אתמול', 'вчера') : lng(`לפני ${d} ימים`, `${d} дн. назад`);
}
const jobKey = j => j.starts_at ? il(Date.parse(j.starts_at)).key : null;
const jobTime = j => j.starts_at ? hm(Date.parse(j.starts_at)) : '';
const jobEnd = j => j.ends_at ? hm(Date.parse(j.ends_at)) : '';

// ======================================================================
// phones, areas, labels
// ======================================================================
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) d = '0' + d.slice(3);
  else if (/^5\d{8}$/.test(d)) d = '0' + d;
  return d;
}
function showPhone(p) {
  const d = normPhone(p);
  if (/^05\d{8}$/.test(d) || /^07\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (/^0[2-9]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return String(p || '');
}
function waNumber(p) { const d = normPhone(p); return d.startsWith('0') ? '972' + d.slice(1) : d; }
const waHref = (phone, text) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text || '')}`;
const telHref = phone => `tel:${normPhone(phone)}`;
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const fullAddress = j => [j.address, j.city].map(s => String(s || '').trim()).filter(Boolean).join(', ');
const cityKey = t => String(t || '').replace(/[\s\-–—־"״'׳`]/g, '');

// ---------- navigation ----------
// Waze searches for the text and drives to its first match: with "דירה 3" in it ("הרצל 32, דירה 3, אריאל") it
// matched nothing and took a shop near the phone. So Waze gets the street, number and town only.
// Never add `ll` unless it is the exact point of the address: with ll Waze drives to ll and ignores the text
// (the town's centre as ll sent every job to the middle of its town, 13.11.2026).
function navAddress(a) {
  return String(a || '')
    .replace(/(^|[\s,(])(?:מספר\s+)?(?:דירה|דיר[׳']|קומה|כניסה)\s*[:.]?\s*[\dא-ת]{0,3}[׳']?(?=$|[\s,)])/g, '$1')
    .replace(/(\d+)\s*\/\s*\d+[א-ת]?/g, '$1')
    .replace(/^\s*(?:רחוב|רח[׳'])\s+/, '')
    .split(',').map(s => s.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
}
const navQuery = j => [navAddress(j.address), String(j.city || '').trim()].filter(Boolean).join(', ');
const townKey = t => cityKey(t).replace(/יי/g, 'י').replace(/וו/g, 'ו');
const TOWN_ALIAS = [['תל אביב', 'תל אביב -יפו'], ['ת"א', 'תל אביב -יפו'], ['יפו', 'תל אביב -יפו'], ['פ"ת', 'פתח תקווה'], ['ר"ג', 'רמת גן'],
                    ['ב"ב', 'בני ברק'], ['ראשל"צ', 'ראשון לציון'], ['מודיעין', 'מודיעין-מכבים-רעות']];
let TOWNS = null;
const townName = t => String(t || '').replace(/\s+/g, ' ').trim();
function towns() {
  if (!TOWNS) {
    TOWNS = { exact: new Map(), loose: new Map(), names: new Map() };
    String(self.ARDUDIM_TOWNS || '').split('|').forEach(s => {
      const i = s.lastIndexOf(':'); if (i < 1) return;
      const n = s.slice(0, i), v = s.slice(i + 1), k = townKey(n);
      TOWNS.exact.set(townName(n), v);
      TOWNS.loose.set(k, TOWNS.loose.has(k) ? '' : v); // two towns with one spelling (צוקים, צוקי ים): only the exact name counts
      TOWNS.names.set(k, townName(n).replace(/\s+-/g, '-'));
    });
    TOWN_ALIAS.forEach(([a, b]) => {
      const v = TOWNS.exact.get(b), k = townKey(a);
      if (v && !TOWNS.loose.has(k)) { TOWNS.loose.set(k, v); TOWNS.names.set(k, TOWNS.names.get(townKey(b))); }
    });
  }
  return TOWNS;
}
// the town's name as Moshe's area lists write it, else as the CBS list does; '' when it is not a town
function townOf(s) {
  const T = towns(), n = townName(s), k = townKey(n);
  if (!k || /\d/.test(n)) return '';
  const mine = allCities().find(c => townKey(c) === k);
  if (mine) return mine;
  if (T.exact.has(n)) return n.replace(/\s+-/g, '-');
  return T.loose.get(k) ? T.names.get(k) : '';
}
const wazeHref = j => `https://waze.com/ul?q=${encodeURIComponent(navQuery(j))}&navigate=yes`;
function areaOf(city) {
  const k = cityKey(city);
  if (!k) return '';
  let best = '';
  for (const a of (S.settings.areas || [])) {
    for (const c of (a.cities || [])) {
      const ck = cityKey(c);
      if (ck === k) return a.name;
      if (!best && k.length >= 3 && ck.length >= 3 && (k.startsWith(ck) || ck.startsWith(k))) best = a.name;
    }
  }
  return best;
}
const allCities = () => (S.settings.areas || []).flatMap(a => a.cities || []);
const SOURCE = { site: 'מהאתר', chromagen: 'כרומגן', contractor: 'קבלן', private: 'פרטי' };
const STATUS = { new: 'מחכה למועד', scheduled: 'נקבע', done: 'בוצע', cancelled: 'בוטל' };
const WINDOW = { morning: 'בוקר', noon: 'צהריים', any: 'לא משנה' };
const statusLabel = j => j.status === 'new' && j.source === 'site' ? 'בקשה מהאתר' : STATUS[j.status] || j.status;
const sourceTag = j => `<span class="tag ${esc(j.source)}">${esc(j.source_name && j.source !== 'site' ? `${SOURCE[j.source] || ''} · ${j.source_name}` : SOURCE[j.source] || j.source)}</span>`;
const windowText = j => {
  const w = (S.settings.windows || {})[j.pref_window];
  return w ? `${w.he} (${range(w.from, w.to)})` : (WINDOW[j.pref_window] || '');
};
const TITLES = ['מערכת מלאה 150 ליטר', 'מערכת מלאה 120 ליטר', 'מערכת תקן 150 ליטר', 'מערכת Super 150 ליטר', 'דוד שמש 150 ליטר', 'דוד שמש 120 ליטר', 'דוד חשמל 80 ליטר', 'דוד חשמל 120 ליטר', 'מחליף חום 120 ליטר', 'מחליף חום 150 ליטר', 'קולט נחושת', 'החלפת גוף חימום', 'תיקון נזילה', 'החלפת צנרת', 'החלפת טרמוסטט', 'ביקור טכנאי'];

// ======================================================================
// state + database
// ======================================================================
const S = {
  session: null, me: null, admins: [], settings: {}, jobs: new Map(), blocks: [],
  loadedFrom: null, view: 'cal', day: todayKey(), showCancelled: false,
  stack: [], ready: false, error: '', loginUser: null, loginBusy: false, loginErr: '', lang: 'he', simple: false,
};

// ======================================================================
// language: Hebrew, or Russian (ru.js) for Iliya. The app writes Hebrew; in Russian every text that reaches the
// screen goes through the dictionary as it appears (text, placeholder, aria-label, title, dialogs). Customer
// details are marked translate="no" and stay as written, and so do the messages that go to customers.
// ======================================================================
const RU = self.ARDUDIM_RU || { words: {}, rules: [] };
const LANG_KEY = 'ardudim_admin_lang';
const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* private mode: the choice lasts this visit */ } };
function trCore(n) {
  const one = x => {
    if (RU.words[x] != null) return RU.words[x];
    for (const [re, to] of RU.rules) { const m = re.exec(x); if (m) return typeof to === 'function' ? to(m, trCore) : x.replace(re, to); }
    return null;
  };
  if (RU.words[n] != null) return RU.words[n];
  // a few sentences: each on its own ("מילאתי שם, טלפון. נשאר למלא: מה העבודה.")
  if (/[.?!]\s/.test(n)) return n.split(/(?<=[.?!])\s+/).map(trCore).join(' ');
  // the text without its final . ? ! : or a "·" before or after it (the dictionary keeps it without), then as it is
  const e = /^((?:·\s*)?)(.*?)(\s*·|[.?!:]*)$/.exec(n);
  let r = one(e[2]);
  if (r != null) return e[1] + r + e[3];
  if ((e[1] || e[3]) && (r = one(n)) != null) return r;
  // "#1016 · כרומגן", "א.ר דודי שמש · אבא", "עבודה אחת · באזור": each part on its own
  if (n.includes(' · ')) return n.split(' · ').map(trCore).join(' · ');
  return n;
}
function tr(s) {
  s = String(s == null ? '' : s);
  if (S.lang !== 'ru' || !/[א-ת]/.test(s)) return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2].replace(/\s+/g, ' ');
  const out = trCore(core);
  return out === core ? s : m[1] + out + m[3];
}
const ask = m => confirm(tr(m));
const TR_SKIP = new Set(['TEXTAREA', 'SCRIPT', 'STYLE']); // their text is not shown text (a textarea's text is its value)
const TR_ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const keepAsIs = el => !!(el && el.closest && el.closest('[translate="no"]'));
function trEl(el) {
  if (keepAsIs(el)) return;
  for (const a of TR_ATTRS) { const v = el.getAttribute(a); if (v && /[א-ת]/.test(v)) { const r = tr(v); if (r !== v) el.setAttribute(a, r); } }
}
function trText(t) {
  const p = t.parentElement;
  if (!p || TR_SKIP.has(p.tagName) || keepAsIs(p) || !/[א-ת]/.test(t.nodeValue)) return;
  const r = tr(t.nodeValue);
  if (r !== t.nodeValue) t.nodeValue = r;
}
function trTree(node) {
  if (S.lang !== 'ru' || !node) return;
  if (node.nodeType === 3) return trText(node);
  if (node.nodeType !== 1 || keepAsIs(node)) return;
  trEl(node);
  const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === 1 && n.getAttribute('translate') === 'no' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) trText(n); else trEl(n); }
}
new MutationObserver(ms => {
  if (S.lang !== 'ru') return;
  for (const m of ms) {
    if (m.type === 'childList') m.addedNodes.forEach(trTree);
    else if (m.type === 'characterData') trText(m.target);
    else trEl(m.target);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
function setLang(l, save) {
  S.lang = l === 'ru' ? 'ru' : 'he';
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ru' ? 'ltr' : 'rtl';
  document.title = S.lang === 'ru' ? 'Работы · א.ר דודי שמש' : 'עבודות · א.ר דודי שמש';
  if (save) {
    lsSet(LANG_KEY, S.lang);
    const email = S.session && S.session.user && S.session.user.email;
    if (email) lsSet(`${LANG_KEY}:${email}`, S.lang);
  }
}
// the user's own choice on this phone, else Russian for Iliya (assets/jobs-config.js), else Hebrew
const langOf = email => lsGet(`${LANG_KEY}:${email}`) || ((CFG.users || []).find(u => u.email === email) || {}).lang || 'he';
setLang(lsGet(LANG_KEY) || 'he');
// the simple screen (simpleHTML, SHEETS.wiz): `simple: true` for the user in assets/jobs-config.js, then the user's
// own choice on this phone
const SIMPLE_KEY = 'ardudim_admin_simple';
const myEmail = () => (S.session && S.session.user && S.session.user.email) || '';
const cfgUser = email => (CFG.users || []).find(u => u.email === email) || {};
const simpleOf = email => { const v = lsGet(`${SIMPLE_KEY}:${email}`); return v == null ? !!cfgUser(email).simple : v === '1'; };
function setSimple(on, save) {
  S.simple = !!on;
  document.documentElement.classList.toggle('simple', S.simple);
  if (save && myEmail()) lsSet(`${SIMPLE_KEY}:${myEmail()}`, S.simple ? '1' : '0');
}
let sb = null;
const configured = () => /^https?:\/\/\S+$/.test(String(CFG.url || '')) && !!CFG.key && !/__SUPABASE_/.test(String(CFG.url) + String(CFG.key));
if (window.supabase && configured()) {
  sb = window.supabase.createClient(String(CFG.url).replace(/\/$/, ''), CFG.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ardudim-jobs-auth' },
  });
}
const tomorrowKey = () => addDays(todayKey(), 1);
const setJob = row => { if (row && row.id) S.jobs.set(row.id, row); };

async function loadAll() {
  const from = addDays(todayKey(), -62);
  const fromIso = new Date(zoned(from, 0)).toISOString();
  const [st, ad, bl, jb] = await Promise.all([
    sb.from('settings').select('data').eq('id', 'main').maybeSingle(),
    sb.from('admins').select('user_id,name'),
    sb.from('blocks').select('*').order('day_from'),
    sb.from('jobs').select('*').or(`status.eq.new,starts_at.gte."${fromIso}"`).order('starts_at', { ascending: true }).limit(5000),
  ]);
  for (const r of [st, ad, bl, jb]) if (r.error) throw r.error;
  S.settings = (st.data && st.data.data) || {};
  S.admins = ad.data || [];
  S.blocks = bl.data || [];
  S.jobs = new Map();
  (jb.data || []).forEach(setJob);
  S.caseCol = (jb.data || []).some(r => 'case_no' in r);
  S.loadedFrom = from;
}
async function ensureFrom(key) {
  if (!S.loadedFrom || key >= S.loadedFrom) return;
  const from = addDays(key, -28);
  const { data, error } = await sb.from('jobs').select('*')
    .gte('starts_at', new Date(zoned(from, 0)).toISOString())
    .lt('starts_at', new Date(zoned(S.loadedFrom, 0)).toISOString()).limit(5000);
  if (error) throw error;
  (data || []).forEach(setJob);
  S.loadedFrom = from;
}
async function saveJob(row, id) {
  const res = id ? await sb.from('jobs').update(row).eq('id', id).select().single()
                 : await sb.from('jobs').insert(row).select().single();
  if (res.error) throw res.error;
  setJob(res.data);
  return res.data;
}
async function mergeSettings(patch) {
  const { data, error } = await sb.rpc('merge_settings', { p_patch: patch });
  if (error) throw error;
  if (data) S.settings = data;
  return S.settings;
}
async function callServer(body) {
  const { data, error } = await sb.functions.invoke('notify', { body });
  if (error) {
    let detail = '';
    try { detail = error.context && (await error.context.json()).error; } catch (_) { /* no body */ }
    throw new Error(detail || error.message || 'server');
  }
  return data || {};
}
let channel = null;
function listen() {
  if (channel || !sb) return;
  channel = sb.channel('ardudim-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, p => {
      if (p.eventType === 'DELETE') S.jobs.delete(p.old && p.old.id); else setJob(p.new);
      refresh();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, async () => {
      const { data } = await sb.from('blocks').select('*').order('day_from');
      if (data) { S.blocks = data; refresh(); }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, p => {
      if (p.new && p.new.data) { S.settings = p.new.data; refresh(); }
    })
    .subscribe();
}
let reloading = false;
async function reload(quiet) {
  if (reloading || !S.session) return;
  reloading = true;
  try { await loadAll(); S.error = ''; } catch (e) { S.error = errText(e); if (!quiet) toast(S.error); }
  reloading = false;
  refresh();
}
function errText(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'אין חיבור לאינטרנט כרגע';
  if (/JWT|token|session/i.test(m)) return 'צריך להתחבר מחדש';
  if (/row-level security|permission/i.test(m)) return 'אין הרשאה לפעולה הזו';
  return m || 'משהו השתבש';
}

// ======================================================================
// derived data
// ======================================================================
const isBlocked = key => S.blocks.find(b => key >= b.day_from && key <= (b.day_to || b.day_from)) || null;
function jobsOn(key, withCancelled) {
  return [...S.jobs.values()]
    .filter(j => j.starts_at && jobKey(j) === key && (withCancelled || j.status !== 'cancelled'))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || (a.ref - b.ref));
}
const activeOn = key => jobsOn(key).filter(j => j.status === 'scheduled' || j.status === 'done');
function requests() {
  return [...S.jobs.values()].filter(j => j.status === 'new')
    .sort((a, b) => ((b.source === 'site') - (a.source === 'site')) || (Date.parse(b.created_at) - Date.parse(a.created_at)));
}
function dayLoad(key, city) {
  const list = activeOn(key);
  const area = areaOf(city);
  const cities = [...new Set(list.map(j => j.city).filter(Boolean))];
  return { n: list.length, cities, near: !!area && list.some(j => areaOf(j.city) === area), list };
}
const adminName = id => (S.admins.find(a => a.user_id === id) || {}).name || '';

// ======================================================================
// messages to customers
// ======================================================================
const TPLS = [
  { k: 'confirm', label: 'אישור מועד' },
  { k: 'remind', label: 'תזכורת למחר' },
  { k: 'onway', label: 'בדרך אליכם' },
  { k: 'request', label: 'קיבלנו את הבקשה' },
  { k: 'review', label: 'בקשת ביקורת' },
  { k: 'free', label: 'הודעה חופשית' },
];
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
function fillTpl(tpl, j) {
  const t = j.starts_at ? Date.parse(j.starts_at) : null;
  const p = t ? il(t) : null;
  const map = {
    'שם': firstName(j.name), 'עבודה': j.title || '', 'יישוב': j.city || '', 'כתובת': fullAddress(j),
    'יום': p ? WD[p.wd] : '', 'תאריך': p ? `${p.d}.${p.m}` : '', 'משעה': t ? hm(t) : '', 'עד': j.ends_at ? hm(Date.parse(j.ends_at)) : '',
    'עסק': S.settings.business || 'א.ר דודי שמש', 'ביקורת': S.settings.reviewLink || '', 'מחיר': j.price ? '₪' + fmtNum(j.price) : '',
    'מספר': '#' + j.ref,
  };
  return String(tpl || '').replace(/\{([^{}]+)\}/g, (m, k) => (k in map ? map[k] : m))
    .replace(/[ \t]+,/g, ',').replace(/[ \t]{2,}/g, ' ');
}
const tplText = (k, j) => k === 'free' ? '' : fillTpl((S.settings.templates || {})[k] || '', j);

// ======================================================================
// reading a pasted message: Chromagen coordination, or a request sent from the site
// ======================================================================
// a water-heater size next to the product name: a number right after it ("מחליף חום 120"), or "150 ליטר" / "ליטר 150"
// nearest to it. Never the day of a date (01/04/2026) or a piece of a serial number (CH55749), and only a real size (40–500)
function sizeNear(t, from, to) {
  const real = v => +v >= 40 && +v <= 500;
  const after = /^[^\n/\\.,\d]{0,25}?(\d{2,3})(?![\d/.:])/.exec(t.slice(to));
  if (after && real(after[1])) return after[1];
  let best = null;
  for (const m of t.matchAll(/(?<![\d/.:])(\d{2,3})\s*ל(?:יטר|׳|')|ליטר\s*(\d{2,3})(?![\d/.:])/g)) {
    const v = m[1] || m[2];
    if (!real(v)) continue;
    const d = Math.min(Math.abs(m.index - from), Math.abs(m.index - to));
    if (!best || d < best.d) best = { v, d };
  }
  return best ? best.v : '';
}
function guessTitle(text, kind) {
  const t = String(text || '');
  // [what to look for, the title from it (s = the size near it); a rule that returns '' passes to the next one]
  const rules = [
    [/מערכת\s*(?:סופר|super)/i, () => 'מערכת Super'],
    [/קומפלט\s+([^\s(]+)\s*(\d{2,3})(?![\d/.:])/, m => `מערכת ${m[1]} ${m[2]}`],
    [/מערכת/, (m, s) => s ? `מערכת ${s} ליטר` : ''],
    [/מחליף(?:\s+|-)חום/, (m, s) => `מחליף חום${s ? ' ' + s + ' ליטר' : ''}`],
    [/דוד\s+חשמל/, (m, s) => `דוד חשמל${s ? ' ' + s + ' ליטר' : ''}`],
    [/דוד\s+(?:שמש\s*)?(\d{2,3})\s*ל/, m => `דוד ${m[1]} ליטר`],
    [/גוף\s+חימום/, () => 'החלפת גוף חימום'],
    [/קולט/, () => 'קולט'],
    [/פלאנג|פלאנץ/, () => 'החלפת פלאנג׳'],
    [/צנרת|צינור/, () => 'צנרת'],
    [/נזיל/, () => 'תיקון נזילה'],
    [/טרמוסטט/, () => 'טרמוסטט'],
  ];
  let title = '';
  for (const [re, f] of rules) {
    const m = re.exec(t);
    if (m) { title = f(m, sizeNear(t, m.index, m.index + m[0].length)); if (title) break; }
  }
  const service = /שירות/.test(kind || '');
  if (!title) return service ? 'שירות' : (kind || '').trim() === 'מכירה' ? 'התקנה' : (kind || '').trim();
  return service ? `שירות – ${title}` : title;
}
function parseChromagen(raw) {
  const t = String(raw || '').replace(/\r/g, '').replace(/[‎‏]/g, '');
  if (!/אצל לקוח|בתאריך|מספר מכירה|כרומגן/.test(t)) return null;
  const g = (re) => { const m = re.exec(t); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const out = { source: 'chromagen' };
  const kind = g(/תואם לך\s+(.+?)\s+אצל לקוח/);
  out.name = g(/אצל לקוח:\s*(.+?)\s*,\s*בכתובת/);
  const street = g(/בכתובת:\s*(.+?)\s*,\s*מספר בית/);
  const house = g(/מספר בית:\s*([^,]*?)\s*,/);
  const apt = g(/מספר דירה:\s*([^,]*?)\s*,/);
  out.city = g(/בעיר:\s*(.+?)\s*\.\s*טלפון/) || g(/בעיר:\s*([^.,\n]+)/);
  out.address = [street, house].filter(Boolean).join(' ') + (apt && apt !== '0' ? `, דירה ${apt}` : '');
  out.phone = showPhone(g(/טלפון:\s*([+\d][\d\s-]{7,})/));
  const dm1 = /בתאריך:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (dm1) out.date = `${dm1[3]}-${pad(dm1[2])}-${pad(dm1[1])}`;
  const f = g(/משעה:\s*(\d{1,2}:\d{2})/), to = g(/עד שעה:\s*(\d{1,2}:\d{2})/);
  if (f) out.from = toHHMM(toMin(f));
  if (to) out.to = toHHMM(toMin(to));
  out.sale_no = g(/מספר מכירה:\s*([\d,]+)/);
  // a warranty call: Chromagen's מספר פניה is CAS-225153-H5K9D9; what they ask for on the phone is the digits in the middle
  out.case_no = g(/CAS-(\d{5,8})-/i) || g(/מספר\s*פני(?:י)?ה:?\s*(\d{5,8})/);
  out.ext_link = g(/קישור לעדכון אחרי ביקור:\s*(https?:\/\/\S+)/);
  out.call_before = /התראה\s*חצי\s*שעה/.test(t);
  if (/עמידר/.test(t)) out.source_name = 'עמידר';
  let notes = g(/דגשים:\s*([\s\S]*?)(?:\.?\s*קישור לעדכון אחרי ביקור:|\s*תודה כרומגן|$)/);
  const nm = /דגשים:\s*([\s\S]*?)(?:\.?\s*קישור לעדכון אחרי ביקור:|\s*תודה כרומגן|$)/.exec(t);
  if (nm) notes = nm[1];
  notes = notes.replace(/\*{2,}\s*התראה\s*חצי\s*שעה\s*\*{2,}\.?/g, '').split(/\/\/|\\\\|\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  out.notes = [kind && !/^מכירה$/.test(kind) ? kind : '', notes].filter(Boolean).join('\n');
  out.title = guessTitle(notes, kind) + (out.source_name === 'עמידר' ? ' (עמידר)' : '');
  return (out.name || out.date || out.sale_no || out.case_no) ? out : null;
}
function parseSiteMsg(raw) {
  const t = String(raw || '').replace(/\r/g, '');
  if (!/הגעתי מהאתר|צפיתי בהצעת המחיר|ardudim\.co\.il/.test(t)) return null;
  const strip = s => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const line = re => { const m = re.exec(t); return m ? strip(m[1]) : ''; };
  const out = { source: 'site' };
  let title = line(/📋\s*(.+)/);
  const brand = line(/🏆\s*\*?חברה:\*?\s*([^(\n]+)/);
  if (title && brand && title.indexOf(brand) < 0) title += ` – ${brand}`;
  out.title = title;
  const price = /₪\s*([\d,]+)/.exec(t);
  if (price) out.price = Number(price[1].replace(/,/g, ''));
  const link = /(https:\/\/ardudim\.co\.il\/\?[pq]=[^\s*]+)/.exec(t);
  if (link) { out.quote_link = link[1]; const q = /[?&]q=([^&\s]+)/.exec(link[1]); if (q) out.quote_code = q[1]; }
  out.city = line(/📍\s*\*?יישוב:\*?\s*(.+)/);
  out.name = line(/👤\s*\*?שם:\*?\s*(.+)/);
  out.phone = showPhone(line(/📞\s*\*?טלפון:\*?\s*(.+)/));
  const ref = /#(\d{4,6})\b/.exec(t);
  if (ref) out.ref = Number(ref[1]);
  const w = line(/🕘\s*\*?שעות:\*?\s*(.+)/);
  out.pref_window = /בוקר/.test(w) ? 'morning' : /צהריים/.test(w) ? 'noon' : w ? 'any' : '';
  const days = line(/📅\s*\*?ימים(?: שנוחים לי)?:\*?\s*(.+)/);
  out.pref_days = [];
  const yNow = il(Date.now()).y;
  for (const m of days.matchAll(/(\d{1,2})\.(\d{1,2})/g)) {
    let key = `${yNow}-${pad(m[2])}-${pad(m[1])}`;
    if (key < addDays(todayKey(), -30)) key = `${yNow + 1}-${pad(m[2])}-${pad(m[1])}`;
    out.pref_days.push(key);
  }
  return out;
}

// any other message, such as a customer's details forwarded on WhatsApp ("הכתובת הרצל 7 פתח תקווה / הלקוח הוא ... / 052...").
// Each line goes to the field it fits; a line that fits none goes to the notes. The job itself is filled only when the
// message names it (guessTitle), otherwise Moshe types it.
const PHONE_RE = /(?<![\d+])(?:\+?972[-\s.]?|0)(?:5\d|7\d|[2-489])(?:[-\s.]?\d){7}(?!\d)/g;
const tidy = s => String(s || '').replace(/\s+/g, ' ').replace(/^[\s,.\-–:;]+|[\s,.\-–:;]+$/g, '');
// words that are not a customer's name (job words, greetings, verbs), with or without ה/ו/ש in front
const NOT_NAME = /(?:^|\s)[והש]?(?:דוד|דודים|שמש|מערכת|קולט|קולטים|גג|מים|חשמל|מחליף|חום|צנרת|צינור|ברז|טרמוסטט|גוף|חימום|נזילה|דולף|נוזל|תקלה|תיקון|להחליף|החלפת|התקנה|להתקין|תתקשר|להתקשר|לפני|אחרי|אתה|שאתה|מגיע|להגיע|תודה|שלום|היי|הי|בוקר|ערב|טוב|רוצה|צריך|צריכה|יש|אין|לא|כן|על|עם|קומה|דירה|בית|רחוב|כתובת|טלפון|נייד|מספר|לקוח|לקוחה|אצל|של|את|זה|זו|הוא|היא|אני|אנחנו|מחר|היום|שעה|בשעה|ליטר|כניסה|בניין|מחיר|עבודה|תאום|תיאום)(?=$|\s)/;
// right next to the phone a one-word place that is not in the area lists is a name (עדי, עומר); "פתח תקווה" or an area town is not
const looksLikeName = (s, byPhone) => s.length <= 30 && /^[א-ת][א-ת'׳"״\-]*(?:\s+[א-ת][א-ת'׳"״\-]*){0,3}$/.test(s) && !NOT_NAME.test(s)
  && (!townOf(s) || (byPhone && !/\s/.test(s) && !allCities().some(c => townKey(c) === townKey(s))));
const looksLikeStreet = s => /^(?:(?:ב?רחוב|ב?רח['׳]|ב?שד(?:רות|['׳])|ב?דרך|ב?סמטת|ב?כיכר)\s*)?[א-ת][א-ת'׳"״\-]*(?:\s+[א-ת'׳"״\-]+){0,4}\s+\d{1,4}[א-ת]?(?:\s*\/\s*\d{1,3})?(?=$|[\s,])/.test(s)
  && !/^(?:קומה|דירה|כניסה|בניין)/.test(s) && !/ליטר|₪|ש"ח|ש״ח|שקל|שעה|מחיר|דוד|מערכת|קולט|מחליף|(?:^|\s)(?:ב?יום|ב?תאריך|מועד|מחר|מחרתיים|היום)(?=$|\s)/.test(s);
// the town of an address: it comes last ("הרצל 7 פתח תקווה") or first ("בפתח תקווה ברחוב הרצל 7"), never in the
// middle, and never a street named after a town ("ירושלים 5"). Longest first: "בני ברק", not the moshav "ברק".
const STREET_WORD = /^(?:רחוב|רח['׳]|שדרות|שד['׳]|דרך|סמטת|כיכר|שכונת)$/;
function findTown(s) {
  s = String(s);
  const w = [...s.matchAll(/[^\s,]+/g)];
  const at = (i, n) => {
    const a = w[i].index, b = w[i + n - 1].index + w[i + n - 1][0].length;
    if (s.slice(a, b).includes(',')) return null;
    const raw = s.slice(a, b).replace(/^[("']+|[.!?:;)"']+$/g, ''), bare = raw.replace(/^[בלמו]-?/, '');
    if (n === 1 && (STREET_WORD.test(raw) || STREET_WORD.test(bare))) return null;
    const name = townOf(raw) || (bare !== raw && (n > 1 || bare.length >= 4) ? townOf(bare) : '');
    return name ? { name, a, b } : null;
  };
  for (let n = Math.min(4, w.length); n >= 1; n--) { const m = at(w.length - n, n); if (m) return m; }
  for (let n = Math.min(4, w.length - 1); n >= 1; n--) { const m = at(0, n); if (m && !/^\d/.test(w[n][0])) return m; }
  return null;
}
// street, number and town from "הרצל 7 פתח תקווה", "ברחוב הרצל 7 בפתח תקווה" or "פתח תקווה, הרצל 7"
function splitAddress(s) {
  const tw = findTown(s);
  let addr = tw ? s.slice(0, tw.a) + ' ' + s.slice(tw.b) : s;
  addr = tidy(addr.replace(/(^|\s)(?:ב|ב-|בעיר|ביישוב)\s*$/, '')).replace(/^(?:ב?רחוב|ב?רח['׳])\s*/, '');
  return { address: tidy(addr.split(',').map(tidy).filter(Boolean).join(', ')), city: tw ? tw.name : '' };
}
const DAYS_HE = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5 };
// a date in digits (15/11, 15.11.26) and a time (10:30, בשעה 10, בין 8 ל-12, 08:00-12:00). A day in words (מחר, ביום רביעי)
// counts only next to a time, so "תתקשר מחר" does not become the date
function whenIn(s) {
  const out = {}, hour = (h, m) => { h = +h; if (h >= 1 && h < 6) h += 12; return h >= 6 && h <= 22 && (+m || 0) < 60 ? toHHMM(h * 60 + (+m || 0)) : ''; };
  const rng = /(?:בין|משעה|מ-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:ל-?|עד(?:\s*שעה)?|[-–])\s*(\d{1,2})(?::(\d{2}))?(?![\d/.])/.exec(s)
    || /(?<![\d/.:])(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})(?![\d:])/.exec(s);
  if (rng) { out.from = hour(rng[1], rng[2]); out.to = hour(rng[3], rng[4]); }
  else {
    const one = /(?:בשעה|שעה)\s*(\d{1,2})(?::(\d{2}))?(?![\d/.])/.exec(s) || /(?<![\d/.:])(\d{1,2}):(\d{2})(?![\d:])/.exec(s);
    if (one) out.from = hour(one[1], one[2]);
  }
  if (!out.from) delete out.from;
  if (!out.to) delete out.to;
  const dm = /(?<![\d/.:])(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?![\d/.:])/.exec(s);
  if (dm && +dm[1] >= 1 && +dm[1] <= 31 && +dm[2] >= 1 && +dm[2] <= 12) {
    let y = dm[3] ? +dm[3] : il(Date.now()).y;
    if (y < 100) y += 2000;
    let key = `${y}-${pad(dm[2])}-${pad(dm[1])}`;
    if (!dm[3] && key < addDays(todayKey(), -30)) key = `${y + 1}-${pad(dm[2])}-${pad(dm[1])}`;
    out.date = key;
  } else if (out.from) {
    const rel = /(?:^|\s)(מחרתיים|מחר|היום)(?=$|[\s,.])/.exec(s);
    const day = /(?:^|\s)[בל]?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו](?=['׳]))/.exec(s);
    if (rel) out.date = addDays(todayKey(), { 'היום': 0, 'מחר': 1, 'מחרתיים': 2 }[rel[1]]);
    else if (day) out.date = addDays(todayKey(), ((DAYS_HE[day[1]] - wdOf(todayKey()) + 7) % 7) || 7);
  }
  return out;
}
const PRICE_RE = /(?:מחיר|סה"כ|סה״כ|סך\s+הכל|עלות|לשלם)\s*[:\-–]?\s*₪?\s*(\d{1,3}(?:,\d{3})+|\d{3,6})|₪\s*(\d{1,3}(?:,\d{3})+|\d{3,6})|(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:₪|ש"ח|ש״ח|שח|שקל(?:ים)?)(?![א-ת])/;
// what is left of a piece once its phone is taken out, when it only said whose phone it is ("הטלפון שלי", "נייד:")
const PHONE_LABEL = /^ו?(?:ה?טלפון|ה?נייד|ה?פלאפון|ה?סלולרי|ה?מספר|מס['׳]|טל['׳]|פלא['׳])(?:\s+(?:שלי|שלו|שלה|שלנו|הוא|היא|זה|של\s+\S+(?:\s+\S+)?))?$/;
const GREETING = /^(?:היי|הי|שלום|שלום רב|היי שלום|אהלן|בוקר טוב|ערב טוב|צהריים טובים|תודה|תודה רבה|תודה מראש|בברכה)$/;
function parseFree(raw) {
  const t = String(raw || '').replace(/\r/g, '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/[*_~]/g, '');
  const out = {}, notes = [], details = [], phones = [];
  // each line in pieces at commas and full stops (not inside a number: 4,500), so "שמי רחל, גרה ב..., הטלפון 05..." works too
  const lines = [];
  t.split('\n').forEach((line, li) => {
    const found = [];
    const marked = line.replace(PHONE_RE, m => `\u0001${found.push(m) - 1}\u0002`)
      // "טלפון:", "הנייד שלי" right before a phone only say whose phone it is
      .replace(/(?:^|\s)ו?(?:מספר\s+)?(?:ה?טלפון|ה?נייד|ה?פלאפון|ה?סלולרי|ה?מספר|מס['׳]|טל['׳]|פלא['׳])(?:\s+(?:שלי|שלו|שלה|שלנו|הוא|היא|זה))?\s*[:\-–]?\s*(?=\u0001)/g, ' ');
    marked.split(/(?<!\d),|,(?!\d)|[.!?](?=\s|$)|\s[-–]\s|(?=\u0001)|(?<=\u0002)/).forEach(part => {
      const mine = [...part.matchAll(/\u0001(\d+)\u0002/g)].map(m => found[+m[1]]);
      phones.push(...mine);
      let s = tidy(part.replace(/\u0001\d+\u0002/g, ' '));
      if (PHONE_LABEL.test(s)) s = '';
      const orig = tidy(part.replace(/\u0001(\d+)\u0002/g, (_, k) => found[+k]));
      if (orig && (mine.length || /[א-תA-Za-z0-9]/.test(s)) && !GREETING.test(s)) lines.push({ s, ph: mine.length > 0, mine, orig, li });
    });
  });
  // a piece right next to a phone on the same line ("דני כהן 052...") is the name before anything else, even a town's name (עדי)
  lines.forEach((ln, i) => { ln.byPhone = [lines[i - 1], lines[i + 1]].some(o => o && o.ph && o.li === ln.li); });
  const first = phones.length ? normPhone(phones[0]) : '', noted = new Set();
  const note = (text, li) => notes.push({ text, li });
  const LABELS = [
    ['name', /^(?:שם\s+(?:ה)?לקוח(?:ה)?\s*[:\-–]?|שם\s*[:\-–]|(?:ה)?לקוח(?:ה)?\s*(?:[:\-–]|(?:הוא|היא)(?=\s|$))|שמו\s|שמה\s|קוראים\s+(?:לו|לה)\s|איש(?:ת)?\s+(?:ה)?קשר\s*[:\-–]?)\s*(.*)$/],
    ['address', /^(?:(?:ה)?כתובת(?:\s+(?:היא|הלקוח(?:ה)?|של\s+הלקוח(?:ה)?|מגורים))?\s*[:\-–]?|גר(?:ה|ים)?\s+ב|מגיעים\s+ל)\s*(.*)$/],
    ['city', /^(?:עיר|יישוב|ישוב)\s*[:\-–]\s*(.*)$/],
    ['title', /^(?:עבודה|מוצר|סוג\s+(?:ה)?(?:עבודה|מוצר|דוד)|דגם|מה\s+צריך)\s*[:\-–]\s*(.*)$/],
    ['notes', /^(?:הערה|הערות|דגשים)\s*[:\-–]\s*(.*)$/],
  ];
  const put = (kind, v) => {
    v = tidy(v);
    if (!v) return false;
    if (kind === 'name') { if (out.name) return false; out.name = v.split(/\s+/).slice(0, 4).join(' '); return true; }
    if (kind === 'address') {
      if (out.address) return false;
      const a = splitAddress(v);
      out.address = a.address;
      if (a.city && !out.city) out.city = a.city;
      return !!(a.address || a.city);
    }
    if (kind === 'city') { if (out.city) return false; out.city = townOf(v.replace(/^[ב]-?(?=[א-ת]{4})/, '')) || townOf(v) || v; return true; }
    if (kind === 'title') { if (out.title) return false; out.title = guessTitle(v) || v; return true; }
    if (kind === 'notes') { note(v, -2); return true; }
    return false;
  };
  let pending = '';
  lines.forEach((ln, i) => {
    const s = ln.s;
    // a line with another phone ("או לבעלה 054...") stays in the notes as it was written
    const other = ln.mine.filter(m => normPhone(m) !== first);
    if (other.length && !ln.mine.some(m => normPhone(m) === first)) { other.forEach(m => noted.add(normPhone(m))); note(ln.orig, ln.li); return; }
    if (!s) return;
    if (pending) { const k = pending; pending = ''; if (put(k, s)) return; }
    for (const [kind, re] of LABELS) {
      const m = re.exec(s);
      if (!m) continue;
      if (!tidy(m[1])) { pending = kind; return; }
      if (put(kind, m[1])) return;
      break;
    }
    // call before arriving: the switch says half an hour; any other length stays in the notes too
    if (/(?:תתקשר|תתקשרו|להתקשר|תצלצל|לצלצל|תודיע|להודיע|(?:ל|ת)הרים\s+טלפון)[^\n]{0,40}?לפני/.test(s)) {
      out.call_before = true;
      if (/(?:^|\s)(?:שעה|שעתיים|רבע\s+שעה|\d+\s*דק)/.test(s) && !/חצי\s*שעה/.test(s)) note(s, ln.li);
      return;
    }
    if (/^(?:קומה|דירה|כניסה|בניין)\s/.test(s)) { details.push(s); return; }
    if (!out.address && (looksLikeStreet(s) || (/\d/.test(s) && looksLikeStreet(splitAddress(s).address))) && put('address', s)) return;
    const w = whenIn(s);
    if (w.date || w.from) {
      if (w.date && !out.date) out.date = w.date;
      if (w.from && !out.from) { out.from = w.from; if (w.to) out.to = w.to; }
      const rest = s.replace(/(?:^|\s)(?:ב?יום|ב?תאריך|מועד|בשעה|שעה|בין|משעה|עד|ל-?|ב-?|בבוקר|בצהריים|אחה"צ|אחה״צ|בערב|מחרתיים|מחר|היום|ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו]['׳])(?=$|\s)/g, ' ')
        .replace(/[\d:./\-–]+/g, ' ');
      if (tidy(rest).split(' ').filter(x => x.length > 1).length >= 2) note(s, ln.li);
      return;
    }
    const me = /^(?:(?:היי|הי|שלום)[,!.]?\s*)?(?:אני|שמי|קוראים\s+לי)\s+(.+)$/.exec(s);
    if (me && !out.name && looksLikeName(tidy(me[1]), true)) { out.name = tidy(me[1]); return; }
    if (!out.name && ln.byPhone && looksLikeName(s, true)) { out.name = s; return; }
    if (!out.city) { const c = townOf(s) || townOf(s.replace(/^ב-?/, '')); if (c && s.split(' ').length <= 4) { out.city = c; return; } }
    const nearPhone = (lines[i - 1] && lines[i - 1].ph) || (lines[i + 1] && lines[i + 1].ph);
    if (!out.name && nearPhone && looksLikeName(s)) { out.name = s; return; }
    const pr = PRICE_RE.exec(s);
    if (pr && out.price == null) {
      out.price = Number((pr[1] || pr[2] || pr[3]).replace(/,/g, ''));
      if (tidy(s.replace(pr[0], ' ')).split(' ').filter(x => x.length > 1).length < 2) return;
    }
    note(s, ln.li);
  });
  if (phones.length) out.phone = showPhone(phones[0]);
  [...new Set(phones.map(normPhone))].filter(p => p !== first && !noted.has(p)).forEach(p => note(`טלפון נוסף: ${showPhone(p)}`, -1));
  if (details.length) out.address = [out.address, ...details].filter(Boolean).join(', ');
  if (!out.title) { const g = guessTitle(t); if (g) out.title = g; }
  // pieces of one line that all went to the notes are put back together
  const joined = [];
  const phoneOnly = x => /^[+\d][\d\s.\-]+$/.test(x);
  notes.forEach(n => {
    const last = joined[joined.length - 1];
    if (last && n.li >= 0 && last.li === n.li) last.text += (phoneOnly(n.text) || phoneOnly(last.text) ? ' ' : ', ') + n.text;
    else joined.push({ ...n });
  });
  out.notes = [...new Set(joined.map(n => n.text))].join('\n');
  return (out.phone || out.name || out.address || out.city || out.date) ? out : null;
}

// a pasted message into the values of a job (the form, or the steps of the simple screen): a Chromagen coordination,
// a request from the site, or any other message. null when nothing was found; { existing } when that request from
// the site is already saved; else { found }: the note that says what was filled and what is left.
function applyMessage(raw, v) {
  const c = parseChromagen(raw), s = c ? null : parseSiteMsg(raw), fr = c || s ? null : parseFree(raw);
  const p = c || s || fr;
  if (!p) return null;
  if (s) {
    const ph = normPhone(s.phone);
    const ex = [...S.jobs.values()].find(j => (s.ref && j.ref === s.ref) || (ph.length >= 9 && j.source === 'site' && j.status === 'new' && j.phone_norm === ph));
    if (ex) return { existing: ex };
  }
  // a second message adds to the notes of the first (the customer's details, then the day from Iliya)
  if (fr && fr.notes && v.notes && !v.notes.includes(fr.notes)) fr.notes = `${v.notes}\n${fr.notes}`;
  for (const k of ['source', 'source_name', 'title', 'name', 'phone', 'city', 'address', 'date', 'from', 'to', 'sale_no', 'case_no', 'ext_link', 'notes', 'quote_link', 'quote_code', 'pref_window']) {
    if (p[k] != null && p[k] !== '') v[k] = p[k];
  }
  if (p.price != null) v.price = p.price;
  if (p.call_before) v.call_before = true;
  if (p.pref_days && p.pref_days.length) v.pref_days = p.pref_days;
  const got = [p.name && 'שם', p.phone && 'טלפון', (p.city || p.address) && 'כתובת', p.date && (p.from ? 'תאריך ושעה' : 'תאריך'), !p.date && p.from && 'שעה',
    p.sale_no && 'מספר מכירה', p.case_no && 'מספר פניה', p.title && 'עבודה', fr && p.price != null && 'מחיר', fr && p.call_before && 'להתקשר לפני', fr && p.notes && 'הערות'].filter(Boolean);
  if (!fr) return { found: `${c ? 'הודעת כרומגן' : 'הודעה מהאתר'}: מילאתי ${got.join(', ')}. כדאי לעבור על הפרטים לפני השמירה.` };
  const left = [!v.title && 'מה העבודה', !v.date && 'תאריך'].filter(Boolean);
  const dateNote = !p.date && v.date ? ` התאריך לא כתוב בהודעה, כרגע ${dayShort(v.date)}.` : '';
  const ph = normPhone(v.phone), twin = ph.length >= 9 && [...S.jobs.values()].find(j => j.phone_norm === ph && (j.status === 'new' || j.status === 'scheduled'));
  return { found: `מילאתי ${got.join(', ')}.${left.length ? ` נשאר למלא: ${left.join(', ')}.` : ''}${dateNote}${twin ? ` שימו לב: כבר יש עבודה פתוחה עם הטלפון הזה (#${twin.ref}).` : ''} כדאי לעבור על הפרטים לפני השמירה.` };
}

// ======================================================================
// rendering
// ======================================================================
const root = $('#app');
function refresh() {
  if (!S.session) return renderLogin();
  if (!S.ready) { root.innerHTML = `${topbarHTML()}<div class="loading">טוען…</div>`; return; }
  const y = window.scrollY;
  root.innerHTML = topbarHTML() + bannerHTML() + (S.simple ? `<main class="view" id="main">${simpleHTML()}</main>` + simpleBarHTML()
    : backToSimpleHTML() + `<main class="view" id="main">${viewHTML()}</main>` + tabbarHTML());
  window.scrollTo(0, y);
  const top = S.stack[S.stack.length - 1];
  if (top && top.live) renderSheet(false);
}
function topbarHTML() {
  return `<header class="topbar"><div class="brand"><img src="${LOGO}" alt=""><div><h1>עבודות</h1><small>א.ר דודי שמש${S.me ? ' · ' + esc(S.me.name) : ''}</small></div></div>
<div class="tb-actions"><button type="button" class="tb-btn tb-lang" data-act="lang" translate="no" lang="${lng('ru', 'he')}">${lng('Русский', 'עברית')}</button>
${S.simple ? '' : `<button type="button" class="tb-btn" data-act="search" aria-label="חיפוש עבודה">${ic('search')}</button>`}</div></header>`;
}
function bannerHTML() {
  if (S.error) return `<div class="banner err" role="alert">${esc(S.error)} <button type="button" class="btn sm ghost" data-act="reload">${ic('refresh', 'sm')}נסו שוב</button></div>`;
  const g = S.settings.gcal || {};
  const bad = [...S.jobs.values()].filter(j => g.enabled && /^error/.test(j.gcal_state || '') && j.status !== 'cancelled').length;
  if (bad) return `<div class="banner warn">${bad === 1 ? 'עבודה אחת לא הועתקה' : bad + ' עבודות לא הועתקו'} ליומן גוגל. <button type="button" class="btn sm ghost" data-act="set-gcal">לבדיקה</button></div>`;
  return '';
}
function tabbarHTML() {
  const n = requests().filter(j => j.source === 'site').length;
  const tab = (v, icon, label, extra) => `<button type="button" class="tab" data-act="view" data-v="${v}"${S.view === v ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${extra || ''}</button>`;
  return `<button type="button" class="fab" data-act="new-job" aria-label="עבודה חדשה">${ic('plus')}</button>
<nav class="tabbar" aria-label="מסכים"><div class="inner">
${tab('cal', 'cal', 'יומן')}${tab('req', 'inbox', 'בקשות', n ? `<span class="badge" aria-label="${n} בקשות">${n}</span>` : '')}${tab('tom', 'moon', 'מחר')}${tab('set', 'gear', 'הגדרות')}
</div></nav>`;
}
function viewHTML() {
  if (S.view === 'req') return requestsHTML();
  if (S.view === 'tom') return tomorrowHTML();
  if (S.view === 'set') return settingsHTML();
  return calendarHTML();
}

// ---------- calendar ----------
function calendarHTML() {
  const ws = weekStart(S.day), t = todayKey();
  const [y, m] = S.day.split('-').map(Number);
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const k = addDays(ws, i), n = activeOn(k).length, off = isBlocked(k) || !((S.settings.workDays || {})[wdOf(k)] || []).length;
    cells += `<button type="button" class="day${k === t ? ' today' : ''}${off ? ' off' : ''}" data-act="day" data-k="${k}" aria-pressed="${k === S.day}" aria-label="${esc(dayLong(k))}${n ? `, ${n} עבודות` : ''}">
<span class="w">${wdShort(i)}</span><span class="n">${Number(k.slice(8))}</span><span class="c">${n || ''}</span></button>`;
  }
  const list = jobsOn(S.day, S.showCancelled);
  const active = list.filter(j => j.status !== 'cancelled');
  const cancelledN = jobsOn(S.day, true).length - jobsOn(S.day).length;
  const blk = isBlocked(S.day);
  const cities = [...new Set(active.map(j => j.city).filter(Boolean))];
  const routeOk = active.filter(j => fullAddress(j)).length >= 1;
  return `<div class="weeknav">
<button type="button" class="iconbtn" data-act="week" data-d="-7" aria-label="שבוע קודם">${ic(lng('right', 'left'))}</button>
<h2>${monthName(m)} ${y}</h2>
${S.day !== t ? `<button type="button" class="btn sm ghost" data-act="day" data-k="${t}">היום</button>` : ''}
<button type="button" class="iconbtn" data-act="week" data-d="7" aria-label="שבוע הבא">${ic(lng('left', 'right'))}</button>
</div>
<div class="week">${cells}</div>
<div class="dayhead"><div class="t"><h2>${esc(dayLong(S.day))}</h2>
<div class="meta">${active.length ? `${active.length === 1 ? 'עבודה אחת' : active.length + ' עבודות'}${cities.length ? ` · <span translate="no">${esc(cities.join(', '))}</span>` : ''}` : 'אין עבודות'}</div></div>
${routeOk ? `<a class="btn sm ghost" href="${esc(routeHref(active))}" target="_blank" rel="noopener">${ic('map', 'sm')}מסלול</a>` : ''}</div>
${blk ? `<div class="dayoff" style="margin-top:10px">יום חופש${blk.reason ? ': ' + esc(blk.reason) : ''}</div>` : ''}
<div class="agenda">${list.length ? list.map(jobCardHTML).join('') : `<div class="empty"><b>היום הזה פנוי</b>אפשר להוסיף עבודה עם הכפתור הכתום</div>`}</div>
${cancelledN ? `<button type="button" class="btn sm ghost" style="margin-top:10px" data-act="toggle-cancelled">${S.showCancelled ? 'להסתיר את מה שבוטל' : `להציג ${cancelledN === 1 ? 'עבודה שבוטלה' : cancelledN + ' עבודות שבוטלו'}`}</button>` : ''}`;
}
function routeHref(list) {
  const stops = list.filter(j => j.status === 'scheduled' || j.status === 'done').map(navQuery).filter(Boolean);
  if (!stops.length) return '#';
  const dest = stops[stops.length - 1], way = stops.slice(0, -1).slice(0, 8);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(dest)}${way.length ? '&waypoints=' + encodeURIComponent(way.join('|')) : ''}`;
}
function jobCardHTML(j) {
  const flags = [];
  if (j.call_before && j.status === 'scheduled') flags.push(`<span class="flag">${ic('phone', 'sm')}להתקשר חצי שעה לפני</span>`);
  if (j.status === 'done') flags.push(`<span class="pill done">בוצע</span>`);
  if (j.status === 'cancelled') flags.push(`<span class="pill cancelled">בוטל</span>`);
  return `<button type="button" class="job src-${esc(j.source)}${j.status === 'done' ? ' is-done' : ''}${j.status === 'cancelled' ? ' is-cancelled' : ''}" data-act="open-job" data-id="${esc(j.id)}">
<span class="time">${esc(jobTime(j))}<small>${esc(jobEnd(j))}</small></span>
<span class="ttl">${esc(j.title || 'עבודה')}</span>
<span class="where" translate="no">${j.city ? `<b>${esc(j.city)}</b>` : ''}${j.address ? ' · ' + esc(j.address) : ''}</span>
<span class="who">${j.name ? `<span translate="no">${esc(j.name)}</span>` : ''}${sourceTag(j)}${flags.join('')}</span>
</button>`;
}

// ---------- requests ----------
function requestsHTML() {
  const list = requests();
  const site = list.filter(j => j.source === 'site'), other = list.filter(j => j.source !== 'site');
  return `<div class="sec-title" style="margin-top:2px"><h2>בקשות מהאתר</h2><span class="hint">${site.length ? site.length + ' מחכות למועד' : ''}</span></div>
<div class="list">${site.length ? site.map(reqCardHTML).join('') : `<div class="empty"><b>אין בקשות חדשות</b>כשמישהו יבחר יישוב ומועד במחשבון באתר, הבקשה תופיע כאן</div>`}</div>
${other.length ? `<div class="sec-title"><h2>עבודות בלי מועד</h2><span class="hint">${other.length}</span></div><div class="list">${other.map(reqCardHTML).join('')}</div>` : ''}`;
}
function prefsHTML(j) {
  if (!j.pref_days || !j.pref_days.length) return '';
  return `<div class="prefs">${j.pref_days.map(k => {
    const L = dayLoad(k, j.city), blk = isBlocked(k);
    const load = blk ? 'יום חופש' : L.n ? `${L.n === 1 ? 'עבודה אחת' : L.n + ' עבודות'}${L.near ? ' · באזור' : ''}` : 'פנוי';
    return `<span class="pref"><b>${esc(dayShort(k))}</b><span class="load${L.near ? ' near' : ''}">${esc(load)}</span></span>`;
  }).join('')}${j.pref_window ? `<span class="pref"><b>${esc(WINDOW[j.pref_window] || '')}</b><span class="load">${esc(windowText(j).replace(/^[^(]*\(|\)$/g, '') || 'כל היום')}</span></span>` : ''}</div>`;
}
function reqCardHTML(j) {
  const area = areaOf(j.city);
  return `<article class="req" aria-label="בקשה ${esc(j.ref)}">
<div class="head"><span class="num">#${esc(j.ref)}</span>${sourceTag(j)}<span>${esc(ago(j.created_at))}</span></div>
<button type="button" class="linkbtn ttl" data-act="open-job" data-id="${esc(j.id)}">${esc(j.title || 'בקשה')}</button>
${j.price ? `<div class="price num">₪${fmtNum(j.price)}</div>` : ''}
<div class="city">${j.city ? `<b translate="no">${esc(j.city)}</b>` : '<span class="muted">בלי יישוב</span>'}${area ? ` <span class="muted small" translate="no">· ${esc(area)}</span>` : (j.city ? ' <span class="tag">מחוץ לרשימת האזורים</span>' : '')}</div>
${prefsHTML(j)}
<div class="small"><span translate="no">${esc(j.name || '')}</span>${j.phone ? ` · <a href="${esc(telHref(j.phone))}" class="ltr">${esc(showPhone(j.phone))}</a>` : ''}</div>
<div class="row-btns req-btns"><button type="button" class="btn primary sm" data-act="schedule" data-id="${esc(j.id)}">${ic('cal', 'sm')}קביעת מועד</button>
${j.phone ? `<button type="button" class="btn wa sm" data-act="wa" data-id="${esc(j.id)}" data-tpl="${j.source === 'site' ? 'request' : 'free'}">${waIc('sm')}וואטסאפ</button>` : ''}
<button type="button" class="btn ghost sm" data-act="open-job" data-id="${esc(j.id)}">פרטים</button></div>
</article>`;
}

// ---------- tomorrow ----------
function tomorrowHTML() {
  const k = tomorrowKey(), list = jobsOn(k).filter(j => j.status === 'scheduled');
  const sent = list.filter(j => j.reminded_at).length;
  return `<div class="sec-title" style="margin-top:2px"><h2>${lng('מחר, ', 'Завтра, ')}${esc(lng(dayLong(k).replace(/^יום /, ''), dayLong(k).replace(/^./, c => c.toLowerCase())))}</h2><span class="hint">${list.length ? `${sent}/${list.length} תזכורות נשלחו` : ''}</span></div>
${list.length && list.some(j => fullAddress(j)) ? `<a class="btn ghost block" style="margin-top:10px" href="${esc(routeHref(list))}" target="_blank" rel="noopener">${ic('map')}המסלול של מחר בגוגל מפות</a>` : ''}
<div class="list">${list.length ? list.map(j => `<article class="tm">
<div class="top"><span class="time">${esc(jobTime(j))}–${esc(jobEnd(j))}</span><div style="flex:1;min-width:0"><button type="button" class="linkbtn" data-act="open-job" data-id="${esc(j.id)}">${esc(j.title || 'עבודה')}</button>
<div class="small" translate="no">${j.city ? `<b>${esc(j.city)}</b>` : ''}${j.address ? ' · ' + esc(j.address) : ''}</div>
<div class="small muted"><span translate="no">${esc(j.name || '')}</span> ${sourceTag(j)}${j.call_before ? ` <span class="flag">${ic('phone', 'sm')}חצי שעה לפני</span>` : ''}</div></div></div>
<div class="row-btns">${j.phone ? (j.reminded_at
    ? `<span class="sent">${ic('check', 'sm')}תזכורת נשלחה</span><button type="button" class="btn ghost sm" data-act="wa" data-id="${esc(j.id)}" data-tpl="remind">שליחה שוב</button>`
    : `<button type="button" class="btn wa sm" data-act="wa" data-id="${esc(j.id)}" data-tpl="remind">${waIc('sm')}שליחת תזכורת</button>`)
    : '<span class="small muted">אין טלפון ללקוח</span>'}
${j.phone ? `<a class="btn ghost sm" href="${esc(telHref(j.phone))}">${ic('phone', 'sm')}חיוג</a>` : ''}</div>
</article>`).join('') : `<div class="empty"><b>אין עבודות מחר</b>${requests().length ? 'יש בקשות שמחכות למועד בלשונית "בקשות"' : ''}</div>`}</div>`;
}

// ---------- the simple screen ----------
// One list instead of the tabs: today, tomorrow, what waits for a date, the days after. Every job is a big card with
// all of its details and its three buttons, so nothing has to be opened. The rest is one tap away (the full screen).
function simpleHTML() {
  const t = todayKey(), tm = tomorrowKey(), all = [...S.jobs.values()];
  const byStart = (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || (a.ref - b.ref);
  const today = jobsOn(t).filter(j => j.status === 'scheduled' || j.status === 'done');
  const tomorrow = jobsOn(tm).filter(j => j.status === 'scheduled');
  const waiting = requests();
  const later = all.filter(j => j.starts_at && j.status === 'scheduled' && jobKey(j) > tm).sort(byStart);
  const missed = all.filter(j => j.starts_at && j.status === 'scheduled' && jobKey(j) < t && jobKey(j) >= addDays(t, -14)).sort(byStart);
  const sec = (title, sub, body, id) => `<section class="sim-sec"${id ? ` id="${id}"` : ''}><div class="sim-h"><h2>${title}</h2>${sub ? `<span class="d">${sub}</span>` : ''}</div>${body}</section>`;
  const cards = list => `<div class="sim-list">${list.map(simpleCardHTML).join('')}</div>`;
  const byDay = list => [...new Set(list.map(jobKey))].map(k => `<h3 class="sim-day">${esc(dayLong(k))}</h3>${cards(list.filter(j => jobKey(j) === k))}`).join('');
  const blk = isBlocked(t);
  return sec('היום', esc(dayLong(t)), (blk ? `<div class="dayoff" style="margin-top:10px">יום חופש${blk.reason ? ': ' + esc(blk.reason) : ''}</div>` : '')
      + (today.length ? cards(today) : `<div class="empty sim-empty">אין עבודות היום</div>`))
    + sec('מחר', esc(dayLong(tm)), tomorrow.length ? cards(tomorrow) : `<div class="empty sim-empty">אין עבודות מחר</div>`, 'sim-tomorrow')
    + (waiting.length ? sec('מחכות למועד', String(waiting.length), cards(waiting), 'sim-waiting') : '')
    + (later.length ? sec('בהמשך', '', byDay(later)) : '')
    + (missed.length ? sec('ימים קודמים', 'עוד לא סומנו', byDay(missed)) : '')
    + `<button type="button" class="btn ghost block sim-full" data-act="simple-off">${ic('gear', 'sm')}כל האפשרויות (המסך המלא)</button>`;
}
function simpleCardHTML(j) {
  const id = esc(j.id), done = j.status === 'done', isNew = j.status === 'new';
  const btns = [];
  if (String(j.address || '').trim()) btns.push(`<a class="btn navy big" href="${esc(wazeHref(j))}" target="_blank" rel="noopener">${ic('nav')}ניווט</a>`);
  if (j.phone) btns.push(`<a class="btn ghost big" href="${esc(telHref(j.phone))}">${ic('phone')}חיוג</a>`);
  if (isNew) btns.push(`<button type="button" class="btn primary big" data-act="schedule" data-id="${id}">${ic('cal')}קביעת מועד</button>`);
  else if (!done && jobKey(j) <= todayKey()) btns.push(`<button type="button" class="btn ok big" data-act="set-status" data-id="${id}" data-s="done">${ic('check')}בוצע</button>`);
  else if (!done) btns.push(`<button type="button" class="btn ghost big" data-act="schedule" data-id="${id}">${ic('clock')}שינוי מועד</button>`);
  const refs = [['מספר מכירה', j.sale_no], ['מספר פניה', j.case_no]].filter(r => r[1]);
  return `<article class="sj src-${esc(j.source)}${done ? ' is-done' : ''}" data-id="${id}">
<div class="sj-top">${j.starts_at ? `<b class="sj-time ltr num">${esc(jobTime(j))}–${esc(jobEnd(j))}</b>` : `<span class="pill new">${esc(statusLabel(j))}</span>`}${done ? `<span class="pill done">בוצע</span>` : ''}${isNew && j.source === 'site' ? '' : sourceTag(j)}</div>
<h3 class="sj-ttl">${esc(j.title || 'עבודה')}</h3>
${j.city || j.address ? `<div class="sj-where" translate="no">${j.city ? `<b>${esc(j.city)}</b>` : ''}${j.city && j.address ? ' · ' : ''}${esc(j.address || '')}</div>` : ''}
${j.name || j.phone ? `<div class="sj-who">${j.name ? `<span translate="no">${esc(j.name)}</span>` : ''}${j.name && j.phone ? ' · ' : ''}${j.phone ? `<span class="ltr num">${esc(showPhone(j.phone))}</span>` : ''}</div>` : ''}
${j.call_before && j.status === 'scheduled' ? `<div class="flag sj-flag">${ic('phone', 'sm')}להתקשר ללקוח חצי שעה לפני ההגעה</div>` : ''}
${isNew ? prefsHTML(j) : ''}
${refs.length ? `<div class="refnum">${refs.map(([k, v]) => `<button type="button" class="refnum-item" data-act="copy" data-copy="${esc(v)}" aria-label="${k} ${esc(v)}. לחיצה מעתיקה"><span class="refnum-k">${k}</span><b class="num">${esc(v)}</b>${ic('copy', 'sm')}</button>`).join('')}</div>` : ''}
${j.price != null ? `<div class="sj-price">מחיר: <b class="num">₪${fmtNum(j.price)}</b></div>` : ''}
${j.notes ? `<div class="notes" translate="no" dir="auto">${esc(j.notes)}</div>` : ''}
${btns.length ? `<div class="sj-btns">${btns.join('')}</div>` : ''}
${!isNew && safeUrl(j.ext_link) ? `<a class="btn ghost block" href="${esc(safeUrl(j.ext_link))}" target="_blank" rel="noopener">${ic('link', 'sm')}עדכון אחרי ביקור (כרומגן)</a>` : ''}
<div class="sj-more">${done ? `<button type="button" class="linkbtn" data-act="set-status" data-id="${id}" data-s="scheduled">${ic('undo', 'sm')}עוד לא בוצע</button>` : '<span></span>'}<button type="button" class="linkbtn" data-act="open-job" data-id="${id}">פרטים ושינויים</button></div>
</article>`;
}
const simpleBarHTML = () => `<nav class="sbar" aria-label="עבודה חדשה"><div class="inner"><button type="button" class="btn primary sbar-add" data-act="new-job">${ic('plus', 'lg')}עבודה חדשה</button></div></nav>`;
// in the full screen, for a user whose own screen is the simple one: the way back, on every tab
const backToSimpleHTML = () => cfgUser(myEmail()).simple ? `<button type="button" class="sim-back" data-act="simple-on">${ic(lng('right', 'left'), 'sm')}חזרה למסך הפשוט</button>` : '';
// a job that was just saved: brought into view and outlined for a moment, so it is clear where it went
function flashJob(id) {
  setTimeout(() => {
    const el = $(`.sj[data-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2600);
  }, 320);
}

// ---------- settings ----------
function settingsHTML() {
  const st = S.settings, g = st.gcal || {}, n = st.notify || {};
  const row = (act, title, sub, right) => `<button type="button" class="set-row" data-act="${act}"><span class="grow"><span class="ttl">${title}</span><span class="sub" style="display:block">${sub}</span></span>${right || ic(lng('left', 'right'), 'sm')}</button>`;
  const wd = st.workDays || {};
  const days = [0, 1, 2, 3, 4, 5, 6].filter(i => (wd[i] || []).length).map(wdShort).join(' ');
  const futureBlocks = S.blocks.filter(b => (b.day_to || b.day_from) >= todayKey());
  return `<div class="set-group">
${row('set-notify', 'התראות לטלפון', pushState.text)}
${row('set-gcal', 'העתק ליומן גוגל', g.enabled && g.url ? '<span class="ok-dot"></span> פעיל: כל עבודה שנקבעת נכנסת גם ליומן "עבודות דודים"' : '<span class="off-dot"></span> לא מחובר עדיין')}
</div>
<div class="set-group">
${row('set-hours', 'ימים ושעות באתר', `ימי עבודה: ${esc(days || '—')} · עד ${esc(st.maxPerDay || 4)} עבודות ביום · ${esc(st.daysAhead || 14)} ימים קדימה`)}
${row('set-blocks', 'ימי חופש', futureBlocks.length ? futureBlocks.map(b => esc(dm(b.day_from) + (b.day_to && b.day_to !== b.day_from ? '–' + dm(b.day_to) : ''))).join(', ') : 'אין ימי חופש קרובים')}
${row('set-areas', 'אזורים ויישובים', `<span translate="no">${esc((st.areas || []).map(a => a.name).join(' · '))}</span>`)}
${row('set-tpls', 'נוסחי ההודעות בוואטסאפ', 'אישור מועד, תזכורת, בדרך, ביקורת')}
</div>
<div class="set-group">
${row('simple-on', 'מסך פשוט', 'רשימה אחת עם כפתורים גדולים, והוספת עבודה בשלבים קצרים')}
${row('lang', 'שפה', S.lang === 'ru' ? 'Русский' : 'עברית')}
${row('set-pass', 'שינוי סיסמה', `מחובר/ת בתור ${esc(S.me ? S.me.name : '')}`)}
<button type="button" class="set-row" data-act="logout"><span class="grow"><span class="ttl">התנתקות</span></span>${ic('out', 'sm')}</button>
</div>
<p class="small muted" style="text-align:center;margin:18px 0 8px">מערכת העבודות של א.ר דודי שמש</p>`;
}

// ---------- login ----------
function renderLogin() {
  if (!sb) {
    root.innerHTML = `<div class="login"><img src="${LOGO}" alt="א.ר דודי שמש"><h1>מערכת העבודות</h1><p class="muted">המערכת עוד לא מחוברת למסד הנתונים.<br>צריך להשלים את הכתובת והמפתח בקובץ assets/jobs-config.js.</p></div>`;
    return;
  }
  const users = CFG.users || [];
  root.innerHTML = `<div class="login"><img src="${LOGO}" alt="א.ר דודי שמש"><h1>מערכת העבודות</h1>
<p class="muted" style="margin:0">מי נכנס?</p>
<div class="users">${users.map((u, i) => `<button type="button" class="who" data-act="pick-user" data-i="${i}" aria-pressed="${S.loginUser === i}">${esc(u.name)}</button>`).join('')}</div>
<form data-form="login"${S.loginUser == null ? ' hidden' : ''}>
<label class="vh" for="pw">סיסמה</label>
<input class="input" id="pw" name="pw" type="password" autocomplete="current-password" placeholder="סיסמה" required>
${S.loginErr ? `<div class="err" role="alert">${esc(S.loginErr)}</div>` : ''}
<button class="btn primary block" type="submit"${S.loginBusy ? ' disabled' : ''}>${S.loginBusy ? 'נכנס…' : 'כניסה'}</button>
</form></div>`;
  if (S.loginUser != null) setTimeout(() => { const p = $('#pw'); if (p) p.focus(); }, 30);
}

// ======================================================================
// sheets
// ======================================================================
const sheetEl = $('#sheet'), inner = $('#sheetInner'), backdrop = $('#backdrop');
let lastFocus = null;
function openSheet(spec) {
  if (!S.stack.length) lastFocus = document.activeElement;
  S.stack.push(spec);
  try { history.pushState({ s: S.stack.length }, ''); } catch (_) { /* file:// */ }
  renderSheet(true);
}
function renderSheet(first) {
  const spec = S.stack[S.stack.length - 1];
  if (!spec) return hideSheet();
  const keepTop = sheetEl.scrollTop;
  inner.innerHTML = (SHEETS[spec.type] || (() => ''))(spec);
  sheetEl.hidden = false;
  backdrop.classList.add('open');
  requestAnimationFrame(() => sheetEl.classList.add('open'));
  if (first) {
    sheetEl.scrollTop = 0;
    const f = $('[autofocus]', inner) || $('.closebtn', inner);
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
    if (spec.after) spec.after(spec);
  } else sheetEl.scrollTop = keepTop;
}
function hideSheet() {
  sheetEl.classList.remove('open');
  backdrop.classList.remove('open');
  setTimeout(() => { if (!S.stack.length) { sheetEl.hidden = true; inner.innerHTML = ''; } }, 260);
  if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (_) { /* gone */ }
}
let closing = false; // the app itself is closing a sheet (not the phone's back button)
function closeSheet(all) {
  const n = all ? S.stack.length : 1;
  if (!n) return;
  if (history.state && history.state.s) { closing = true; history.go(-n); }
  else { S.stack.splice(-n, n); S.stack.length ? renderSheet(true) : hideSheet(); }
}
window.addEventListener('popstate', () => {
  const depth = (history.state && history.state.s) || 0, mine = closing, top = S.stack[S.stack.length - 1];
  closing = false;
  // the phone's back button inside the steps of a job: one step back, and what was filled in stays
  if (!mine && top && top.type === 'wiz' && S.stack.length > depth && top.step && top.step !== 'start' && !(top.id && top.step === 'check' && !top.ret)) {
    try { history.pushState({ s: S.stack.length }, ''); } catch (_) { /* file:// */ }
    wizRead(top);
    const i = WIZ_STEPS.indexOf(top.step);
    Object.assign(top, { step: top.ret ? 'check' : i > 0 ? WIZ_STEPS[i - 1] : 'start', ret: false, err: '', found: '' });
    renderSheet(true);
    return;
  }
  if (S.stack.length > depth) {
    S.stack.length = depth;
    if (depth) renderSheet(true); else hideSheet();
  }
});
const head = (title, sub) => `<div class="sheet-head"><h2 id="sheetTitle">${title}</h2><button type="button" class="closebtn" data-act="sheet-close" aria-label="סגירה">${ic('x')}</button></div>${sub ? `<p class="muted small" style="margin:-6px 0 12px">${sub}</p>` : ''}`;

const SHEETS = {};

// ---------- one job ----------
SHEETS.job = spec => {
  const j = S.jobs.get(spec.id);
  if (!j) return head('העבודה לא נמצאה') + '<p class="muted">ייתכן שנמחקה.</p>';
  const when = j.starts_at ? `${dayLong(jobKey(j))} · <span class="ltr num">${esc(jobTime(j))}–${esc(jobEnd(j))}</span>` : 'עדיין בלי מועד';
  const L = j.starts_at ? dayLoad(jobKey(j), j.city) : null;
  const g = S.settings.gcal || {};
  const gc = !g.enabled ? '' : j.gcal_state === 'ok' ? `${ic('check', 'sm')} מופיע ביומן גוגל` : /^error/.test(j.gcal_state || '') ? `לא הועתק ליומן גוגל (${esc(j.gcal_state.replace(/^error:?\s*/, ''))})` : (j.status === 'scheduled' ? 'מועתק ליומן גוגל…' : '');
  const dl = [];
  if (j.name) dl.push(['לקוח', `<span translate="no">${esc(j.name)}</span>`]);
  if (j.phone) dl.push(['טלפון', `<a class="ltr" href="${esc(telHref(j.phone))}">${esc(showPhone(j.phone))}</a>`]);
  if (j.city || j.address) dl.push(['כתובת', `<span translate="no">${esc(fullAddress(j))}</span>` + (areaOf(j.city) ? ` <span class="muted small" translate="no">· ${esc(areaOf(j.city))}</span>` : '')]);
  if (j.price != null) dl.push(['מחיר', `<span class="num">₪${fmtNum(j.price)}</span>`]);
  if (j.status === 'new' && j.pref_days && j.pref_days.length) dl.push(['ימים שהלקוח סימן', esc(j.pref_days.map(dayShort).join(', ')) + (j.pref_window ? ' · ' + esc(windowText(j)) : '')]);
  const links = [];
  if (safeUrl(j.ext_link)) links.push(`<a class="btn ghost sm" href="${esc(safeUrl(j.ext_link))}" target="_blank" rel="noopener">${ic('link', 'sm')}עדכון אחרי ביקור (כרומגן)</a>`);
  if (safeUrl(j.quote_link)) links.push(`<a class="btn ghost sm" href="${esc(safeUrl(j.quote_link))}" target="_blank" rel="noopener">${ic('link', 'sm')}הצעת המחיר</a>`);
  const by = adminName(j.created_by), upd = adminName(j.updated_by);
  const actions = [];
  if (j.status === 'new') actions.push(`<button type="button" class="btn primary" data-act="schedule" data-id="${esc(j.id)}">${ic('cal', 'sm')}קביעת מועד</button>`);
  if (j.status === 'scheduled') actions.push(`<button type="button" class="btn ok" data-act="set-status" data-id="${esc(j.id)}" data-s="done">${ic('check', 'sm')}בוצע</button>`, `<button type="button" class="btn ghost" data-act="schedule" data-id="${esc(j.id)}">${ic('clock', 'sm')}שינוי מועד</button>`);
  if (j.status === 'done') actions.push(`<button type="button" class="btn ghost" data-act="set-status" data-id="${esc(j.id)}" data-s="scheduled">${ic('undo', 'sm')}עוד לא בוצע</button>`);
  if (j.status === 'cancelled') actions.push(`<button type="button" class="btn ghost" data-act="set-status" data-id="${esc(j.id)}" data-s="${j.starts_at ? 'scheduled' : 'new'}">${ic('undo', 'sm')}החזרה</button>`);
  actions.push(`<button type="button" class="btn ghost" data-act="edit-job" data-id="${esc(j.id)}">${ic('edit', 'sm')}עריכה</button>`);
  const refs = [['מספר מכירה', j.sale_no], ['מספר פניה', j.case_no]].filter(r => r[1]);
  const refBox = refs.length ? `<div class="refnum">${refs.map(([k, v]) => `<button type="button" class="refnum-item" data-act="copy" data-copy="${esc(v)}" aria-label="${k} ${esc(v)}. לחיצה מעתיקה"><span class="refnum-k">${k}</span><b class="num">${esc(v)}</b>${ic('copy', 'sm')}</button>`).join('')}</div>` : '';
  return `${head(esc(j.title || 'עבודה'), `#${esc(j.ref)} · ${sourceTag(j)} <span class="pill ${esc(j.status)}">${esc(statusLabel(j))}</span>`)}
${refBox}<div class="box" style="margin-top:0"><b>${when}</b>${j.call_before && j.status === 'scheduled' ? `<div class="flag" style="margin-top:4px">${ic('phone', 'sm')}להתקשר ללקוח חצי שעה לפני ההגעה</div>` : ''}
${L && L.list.length > 1 ? `<div class="small muted" style="margin-top:4px">באותו יום: ${L.list.filter(x => x.id !== j.id).map(x => `${esc(jobTime(x))} ${x.city ? `<span translate="no">${esc(x.city)}</span>` : esc(x.title)}`).join(' · ')}</div>` : ''}</div>
<div class="row-btns" style="margin:12px 0">
${j.phone ? `<button type="button" class="btn wa" data-act="wa" data-id="${esc(j.id)}" data-tpl="${j.status === 'new' ? (j.source === 'site' ? 'request' : 'free') : j.status === 'done' ? 'review' : 'confirm'}">${waIc('sm')}וואטסאפ</button><a class="btn ghost" href="${esc(telHref(j.phone))}">${ic('phone', 'sm')}חיוג</a>` : ''}
${fullAddress(j) ? `<a class="btn ghost" href="${esc(wazeHref(j))}" target="_blank" rel="noopener">${ic('nav', 'sm')}ניווט</a>` : ''}
</div>
<dl class="kv">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
${j.notes ? `<div class="notes" translate="no" dir="auto">${esc(j.notes)}</div>` : ''}
${links.length ? `<div class="row-btns" style="margin-bottom:12px">${links.join('')}</div>` : ''}
<div class="row-btns">${actions.join('')}</div>
${j.status !== 'cancelled' && j.status !== 'done' ? `<button type="button" class="btn danger block sm" style="margin-top:10px" data-act="set-status" data-id="${esc(j.id)}" data-s="cancelled">${ic('x', 'sm')}ביטול העבודה</button>` : ''}
${(j.status === 'cancelled' || j.status === 'new') && !j.gcal_id ? `<button type="button" class="btn ghost block sm" style="margin-top:8px" data-act="delete-job" data-id="${esc(j.id)}">${ic('trash', 'sm')}מחיקה לגמרי</button>` : ''}
<div class="meta-line">${gc ? gc + '<br>' : ''}${by ? `נוסף ע״י ${esc(by)} · ` : ''}${esc(ago(j.created_at))}${upd && j.updated_at !== j.created_at ? ` · עודכן ע״י ${esc(upd)} ${esc(ago(j.updated_at))}` : ''}</div>`;
};

// ---------- new / edit ----------
// a short list of whole and half hours: the iPhone's own clock offers every minute
const HALF_HOURS = Array.from({ length: 31 }, (_, i) => toHHMM(360 + i * 30)); // 06:00–21:00
function timeSel(attrs, value, empty) {
  const v = toMin(value) == null ? '' : toHHMM(toMin(value));
  const list = HALF_HOURS.slice();
  if (v && !list.includes(v)) { list.push(v); list.sort(); } // a time like 12:15 from a message stays as it is
  return `<select class="input num" ${attrs}>${empty || !v ? `<option value="">—</option>` : ''}${list.map(t => `<option value="${t}"${t === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
}
function setTime(sel, t) {
  if (!sel) return;
  if (t && !Array.from(sel.options).some(o => o.value === t)) sel.add(new Option(t, t), Array.from(sel.options).find(o => o.value > t) || null);
  sel.value = t;
}
function timeChips(name) {
  const slots = [['08:00', '10:00'], ['10:00', '12:00'], ['12:00', '14:00'], ['14:00', '16:00']];
  return `<div class="chips" style="margin-top:6px">${slots.map(([a, b]) => `<button type="button" class="chip num" data-act="slot" data-f="${a}" data-t="${b}" data-n="${name}"><span class="ltr">${a}–${b}</span></button>`).join('')}</div>`;
}
// a job (or the draft of a new one) as the values the form and the steps edit
const jobValues = j => ({
  source: j.source || 'private', source_name: j.source_name || '', title: j.title || '', name: j.name || '', phone: j.phone ? showPhone(j.phone) : '',
  city: j.city || '', address: j.address || '', date: j.starts_at ? jobKey(j) : (j.date || ''), from: j.starts_at ? jobTime(j) : (j.from || ''),
  to: j.ends_at ? jobEnd(j) : (j.to || ''), price: j.price != null ? j.price : '', sale_no: j.sale_no || '', case_no: j.case_no || '', ext_link: j.ext_link || '',
  call_before: !!j.call_before, notes: j.notes || '', quote_link: j.quote_link || '', quote_code: j.quote_code || '',
  pref_days: j.pref_days || [], pref_window: j.pref_window || '',
});
// those values as a database row; { error, step } when something is missing (step: where the steps ask for it)
function jobRow(d, id) {
  const has = s => String(s || '').trim() !== '';
  if (!has(d.title) && !has(d.name)) return { error: 'צריך לפחות מה העבודה או שם הלקוח', step: 'job' };
  if (has(d.phone) && !/^0[2-9]\d{7,8}$|^[1-9]\d{9,14}$/.test(normPhone(d.phone))) return { error: 'מספר הטלפון לא נראה תקין', step: 'who' };
  let starts = null, ends = null;
  if (has(d.date)) {
    const a = toMin(d.from), b = toMin(d.to);
    if (a == null) return { error: 'חסרה שעת התחלה', step: 'when' };
    const end = b == null ? a + 60 * (Number(S.settings.jobHours) || 2) : b;
    if (end <= a) return { error: 'שעת הסיום צריכה להיות אחרי שעת ההתחלה', step: 'when' };
    starts = new Date(zoned(d.date, a)).toISOString();
    ends = new Date(zoned(d.date, end)).toISOString();
  }
  const old = id ? S.jobs.get(id) : null;
  let status = old ? old.status : 'new';
  if (starts && status === 'new') status = 'scheduled';
  if (!starts && status === 'scheduled') status = 'new';
  if (!starts && status === 'done') return { error: 'לעבודה שבוצעה צריך תאריך', step: 'when' };
  const row = {
    source: d.source, source_name: (d.source === 'contractor' || d.source === 'chromagen') ? String(d.source_name || '').trim() : '',
    title: String(d.title || '').trim(), name: String(d.name || '').trim(), phone: has(d.phone) ? normPhone(d.phone) : '',
    city: String(d.city || '').trim(), address: String(d.address || '').trim(), starts_at: starts, ends_at: ends, status,
    price: has(d.price) ? Number(d.price) : null, sale_no: String(d.sale_no || '').trim(), ext_link: String(d.ext_link || '').trim(),
    call_before: !!d.call_before, notes: String(d.notes || '').trim(),
  };
  const caseNo = String(d.case_no || '').replace(/\s+/g, '').trim();
  if (S.caseCol) row.case_no = caseNo;
  else if (caseNo && !row.notes.includes(caseNo)) row.notes = `מספר פניה: ${caseNo}` + (row.notes ? '\n' + row.notes : '');
  if (row.ext_link && !safeUrl(row.ext_link)) return { error: 'הקישור צריך להתחיל ב-https://', step: 'check' };
  if (!id) Object.assign(row, { quote_link: d.quote_link || '', quote_code: d.quote_code || '', pref_days: d.pref_days || [], pref_window: d.pref_window || '' });
  return { row };
}
SHEETS.form = spec => {
  const j = spec.id ? (S.jobs.get(spec.id) || {}) : (spec.draft || {});
  const d = spec.values || jobValues(j);
  spec.values = d;
  const srcs = spec.id && j.source === 'site' ? ['site'] : ['chromagen', 'contractor', 'private'].concat(!spec.id && d.source === 'site' ? ['site'] : []);
  return `${head(spec.id ? 'עריכת עבודה' : 'עבודה חדשה')}
${spec.id ? '' : `<div class="paste"><label class="lbl small" for="f-paste" style="font-weight:700;color:var(--muted)">${ic('paste', 'sm')} הדבקת הודעה</label>
<textarea class="input" id="f-paste"${AUTO()} rows="3" placeholder="הדביקו כאן כל הודעה עם פרטי לקוח: תיאום מכרומגן, בקשה מהאתר, או הודעה רגילה עם שם, טלפון וכתובת. הפרטים יתמלאו לבד"></textarea>
<button type="button" class="btn navy sm block" style="margin-top:8px" data-act="parse">מילוי הפרטים מההודעה</button>
${spec.found ? `<div class="found" role="status">${esc(spec.found)}</div>` : ''}</div>`}
<form data-form="job" novalidate>
<div class="field"><span class="lbl">מקור</span><div class="chips" role="radiogroup" aria-label="מקור">${srcs.map(s => `<button type="button" class="chip" role="radio" data-act="src" data-s="${s}" aria-checked="${d.source === s}">${SOURCE[s]}</button>`).join('')}</div></div>
<div class="field"${d.source === 'contractor' || d.source === 'chromagen' ? '' : ' hidden'} id="f-srcname-wrap"><label for="f-source_name">${d.source === 'contractor' ? 'שם הקבלן' : 'הערה למקור (למשל עמידר)'}</label><input class="input" id="f-source_name"${AUTO()} name="source_name" value="${esc(d.source_name)}" maxlength="60"></div>
<div class="field"><label for="f-title">מה העבודה</label><input class="input" id="f-title"${AUTO()} name="title" list="titles" value="${esc(d.title)}" maxlength="120" placeholder="למשל: מחליף חום 120 ליטר"></div>
<datalist id="titles">${TITLES.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
<div class="grid2"><div class="field"><label for="f-name">שם הלקוח</label><input class="input" id="f-name"${AUTO()} name="name" value="${esc(d.name)}" maxlength="60" autocomplete="off"></div>
<div class="field"><label for="f-phone">טלפון</label><input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" value="${esc(d.phone)}" maxlength="20" autocomplete="off"></div></div>
<div class="grid2"><div class="field"><label for="f-city">יישוב</label><input class="input" id="f-city"${AUTO()} name="city" list="cities" value="${esc(d.city)}" maxlength="40" autocomplete="off"></div>
<div class="field"><label for="f-address">רחוב ומספר</label><input class="input" id="f-address"${AUTO()} name="address" value="${esc(d.address)}" maxlength="120" autocomplete="off"></div></div>
<datalist id="cities">${allCities().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="field"><label for="f-date">תאריך</label><input class="input" id="f-date" name="date" type="date" value="${esc(d.date)}"></div>
<div id="f-dayload">${dayLoadHTML(d.date, spec.id, d.city)}</div>
<div class="grid2"><div class="field"><label for="f-from">משעה</label>${timeSel('id="f-from" name="from"', d.from, true)}</div>
<div class="field"><label for="f-to">עד שעה</label>${timeSel('id="f-to" name="to"', d.to, true)}</div></div>
${timeChips('f')}
<p class="small muted" style="margin:6px 0 12px">בלי תאריך, העבודה נשמרת ברשימה "עבודות בלי מועד" בלשונית הבקשות.</p>
<div class="grid2"><div class="field"><label for="f-price">מחיר (₪)</label><input class="input num" id="f-price" name="price" type="number" inputmode="decimal" min="0" step="1" value="${esc(d.price)}"></div>
<div class="field"><label for="f-sale_no">מספר מכירה</label><input class="input num" id="f-sale_no" name="sale_no" value="${esc(d.sale_no)}" maxlength="20" inputmode="numeric"></div></div>
<div class="field"><label for="f-case_no">מספר פניה (אחריות)</label><input class="input num" id="f-case_no" name="case_no" value="${esc(d.case_no || '')}" maxlength="20" inputmode="numeric" placeholder="225153"></div>
<label class="switch"><input type="checkbox" name="call_before"${d.call_before ? ' checked' : ''}> להתקשר ללקוח חצי שעה לפני ההגעה</label>
<div class="field"><label for="f-notes">הערות ודגשים</label><textarea class="input" id="f-notes"${AUTO()} name="notes" rows="4" maxlength="2000">${esc(d.notes)}</textarea></div>
<div class="field"><label for="f-ext_link">קישור לעדכון אחרי ביקור (כרומגן)</label><input class="input" id="f-ext_link" name="ext_link" type="url" value="${esc(d.ext_link)}" maxlength="400" dir="ltr"></div>
<div class="err" id="f-err" role="alert"></div>
<button class="btn primary block" type="submit" style="margin-top:6px">${spec.id ? 'שמירה' : 'הוספת העבודה'}</button>
</form>`;
};
function dayLoadHTML(key, exceptId, city) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) return '';
  const blk = isBlocked(key);
  const list = activeOn(key).filter(j => j.id !== exceptId);
  const closed = !((S.settings.workDays || {})[wdOf(key)] || []).length;
  const parts = [];
  if (blk) parts.push(`יום חופש${blk.reason ? ' (' + esc(blk.reason) + ')' : ''}`);
  else if (closed) parts.push('יום שבדרך כלל לא עובדים בו');
  parts.push(list.length ? `באותו יום כבר יש: ${list.map(j => `<span class="ltr num">${esc(jobTime(j))}</span> ${j.city ? `<span translate="no">${esc(j.city)}</span>` : esc(j.title || '')}`).join(' · ')}` : 'אין עוד עבודות באותו יום');
  if (city && list.some(j => areaOf(j.city) && areaOf(j.city) === areaOf(city))) parts.push('<b style="color:var(--ok)">יש עבודה באותו אזור</b>');
  return `<div class="dayload">${dayShort(key)}: ${parts.join('<br>')}</div>`;
}
function formValues(form) {
  const v = Object.fromEntries(new FormData(form).entries());
  v.call_before = !!form.querySelector('[name=call_before]').checked;
  return v;
}
function readForm(spec) {
  const form = $('form[data-form="job"]', inner);
  if (form) Object.assign(spec.values, formValues(form));
  return spec.values;
}

// ---------- a new job in short steps (the simple screen) ----------
// One question on a screen, big buttons to choose from, and as little typing as possible. What is typed (a name,
// a street, notes) is saved as it was written, in any language. A pasted message fills the steps by itself.
// An edit opens at the last step, which lists everything with a "change" button next to each part.
const WIZ_STEPS = ['job', 'who', 'where', 'when', 'check'];
const WIZ_KINDS = ['דוד שמש', 'דוד חשמל', 'מחליף חום', 'מערכת מלאה', 'קולט', 'החלפת גוף חימום', 'תיקון נזילה', 'החלפת צנרת', 'החלפת טרמוסטט', 'ביקור טכנאי'];
const WIZ_SIZED = new Set(['דוד שמש', 'דוד חשמל', 'מחליף חום', 'מערכת מלאה']);
const WIZ_SIZES = ['80', '120', '150', '200'];
const WIZ_SRC = { private: 'לקוח פרטי', contractor: 'דרך קבלן', chromagen: 'כרומגן', site: 'מהאתר' };
// which of the buttons a title is: "דוד שמש 150 ליטר" is { kind: 'דוד שמש', size: '150' }; anything else is "other"
function wizKind(title) {
  const t = String(title || '').trim();
  for (const k of WIZ_KINDS) {
    if (t === k) return { kind: k, size: '' };
    const m = WIZ_SIZED.has(k) && t.startsWith(k + ' ') && /^(\d{2,3}) ליטר$/.exec(t.slice(k.length + 1));
    if (m) return { kind: k, size: m[1] };
  }
  return { kind: '', size: '' };
}
// what is typed in the step on screen, into the values (before the step is drawn again, or left)
function wizRead(spec) {
  const form = $('form[data-form="wiz"]', inner);
  if (!form || !spec || !spec.values) return;
  for (const el of form.elements) if (el.name) spec.values[el.name] = el.type === 'checkbox' ? el.checked : el.value;
}
// a pasted message: fills the values and goes to the first step that still misses something
function wizMessage(spec, raw) {
  const r = applyMessage(raw, spec.values);
  if (!r) { spec.manual = true; spec.raw = raw; spec.err = 'לא מצאתי בהודעה שם, טלפון או כתובת'; renderSheet(false); return; }
  if (r.existing) { closeSheet(); setTimeout(() => openSheet({ type: 'job', id: r.existing.id, live: true }), 280); toast(`הבקשה #${r.existing.ref} כבר במערכת`); return; }
  const d = spec.values;
  spec.found = r.found; spec.err = ''; spec.ret = false;
  spec.step = !String(d.title || '').trim() ? 'job' : !d.date ? 'when' : 'check';
  renderSheet(true);
}
// the towns of the most jobs, in the order of the area lists so that every button keeps its place
function topTowns(current) {
  const mine = allCities(), n = new Map();
  for (const j of S.jobs.values()) { const c = townOf(j.city); if (c) n.set(c, (n.get(c) || 0) + 1); }
  const pos = c => { const i = mine.indexOf(c); return i < 0 ? 999 : i; };
  const top = [...n.entries()].sort((a, b) => b[1] - a[1] || pos(a[0]) - pos(b[0])).map(e => e[0]);
  const list = [...new Set([...top, ...mine])].slice(0, 8).sort((a, b) => pos(a) - pos(b));
  if (current && !list.some(c => townKey(c) === townKey(current))) { list.pop(); list.unshift(current); }
  return list;
}
const ruNorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я]/g, '');
let RU_TOWNS = null;
function townRu(c) {
  if (!RU_TOWNS) { RU_TOWNS = new Map(); for (const [he, ru] of Object.entries(RU.towns || {})) RU_TOWNS.set(townKey(he), ru); }
  return RU_TOWNS.get(townKey(c)) || '';
}
const townOptHTML = (c, cur) => `<button type="button" class="wiz-opt" data-act="wiz-town" data-c="${esc(c)}" aria-pressed="${!!cur && townKey(cur) === townKey(c)}">${S.lang === 'ru' && townRu(c) ? `<b translate="no">${esc(townRu(c))}</b><small translate="no">${esc(c)}</small>` : `<b translate="no">${esc(c)}</b>`}</button>`;
// a town typed in Latin or Russian letters. Hebrew is written without vowels, so both sides become a skeleton of
// consonant classes: "petah tikva", "петах тиква" and "פתח תקווה" are all PTHTKB. The result is a short list to
// pick from, so a loose match is fine.
const SK_HE = { 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ז': 'Z', 'ח': 'H', 'ט': 'T', 'כ': 'K', 'ך': 'K', 'ל': 'L', 'מ': 'M', 'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S', 'פ': 'P', 'ף': 'P', 'צ': 'Z', 'ץ': 'Z', 'ק': 'K', 'ר': 'R', 'ש': 'S', 'ת': 'T' };
const SK_XX = { b: 'B', v: 'B', w: 'B', p: 'P', f: 'P', g: 'G', d: 'D', z: 'Z', h: 'H', t: 'T', k: 'K', q: 'K', c: 'K', l: 'L', m: 'M', n: 'N', r: 'R', s: 'S', x: 'KS',
  'б': 'B', 'в': 'B', 'п': 'P', 'ф': 'P', 'г': 'G', 'д': 'D', 'з': 'Z', 'ж': 'Z', 'ц': 'Z', 'х': 'H', 'т': 'T', 'к': 'K', 'л': 'L', 'м': 'M', 'н': 'N', 'р': 'R', 'с': 'S', 'ш': 'S', 'щ': 'S', 'ч': 'H' };
const squeeze = s => s.replace(/(.)\1+/g, '$1');
// ה is heard at the start and in the middle of a word (הוד, יהוד), not at its end (תקווה); וו is v
const skelHe = name => squeeze(String(name).split(/[\s\-־]+/).map(w => { const cs = [...w.replace(/וו/g, 'ב')]; return cs.map((c, i) => c === 'ה' ? (i < cs.length - 1 ? 'H' : '') : (SK_HE[c] || '')).join(''); }).join(''));
const skelOf = q => squeeze([...String(q).toLowerCase().replace(/sch|sh/g, 's').replace(/tz|ts|тс/g, 'z').replace(/ch|kh/g, 'h').replace(/ph/g, 'f').replace(/th/g, 't')].map(c => SK_XX[c] || '').join(''));
// at most one letter changed, added or missing
function lev1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, x = a.length - 1, y = b.length - 1;
  while (i <= x && i <= y && a[i] === b[i]) i++;
  while (x >= i && y >= i && a[x] === b[y]) { x--; y--; }
  return x - i < 1 && y - i < 1;
}
const SKEL = new Map();
function townSearch(q) {
  q = townName(q);
  if (q.length < 2) return [];
  const mine = allCities(), seen = new Map();
  for (const c of [...mine, ...towns().names.values()]) { const k = townKey(c); if (!seen.has(k)) seen.set(k, c); }
  const pos = c => { const i = mine.indexOf(c); return i < 0 ? 999 : i; };
  let score;
  if (/[א-ת]/.test(q)) {
    const k = townKey(q);
    score = c => { const n = townKey(c); return n.startsWith(k) ? 0 : n.includes(k) ? 1 : 9; };
  } else {
    const s = skelOf(q), s0 = s.replace(/H/g, ''), r = ruNorm(q);
    score = c => {
      const ru = ruNorm(townRu(c));
      if (ru && r.length >= 2 && ru.startsWith(r)) return 0;
      if (s.length < 2) return 9;
      if (!SKEL.has(c)) SKEL.set(c, skelHe(c));
      const h = SKEL.get(c), h0 = h.replace(/H/g, '');
      if (h === s) return 1;
      if (h.startsWith(s)) return 2;
      if (h0 === s0 || (s0.length >= 2 && h0.startsWith(s0))) return 3;
      if (s.length >= 4 && (lev1(h, s) || lev1(h.slice(0, s.length), s) || lev1(h.slice(0, s.length + 1), s))) return 4;
      return 9;
    };
  }
  // a town of the area lists, or one big enough to have its Russian name here, comes before a small place that
  // only happens to fit better ("petah": פתח תקווה before the moshav יפתח)
  const known = c => pos(c) < 999 || !!townRu(c);
  return [...seen.values()].map(c => [score(c), c]).filter(x => x[0] < 9).map(([n, c]) => [n + (known(c) ? 0 : 1.5), c])
    .sort((a, b) => a[0] - b[0] || pos(a[1]) - pos(b[1]) || a[1].length - b[1].length || a[1].localeCompare(b[1], 'he')).slice(0, 6).map(x => x[1]);
}
function townResHTML(spec) {
  const q = townName(spec.townQ || '');
  if (q.length < 2) return '';
  return townSearch(q).map(c => townOptHTML(c, spec.values.city)).join('')
    || `<button type="button" class="wiz-opt" data-act="wiz-town" data-c="${esc(q)}"><b translate="no">${esc(q)}</b><small>להשתמש כמו שכתוב</small></button>`;
}
SHEETS.wiz = spec => {
  const j = spec.id ? (S.jobs.get(spec.id) || {}) : {};
  const d = spec.values || (spec.values = jobValues(j));
  if (!spec.orig) spec.orig = JSON.stringify(d);
  const step = spec.step || 'start', i = WIZ_STEPS.indexOf(step), t = todayKey();
  const opt = (act, data, on, label, cls) => `<button type="button" class="wiz-opt${cls ? ' ' + cls : ''}" data-act="${act}" ${data} aria-pressed="${!!on}">${label}</button>`;
  const any = 'אפשר לכתוב באיזו שפה שנוח';
  let body = '';
  if (step === 'start') {
    body = `<p class="wiz-q">איך להוסיף את העבודה?</p>
<button type="button" class="wiz-big" data-act="wiz-paste">${ic('paste', 'lg')}<span><b>הדבקת הודעה</b><small>מעתיקים בוואטסאפ את ההודעה של הלקוח או של כרומגן, ואז לוחצים כאן</small></span></button>
<button type="button" class="wiz-big" data-act="wiz-step" data-s="job">${ic('edit', 'lg')}<span><b>מילוי לבד</b><small>כמה שאלות קצרות, אחת בכל פעם</small></span></button>
${spec.manual ? `<div class="field" style="margin-top:16px"><label for="w-paste">ההודעה</label><textarea class="input" id="w-paste" dir="auto" rows="5" placeholder="נגיעה ארוכה כאן, ואז הדבקה">${esc(spec.raw || '')}</textarea></div>
<button type="button" class="btn navy block" data-act="wiz-read">קריאת ההודעה</button>` : ''}`;
  } else if (step === 'job') {
    const K = wizKind(d.title), other = !!spec.other || (!K.kind && String(d.title || '').trim() !== '');
    body = `<p class="wiz-q">מה העבודה?</p>
<div class="wiz-grid">${WIZ_KINDS.map(k => opt('wiz-kind', `data-k="${esc(k)}"`, !other && K.kind === k, k)).join('')}${opt('wiz-kind', 'data-k=""', other, 'משהו אחר')}</div>
${!other && WIZ_SIZED.has(K.kind) ? `<p class="wiz-sub">כמה ליטר?</p><div class="wiz-grid g4">${WIZ_SIZES.map(z => opt('wiz-size', `data-z="${z}"`, K.size === z, `<span class="num">${z}</span>`)).join('')}</div>` : ''}
${other ? `<div class="field" style="margin-top:14px"><label for="w-title">מה צריך לעשות?</label><input class="input" id="w-title" dir="auto" name="title" value="${esc(d.title)}" maxlength="120" autocomplete="off" enterkeyhint="next" placeholder="${any}"></div>` : ''}`;
  } else if (step === 'who') {
    const srcs = spec.id && j.source === 'site' ? ['site'] : ['private', 'contractor', 'chromagen'].concat(d.source === 'site' ? ['site'] : []);
    body = `<p class="wiz-q">מי הלקוח?</p>
<div class="wiz-grid g3" role="radiogroup" aria-label="מקור">${srcs.map(x => opt('wiz-src', `data-s="${x}"`, d.source === x, WIZ_SRC[x])).join('')}</div>
${d.source === 'contractor' ? `<div class="field" style="margin-top:12px"><label for="w-source_name">שם הקבלן</label><input class="input" id="w-source_name" dir="auto" name="source_name" value="${esc(d.source_name)}" maxlength="60" autocomplete="off"></div>` : ''}
<div class="field" style="margin-top:12px"><label for="w-phone">טלפון</label><input class="input num" id="w-phone" name="phone" type="tel" inputmode="tel" value="${esc(d.phone)}" maxlength="20" autocomplete="off" enterkeyhint="next"></div>
<div class="field"><label for="w-name">שם הלקוח</label><input class="input" id="w-name" dir="auto" name="name" value="${esc(d.name)}" maxlength="60" autocomplete="off" enterkeyhint="next" placeholder="${any}"></div>
${d.source === 'chromagen' ? `<div class="grid2"><div class="field"><label for="w-sale_no">מספר מכירה</label><input class="input num" id="w-sale_no" name="sale_no" value="${esc(d.sale_no)}" maxlength="20" inputmode="numeric"></div>
<div class="field"><label for="w-case_no">מספר פניה (אחריות)</label><input class="input num" id="w-case_no" name="case_no" value="${esc(d.case_no || '')}" maxlength="20" inputmode="numeric"></div></div>` : ''}`;
  } else if (step === 'where') {
    body = `<p class="wiz-q">איפה העבודה?</p>
<div class="field"><span class="lbl">יישוב</span><div class="wiz-grid">${topTowns(d.city).map(c => townOptHTML(c, d.city)).join('')}</div></div>
<div class="field"><label for="w-town">יישוב אחר</label><input class="input" id="w-town" dir="auto" autocomplete="off" value="${esc(spec.townQ || '')}" placeholder="תחילת השם, באיזו שפה שנוח">
<div class="wiz-grid" id="w-town-res">${townResHTML(spec)}</div></div>
<div class="field"><label for="w-address">רחוב ומספר בית</label><input class="input" id="w-address" dir="auto" name="address" value="${esc(d.address)}" maxlength="120" autocomplete="off" enterkeyhint="next" placeholder="${any}"></div>`;
  } else if (step === 'when') {
    const days = Array.from({ length: 7 }, (_, n) => addDays(t, n));
    const other = !!spec.otherDate || (!!d.date && !days.includes(d.date));
    const dayOpt = k => {
      const n = activeOn(k).filter(x => x.id !== spec.id).length, blk = isBlocked(k), closed = !((S.settings.workDays || {})[wdOf(k)] || []).length;
      const near = k === t || k === addDays(t, 1);
      const sub = blk ? 'יום חופש' : n ? (n === 1 ? 'עבודה אחת' : n + ' עבודות') : near ? esc(dm(k)) : '';
      return opt('wiz-date', `data-k="${k}"`, !other && d.date === k, `<b>${k === t ? 'היום' : near ? 'מחר' : `${esc(lng(WD[wdOf(k)], WDS_RU[wdOf(k)].replace(/^./, c => c.toUpperCase())))} <span class="num">${esc(dm(k))}</span>`}</b>${sub ? `<small>${sub}</small>` : ''}`, blk || closed ? 'off' : '');
    };
    const from = toMin(d.from) == null ? '' : toHHMM(toMin(d.from));
    const hours = Array.from({ length: 12 }, (_, n) => toHHMM((7 + n) * 60));
    if (from && !hours.includes(from)) { hours.push(from); hours.sort(); } // a time like 12:15 from a message keeps its own button
    body = `<p class="wiz-q">מתי?</p>
<div class="wiz-grid g3">${days.map(dayOpt).join('')}${opt('wiz-date', 'data-k="other"', other, '<b>תאריך אחר</b>')}${opt('wiz-date', 'data-k=""', !other && !d.date, '<b>בלי תאריך</b><small>עוד לא ידוע</small>')}</div>
${other ? `<div class="field" style="margin-top:12px"><label for="w-date">תאריך</label><input class="input" id="w-date" name="date" type="date" value="${esc(d.date)}"></div>` : ''}
${d.date ? `<div id="w-dayload" style="margin-top:12px">${dayLoadHTML(d.date, spec.id, d.city)}</div>` : ''}
${d.date || other ? `<p class="wiz-sub">באיזו שעה מתחילים?</p>
<div class="wiz-grid g4">${hours.map(h => opt('wiz-from', `data-t="${h}"`, from === h, `<span class="num ltr">${h}</span>`)).join('')}</div>
${!from ? '' : spec.endOpen ? `<div class="field" style="margin-top:12px"><label for="w-to">עד שעה</label>${timeSel('id="w-to" name="to"', d.to, true)}</div>`
      : `<div class="wiz-end"><span>עד שעה</span> <b class="num ltr" id="w-end">${esc(d.to || '')}</b><button type="button" class="wiz-chg" data-act="wiz-end">שינוי</button></div>`}`
      : `<p class="wiz-hint">בלי תאריך העבודה נשמרת ברשימה "מחכות למועד", ואפשר לקבוע לה מועד אחר כך.</p>`}`;
  } else {
    const row = (st, k, v) => `<button type="button" class="wiz-row" data-act="wiz-step" data-s="${st}" data-ret="1"><span class="k">${k}</span><span class="v">${v}</span><span class="wiz-chg">שינוי</span></button>`;
    const miss = '<span class="miss">חסר</span>';
    const who = [d.name ? `<span translate="no">${esc(d.name)}</span>` : '', d.phone ? `<span class="ltr num">${esc(d.phone)}</span>` : ''].filter(Boolean).join(' · ');
    const src = d.source && d.source !== 'private' ? ` <span class="tag ${esc(d.source)}">${esc(SOURCE[d.source] || '')}${d.source_name ? ' · ' + esc(d.source_name) : ''}</span>` : '';
    body = `<p class="wiz-q">בדיקה ושמירה</p>
<div class="wiz-sum">
${row('job', 'מה העבודה', String(d.title || '').trim() ? esc(d.title) : miss)}
${row('who', 'לקוח', (who || miss) + src)}
${row('where', 'כתובת', d.city || d.address ? `<span translate="no">${esc([d.address, d.city].map(x => String(x || '').trim()).filter(Boolean).join(', '))}</span>` : miss)}
${row('when', 'מתי', d.date ? `${esc(dayLong(d.date))} · <span class="ltr num">${esc(d.from || '')}${d.from && d.to ? '–' + esc(d.to) : ''}</span>` : 'עוד בלי תאריך')}
</div>
<div class="field"><label for="w-price">מחיר (₪)</label><input class="input num" id="w-price" name="price" type="number" inputmode="decimal" min="0" step="1" value="${esc(d.price)}"></div>
<label class="switch"><input type="checkbox" name="call_before"${d.call_before ? ' checked' : ''}> להתקשר ללקוח חצי שעה לפני ההגעה</label>
<div class="field"><label for="w-notes">הערות ודגשים</label><textarea class="input" id="w-notes" dir="auto" name="notes" rows="3" maxlength="2000" placeholder="${any}">${esc(d.notes)}</textarea></div>
${d.source === 'chromagen' || d.ext_link ? `<div class="field"><label for="w-ext_link">קישור לעדכון אחרי ביקור (כרומגן)</label><input class="input" id="w-ext_link" name="ext_link" type="url" value="${esc(d.ext_link)}" maxlength="400" dir="ltr"></div>` : ''}`;
  }
  const back = `<button type="button" class="btn ghost wiz-prev" data-act="wiz-back">${ic(lng('right', 'left'), 'sm')}חזרה</button>`;
  const foot = step === 'start' ? ''
    : step === 'check' ? `<div class="wiz-foot">${spec.id ? '' : back}<button class="btn primary" type="submit">${spec.id ? 'שמירה' : 'הוספת העבודה'}</button></div>`
    : spec.ret ? `<div class="wiz-foot"><button class="btn primary" type="submit">חזרה לבדיקה</button></div>`
    : `<div class="wiz-foot">${back}<button class="btn primary" type="submit">המשך</button></div>`;
  return `<div class="wiz wiz-${step}"><div class="sheet-head"><h2 id="sheetTitle">${spec.id ? 'עריכת עבודה' : 'עבודה חדשה'}</h2><button type="button" class="closebtn" data-act="sheet-close" aria-label="סגירה">${ic('x')}</button></div>
${i >= 0 ? `<div class="wiz-n">שלב ${i + 1} מתוך ${WIZ_STEPS.length}</div><div class="wiz-prog" aria-hidden="true"><i style="width:${(i + 1) * 100 / WIZ_STEPS.length}%"></i></div>` : ''}
${spec.found ? `<div class="found wiz-found" role="status">${esc(spec.found)}</div>` : ''}
<form data-form="wiz" novalidate>${body}<div class="err wiz-err" id="w-err" role="alert">${esc(spec.err || '')}</div>${foot}</form></div>`;
};

// ---------- schedule a request ----------
SHEETS.schedule = spec => {
  const j = S.jobs.get(spec.id);
  if (!j) return head('העבודה לא נמצאה');
  const v = spec.values || (spec.values = {
    date: j.starts_at ? jobKey(j) : ((j.pref_days || []).find(k => k >= tomorrowKey()) || ''),
    from: j.starts_at ? jobTime(j) : (j.pref_window === 'noon' ? '12:00' : '08:00'),
    to: j.ends_at ? jobEnd(j) : (j.pref_window === 'noon' ? '14:00' : '10:00'),
    address: j.address || '', city: j.city || '',
  });
  const chips = (j.pref_days || []).map(k => {
    const L = dayLoad(k, j.city);
    return `<button type="button" class="chip" data-act="pick-date" data-k="${k}" aria-pressed="${v.date === k}">${esc(dayShort(k))}${L.near ? ' · באזור' : L.n ? ` · ${L.n}` : ''}</button>`;
  }).join('');
  return `${head(j.starts_at ? 'שינוי מועד' : 'קביעת מועד', `#${esc(j.ref)} · ${esc(j.title || '')}${j.city ? ` · <span translate="no">${esc(j.city)}</span>` : ''}`)}
<form data-form="schedule" novalidate>
${chips ? `<div class="field"><span class="lbl">הימים שהלקוח סימן${j.pref_window ? ' · ' + esc(windowText(j)) : ''}</span><div class="chips">${chips}</div></div>` : ''}
<div class="field"><label for="s-date">תאריך</label><input class="input" id="s-date" name="date" type="date" value="${esc(v.date)}" required></div>
<div id="s-dayload">${dayLoadHTML(v.date, j.id, j.city)}</div>
<div class="grid2"><div class="field"><label for="s-from">משעה</label>${timeSel('id="s-from" name="from" required', v.from)}</div>
<div class="field"><label for="s-to">עד שעה</label>${timeSel('id="s-to" name="to" required', v.to)}</div></div>
${timeChips('s')}
<div class="grid2" style="margin-top:12px"><div class="field"><label for="s-city">יישוב</label><input class="input" id="s-city"${AUTO()} name="city" list="cities2" value="${esc(v.city)}" maxlength="40"></div>
<div class="field"><label for="s-address">רחוב ומספר</label><input class="input" id="s-address"${AUTO()} name="address" value="${esc(v.address)}" maxlength="120"></div></div>
<datalist id="cities2">${allCities().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
<div class="err" id="s-err" role="alert"></div>
<button class="btn primary block" type="submit">שמירה${j.phone ? ' ושליחת אישור בוואטסאפ' : ''}</button>
</form>`;
};

// ---------- WhatsApp ----------
SHEETS.wa = spec => {
  const j = S.jobs.get(spec.id);
  if (!j) return head('העבודה לא נמצאה');
  if (spec.text == null) spec.text = tplText(spec.tpl, j);
  return `${head('הודעה בוואטסאפ', `<span translate="no">${esc(j.name || '')}</span> · <span class="ltr">${esc(showPhone(j.phone))}</span>`)}
<div class="chips" role="radiogroup" aria-label="סוג ההודעה">${TPLS.map(t => `<button type="button" class="chip" role="radio" data-act="tpl" data-k="${t.k}" aria-checked="${t.k === spec.tpl}">${t.label}</button>`).join('')}</div>
<div class="field" style="margin-top:12px"><label for="wa-text">ההודעה (אפשר לערוך לפני השליחה)</label><textarea class="input tpl-preview" id="wa-text" rows="7">${esc(spec.text)}</textarea></div>
${(spec.tpl === 'confirm' || spec.tpl === 'remind') && !j.starts_at ? '<p class="err">לעבודה הזו עוד אין מועד.</p>' : ''}
<a class="btn wa block" id="wa-go" href="${esc(waHref(j.phone, spec.text))}" target="_blank" rel="noopener" data-act="wa-sent">${waIc()}פתיחה בוואטסאפ</a>`;
};

// ---------- search ----------
SHEETS.search = spec => `${head('חיפוש עבודה')}
<input class="input" id="q"${AUTO()} type="search" placeholder="שם, טלפון, יישוב, כתובת או מספר" value="${esc(spec.q || '')}" autofocus autocomplete="off">
<div class="search-res" id="q-res">${searchResultsHTML(spec)}</div>`;
function searchResultsHTML(spec) {
  const q = String(spec.q || '').trim();
  if (q.length < 2) return '<p class="muted small">כתבו לפחות שני תווים.</p>';
  const list = searchLocal(q).concat((spec.remote || []).filter(r => !S.jobs.has(r.id)));
  const more = spec.remoteDone ? '' : `<button type="button" class="btn ghost sm" data-act="search-old">חיפוש גם בעבודות ישנות</button>`;
  if (!list.length) return `<p class="muted small">לא נמצאו עבודות.</p>${more}`;
  return list.slice(0, 40).map(j => `<button type="button" class="job src-${esc(j.source)}" data-act="open-job" data-id="${esc(j.id)}" style="grid-template-columns:auto 1fr">
<span class="time">${j.starts_at ? esc(dm(jobKey(j))) : '—'}<small>${esc(jobTime(j))}</small></span>
<span class="ttl">${esc(j.title || 'עבודה')} <span class="pill ${esc(j.status)}">${esc(statusLabel(j))}</span></span>
<span class="where" translate="no">${j.city ? `<b>${esc(j.city)}</b>` : ''}${j.address ? ' · ' + esc(j.address) : ''}</span>
<span class="who"><span translate="no">${esc(j.name || '')}</span> · #${esc(j.ref)}</span></button>`).join('') + more;
}
function searchLocal(q) {
  const k = q.replace(/\s+/g, ' ').toLowerCase(), digits = q.replace(/\D/g, '');
  return [...S.jobs.values()].filter(j => {
    if (digits.length >= 3 && (String(j.phone_norm || '').includes(digits) || String(j.ref) === digits || String(j.sale_no || '').replace(/\D/g, '').includes(digits) || String(j.case_no || '').includes(digits))) return true;
    return [j.name, j.city, j.address, j.title, j.notes, j.source_name].some(s => String(s || '').toLowerCase().includes(k));
  }).sort((a, b) => Date.parse(b.starts_at || b.created_at) - Date.parse(a.starts_at || a.created_at));
}

// ---------- settings sheets ----------
SHEETS.tpls = () => {
  const t = S.settings.templates || {};
  return `${head('נוסחי ההודעות', 'אפשר להשתמש ב: {שם} {יום} {תאריך} {משעה} {עד} {כתובת} {יישוב} {עבודה} {מחיר} {מספר} {ביקורת}')}
<form data-form="tpls">${TPLS.filter(x => x.k !== 'free').map(x => `<div class="field"><label for="t-${x.k}">${x.label}</label><textarea class="input" id="t-${x.k}" name="${x.k}" rows="4">${esc(t[x.k] || '')}</textarea></div>`).join('')}
<div class="field"><label for="t-review">קישור לכתיבת ביקורת בגוגל</label><input class="input" id="t-reviewLink" name="reviewLink" type="url" dir="ltr" value="${esc(S.settings.reviewLink || '')}"></div>
<button class="btn primary block" type="submit">שמירה</button></form>`;
};
SHEETS.hours = () => {
  const st = S.settings, wd = st.workDays || {}, w = st.windows || {};
  return `${head('ימים ושעות באתר', 'מה הלקוחות יכולים לבחור במחשבון באתר')}
<form data-form="hours">
<div class="field"><span class="lbl">ימי עבודה</span>
${[0, 1, 2, 3, 4, 5, 6].map(i => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><b style="min-width:52px">${wdName(i)}</b>
<label class="chip"><input type="checkbox" name="wd-${i}-morning"${(wd[i] || []).includes('morning') ? ' checked' : ''}> בוקר</label>
<label class="chip"><input type="checkbox" name="wd-${i}-noon"${(wd[i] || []).includes('noon') ? ' checked' : ''}> צהריים</label></div>`).join('')}</div>
<div class="grid2"><div class="field"><label for="h-mf">בוקר משעה</label>${timeSel('id="h-mf" name="morning-from"', (w.morning || {}).from || '08:00')}</div>
<div class="field"><label for="h-mt">עד שעה</label>${timeSel('id="h-mt" name="morning-to"', (w.morning || {}).to || '12:00')}</div></div>
<div class="grid2"><div class="field"><label for="h-nf">צהריים משעה</label>${timeSel('id="h-nf" name="noon-from"', (w.noon || {}).from || '12:00')}</div>
<div class="field"><label for="h-nt">עד שעה</label>${timeSel('id="h-nt" name="noon-to"', (w.noon || {}).to || '16:00')}</div></div>
<div class="grid2"><div class="field"><label for="h-max">עבודות ביום לכל היותר</label><input class="input num" id="h-max" type="number" min="1" max="12" name="maxPerDay" value="${esc(st.maxPerDay || 4)}"></div>
<div class="field"><label for="h-ahead">כמה ימים קדימה</label><input class="input num" id="h-ahead" type="number" min="3" max="60" name="daysAhead" value="${esc(st.daysAhead || 14)}"></div></div>
<div class="field"><label for="h-notice">היום הראשון שאפשר לבחור</label><select class="input" id="h-notice" name="minNoticeDays">
${[[0, 'היום'], [1, 'מחר'], [2, 'מחרתיים'], [3, 'בעוד 3 ימים']].map(([v, l]) => `<option value="${v}"${Number(st.minNoticeDays == null ? 1 : st.minNoticeDays) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
<p class="small muted">ביום שהגיע למספר העבודות המקסימלי, הלקוחות באתר רואים "מלא". זה לא מגביל אותך כשאתה קובע עבודה כאן.</p>
<button class="btn primary block" type="submit">שמירה</button></form>`;
};
SHEETS.blocks = spec => {
  const list = S.blocks.filter(b => (b.day_to || b.day_from) >= addDays(todayKey(), -1));
  return `${head('ימי חופש', 'בימים האלה האתר לא מציע מועדים')}
${list.length ? `<div class="list" style="margin-top:0">${list.map(b => `<div class="set-row" style="border:1px solid var(--line);border-radius:12px"><span class="grow"><span class="ttl">${esc(dayShort(b.day_from))}${b.day_to && b.day_to !== b.day_from ? ' – ' + esc(dayShort(b.day_to)) : ''}</span><span class="sub" style="display:block" translate="no">${esc(b.reason || '')}</span></span>
<button type="button" class="iconbtn" data-act="del-block" data-id="${esc(b.id)}" aria-label="מחיקת יום החופש">${ic('trash', 'sm')}</button></div>`).join('')}</div>` : '<p class="muted">אין ימי חופש קרובים.</p>'}
<form data-form="block" class="box"><h3>הוספת יום חופש</h3>
<div class="grid2"><div class="field"><label for="b-from">מתאריך</label><input class="input" id="b-from" type="date" name="from" required value="${esc(spec.from || '')}"></div>
<div class="field"><label for="b-to">עד תאריך</label><input class="input" id="b-to" type="date" name="to"></div></div>
<div class="field"><label for="b-reason">סיבה (לא חובה)</label><input class="input" id="b-reason" name="reason" maxlength="60" placeholder="למשל: חג, חופשה"></div>
<button class="btn primary block" type="submit">הוספה</button></form>`;
};
SHEETS.areas = () => `${head('אזורים ויישובים', 'הרשימה שהלקוחות בוחרים ממנה באתר. יישוב בכל שורה.')}
<form data-form="areas">${(S.settings.areas || []).map((a, i) => `<div class="box"><div class="field"><label for="a-n-${i}">שם האזור</label><input class="input" id="a-n-${i}" name="n-${i}" value="${esc(a.name)}" maxlength="40"></div>
<div class="field"><label for="a-c-${i}">יישובים</label><textarea class="input" id="a-c-${i}" name="c-${i}" rows="5">${esc((a.cities || []).join('\n'))}</textarea></div></div>`).join('')}
<div class="box"><div class="field"><label for="a-n-new">אזור חדש (לא חובה)</label><input class="input" id="a-n-new" name="n-new" maxlength="40"></div>
<div class="field"><label for="a-c-new">יישובים</label><textarea class="input" id="a-c-new" name="c-new" rows="3"></textarea></div></div>
<p class="small muted">אזור בלי יישובים נמחק בשמירה.</p>
<button class="btn primary block" type="submit">שמירה</button></form>`;
SHEETS.pass = () => `${head('שינוי סיסמה', esc(S.me ? 'הסיסמה של ' + S.me.name : ''))}
<form data-form="pass"><div class="field"><label for="p1">סיסמה חדשה</label><input class="input" id="p1" name="p1" type="password" autocomplete="new-password" minlength="8" required></div>
<div class="field"><label for="p2">שוב, לבדיקה</label><input class="input" id="p2" name="p2" type="password" autocomplete="new-password" minlength="8" required></div>
<div class="err" id="p-err" role="alert"></div><button class="btn primary block" type="submit">שמירה</button></form>`;
SHEETS.notify = () => {
  const n = S.settings.notify || {};
  return `${head('התראות לטלפון')}
<p>${esc(pushState.text)}</p>
${pushState.hint ? `<p class="small muted">${esc(pushState.hint)}</p>` : ''}
<div class="row-btns" style="margin:10px 0 16px">${pushState.can && !pushState.on ? `<button type="button" class="btn primary" data-act="push-on">${ic('bell', 'sm')}הפעלה בטלפון הזה</button>` : ''}
${pushState.on ? `<button type="button" class="btn ghost" data-act="push-test">שליחת התראת בדיקה</button><button type="button" class="btn ghost" data-act="push-off">כיבוי בטלפון הזה</button>` : ''}</div>
<form data-form="notify" class="box"><h3>מה שולחים</h3>
<label class="switch"><input type="checkbox" name="site"${n.site !== false ? ' checked' : ''}> כל בקשה חדשה מהאתר</label>
<label class="switch"><input type="checkbox" name="added"${n.added !== false ? ' checked' : ''}> כל עבודה שמוסיפים כאן (כרומגן, קבלן, פרטי)</label>
<div class="field"><label for="n-hour">רשימת העבודות של מחר, בשעה</label><select class="input" id="n-hour" name="eveningHour">
<option value="-1"${Number(n.eveningHour) === -1 ? ' selected' : ''}>לא לשלוח</option>
${[17, 18, 19, 20, 21, 22].map(h => `<option value="${h}"${Number(n.eveningHour == null ? 20 : n.eveningHour) === h ? ' selected' : ''}>${h}:00</option>`).join('')}</select></div>
<button class="btn primary block" type="submit">שמירה</button></form>
<p class="small muted">כל טלפון שמפעילים בו התראות מקבל אותן, גם של אבא וגם של משה. על עבודה שמוסיפים כאן, ההתראה מגיעה לטלפון של השני: מי שהוסיף לא מקבל התראה על עצמו.</p>`;
};
SHEETS.gcal = spec => {
  const g = S.settings.gcal || {};
  return `${head('העתק ליומן גוגל', 'כל עבודה שנקבעת, משתנה או מתבטלת כאן, מתעדכנת גם ביומן "עבודות דודים"')}
<div class="box"><b>${g.enabled && g.url ? '<span class="ok-dot"></span> מחובר' : '<span class="off-dot"></span> לא מחובר'}</b>${spec.test ? `<div class="small" style="margin-top:6px">${esc(spec.test)}</div>` : ''}</div>
<h3 style="margin:14px 0 6px">חיבור (פעם אחת, מהמחשב)</h3>
<ol class="steps-list">
<li>פותחים את <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> בחשבון שבו נמצא היומן "עבודות דודים", ונפתח פרויקט חדש.</li>
<li>מוחקים את מה שכתוב שם, ומדביקים את הקוד הזה:
<button type="button" class="btn navy sm block" style="margin-top:6px" data-act="gcal-copy">${ic('copy', 'sm')}העתקת הקוד</button></li>
<li>שומרים, ואז Deploy ← New deployment ← בגלגל השיניים בוחרים Web app. ב-Execute as בוחרים Me, וב-Who has access בוחרים Anyone, ולוחצים Deploy.</li>
<li>גוגל מבקש לאשר גישה ליומן: Authorize access, בוחרים את החשבון, Advanced, ואז Go to (unsafe) ו-Allow. זה הקוד שלך, בחשבון שלך.</li>
<li>מעתיקים את ה-Web app URL ומדביקים כאן:</li></ol>
<form data-form="gcal"><div class="field"><label for="g-url" class="vh">Web app URL</label><input class="input" id="g-url" name="url" type="url" dir="ltr" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(g.url || '')}"></div>
<button class="btn primary block" type="submit">שמירה ובדיקת החיבור</button></form>
${g.enabled && g.url ? `<button type="button" class="btn ghost block" style="margin-top:10px" data-act="gcal-resync">העתקת כל העבודות הקרובות ליומן</button>
<button type="button" class="btn ghost block" style="margin-top:8px" data-act="gcal-off">הפסקת ההעתקה ליומן</button>` : ''}`;
};

// ======================================================================
// actions
// ======================================================================
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function go(view) {
  S.view = view;
  refresh();
  window.scrollTo(0, 0);
}
function setValues(prefix, vals) {
  for (const [k, v] of Object.entries(vals)) {
    const el = $(`#${prefix}-${k}`, inner);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
  }
}
const ACT = {
  'view': el => go(el.dataset.v),
  'reload': () => reload(),
  'day': async el => {
    S.day = el.dataset.k;
    try { await ensureFrom(S.day); } catch (e) { toast(errText(e)); }
    refresh();
  },
  'week': async el => {
    S.day = addDays(S.day, Number(el.dataset.d));
    try { await ensureFrom(weekStart(S.day)); } catch (e) { toast(errText(e)); }
    refresh();
  },
  'toggle-cancelled': () => { S.showCancelled = !S.showCancelled; refresh(); },
  'open-job': el => openSheet({ type: 'job', id: el.dataset.id, live: true }),
  'new-job': () => openSheet(S.simple ? { type: 'wiz', step: 'start' } : { type: 'form', draft: { date: S.view === 'cal' && S.day >= todayKey() ? S.day : '' } }),
  'edit-job': el => openSheet(S.simple ? { type: 'wiz', id: el.dataset.id, step: 'check' } : { type: 'form', id: el.dataset.id }),
  'simple-on': () => { setSimple(true, true); refresh(); window.scrollTo(0, 0); },
  'simple-off': () => { setSimple(false, true); S.view = 'cal'; S.day = todayKey(); refresh(); window.scrollTo(0, 0); },
  copy: async el => {
    const v = el.dataset.copy || '';
    try { await navigator.clipboard.writeText(v); toast('הועתק: ' + v); }
    catch (_) { toast(v); }
  },
  'schedule': el => openSheet({ type: 'schedule', id: el.dataset.id }),
  'search': () => openSheet({ type: 'search', q: '' }),
  'sheet-close': el => {
    const spec = S.stack[S.stack.length - 1];
    if (spec && spec.type === 'wiz') {
      if (el.id === 'backdrop') return; // a tap outside the steps is not "close": what was filled in would be lost
      wizRead(spec);
      if (spec.orig && JSON.stringify(spec.values) !== spec.orig && !ask('לסגור בלי לשמור?')) return;
    }
    closeSheet();
  },
  'pick-user': el => {
    S.loginUser = Number(el.dataset.i); S.loginErr = '';
    const u = (CFG.users || [])[S.loginUser];
    if (u) setLang(langOf(u.email));
    renderLogin();
  },
  'lang': () => {
    setLang(S.lang === 'ru' ? 'he' : 'ru', true);
    refresh();
    if (S.stack.length) renderSheet(false);
  },
  'src': el => {
    const spec = S.stack[S.stack.length - 1];
    readForm(spec);
    spec.values.source = el.dataset.s;
    renderSheet(false);
  },
  'slot': el => {
    const p = el.dataset.n;
    setTime($(`#${p}-from`, inner), el.dataset.f);
    setTime($(`#${p}-to`, inner), el.dataset.t);
  },
  'pick-date': el => {
    const spec = S.stack[S.stack.length - 1];
    const d = $('#s-date', inner);
    if (d) { d.value = el.dataset.k; d.dispatchEvent(new Event('input', { bubbles: true })); }
    $$('[data-act="pick-date"]', inner).forEach(c => c.setAttribute('aria-pressed', String(c === el)));
    if (spec.values) spec.values.date = el.dataset.k;
  },
  'parse': () => {
    const spec = S.stack[S.stack.length - 1];
    const raw = ($('#f-paste', inner) || {}).value || '';
    readForm(spec);
    const r = applyMessage(raw, spec.values);
    if (!r) { spec.found = 'לא מצאתי בהודעה שם, טלפון או כתובת. אפשר למלא את הפרטים ידנית.'; renderSheet(false); return; }
    if (r.existing) { closeSheet(); setTimeout(() => openSheet({ type: 'job', id: r.existing.id, live: true }), 280); toast(`הבקשה #${r.existing.ref} כבר במערכת`); return; }
    spec.found = r.found;
    renderSheet(false);
  },
  'wiz-step': el => {
    const spec = S.stack[S.stack.length - 1];
    wizRead(spec);
    Object.assign(spec, { step: el.dataset.s, ret: !!el.dataset.ret, err: '', found: '' });
    renderSheet(true);
  },
  'wiz-back': () => {
    const spec = S.stack[S.stack.length - 1], i = WIZ_STEPS.indexOf(spec.step);
    wizRead(spec);
    Object.assign(spec, { step: i > 0 ? WIZ_STEPS[i - 1] : 'start', err: '', found: '' });
    renderSheet(true);
  },
  'wiz-kind': el => {
    const spec = S.stack[S.stack.length - 1], d = spec.values, k = el.dataset.k, was = wizKind(d.title);
    wizRead(spec);
    if (!k) { spec.other = true; if (was.kind) d.title = ''; }
    else { spec.other = false; d.title = WIZ_SIZED.has(k) && was.size ? `${k} ${was.size} ליטר` : k; }
    spec.err = '';
    renderSheet(false);
    if (!k) { const f = $('#w-title', inner); if (f) f.focus(); }
  },
  'wiz-size': el => {
    const spec = S.stack[S.stack.length - 1], d = spec.values, K = wizKind(d.title), z = el.dataset.z;
    if (!K.kind) return;
    d.title = K.size === z ? K.kind : `${K.kind} ${z} ליטר`;
    renderSheet(false);
  },
  'wiz-src': el => { const spec = S.stack[S.stack.length - 1]; wizRead(spec); spec.values.source = el.dataset.s; renderSheet(false); },
  'wiz-town': el => { const spec = S.stack[S.stack.length - 1]; wizRead(spec); spec.values.city = el.dataset.c; spec.townQ = ''; renderSheet(false); },
  'wiz-date': el => {
    const spec = S.stack[S.stack.length - 1], k = el.dataset.k;
    wizRead(spec);
    if (k === 'other') spec.otherDate = true; else { spec.otherDate = false; spec.values.date = k; }
    spec.err = '';
    renderSheet(false);
  },
  'wiz-end': () => { const spec = S.stack[S.stack.length - 1]; wizRead(spec); spec.endOpen = true; renderSheet(false); },
  // a new start keeps the length the job had (two hours when it had none)
  'wiz-from': el => {
    const spec = S.stack[S.stack.length - 1], d = spec.values;
    wizRead(spec);
    const was = toMin(d.from), end = toMin(d.to), a = toMin(el.dataset.t);
    const len = was != null && end > was ? end - was : 60 * (Number(S.settings.jobHours) || 2);
    d.from = el.dataset.t;
    d.to = toHHMM(Math.min(a + len, 23 * 60 + 30));
    spec.err = '';
    renderSheet(false);
  },
  // the copied message straight from the phone's clipboard; when the phone does not allow it, a box to paste into
  'wiz-paste': async () => {
    const spec = S.stack[S.stack.length - 1];
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (_) { text = ''; }
    if (S.stack[S.stack.length - 1] !== spec) return;
    if (!String(text || '').trim()) {
      Object.assign(spec, { manual: true, err: '' });
      renderSheet(false);
      const f = $('#w-paste', inner); if (f) f.focus();
      return;
    }
    wizMessage(spec, text);
  },
  'wiz-read': () => { const spec = S.stack[S.stack.length - 1]; wizMessage(spec, ($('#w-paste', inner) || {}).value || ''); },
  'set-status': async el => {
    const id = el.dataset.id, s = el.dataset.s, j = S.jobs.get(id);
    if (!j) return;
    if (s === 'cancelled' && !ask('לבטל את העבודה?' + (j.gcal_id ? ' היא תימחק גם מיומן גוגל.' : ''))) return;
    if (s === 'scheduled' && !j.starts_at) { openSheet({ type: 'schedule', id }); return; }
    try {
      await saveJob({ status: s }, id);
      toast(s === 'done' ? 'סומן כבוצע' : s === 'cancelled' ? 'העבודה בוטלה' : 'עודכן');
      refresh();
      renderSheet(false);
      if (s === 'done' && j.phone && (S.settings.templates || {}).review) {
        setTimeout(() => { if (ask('לשלוח ללקוח בקשה לביקורת בגוגל?')) openSheet({ type: 'wa', id, tpl: 'review' }); }, 150);
      }
    } catch (e) { toast(errText(e)); }
  },
  'delete-job': async el => {
    const id = el.dataset.id;
    if (!ask('למחוק את העבודה לגמרי? אי אפשר לבטל את זה.')) return;
    const { data, error } = await sb.from('jobs').delete().eq('id', id).select('id');
    if (error) { toast(errText(error)); return; }
    if (!data || !data.length) { toast('העבודה כבר ביומן גוגל, אז מבטלים אותה במקום למחוק'); await reload(true); renderSheet(false); return; }
    S.jobs.delete(id);
    closeSheet(true);
    refresh();
    toast('נמחקה');
  },
  'wa': el => openSheet({ type: 'wa', id: el.dataset.id, tpl: el.dataset.tpl || 'free' }),
  'tpl': el => {
    const spec = S.stack[S.stack.length - 1], j = S.jobs.get(spec.id);
    spec.tpl = el.dataset.k;
    spec.text = tplText(spec.tpl, j || {});
    renderSheet(false);
  },
  'wa-sent': async () => {
    const spec = S.stack[S.stack.length - 1];
    if (!spec || spec.type !== 'wa') return;
    const field = spec.tpl === 'confirm' ? 'confirmed_at' : spec.tpl === 'remind' ? 'reminded_at' : null;
    if (field) { try { await saveJob({ [field]: new Date().toISOString() }, spec.id); refresh(); } catch (_) { /* the message still went out */ } }
    setTimeout(() => closeSheet(), 400);
  },
  'search-old': async () => {
    const spec = S.stack[S.stack.length - 1];
    const q = String(spec.q || '').replace(/[,()*%\\"'״׳.:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) return;
    const digits = q.replace(/\D/g, '');
    const ors = ['name', 'city', 'address', 'title', 'notes'].map(c => `${c}.ilike.*${q}*`);
    if (digits.length >= 3) ors.push(`phone_norm.like.*${digits}*`);
    if (digits.length >= 4 && S.caseCol) ors.push(`case_no.like.*${digits}*`);
    const { data, error } = await sb.from('jobs').select('*').or(ors.join(',')).order('created_at', { ascending: false }).limit(60);
    if (error) { toast(errText(error)); return; }
    spec.remote = data || [];
    spec.remoteDone = true;
    $('#q-res', inner).innerHTML = searchResultsHTML(spec);
  },
  'set-notify': () => { pushCheck().then(() => openSheet({ type: 'notify', live: true })); },
  'set-gcal': () => openSheet({ type: 'gcal' }),
  'set-hours': () => openSheet({ type: 'hours' }),
  'set-blocks': () => openSheet({ type: 'blocks', live: true }),
  'set-areas': () => openSheet({ type: 'areas' }),
  'set-tpls': () => openSheet({ type: 'tpls' }),
  'set-pass': () => openSheet({ type: 'pass' }),
  'del-block': async el => {
    if (!ask('למחוק את יום החופש?')) return;
    const { error } = await sb.from('blocks').delete().eq('id', el.dataset.id);
    if (error) { toast(errText(error)); return; }
    S.blocks = S.blocks.filter(b => b.id !== el.dataset.id);
    renderSheet(false);
    refresh();
  },
  'logout': async () => {
    if (!ask('להתנתק?')) return;
    try { await sb.auth.signOut(); } catch (_) { /* offline */ }
    location.reload();
  },
  'push-on': () => pushOn(),
  'push-off': () => pushOff(),
  'push-test': async () => {
    try {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      const r = await callServer({ op: 'test', endpoint: sub && sub.endpoint });
      toast(r.ok ? 'נשלחה התראת בדיקה' : r.error === 'wait' ? 'אפשר לנסות שוב בעוד כמה שניות' : 'השליחה לא הצליחה');
    } catch (e) { toast(errText(e)); }
  },
  'gcal-copy': async () => {
    try {
      // the script keeps the password the system sends first, so the copied code holds no password
      const g = S.settings.gcal || {};
      const res = await fetch('gcal-script.txt?v=2', { cache: 'no-store' });
      const q = v => String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const code = (await res.text()).replace('__CALENDAR__', q(g.calendar)).replace('__CALENDAR_NAME__', q(g.calendarName || 'עבודות דודים'));
      await navigator.clipboard.writeText(code);
      toast('הקוד הועתק');
    } catch (e) { toast('ההעתקה לא הצליחה: ' + errText(e)); }
  },
  'gcal-resync': async () => {
    try {
      toast('מעתיק…');
      const r = await callServer({ op: 'gcal', sub: 'resync' });
      toast(r.ok ? `הועתקו ${r.done || 0} עבודות ליומן` : 'ההעתקה לא הצליחה: ' + (r.error || ''));
      await reload(true);
    } catch (e) { toast(errText(e)); }
  },
  'gcal-off': async () => {
    if (!ask('להפסיק להעתיק עבודות ליומן גוגל? מה שכבר ביומן נשאר שם.')) return;
    try { await mergeSettings({ gcal: Object.assign({}, S.settings.gcal, { enabled: false }) }); renderSheet(false); refresh(); } catch (e) { toast(errText(e)); }
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACT[el.dataset.act]) return;
  if (el.tagName === 'A' && el.dataset.act !== 'wa-sent') e.preventDefault();
  if (el.tagName === 'BUTTON' && el.type === 'submit') return;
  ACT[el.dataset.act](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.stack.length) { e.preventDefault(); closeSheet(); }
  if (e.key === 'Tab' && S.stack.length) {
    const f = $$('a[href],button:not([disabled]),input,select,textarea', inner).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
document.addEventListener('input', e => {
  const spec = S.stack[S.stack.length - 1];
  if (!spec) return;
  if (e.target.id === 'q' && spec.type === 'search') {
    spec.q = e.target.value; spec.remote = []; spec.remoteDone = false;
    $('#q-res', inner).innerHTML = searchResultsHTML(spec);
  }
  if (e.target.id === 'wa-text' && spec.type === 'wa') {
    spec.text = e.target.value;
    const j = S.jobs.get(spec.id), a = $('#wa-go', inner);
    if (a && j) a.href = waHref(j.phone, spec.text);
  }
  if (e.target.id === 'w-town' && spec.type === 'wiz') {
    spec.townQ = e.target.value;
    $('#w-town-res', inner).innerHTML = townResHTML(spec);
  }
  // a message under a step goes away once the answer is being changed
  if (spec.type === 'wiz' && spec.err) { spec.err = ''; const m = $('#w-err', inner); if (m) m.textContent = ''; }
  if ((e.target.id === 'f-date' || e.target.id === 'f-city') && spec.type === 'form') {
    $('#f-dayload', inner).innerHTML = dayLoadHTML(($('#f-date', inner) || {}).value, spec.id, ($('#f-city', inner) || {}).value);
  }
  if ((e.target.id === 's-date' || e.target.id === 's-city') && spec.type === 'schedule') {
    const j = S.jobs.get(spec.id);
    $('#s-dayload', inner).innerHTML = dayLoadHTML(($('#s-date', inner) || {}).value, spec.id, ($('#s-city', inner) || {}).value || (j && j.city));
  }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'f-date' || id === 's-date') e.target.dispatchEvent(new Event('input', { bubbles: true }));
  if (id === 'w-date') { const spec = S.stack[S.stack.length - 1]; if (spec && spec.type === 'wiz') { wizRead(spec); renderSheet(false); } }
  // a start at or after the end (or no end yet): the end moves to the usual length of a job, so there is one less list to open
  if (id === 'f-from' || id === 's-from') {
    const to = $(`#${id[0]}-to`, inner), a = toMin(e.target.value);
    if (to && a != null && !(toMin(to.value) > a)) setTime(to, toHHMM(Math.min(a + 60 * (Number(S.settings.jobHours) || 2), 23 * 60 + 30)));
  }
});

// ---------- forms ----------
const FORMS = {
  async login(form) {
    const u = (CFG.users || [])[S.loginUser];
    if (!u) return;
    S.loginBusy = true; S.loginErr = ''; renderLogin();
    let res;
    try { res = await sb.auth.signInWithPassword({ email: u.email, password: form.pw.value }); } catch (e) { res = { error: e }; }
    S.loginBusy = false;
    if (res.error) {
      S.loginErr = /Invalid login/i.test(res.error.message || '') ? 'הסיסמה לא נכונה' : errText(res.error);
      renderLogin();
      return;
    }
    S.session = res.data.session;
    start();
  },
  async job(form, spec) {
    const err = $('#f-err', inner);
    Object.assign(spec.values, formValues(form));
    const r = jobRow(spec.values, spec.id);
    if (r.error) { err.textContent = r.error; return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const saved = await saveJob(r.row, spec.id);
      closeSheet(!spec.id); // an edit returns to the job, a new job closes everything
      if (saved.starts_at) { S.day = jobKey(saved); if (S.view !== 'cal') S.view = 'cal'; }
      refresh();
      toast(spec.id ? 'נשמר' : `נוספה עבודה #${saved.ref}`);
    } catch (e) { err.textContent = errText(e); btn.disabled = false; }
  },
  async wiz(form, spec) {
    wizRead(spec);
    const d = spec.values, step = spec.step, has = x => String(x || '').trim() !== '';
    const fail = msg => { spec.err = msg; renderSheet(false); };
    spec.err = '';
    if (step === 'job' && !has(d.title)) return fail('בוחרים מה העבודה, או כותבים אותה ב"משהו אחר"');
    if (step === 'who' && has(d.phone) && !/^0[2-9]\d{7,8}$|^[1-9]\d{9,14}$/.test(normPhone(d.phone))) return fail('מספר הטלפון לא נראה תקין');
    // a town was typed but not picked from the list under the field: say so, rather than go on without it
    if (step === 'where' && townName(spec.townQ || '').length >= 2) return fail('לוחצים על היישוב ברשימה שמתחת לשדה');
    if (step === 'when' && spec.otherDate && !has(d.date)) return fail('בוחרים תאריך, או "בלי תאריך"');
    if (step === 'when' && has(d.date) && toMin(d.from) == null) return fail('בוחרים באיזו שעה מתחילים');
    if (step !== 'check') {
      Object.assign(spec, { step: spec.ret ? 'check' : WIZ_STEPS[WIZ_STEPS.indexOf(step) + 1], ret: false, found: '' });
      return renderSheet(true);
    }
    const r = jobRow(d, spec.id);
    if (r.error) {
      spec.err = r.error;
      if (r.step && r.step !== 'check') Object.assign(spec, { step: r.step, ret: true });
      return renderSheet(true);
    }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const saved = await saveJob(r.row, spec.id);
      closeSheet(!spec.id); // an edit returns to the job, a new job closes everything
      if (saved.starts_at) { S.day = jobKey(saved); S.view = 'cal'; }
      refresh();
      toast(spec.id ? 'נשמר' : `נוספה עבודה #${saved.ref}`);
      if (S.simple) flashJob(saved.id);
    } catch (e) { spec.err = errText(e); renderSheet(false); }
  },
  async schedule(form, spec) {
    const j = S.jobs.get(spec.id), err = $('#s-err', inner);
    const v = Object.fromEntries(new FormData(form).entries());
    Object.assign(spec.values, v);
    const a = toMin(v.from), b = toMin(v.to);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) { err.textContent = 'צריך לבחור תאריך'; return; }
    if (a == null || b == null || b <= a) { err.textContent = 'צריך שעת התחלה ושעת סיום אחריה'; return; }
    const row = { starts_at: new Date(zoned(v.date, a)).toISOString(), ends_at: new Date(zoned(v.date, b)).toISOString(),
                  city: String(v.city || '').trim(), address: String(v.address || '').trim() };
    if (j.status === 'new' || j.status === 'cancelled') row.status = 'scheduled';
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await saveJob(row, j.id);
      S.day = v.date;
      S.view = 'cal';
      refresh();
      toast('המועד נשמר');
      if (j.phone) {
        S.stack.pop();
        try { history.replaceState({ s: S.stack.length + 1 }, ''); } catch (_) { /* file:// */ }
        S.stack.push({ type: 'wa', id: j.id, tpl: 'confirm' });
        renderSheet(true);
      } else closeSheet();
    } catch (e) { err.textContent = errText(e); btn.disabled = false; }
  },
  async tpls(form) {
    const v = Object.fromEntries(new FormData(form).entries());
    const t = Object.assign({}, S.settings.templates);
    TPLS.forEach(x => { if (x.k in v) t[x.k] = v[x.k]; });
    try { await mergeSettings({ templates: t, reviewLink: String(v.reviewLink || '').trim() }); toast('נשמר'); closeSheet(); refresh(); } catch (e) { toast(errText(e)); }
  },
  async hours(form) {
    const f = new FormData(form), wd = {};
    for (let i = 0; i < 7; i++) wd[i] = ['morning', 'noon'].filter(w => f.get(`wd-${i}-${w}`));
    const w = Object.assign({}, S.settings.windows);
    for (const k of ['morning', 'noon']) {
      const a = f.get(`${k}-from`), b = f.get(`${k}-to`);
      if (toMin(a) == null || toMin(b) == null || toMin(b) <= toMin(a)) { toast('שעות לא תקינות'); return; }
      w[k] = Object.assign({}, w[k], { from: a, to: b });
    }
    const n = x => Math.round(Number(x));
    const patch = { workDays: wd, windows: w, maxPerDay: Math.min(12, Math.max(1, n(f.get('maxPerDay')) || 4)),
                    daysAhead: Math.min(60, Math.max(3, n(f.get('daysAhead')) || 14)), minNoticeDays: Math.min(3, Math.max(0, n(f.get('minNoticeDays')) || 0)) };
    try { await mergeSettings(patch); toast('נשמר'); closeSheet(); refresh(); } catch (e) { toast(errText(e)); }
  },
  async block(form) {
    const v = Object.fromEntries(new FormData(form).entries());
    if (!v.from) return;
    const to = v.to && v.to > v.from ? v.to : null;
    const { data, error } = await sb.from('blocks').insert({ day_from: v.from, day_to: to, reason: String(v.reason || '').trim() }).select().single();
    if (error) { toast(errText(error)); return; }
    S.blocks.push(data);
    S.blocks.sort((a, b) => a.day_from < b.day_from ? -1 : 1);
    toast('נוסף יום חופש');
    renderSheet(true);
    refresh();
  },
  async areas(form) {
    const f = new FormData(form), out = [];
    const split = s => String(s || '').split(/[\n,]+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    (S.settings.areas || []).forEach((a, i) => {
      const name = String(f.get(`n-${i}`) || '').trim(), cities = split(f.get(`c-${i}`));
      if (name && cities.length) out.push({ name, cities });
    });
    const nn = String(f.get('n-new') || '').trim(), nc = split(f.get('c-new'));
    if (nn && nc.length) out.push({ name: nn, cities: nc });
    if (!out.length) { toast('צריך לפחות אזור אחד'); return; }
    try { await mergeSettings({ areas: out }); toast('נשמר'); closeSheet(); refresh(); } catch (e) { toast(errText(e)); }
  },
  async pass(form) {
    const err = $('#p-err', inner);
    if (form.p1.value.length < 8) { err.textContent = 'לפחות 8 תווים'; return; }
    if (form.p1.value !== form.p2.value) { err.textContent = 'שתי הסיסמאות לא זהות'; return; }
    const { error } = await sb.auth.updateUser({ password: form.p1.value });
    if (error) { err.textContent = errText(error); return; }
    toast('הסיסמה עודכנה');
    closeSheet();
  },
  async notify(form) {
    const f = new FormData(form);
    try { await mergeSettings({ notify: { site: !!f.get('site'), added: !!f.get('added'), eveningHour: Number(f.get('eveningHour')) } }); toast('נשמר'); closeSheet(); refresh(); } catch (e) { toast(errText(e)); }
  },
  async gcal(form, spec) {
    const url = String(form.url.value || '').trim();
    if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { toast('הכתובת צריכה להיות ה-Web app URL שמסתיים ב-exec'); return; }
    const g = Object.assign({}, S.settings.gcal, { url, enabled: !!url });
    // the password between the system and the script: random, made once, never shown (the script keeps the first one it gets)
    if (!g.token) g.token = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
    try {
      await mergeSettings({ gcal: g });
      if (!url) { renderSheet(false); refresh(); return; }
      spec.test = 'בודק…'; renderSheet(false);
      const r = await callServer({ op: 'gcal', sub: 'ping' });
      spec.test = r.ok ? `מחובר ליומן "${r.name || ''}"` : `החיבור לא עבד (${r.error || 'שגיאה'}). כדאי לבדוק שהקוד הודבק כולו ושנבחר Anyone.`;
      renderSheet(false);
      refresh();
    } catch (e) { spec.test = errText(e); renderSheet(false); }
  },
};
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form || !FORMS[form.dataset.form]) return;
  e.preventDefault();
  FORMS[form.dataset.form](form, S.stack[S.stack.length - 1]);
});

// ======================================================================
// phone alerts (Web Push through the service worker)
// ======================================================================
const pushState = { can: false, on: false, text: 'בודק…', hint: '' };
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
async function pushCheck() {
  pushState.hint = '';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    pushState.can = false; pushState.on = false;
    pushState.text = 'הטלפון הזה לא תומך בהתראות מהמערכת.';
    if (isIOS() && !standalone()) { pushState.text = 'כדי לקבל התראות באייפון, קודם מוסיפים את המערכת למסך הבית.'; pushState.hint = 'בספארי: כפתור השיתוף, ואז "הוספה למסך הבית". אחר כך פותחים את המערכת מהאייקון החדש.'; }
    return;
  }
  pushState.can = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    pushState.on = !!sub && Notification.permission === 'granted';
  } catch (_) { pushState.on = false; }
  if (Notification.permission === 'denied') { pushState.can = false; pushState.text = 'ההתראות חסומות בטלפון הזה.'; pushState.hint = 'אפשר לאפשר אותן בהגדרות של הדפדפן או של הטלפון.'; return; }
  pushState.text = pushState.on ? 'פעילות בטלפון הזה.' : 'כבויות בטלפון הזה.';
}
async function pushOn() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { await pushCheck(); renderSheet(false); return; }
    const { publicKey } = await callServer({ op: 'key' });
    const reg = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((publicKey.length + 3) % 4)), c => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    const label = `${S.me ? S.me.name : ''} · ${/iPhone|iPad/.test(navigator.userAgent) ? 'אייפון' : /Android/.test(navigator.userAgent) ? 'אנדרואיד' : 'מחשב'}`;
    const { error } = await sb.from('push_subs').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, label, user_id: S.session.user.id });
    if (error) throw error;
    await pushCheck();
    toast('ההתראות הופעלו');
    renderSheet(false); refresh();
  } catch (e) { toast('ההפעלה לא הצליחה: ' + errText(e)); }
}
async function pushOff() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    await pushCheck();
    toast('ההתראות כובו');
    renderSheet(false); refresh();
  } catch (e) { toast(errText(e)); }
}

// ======================================================================
// links from alerts (#job=…, #requests, #tomorrow)
// ======================================================================
function openFromHash(h) {
  const hash = String(h || location.hash || '');
  const m = /#job=([0-9a-f-]{36})/i.exec(hash);
  if (m) {
    const go1 = () => { if (S.jobs.has(m[1])) openSheet({ type: 'job', id: m[1], live: true }); else toast('העבודה לא נמצאה'); };
    S.jobs.has(m[1]) ? go1() : reload(true).then(go1);
  } else if (/#requests|#tomorrow/.test(hash)) {
    go(/#requests/.test(hash) ? 'req' : 'tom');
    const sec = S.simple && $(/#requests/.test(hash) ? '#sim-waiting' : '#sim-tomorrow');
    if (sec) sec.scrollIntoView();
  }
  if (hash) try { history.replaceState(history.state, '', location.pathname + location.search); } catch (_) { /* file:// */ }
}

// ======================================================================
// start
// ======================================================================
async function start() {
  S.ready = false;
  if (myEmail()) { setLang(langOf(myEmail())); setSimple(simpleOf(myEmail())); }
  refresh();
  try {
    const { data: ok, error } = await sb.rpc('is_admin');
    if (error) throw error;
    if (ok !== true) {
      root.innerHTML = `<div class="login"><img src="${LOGO}" alt=""><h1>אין הרשאה</h1><p class="muted">המשתמש מחובר, אבל עוד לא רשום כמנהל במסד הנתונים.<br>צריך להריץ שוב את supabase/schema.sql אחרי יצירת המשתמשים.</p><button type="button" class="btn ghost" data-act="logout">התנתקות</button></div>`;
      return;
    }
    await loadAll();
    const uidNow = S.session && S.session.user && S.session.user.id;
    S.me = S.admins.find(a => a.user_id === uidNow) || { user_id: uidNow, name: (CFG.users || []).find(u => S.session.user.email === u.email)?.name || '' };
    setLang(langOf(S.session.user.email), true);
    setSimple(simpleOf(S.session.user.email));
    S.ready = true;
    S.error = '';
  } catch (e) {
    S.ready = true;
    S.error = errText(e);
  }
  refresh();
  listen();
  pushCheck().then(() => { if (S.view === 'set') refresh(); });
  openFromHash();
}
async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* alerts stay off */ });
    navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.type === 'open') openFromHash(new URL(ev.data.url).hash); });
  }
  if (!sb) return renderLogin();
  try { const { data } = await sb.auth.getSession(); S.session = data && data.session; } catch (_) { S.session = null; }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT') { S.session = null; S.ready = false; setSimple(false); refresh(); }
    else if (session) S.session = session;
  });
  if (!S.session) return renderLogin();
  start();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.ready) reload(true); });
window.addEventListener('online', () => { if (S.ready) reload(true); });
window.__jobs = { S, parseChromagen, parseSiteMsg, areaOf, fillTpl, zoned, il };
boot();
})();
