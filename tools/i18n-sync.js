/* tools/i18n-sync.js — evaluate in a SUBPAGE or 404.html:  node tools/cdp.js --page tikun-dahuf.html --eval-file tools/i18n-sync.js
   (tools/i18n-check.py runs it on all of them). Checks the data-i18n system:
   1. htmlVsDict: elements whose Hebrew in the HTML differs from the dictionary's `he` value (the page is switched to Russian
      and back; what changed was different). The HTML and the table must say the same thing.
   2. hebrewLeftInRussian: every visible-or-not text node and aria-label / title / alt / placeholder of the whole page that still
      contains Hebrew letters in Russian mode (untranslated text).
   3. keysWithoutRussian: data-i18n keys whose element still shows the same Hebrew in Russian mode (no Russian for the key,
      neither in the page's I18N nor in the shared UI table), or is empty in Russian mode (ru: ''); the same for a
      data-i18n-attr attribute that is empty in Russian mode.
   4. docTitle (he / ru / backToHe) and docDesc (ruHasHebrew / backToHe): the doc_title / doc_desc keys.
   The page is left in Hebrew. */
(function () {
  var HE = /[֐-׿]/;
  var norm = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
  var els = [].slice.call(document.querySelectorAll('[data-i18n]'));
  var before = els.map(function (el) { return norm(el.innerHTML); });
  var attrEls = [].slice.call(document.querySelectorAll('[data-i18n-attr]'));
  var pairsOf = function (el) { return el.getAttribute('data-i18n-attr').split(';').map(function (p) { var x = p.split(':'); return x.length === 2 ? [x[0].trim(), x[1].trim()] : null; }).filter(Boolean); };
  var attrBefore = attrEls.map(function (el) { return pairsOf(el).map(function (p) { return el.getAttribute(p[0]); }); });
  var attrRu;
  var title0 = document.title, md = document.querySelector('meta[name="description"]'), desc0 = md ? md.getAttribute('content') : null;
  applyLang('ru');
  var ruState = els.map(function (el) { return norm(el.innerHTML); });
  attrRu = attrEls.map(function (el) { return pairsOf(el).map(function (p) { return el.getAttribute(p[0]); }); });
  var left = [];
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
  while ((n = w.nextNode())) {
    var p = n.parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
    if (HE.test(n.nodeValue)) { var holder = p.closest('[data-i18n]'); left.push((holder ? 'key ' + holder.getAttribute('data-i18n') : 'NO data-i18n') + ': ' + norm(n.nodeValue).slice(0, 80)); }
  }
  [].forEach.call(document.querySelectorAll('[aria-label],[title],[alt],[placeholder]'), function (el) {
    ['aria-label', 'title', 'alt', 'placeholder'].forEach(function (a) { var v = el.getAttribute(a); if (v && HE.test(v)) left.push(a + ' on <' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + '>: ' + v.slice(0, 80)); });
  });
  var titleRu = document.title, descRu = md ? md.getAttribute('content') : null;
  applyLang('he');
  var diffs = [], missing = [];
  els.forEach(function (el, i) {
    var now = norm(el.innerHTML), key = el.getAttribute('data-i18n');
    if (now !== before[i]) diffs.push({ key: key, html: before[i].slice(0, 160), dict: now.slice(0, 160) });
    if ((ruState[i] === before[i] && HE.test(before[i])) || (!ruState[i] && before[i])) missing.push(key);
  });
  attrEls.forEach(function (el, i) {
    pairsOf(el).forEach(function (p, k) {
      var now = el.getAttribute(p[0]);
      if (now !== attrBefore[i][k]) diffs.push({ key: p[0] + ':' + p[1], html: attrBefore[i][k], dict: now });
      if (attrBefore[i][k] && !attrRu[i][k]) missing.push(p[0] + ':' + p[1]);
    });
  });
  return { dataI18nElements: els.length, htmlVsDict: diffs, hebrewLeftInRussian: left, keysWithoutRussian: missing,
    docTitle: { he: title0, ru: titleRu, backToHe: document.title === title0 }, docDesc: { ruHasHebrew: HE.test(descRu || ''), backToHe: (md ? md.getAttribute('content') : null) === desc0 } };
})()
