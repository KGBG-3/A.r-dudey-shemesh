/* tools/ru-check.js — evaluate in a page through tools/cdp.js --eval-file; tools/ru-check.py runs it on every public page. Russian coverage and round trip of the shared components.
   For #privacy-modal, #a11y-modal, #cookie-banner and footer: text nodes and aria-label / title / alt values are read in
   Hebrew, after switching to Russian, after switching back, and after a second switch to Russian.
   Returns per container: hebrewLeft (strings that still contain Hebrew letters in Russian mode), roundTripDiffs (Hebrew
   text that came back different), ruUnstable (Russian that differs on the second switch), plus the page title / description. */
(async function () {
  var HE = /[֐-׿]/;
  var SELS = ['#privacy-modal', '#a11y-modal', '#cookie-banner', 'footer'];
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function snap() {
    return SELS.map(function (s) {
      var el = document.querySelector(s);
      if (!el) return null;
      var texts = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) { if (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue; if (n.nodeValue.trim()) texts.push(n.nodeValue.replace(/\s+/g, ' ').trim()); }
      var attrs = [];
      [el].concat([].slice.call(el.querySelectorAll('[aria-label],[title],[alt]'))).forEach(function (e) {
        ['aria-label', 'title', 'alt'].forEach(function (a) { if (e.hasAttribute(a) && e.getAttribute(a)) attrs.push(a + '=' + e.getAttribute(a)); });
      });
      return { texts: texts, attrs: attrs };
    });
  }
  var isIndex = typeof switchToRussian === 'function' && typeof toggleLang === 'function';
  function lang() { return document.documentElement.lang; }
  function to(l) { if (lang() === l) return; if (isIndex) toggleLang(); else applyLang(l); }
  var startLang = lang();
  to('he'); await sleep(150);
  var he0 = snap(), title0 = document.title;
  to('ru'); await sleep(250);
  var ru1 = snap(), titleRu = document.title, descRu = (document.querySelector('meta[name="description"]') || { getAttribute: function () { return ''; } }).getAttribute('content');
  var btn = document.getElementById('lang-btn');
  var btnRu = btn ? { text: btn.textContent.trim(), aria: btn.getAttribute('aria-label'), lang: btn.getAttribute('lang') } : null;
  to('he'); await sleep(250);
  var he1 = snap(), btnHe = btn ? { text: btn.textContent.trim(), aria: btn.getAttribute('aria-label'), lang: btn.getAttribute('lang') } : null;
  to('ru'); await sleep(250);
  var ru2 = snap();
  to(startLang);
  var out = { page: location.pathname, dirInRu: null, containers: {}, title: { he: title0, ru: titleRu, ruHasHebrew: HE.test(titleRu) }, descRuHasHebrew: HE.test(descRu || ''), langBtn: { whileHebrew: btnHe, whileRussian: btnRu } };
  SELS.forEach(function (s, i) {
    if (!he0[i]) { out.containers[s] = 'MISSING'; return; }
    var left = ru1[i].texts.concat(ru1[i].attrs).filter(function (t) { return HE.test(t); });
    var diffs = [];
    he0[i].texts.forEach(function (t, k) { if (he1[i].texts[k] !== t) diffs.push({ was: t.slice(0, 90), now: (he1[i].texts[k] || '(missing)').slice(0, 90) }); });
    he0[i].attrs.forEach(function (t, k) { if (he1[i].attrs[k] !== t) diffs.push({ was: t, now: he1[i].attrs[k] || '(missing)' }); });
    var unstable = ru1[i].texts.filter(function (t, k) { return ru2[i].texts[k] !== t; });
    out.containers[s] = { textNodes: he0[i].texts.length, hebrewLeft: left.map(function (t) { return t.slice(0, 110); }), roundTripDiffs: diffs.slice(0, 12), ruUnstable: unstable.slice(0, 6).map(function (t) { return t.slice(0, 90); }) };
  });
  return out;
})()
