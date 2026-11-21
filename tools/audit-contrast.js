/* tools/audit-contrast.js — evaluate in a page:  node tools/cdp.js --page index.html --eval-file tools/audit-contrast.js
   (add --width 390 for the phone layout, --ls a11ySettings=… for a saved mode). Lists visible text and icons whose contrast against their
   effective background is under the WCAG AA minimum. Returns { checked, fails: [...] }, worst first, at most 80 rows.
   Text: 4.5:1, or 3:1 for large text (>= 24px, or >= 18.66px bold). SVG icons that take currentColor: 3:1.
   The background is the nearest ancestor with an opaque background-color or a gradient (every colour stop is tried and
   the worst one counts); a photo behind text cannot be judged and is reported as bg "image". Semi-transparent colours
   are blended over what lies behind them. A heuristic: read each row before acting on it. */
(function () {
  function parse(c) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(c || '');
    if (!m) return null;
    var a = m[4] === undefined ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function over(top, under) { var a = top.a; return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 }; }
  function lum(c) { function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
  function hex(c) { return '#' + [c.r, c.g, c.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  // every background layer from the element up to the root: [{colors:[…]}] nearest first
  function backgrounds(el) {
    var layers = [], image = false;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n), bi = cs.backgroundImage, bc = parse(cs.backgroundColor);
      if (bi && bi !== 'none') {
        var stops = (bi.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
        if (/gradient/.test(bi) && stops.length) layers.push(stops);
        if (/url\(/.test(bi)) image = true;
      }
      if (bc && bc.a > 0) layers.push([bc]);
      if (layers.length && layers[layers.length - 1].every(function (c) { return c.a >= 0.99; })) break;
    }
    return { layers: layers, image: image };
  }
  function effective(el) {
    var b = backgrounds(el), base = [{ r: 255, g: 255, b: 255, a: 1 }], opaque = false;
    // compose from the farthest layer to the nearest; several stops → several candidates
    var cands = base;
    for (var i = b.layers.length - 1; i >= 0; i--) {
      var next = [];
      b.layers[i].forEach(function (c) { cands.forEach(function (u) { next.push(c.a >= 0.99 ? c : over(c, u)); }); });
      cands = next.slice(0, 12);
      if (b.layers[i].every(function (c) { return c.a >= 0.99; })) opaque = true;
    }
    return { cands: cands, image: b.image && !opaque };
  }
  function visible(el) {
    var r = el.getBoundingClientRect();
    if (!(r.width && r.height)) return false;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
      if (n.getAttribute('aria-hidden') === 'true' && n.tagName !== 'svg' && n.tagName !== 'SPAN' && n.tagName !== 'I') return false;
    }
    return true;
  }
  function path(el) {
    var out = [];
    for (var n = el, k = 0; n && n.nodeType === 1 && k < 4; n = n.parentElement, k++) {
      var c = (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '';
      out.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + String(c).trim().split(/\s+/).slice(0, 2).join('.') : ''));
    }
    return out.join(' > ');
  }
  var fails = [], checked = 0, seen = new Set();
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    var t = node.nodeValue.trim();
    if (!t) continue;
    var el = node.parentElement;
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) || !visible(el)) continue;
    seen.add(el);
    var cs = getComputedStyle(el), fg = parse(cs.color);
    if (!fg) continue;
    var e = effective(el), size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    var need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    var worst = null;
    e.cands.forEach(function (bg) { var f = fg.a < 0.99 ? over(fg, bg) : fg; var r = ratio(f, bg); if (!worst || r < worst.r) worst = { r: r, bg: bg, fg: f }; });
    checked++;
    if (worst && worst.r < need - 0.005) fails.push({ kind: 'text', ratio: Math.round(worst.r * 100) / 100, need: need, color: hex(worst.fg), bg: e.image ? 'image (over ' + hex(worst.bg) + ')' : hex(worst.bg), size: Math.round(size * 10) / 10 + 'px' + (bold ? ' bold' : ''), text: t.replace(/\s+/g, ' ').slice(0, 50), el: path(el) });
  }
  [].forEach.call(document.querySelectorAll('svg'), function (svg) {
    if (!visible(svg)) return;
    var cs = getComputedStyle(svg), uses = svg.getAttribute('fill') === 'currentColor' || svg.getAttribute('stroke') === 'currentColor' || /currentColor/.test(svg.innerHTML.slice(0, 2000));
    if (!uses) return;
    var fg = parse(cs.color);
    if (!fg) return;
    var e = effective(svg.parentElement || svg), worst = null;
    e.cands.forEach(function (bg) { var f = fg.a < 0.99 ? over(fg, bg) : fg; var r = ratio(f, bg); if (!worst || r < worst.r) worst = { r: r, bg: bg, fg: f }; });
    checked++;
    if (worst && worst.r < 3 - 0.005) fails.push({ kind: 'icon', ratio: Math.round(worst.r * 100) / 100, need: 3, color: hex(worst.fg), bg: e.image ? 'image (over ' + hex(worst.bg) + ')' : hex(worst.bg), text: (svg.parentElement.getAttribute('aria-label') || svg.parentElement.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), el: path(svg) });
  });
  fails.sort(function (a, b) { return a.ratio - b.ratio; });
  return { checked: checked, failing: fails.length, fails: fails.slice(0, 80) };
})()
