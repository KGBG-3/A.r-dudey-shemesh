// Supabase Edge Function "notify" · מערכת העבודות של א.ר דודי שמש
//
// Who calls it:
//   the database, after every saved change to a job      {op: 'job', id}
//   the database, every hour (pg_cron)                    {op: 'hourly'}
//   the admin screen                                      {op: 'key'}, {op: 'test', endpoint},
//                                                         {op: 'gcal', sub: 'ping' | 'resync'} (admins only)
//
// What it does:
//   • a phone alert (Web Push) for every new request from the site, once per request
//   • a phone alert for every job added in the system (Chromagen, a contractor, private), to the other admin's phones
//   • in the evening (Israel time), the list of tomorrow's jobs
//   • keeps a copy of every scheduled job in the Google Calendar "עבודות דודים", through a small
//     Google Apps Script that runs in Moshe's Google account (its address and password are kept in
//     settings.gcal, which only the admins can read)
//
// Deploy with "Verify JWT" turned off. Every request is limited here instead:
//   job     only reads the job from the database and acts on what is stored there, so a stray call changes nothing;
//           the new-job alert goes out once (notified_at), only while the job is fresh
//   hourly  acts only at the evening hour, once a day
//   test    only to a phone that is already registered, at most once every 20 seconds
//   gcal    only for a logged-in admin (checked with the caller's own login)
// The web-push key pair is created on first use and kept in public.server_kv, which only the server can read.

const ZONE = 'Asia/Jerusalem';
const SITE = 'https://ardudim.co.il/';
const ADMIN = SITE + 'admin/';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------- bytes ----------
const te = new TextEncoder();
const enc = (s: string): Uint8Array => te.encode(s);
export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function sha(s: string): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc(s)))).slice(0, 32);
}

// ---------- web push (RFC 8291 payload encryption, RFC 8292 VAPID) ----------
export async function encryptPayload(
  p256dh: string, authSecret: string, plaintext: Uint8Array,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<Uint8Array> {
  const uaPublic = unb64u(p256dh);
  const auth = unb64u(authSecret);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const prkKey = await hmac(auth, shared);
  const ikm = (await hmac(prkKey, concat(enc('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, sealed);
}

type Vapid = { jwk: JsonWebKey; pub: string };
export async function vapidAuth(endpoint: string, v: Vapid, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SITE })));
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${v.pub}`;
}
export async function newVapid(): Promise<Vapid> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  return {
    jwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
    pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
  };
}

// ---------- database (REST with the server key) ----------
// deno-lint-ignore no-explicit-any
const env = (k: string): string => ((globalThis as any).Deno?.env.get(k) ?? (globalThis as any).process?.env?.[k] ?? '') as string;
function serverKey(): string {
  try {
    const all = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const v = all.default || Object.values(all)[0];
    if (typeof v === 'string' && v) return v;
  } catch (_) { /* projects without the new keys */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}
function publicKey(): string {
  try {
    const all = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const v = all.default || Object.values(all)[0];
    if (typeof v === 'string' && v) return v;
  } catch (_) { /* projects without the new keys */ }
  return env('SUPABASE_ANON_KEY');
}
// deno-lint-ignore no-explicit-any
async function rest(path: string, opt: { method?: string; body?: unknown; prefer?: string } = {}): Promise<any> {
  const key = serverKey();
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  if (opt.prefer) headers.Prefer = opt.prefer;
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method: opt.method || 'GET', headers, body: opt.body === undefined ? undefined : JSON.stringify(opt.body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${r.status} ${path.split('?')[0]}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
async function kvGet(k: string) {
  const rows = await rest(`server_kv?select=v,updated_at&k=eq.${encodeURIComponent(k)}`);
  return rows.length ? rows[0] : null;
}
async function kvPut(k: string, v: unknown) {
  await rest('server_kv?on_conflict=k', { method: 'POST', body: { k, v, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
}
async function kvAdd(k: string, v: unknown): Promise<boolean> {
  const rows = await rest('server_kv?on_conflict=k', { method: 'POST', body: { k, v }, prefer: 'resolution=ignore-duplicates,return=representation' });
  return rows.length > 0;
}
const kvDel = (k: string) => rest(`server_kv?k=eq.${encodeURIComponent(k)}`, { method: 'DELETE' });
async function vapidKeys(): Promise<Vapid> {
  const have = await kvGet('vapid');
  if (have && have.v && have.v.jwk && have.v.pub) return have.v;
  const v = await newVapid();
  if (await kvAdd('vapid', v)) return v;
  return (await kvGet('vapid')).v; // a parallel request created them first
}
// deno-lint-ignore no-explicit-any
async function settings(): Promise<any> {
  const rows = await rest('settings?select=data&id=eq.main');
  return (rows[0] && rows[0].data) || {};
}
// deno-lint-ignore no-explicit-any
export function prefs(st: any) {
  const n = (st && st.notify) || {};
  const h = Number(n.eveningHour);
  return { site: n.site !== false, added: n.added !== false, eveningHour: n.eveningHour === undefined || n.eveningHour === null || !Number.isFinite(h) ? 20 : h };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PUSH_GAP = 2 * 60e3;

// ---------- Israel time ----------
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
export function il(ms: number) {
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = p.value;
  return {
    y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute,
    key: `${o.year}-${o.month}-${o.day}`, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday),
  };
}
const offsetAt = (ms: number) => { const p = il(ms); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000; };
export function zoned(key: string, min: number): number {
  const [y, m, d] = key.split('-').map(Number);
  const g = Date.UTC(y, m - 1, d, 0, min);
  let t = g - offsetAt(g);
  t = g - offsetAt(t);
  return t;
}
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => { const p = il(ms); return `${pad(p.h)}:${pad(p.mi)}`; };
const WDS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const dayShort = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${WDS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}.${m}`;
};
function showPhone(p: string): string {
  const d = String(p || '').replace(/\D/g, '');
  if (/^05\d{8}$/.test(d) || /^07\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (/^0[2-9]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return p || '';
}

// ---------- sending alerts ----------
type Sub = { endpoint: string; p256dh: string; auth: string; fails: number; user_id: string | null };
async function broadcast(payload: Record<string, string>, only?: string, skipUser?: string) {
  const v = await vapidKeys();
  let subs: Sub[] = await rest('push_subs?select=endpoint,p256dh,auth,fails,user_id');
  if (only) subs = subs.filter((s) => s.endpoint === only);
  if (skipUser) subs = subs.filter((s) => s.user_id !== skipUser);
  const body = enc(JSON.stringify(payload));
  const results = await Promise.all(subs.map(async (s) => {
    try {
      const r = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuth(s.endpoint, v),
          'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high',
        },
        body: await encryptPayload(s.p256dh, s.auth, body),
      });
      const detail = r.ok ? '' : (await r.text()).slice(0, 200);
      return { s, status: r.status, detail };
    } catch (e) {
      return { s, status: 0, detail: String(e) };
    }
  }));
  for (const { s, status, detail } of results) {
    const q = `push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`;
    if (status === 404 || status === 410) await rest(q, { method: 'DELETE' }); // the phone turned alerts off
    else if (status >= 200 && status < 300) await rest(q, { method: 'PATCH', body: { last_ok_at: new Date().toISOString(), fails: 0 } });
    else { console.error('push failed', status, detail); await rest(q, { method: 'PATCH', body: { fails: (s.fails || 0) + 1 } }); }
  }
  return { ok: true, sent: results.filter((x) => x.status >= 200 && x.status < 300).length, of: results.length };
}

// ---------- the Google Calendar copy ----------
// deno-lint-ignore no-explicit-any
type Job = Record<string, any>;
const SOURCE: Record<string, string> = { site: 'מהאתר', chromagen: 'כרומגן', contractor: 'קבלן', private: 'פרטי' };
export function eventFor(j: Job) {
  const src = j.source === 'contractor' ? (j.source_name || 'קבלן')
    : j.source === 'chromagen' ? 'כרומגן' + (j.source_name ? ` ${j.source_name}` : '')
    : SOURCE[j.source] || '';
  const title = `${j.status === 'done' ? '✓ ' : ''}${j.title || 'עבודה'}${src ? ' - ' + src : ''}`;
  const lines: string[] = [];
  if (j.name) lines.push(`לקוח: ${j.name}`);
  const addr = [j.address, j.city].map((s) => String(s || '').trim()).filter(Boolean).join(', ');
  if (addr) lines.push(`כתובת: ${addr}`);
  if (j.phone) lines.push(`טלפון: ${showPhone(j.phone)}`);
  if (j.sale_no) lines.push(`מספר מכירה: ${j.sale_no}`);
  if (j.case_no) lines.push(`מספר פניה: ${j.case_no}`);
  if (j.price !== null && j.price !== undefined) lines.push(`מחיר: ₪${Number(j.price).toLocaleString('en-US')}`);
  if (j.call_before) lines.push('', '⚠️ להתקשר ללקוח חצי שעה לפני ההגעה');
  if (j.notes) lines.push('', String(j.notes));
  const links: string[] = [];
  if (j.ext_link) links.push(`🔗 קישור לעדכון אחרי ביקור:\n${j.ext_link}`);
  if (j.quote_link) links.push(`📄 הצעת המחיר: ${j.quote_link}`);
  links.push(`✏️ במערכת העבודות (#${j.ref}): ${ADMIN}#job=${j.id}`);
  lines.push('', '———————————', ...links);
  return {
    title, location: addr, description: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    start: j.starts_at, end: j.ends_at, color: j.status === 'done' ? 'done' : j.source,
  };
}
// deno-lint-ignore no-explicit-any
async function script(g: any, body: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(g.url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: g.token }),
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch (_) {
      return { ok: false, error: /<html|accounts\.google/i.test(text) ? 'הסקריפט לא פתוח לגישה (Anyone)' : `http ${r.status}` };
    }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}
const patchJob = (id: string, body: Record<string, unknown>) =>
  rest(`jobs?id=eq.${id}`, { method: 'PATCH', body, prefer: 'return=minimal' });
const readJob = async (id: string): Promise<Job | null> => (await rest(`jobs?id=eq.${id}&select=*`))[0] || null;

// one step: bring the calendar copy in line with the stored job. Returns true when something changed.
// deno-lint-ignore no-explicit-any
async function gcalStep(j: Job, g: any, force: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const want = (j.status === 'scheduled' || j.status === 'done') && j.starts_at && j.ends_at;
  if (want) {
    const ev = eventFor(j);
    const hash = await sha(JSON.stringify(ev));
    if (!force && j.gcal_id && j.gcal_hash === hash && j.gcal_state === 'ok') return false;
    const r = await script(g, { op: 'upsert', job: j.id, eventId: j.gcal_id || '', ...ev });
    if (r && r.ok && r.eventId) await patchJob(j.id, { gcal_id: r.eventId, gcal_hash: hash, gcal_state: 'ok', gcal_at: now });
    else await patchJob(j.id, { gcal_state: `error: ${(r && r.error) || 'unknown'}`.slice(0, 160), gcal_at: now });
    return !!(r && r.ok);
  }
  if (j.gcal_id || j.gcal_state === 'ok' || /^error/.test(j.gcal_state || '')) {
    const r = await script(g, { op: 'delete', job: j.id, eventId: j.gcal_id || '' });
    if (r && r.ok) await patchJob(j.id, { gcal_id: null, gcal_hash: null, gcal_state: '', gcal_at: now });
    else await patchJob(j.id, { gcal_state: `error: ${(r && r.error) || 'unknown'}`.slice(0, 160), gcal_at: now });
    return !!(r && r.ok);
  }
  return false;
}
// one job at a time (a short lock in server_kv), re-reading after each step so the last saved state wins
// deno-lint-ignore no-explicit-any
async function gcalSync(id: string, g: any, force = false): Promise<string> {
  const lock = 'gcal-lock:' + id;
  let got = false;
  for (let i = 0; i < 24 && !got; i++) {
    got = await kvAdd(lock, Date.now());
    if (!got) {
      const held = await kvGet(lock);
      if (held && Date.now() - Number(held.v) > 60000) { await kvDel(lock); continue; } // a run that died
      await sleep(500);
    }
  }
  if (!got) return 'busy';
  try {
    let result = 'same';
    for (let i = 0; i < 3; i++) {
      const j = await readJob(id);
      if (!j) return 'gone';
      const changed = await gcalStep(j, g, force && i === 0);
      if (!changed) break;
      result = 'synced';
    }
    return result;
  } finally {
    await kvDel(lock);
  }
}

// the alert for a job added in the system: what, from where, when, where, and who added it
const PUSH_SOURCE: Record<string, string> = { chromagen: 'כרומגן', contractor: 'קבלן', private: 'פרטי', site: 'מהאתר' };
export function addedPush(j: Job, by: string) {
  const src = (PUSH_SOURCE[j.source] || 'עבודה') + (j.source_name ? ` · ${j.source_name}` : '');
  const when = j.starts_at && j.ends_at
    ? `${dayShort(il(Date.parse(j.starts_at)).key)} · ${hm(Date.parse(j.starts_at))}–${hm(Date.parse(j.ends_at))}`
    : 'עוד בלי מועד';
  const lines = [
    `${j.title || 'עבודה'}${j.price ? ` · ₪${Number(j.price).toLocaleString('en-US')}` : ''}`,
    [when, j.city].filter(Boolean).join(' · '),
    by ? `נוספה ע״י ${by}` : '',
  ].filter(Boolean);
  return { title: `עבודה חדשה · ${src} · #${j.ref}`, body: lines.join('\n'), tag: 'job-' + j.id, url: ADMIN + '#job=' + j.id };
}
async function adminName(id: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return '';
  const rows = await rest(`admins?select=name&user_id=eq.${id}`);
  return (rows[0] && rows[0].name) || '';
}

// ---------- operations ----------
async function onJob(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'id' };
  const j = await readJob(id);
  if (!j) return { ok: true, skipped: 'gone' };
  const st = await settings();
  const out: Record<string, unknown> = { ok: true };

  const fresh = !j.notified_at && Date.parse(j.created_at) > Date.now() - 30 * 60e3;
  // a job added in the system (Chromagen, a contractor, private): one alert to the phones of the other admin
  if (fresh && j.created_by) {
    const marked = await rest(`jobs?id=eq.${id}&notified_at=is.null&select=id`,
      { method: 'PATCH', body: { notified_at: new Date().toISOString() }, prefer: 'return=representation' });
    if (marked.length && prefs(st).added) out.push = await broadcast(addedPush(j, await adminName(j.created_by)), undefined, j.created_by);
  }
  // a new request from the site: one alert, only while it is fresh
  else if (fresh && j.source === 'site' && j.status === 'new') {
    const marked = await rest(`jobs?id=eq.${id}&notified_at=is.null&select=id`,
      { method: 'PATCH', body: { notified_at: new Date().toISOString() }, prefer: 'return=representation' });
    if (marked.length && prefs(st).site) {
      // at most one alert every 2 minutes: a burst of requests waits for the next alert (or the hourly check)
      const gate = await kvGet('site-push');
      const last = gate && gate.v ? Number(gate.v.at) || 0 : 0, held = gate && gate.v ? Number(gate.v.held) || 0 : 0;
      if (Date.now() - last < PUSH_GAP) {
        await kvPut('site-push', { at: last, held: held + 1 });
        out.push = { ok: true, held: held + 1 };
      } else {
        await kvPut('site-push', { at: Date.now(), held: 0 });
        const days = (j.pref_days || []).map(dayShort).join(' / ');
        const win = ({ morning: 'בוקר', noon: 'צהריים' } as Record<string, string>)[j.pref_window] || '';
        out.push = await broadcast({
          title: `בקשה חדשה מהאתר · #${j.ref}`,
          body: `${j.title || 'בקשה'}${j.price ? ` · ₪${Number(j.price).toLocaleString('en-US')}` : ''}\n${j.city || ''}${days ? ' · ' + days : ''}${win ? ' · ' + win : ''}` +
            (held ? `\nועוד ${held === 1 ? 'בקשה אחת' : held + ' בקשות'} מהדקות האחרונות` : ''),
          tag: 'job-' + j.id,
          url: ADMIN + '#job=' + j.id,
        });
      }
    }
  }

  const g = st.gcal || {};
  if (g.enabled && g.url && g.token) out.gcal = await gcalSync(id, g);
  return out;
}

async function onHourly() {
  const pref = prefs(await settings());
  // requests that arrived during a burst and were not announced yet
  const gate = await kvGet('site-push');
  if (gate && gate.v && Number(gate.v.held) > 0 && Date.now() - (Number(gate.v.at) || 0) >= PUSH_GAP) {
    const held = Number(gate.v.held);
    await kvPut('site-push', { at: Date.now(), held: 0 });
    if (pref.site) {
      await broadcast({ title: held === 1 ? 'עוד בקשה חדשה מהאתר' : `עוד ${held} בקשות חדשות מהאתר`, body: 'לחיצה כאן לרשימת הבקשות', tag: 'held', url: ADMIN + '#requests' });
    }
  }
  if (pref.eveningHour < 0) return { ok: true, skipped: 'off' };
  const now = il(Date.now());
  if (now.h !== pref.eveningHour) return { ok: true, skipped: 'hour' };
  if (!(await kvAdd('evening:' + now.key, true))) return { ok: true, skipped: 'sent' };
  await rest(`server_kv?k=like.evening:*&k=lt.evening:${addDays(now.key, -7)}`, { method: 'DELETE' });
  const tk = addDays(now.key, 1);
  const from = new Date(zoned(tk, 0)).toISOString(), to = new Date(zoned(addDays(tk, 1), 0)).toISOString();
  const list = await rest(`jobs?select=title,city,starts_at&status=eq.scheduled&starts_at=gte.${from}&starts_at=lt.${to}&order=starts_at`);
  const waiting = await rest('jobs?select=id&status=eq.new&source=eq.site');
  if (!list.length && !waiting.length) return { ok: true, skipped: 'empty' };
  // deno-lint-ignore no-explicit-any
  const lines = list.map((j: any) => `${hm(Date.parse(j.starts_at))} ${j.city || j.title || ''}`.trim());
  const body = [lines.join(' · '), waiting.length ? `${waiting.length === 1 ? 'בקשה אחת' : waiting.length + ' בקשות'} מהאתר מחכות למועד` : '',
                list.length ? 'לחיצה כאן לשליחת תזכורות בוואטסאפ' : ''].filter(Boolean).join('\n');
  return broadcast({
    title: list.length ? `מחר ${list.length === 1 ? 'עבודה אחת' : list.length + ' עבודות'}` : 'אין עבודות מחר',
    body, tag: 'evening', url: ADMIN + (list.length ? '#tomorrow' : '#requests'),
  });
}

async function onTest(endpoint: string) {
  if (!endpoint) return { ok: false, error: 'endpoint' };
  const rows = await rest(`push_subs?select=endpoint&endpoint=eq.${encodeURIComponent(endpoint)}`);
  if (!rows.length) return { ok: false, error: 'unknown' };
  const last = await kvGet('test_last');
  if (last && Date.now() - Number(last.v) < 20000) return { ok: false, error: 'wait' };
  await kvPut('test_last', Date.now());
  return broadcast({ title: 'ההתראות פועלות', body: 'כך תופיע כאן כל בקשה חדשה מהאתר.', tag: 'test', url: ADMIN }, endpoint);
}

// the caller must be logged in as one of the admins (checked with the caller's own login)
async function isAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return false;
  const apikey = req.headers.get('apikey') || publicKey();
  try {
    const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/is_admin`, {
      method: 'POST', headers: { apikey, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}',
    });
    return r.ok && (await r.json()) === true;
  } catch (_) {
    return false;
  }
}
// deno-lint-ignore no-explicit-any
async function onGcal(input: any, req: Request) {
  if (!(await isAdmin(req))) return { ok: false, error: 'login' };
  const g = (await settings()).gcal || {};
  if (!g.url || !g.token) return { ok: false, error: 'not-set' };
  if (input.sub === 'ping') return await script(g, { op: 'ping' });
  if (input.sub === 'resync') {
    if (!g.enabled) return { ok: false, error: 'off' };
    const from = new Date(Date.now() - 24 * 3600e3).toISOString();
    const rows = await rest(`jobs?select=id&status=in.(scheduled,done)&starts_at=gte.${from}&order=starts_at&limit=60`);
    let done = 0;
    for (const r of rows) { if ((await gcalSync(r.id, g, true)) === 'synced') done++; }
    return { ok: true, done, of: rows.length };
  }
  return { ok: false, error: 'sub' };
}

// deno-lint-ignore no-explicit-any
export async function handle(input: any, req: Request) {
  switch (input && input.op) {
    case 'key': return { ok: true, publicKey: (await vapidKeys()).pub };
    case 'job': return await onJob(String(input.id || ''));
    case 'hourly': return await onHourly();
    case 'test': return await onTest(String(input.endpoint || ''));
    case 'gcal': return await onGcal(input, req);
    default: return { ok: false, error: 'op' };
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && typeof D.serve === 'function') {
  D.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    let input = {};
    try { input = await req.json(); } catch (_) { /* no body */ }
    try {
      return Response.json(await handle(input, req), { headers: CORS });
    } catch (e) {
      console.error(e);
      return Response.json({ ok: false, error: 'server' }, { status: 500, headers: CORS });
    }
  });
}
