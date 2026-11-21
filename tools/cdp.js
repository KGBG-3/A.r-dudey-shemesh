#!/usr/bin/env node
/* tools/cdp.js — open a page of the site in headless Chromium and run steps in it. No npm dependencies (Node 22+, for its
   built-in WebSocket). Developer tool only: the site never loads it.

   Needs a Chromium build: $CHROME if set, else Playwright's Chromium (any ~/Library/Caches/ms-playwright/chromium-*
   or ~/.cache/ms-playwright/chromium-*, installed by "npx playwright install chromium"), else Google Chrome or Chromium
   in their usual places (macOS /Applications, Linux /usr/bin).

   It serves the repo itself on a free local port (like GitHub Pages: a missing path gets 404.html with status 404),
   so cookies, localStorage, root-absolute paths and fetch all behave as on the live site. Every run uses a fresh browser profile.

   node tools/cdp.js --page index.html [options]      (run from the repo root)
     --root DIR          folder to serve (default: the current directory)
     --page PATH         page to open, e.g. index.html, "index.html?l=ru", "tikun-dahuf.html#x", "no/such/page"
     --width N --height N   viewport (default 1440x900; a width under 768 emulates a phone)
     --ls key=value      set a localStorage item before the page's scripts run (repeatable), e.g. --ls ardudim_lang=ru --ls cookiesAccepted=1
     --reduced-motion    emulate prefers-reduced-motion: reduce
     --block SUBSTR      block requests whose URL contains SUBSTR (repeatable), e.g. --block googletagmanager --block fonts.g
     --net SUBSTR        list in the output ("requests") every network request whose URL contains SUBSTR (repeatable), e.g. --net google --net doubleclick
     --wait MS           wait after the load event before the steps (default 1200)
     --timeout SEC       hard stop for the whole run (default 150)
     --eval "JS"         one expression to evaluate (may be an async IIFE); its value is printed as JSON
     --eval-file F.js    the same, with the expression read from a file (in a steps file: {"evalFile": "/abs/F.js"})
     --steps FILE.json   a list of steps instead of --eval. Each step is an object with ONE of:
                           {"eval": "JS expression"}                 → value goes to results[]
                           {"key": "Tab", "count": 3, "shift": false} → real key presses (Tab, Enter, Escape, Space, ArrowDown, …)
                           {"click": "css selector"}                 → real mouse click at the element's centre (scrolled into view first)
                           {"type": "text"}                          → types text into the focused element
                           {"wait": 500}
                           {"shot": "/abs/path.png", "full": false}  → screenshot
                           {"focused": true}                         → describes document.activeElement → results[]
     --shot FILE.png     screenshot at the end (--full for the whole page)
   Output (stdout, JSON): { url, status, results: [...], errors: [console errors and uncaught exceptions], cookies: [names] }
   (plus requests: [...] with --net). Exit code 2: bad arguments or no Chromium; 3: timeout. Screenshots go only where
   --shot / "shot" say: keep them out of the repo (it is public).
*/
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const opt = { ls: [], block: [], net: [], width: 1440, height: 900, wait: 1200, root: process.cwd() };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--ls') opt.ls.push(args[++i]);
  else if (a === '--net') opt.net.push(args[++i]);
  else if (a === '--block') opt.block.push(args[++i]);
  else if (a === '--full') opt.full = true;
  else if (a === '--reduced-motion') opt.reduced = true;
  else if (a.startsWith('--')) opt[a.slice(2)] = args[++i];
}
if (!opt.page) { console.error('usage: node tools/cdp.js --page index.html [--eval "…" | --steps file.json] (see the header of this file)'); process.exit(2); }
opt.root = path.resolve(opt.root);
opt.width = Number(opt.width); opt.height = Number(opt.height); opt.wait = Number(opt.wait);

function findChrome() {
  if (process.env.CHROME) return fs.existsSync(process.env.CHROME) ? process.env.CHROME : null;
  const home = os.homedir();
  const found = [];
  // Playwright's own Chromium, newest build first
  for (const dir of [path.join(home, 'Library/Caches/ms-playwright'), path.join(home, '.cache/ms-playwright')]) {
    let names = [];
    try { names = fs.readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])); } catch (e) {}
    for (const n of names) {
      found.push(path.join(dir, n, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'));
      found.push(path.join(dir, n, 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium'));
      found.push(path.join(dir, n, 'chrome-linux/chrome'));
    }
  }
  found.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return found.find(p => fs.existsSync(p)) || null;
}
const CHROME = findChrome();
if (!CHROME) {
  console.error('cdp.js: no Chromium found' + (process.env.CHROME ? ' at $CHROME (' + process.env.CHROME + ')' : '') + '.\n' +
    'Install one of: Playwright\'s Chromium ("npx playwright install chromium"), or Google Chrome (https://www.google.com/chrome/).\n' +
    'Or point $CHROME at any Chromium-based browser binary, e.g. CHROME=/path/to/chrome node tools/cdp.js ...');
  process.exit(2);
}

const MIME = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', xml: 'application/xml',
  txt: 'text/plain; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon', webmanifest: 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(opt.root, p);
  let status = 200;
  if (!file.startsWith(opt.root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const nf = path.join(opt.root, '404.html');
    status = 404;
    if (!fs.existsSync(nf)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
    file = nf;
  }
  res.writeHead(status, { 'content-type': MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

const KEYS = { Tab: 9, Enter: 13, Escape: 27, Space: 32, ' ': 32, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, Backspace: 8 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-prof-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--mute-audio', `--window-size=${opt.width},${opt.height}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let done = false;
  const finish = (code) => { if (done) return; done = true; try { chrome.kill('SIGKILL'); } catch (e) {} server.close(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(code); };
  const hardStop = setTimeout(() => { console.error('cdp.js: timeout'); finish(3); }, Number(opt.timeout || 150) * 1000);
  // never leave a headless browser behind: also when this script is interrupted or killed by a shell timeout
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => process.on(sig, () => finish(130)));
  process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch (e) {} });

  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    chrome.stderr.on('data', d => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res(m[1]); });
    chrome.on('exit', () => rej(new Error('Chromium exited early: ' + buf.slice(0, 400))));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket error')); });
  let id = 0;
  const pending = new Map();
  const handlers = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) handlers.forEach(h => h(m));
  };
  const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {}, sessionId })); });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (method, params) => send(method, params, sessionId);
  const errors = [];
  const requests = [];
  let status = null, loaded = null;
  const loadedP = new Promise(r => { loaded = r; });
  handlers.push(m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push('exception: ' + ((d.exception && d.exception.description) || d.text).split('\n').slice(0, 2).join(' ') + (d.url ? ' @' + d.url.replace(/^.*\//, '') + ':' + d.lineNumber : '')); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 300));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text.slice(0, 200) + (m.params.entry.url ? ' @' + m.params.entry.url.slice(0, 120) : ''));
    if (m.method === 'Network.responseReceived' && m.params.type === 'Document' && status === null) status = m.params.response.status;
    if (m.method === 'Network.requestWillBeSent' && opt.net.some(n => m.params.request.url.indexOf(n) !== -1)) requests.push(m.params.request.url.slice(0, 260));
    if (m.method === 'Page.loadEventFired') loaded();
  });
  await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: opt.width, height: opt.height, deviceScaleFactor: 1, mobile: opt.width < 768 });
  if (opt.width < 768) await S('Emulation.setTouchEmulationEnabled', { enabled: true });
  if (opt.reduced) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  if (opt.block.length) await S('Network.setBlockedURLs', { urls: opt.block.map(b => '*' + b + '*') });
  if (opt.ls.length) {
    const pairs = opt.ls.map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; });
    await S('Page.addScriptToEvaluateOnNewDocument', { source: `try{${JSON.stringify(pairs)}.forEach(function(p){if(!sessionStorage.getItem('__cdp_'+p[0])){localStorage.setItem(p[0],p[1]);sessionStorage.setItem('__cdp_'+p[0],'1')}})}catch(e){}` });
  }
  const url = `http://localhost:${port}/${opt.page.replace(/^\//, '')}`;
  await S('Page.navigate', { url });
  await Promise.race([loadedP, sleep(20000)]);
  await sleep(opt.wait);

  const evalJs = async (expression) => {
    const r = await S('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) return { error: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
    return r.result.value === undefined ? null : r.result.value;
  };
  const FOCUSED = `(function(){var e=document.activeElement;if(!e)return null;var r=e.getBoundingClientRect();return {tag:e.tagName.toLowerCase(),id:e.id||undefined,cls:(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||undefined,text:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,70),visible:!!(r.width||r.height),inViewport:r.bottom>0&&r.top<innerHeight}})()`;
  const shot = async (file, full) => { const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); };
  const results = [];
  let steps = [];
  if (opt.steps) steps = JSON.parse(fs.readFileSync(opt.steps, 'utf8'));
  else if (opt['eval-file']) steps = [{ evalFile: opt['eval-file'] }];
  else if (opt.eval) steps = [{ eval: opt.eval }];
  for (const st of steps) {
    if (st.evalFile !== undefined) results.push(await evalJs(fs.readFileSync(st.evalFile, 'utf8')));
    else if (st.eval !== undefined) results.push(await evalJs(st.eval));
    else if (st.key !== undefined) {
      const code = KEYS[st.key] || st.key.toUpperCase().charCodeAt(0);
      const key = st.key === 'Space' ? ' ' : st.key;
      for (let k = 0; k < (st.count || 1); k++) {
        const base = { key, code: st.key === 'Space' ? 'Space' : (st.key.length === 1 ? 'Key' + st.key.toUpperCase() : st.key), windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: st.shift ? 8 : 0 };
        await S('Input.dispatchKeyEvent', Object.assign({ type: (key === 'Enter' || key === ' ' || key.length === 1) ? 'keyDown' : 'rawKeyDown', text: key === 'Enter' ? '\r' : (key.length === 1 ? key : undefined) }, base));
        await S('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
        await sleep(60);
      }
    } else if (st.click !== undefined) {
      const box = await evalJs(`(function(){var e=document.querySelector(${JSON.stringify(st.click)});if(!e)return null;e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      if (!box) { results.push({ error: 'click: no element ' + st.click }); continue; }
      await sleep(120);
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    } else if (st.type !== undefined) await S('Input.insertText', { text: st.type });
    else if (st.wait !== undefined) await sleep(st.wait);
    else if (st.shot !== undefined) await shot(st.shot, st.full);
    else if (st.focused) results.push(await evalJs(FOCUSED));
  }
  if (opt.shot) await shot(opt.shot, opt.full);
  const cookies = (await S('Network.getCookies', { urls: [url] })).cookies.map(c => c.name);
  clearTimeout(hardStop);
  process.stdout.write(JSON.stringify(opt.net.length ? { url, status, results, errors, cookies, requests } : { url, status, results, errors, cookies }, null, 1) + '\n');
  finish(0);
})().catch(e => { console.error('cdp.js failed: ' + e.message); process.exit(1); });
