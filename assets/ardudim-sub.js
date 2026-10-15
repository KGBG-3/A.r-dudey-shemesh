/* ============================================================
   ardudim-sub.js: what the subpages do, the same way index.html does it
   (top bar and mobile menu, floating buttons, accessibility menu, dialogs,
   cookie banner, Hebrew / Russian, yellow marker, scroll entrances).
   Load it at the end of <body>, after the page's own `var I18N = { key: { he, ru } }`.
   Parts between "@src index.html" and "@end-src" are copied word for word from index.html,
   and python3 tools/check-shared.py checks them. Everything else is subpage code.
   ============================================================ */
(function () {
  var html = document.documentElement;
  var LANG_KEY = 'ardudim_lang';            // one language choice for all the pages
  var A11Y_STORAGE_KEY = 'a11ySettings';    // the same key as index.html, so the settings follow the visitor
  // index.html's six features, plus the large cursor that the subpages' accessibility statement promises
  var A11Y_FEATURES = ['text-large', 'text-xlarge', 'readable-font', 'high-contrast', 'highlight-links', 'pause-anim', 'big-cursor'];
  var PHONE_MENU = window.matchMedia ? window.matchMedia('(max-width:859px)') : null;

  // ---------- strings shared by every subpage (the page's own I18N wins on the same key) ----------
  var UI = {
    ui_skip: { he: 'דלג לתוכן הראשי', ru: 'Перейти к основному содержанию' },
    ui_brand: { he: 'א.ר דודי שמש', ru: 'А.Р. Дудей Шемеш' },
    ui_nav_main: { he: 'ניווט ראשי', ru: 'Главное меню' },
    ui_menu: { he: 'תפריט', ru: 'Меню' },
    ui_menu_close: { he: 'סגור תפריט', ru: 'Закрыть меню' },
    ui_nav_calc: { he: 'מחשבון מחיר', ru: 'Расчёт цены' },
    ui_nav_reviews: { he: 'ביקורות', ru: 'Отзывы' },
    ui_nav_repairs: { he: 'תיקונים', ru: 'Ремонт' },
    ui_nav_gallery: { he: 'גלריה', ru: 'Галерея' },
    ui_nav_about: { he: 'אודות', ru: 'О нас' },
    ui_nav_contact: { he: 'צור קשר', ru: 'Свяжитесь с нами' },
    ui_call_us: { he: 'חייגו אלינו', ru: 'Позвонить нам' },
    ui_close: { he: 'סגור', ru: 'Закрыть' },
    ui_a11y_open: { he: 'פתח כלי נגישות', ru: 'Открыть инструменты доступности' },
    ui_a11y_title: { he: 'כלי נגישות', ru: 'Инструменты доступности' },
    ui_a11y_textlg: { he: 'הגדל טקסט', ru: 'Увеличить текст' },
    ui_a11y_textxl: { he: 'טקסט גדול מאוד', ru: 'Очень крупный текст' },
    ui_a11y_font: { he: 'גופן קריא', ru: 'Читаемый шрифт' },
    ui_a11y_contrast: { he: 'ניגודיות גבוהה', ru: 'Высокая контрастность' },
    ui_a11y_links: { he: 'הדגש קישורים', ru: 'Выделить ссылки' },
    ui_a11y_anim: { he: 'עצור אנימציות', ru: 'Остановить анимации' },
    ui_a11y_cursor: { he: 'סמן גדול', ru: 'Крупный курсор' },
    ui_a11y_reset: { he: 'איפוס הגדרות נגישות', ru: 'Сбросить настройки доступности' },
    ui_a11y_statement: { he: 'הצהרת נגישות', ru: 'Декларация доступности' },
    ui_cookie_label: { he: 'עוגיות', ru: 'Файлы cookie' },
    ui_cookie_text: { he: 'האתר משתמש בעוגיות בסיסיות לתפקוד האתר, ובעוגיות של Google Ads למדידת פניות שמגיעות מהמודעות שלנו. אפשר לסרב לעוגיות המדידה.', ru: 'Сайт использует базовые файлы cookie для работы и файлы cookie Google Ads для учёта обращений, пришедших из нашей рекламы. От файлов cookie для учёта можно отказаться.' },
    ui_cookie_more: { he: 'לפרטים נוספים ראה את <a href="#privacy" data-open="privacy">מדיניות הפרטיות</a> שלנו.', ru: 'Подробнее в нашей <a href="#privacy" data-open="privacy">политике конфиденциальности</a>.' },
    ui_cookie_accept: { he: 'הבנתי, אני מסכים', ru: 'Понятно, согласен' },
    ui_cookie_decline: { he: 'המשך בלי הסכמה', ru: 'Продолжить без согласия' },
    ui_ft_more: { he: 'מידע נוסף', ru: 'Дополнительная информация' },
    ui_ft_calc: { he: 'מחשבון מחירים לדודי שמש', ru: 'Калькулятор цен на солнечные бойлеры' },
    ui_ft_tikun: { he: 'תיקון דוד שמש', ru: 'Ремонт солнечного бойлера' },
    ui_ft_guf: { he: 'החלפת גוף חימום', ru: 'Замена ТЭНа' },
    ui_ft_chromagen: { he: 'מתקין מורשה כרומגן', ru: 'Монтажник Chromagen' },
    ui_ft_areas: { he: 'אזורי שירות', ru: 'Зоны обслуживания' },
    ui_ft_sanan: { he: 'סנן אבנית לדוד שמש', ru: 'Фильтр от накипи для бойлера' }
  };
  var PAGE = window.I18N || {};
  function str(key, lang) {
    var e = Object.prototype.hasOwnProperty.call(PAGE, key) ? PAGE[key] : UI[key];
    return e && e[lang] !== undefined ? e[lang] : null;
  }

  var curLang = 'he';
  var isRu = function () { return curLang === 'ru'; };

  /* @src index.html #ardudim-design-js · Rubik for the Russian headings */
  // Secular One has no Russian letters → in Russian the headings take them from Rubik Bold,
  // loaded only then (Hebrew visitors never download it)
  function ensureRuFont() {
    if (!isRu() || document.getElementById('font-rubik')) return;
    const l = document.createElement('link');
    l.id = 'font-rubik';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Rubik:wght@700&display=swap';
    document.head.appendChild(l);
  }
  /* @end-src */

  /* @src index.html #ardudim-design-js · marker off before the language changes */
  function unmark() {
    document.querySelectorAll('mark.hl').forEach(m => {
      const p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();   // one text node again, so the page's translation finds the whole sentence
    });
  }
  /* @end-src */

  // yellow marker: <h2 data-mark="key"> marks the word I18N[key][lang] (index.html does the same from a fixed list)
  function mark() {
    document.querySelectorAll('h2[data-mark]').forEach(function (h) {
      if (h.querySelector('mark.hl')) return;
      var word = str(h.getAttribute('data-mark'), curLang);
      if (!word) return;
      var walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), n;
      while ((n = walker.nextNode())) {
        var i = n.nodeValue.indexOf(word);
        if (i < 0) continue;
        var target = n.splitText(i);
        target.splitText(word.length);
        var m = document.createElement('mark');
        m.className = 'hl';
        target.parentNode.replaceChild(m, target);
        m.appendChild(target);
        break;
      }
    });
  }

  // ---------- Hebrew / Russian (data-i18n = inner HTML, data-i18n-attr = "aria-label:key;alt:key") ----------
  function applyLang(lang) {
    curLang = lang === 'ru' ? 'ru' : 'he';
    html.lang = curLang;
    html.dir = curLang === 'ru' ? 'ltr' : 'rtl';
    unmark();
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = str(el.getAttribute('data-i18n'), curLang);
      if (v !== null) el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        if (p.length !== 2) return;
        var v = str(p[1].trim(), curLang);
        if (v !== null) el.setAttribute(p[0].trim(), v);
      });
    });
    mark();
    ensureRuFont();
    try { localStorage.setItem(LANG_KEY, curLang); } catch (e) {}
  }
  function toggleLang() { applyLang(curLang === 'he' ? 'ru' : 'he'); }

  // ---------- dialogs: the focus moves in, stays in (Tab), and goes back to the opener; Escape closes ----------
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  var stack = [];
  function shown(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function focusables(el) { return [].filter.call(el.querySelectorAll(FOCUSABLE), shown); }
  function openDialog(el, o) {
    if (!el || stack.some(function (d) { return d.el === el; })) return;
    o = o || {};
    var d = { el: el, opener: o.opener || document.activeElement, fallback: o.fallback, lock: o.lock, onClose: o.onClose, aria: o.aria !== false };
    stack.push(d);
    if (o.show) o.show(); else el.classList.add('open');
    if (d.aria) el.setAttribute('aria-hidden', 'false');
    if (d.lock) { document.body.style.overflow = 'hidden'; html.style.overflow = 'hidden'; }
    var f = (o.focus && el.querySelector(o.focus)) || focusables(el)[0];
    if (!f) { el.setAttribute('tabindex', '-1'); f = el; }
    f.focus({ preventScroll: true });
  }
  function closeDialog(el) {
    var i = -1;
    stack.forEach(function (d, k) { if (d.el === el) i = k; });
    if (i < 0) return;
    var d = stack.splice(i, 1)[0];
    if (d.onClose) d.onClose(); else el.classList.remove('open');
    if (d.aria) el.setAttribute('aria-hidden', 'true');
    if (d.lock && !stack.some(function (x) { return x.lock; })) { document.body.style.overflow = ''; html.style.overflow = ''; }
    var back = d.opener && document.contains(d.opener) && shown(d.opener) ? d.opener : d.fallback;
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  function isOpen(el) { return stack.some(function (d) { return d.el === el; }); }
  document.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(top.el); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(top.el);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!top.el.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  });

  // ---------- mobile menu: a dialog on phones, a plain row of links on desktop ----------
  var links = document.getElementById('nav-links');
  var overlay = document.getElementById('nav-menu-overlay');
  var burger = document.querySelector('.nav-hamburger');
  function menuInert() {
    if (!links) return;
    if (PHONE_MENU && PHONE_MENU.matches && !links.classList.contains('open')) links.setAttribute('inert', '');
    else links.removeAttribute('inert');
  }
  function openMenu() {
    if (!links) return;
    var ap = document.getElementById('a11y-panel');
    if (ap && isOpen(ap)) closeDialog(ap);
    openDialog(links, {
      opener: burger, focus: '.nav-close', lock: true, aria: false,
      show: function () {
        links.removeAttribute('inert');
        links.classList.add('open'); overlay.classList.add('open'); burger.classList.add('open');
        burger.setAttribute('aria-expanded', 'true');
        links.setAttribute('role', 'dialog'); links.setAttribute('aria-modal', 'true'); links.setAttribute('aria-label', str('ui_nav_main', curLang) || '');
        document.body.classList.add('menu-open');
      },
      onClose: function () {
        links.classList.remove('open'); overlay.classList.remove('open'); burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        links.removeAttribute('role'); links.removeAttribute('aria-modal'); links.removeAttribute('aria-label');
        document.body.classList.remove('menu-open');
        menuInert();
      }
    });
  }
  function closeMenu() { if (links) closeDialog(links); }
  if (burger) burger.addEventListener('click', function () { if (isOpen(links)) closeMenu(); else openMenu(); });
  if (overlay) overlay.addEventListener('click', closeMenu);
  if (links) links.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href]') && isOpen(links)) closeMenu(); });
  if (links) {
    var navClose = links.querySelector('.nav-close');
    if (navClose) navClose.addEventListener('click', closeMenu);
  }
  if (PHONE_MENU) {
    var onBp = function () { if (!PHONE_MENU.matches && isOpen(links)) closeMenu(); menuInert(); };
    if (PHONE_MENU.addEventListener) PHONE_MENU.addEventListener('change', onBp); else if (PHONE_MENU.addListener) PHONE_MENU.addListener(onBp);
  }

  // ---------- accessibility menu (same features and storage as index.html) ----------
  var panel = document.getElementById('a11y-panel');
  var a11yToggle = document.getElementById('a11y-toggle');
  var statement = document.getElementById('a11y-modal');
  var privacy = document.getElementById('privacy-modal');

  /* @src index.html · accessibility widget */
  function toggleA11y(feature) {
    if (!A11Y_FEATURES.includes(feature)) return;
    const body = document.body;
    const cls = 'a11y-' + feature;
    // text size: only one of large/xlarge active at a time
    if (feature === 'text-large') body.classList.remove('a11y-text-xlarge');
    if (feature === 'text-xlarge') body.classList.remove('a11y-text-large');
    body.classList.toggle(cls);
    updateA11yButtonStates();
    saveA11ySettings();
    syncMotion();
  }

  function resetA11y() {
    const body = document.body;
    A11Y_FEATURES.forEach(f => body.classList.remove('a11y-' + f));
    updateA11yButtonStates();
    try { localStorage.removeItem(A11Y_STORAGE_KEY); } catch(e) {}
    syncMotion();
  }

  function updateA11yButtonStates() {
    document.querySelectorAll('.a11y-btn').forEach(btn => {
      const feature = btn.getAttribute('data-a11y');
      const isActive = document.body.classList.contains('a11y-' + feature);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // "עצירת אנימציות" (or prefers-reduced-motion): stop everything now. html.calm stops every animation, transition and smooth scroll
  // (motion CSS); dropping html.motion shows everything that waits to scroll in. Turning it off lets transitions back in at once;
  // the scroll entrances and the slow ambient motion come back on the next page load.
  function syncMotion() {
    const root = document.documentElement;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e) {}
    if (document.body.classList.contains('a11y-pause-anim') || reduce) {
      root.classList.add('calm');
      if (root.classList.contains('motion')) {
        root.classList.remove('motion');
        document.querySelectorAll('.stat-number[data-target]').forEach(el => { el.textContent = el.getAttribute('data-target') + (el.getAttribute('data-suffix') || ''); });
        document.querySelectorAll('.gallery-item').forEach(el => el.classList.add('gal-in'));
        document.querySelectorAll('.repairs').forEach(el => el.classList.add('cards-in'));
      }
    } else if (root.classList.contains('calm')) {
      // turned off: the one-time entrances (hero fade-up, the open panel's fade) already happened, so they do not run again
      root.classList.add('settled');
      root.classList.remove('calm');
    }
  }
  try {
    const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rmq.addEventListener) rmq.addEventListener('change', () => syncMotion());
  } catch(e) {}

  function saveA11ySettings() {
    try {
      const active = A11Y_FEATURES.filter(f => document.body.classList.contains('a11y-' + f));
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(active));
    } catch(e) {}
  }

  function loadA11ySettings() {
    try {
      const saved = localStorage.getItem(A11Y_STORAGE_KEY);
      if (!saved) return;
      const active = JSON.parse(saved);
      if (Array.isArray(active)) {
        active.forEach(f => {
          if (A11Y_FEATURES.includes(f)) document.body.classList.add('a11y-' + f);
        });
        updateA11yButtonStates();
      }
    } catch(e) {}
  }
  /* @end-src */

  function openPanel() {
    openDialog(panel, {
      opener: a11yToggle, fallback: a11yToggle,
      show: function () { panel.classList.add('open'); a11yToggle.setAttribute('aria-expanded', 'true'); },
      onClose: function () { panel.classList.remove('open'); a11yToggle.setAttribute('aria-expanded', 'false'); }
    });
  }
  function toggleA11yPanel() { if (!panel) return; if (isOpen(panel)) closeDialog(panel); else openPanel(); }
  if (a11yToggle) a11yToggle.addEventListener('click', toggleA11yPanel);
  if (panel) {
    panel.querySelectorAll('.a11y-btn[data-a11y]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleA11y(btn.getAttribute('data-a11y')); });
    });
    var pClose = panel.querySelector('.a11y-panel-close');
    if (pClose) pClose.addEventListener('click', function () { closeDialog(panel); });
    var pReset = panel.querySelector('.a11y-reset');
    if (pReset) pReset.addEventListener('click', resetA11y);
    var pStatement = panel.querySelector('.a11y-statement-link');
    if (pStatement) pStatement.addEventListener('click', function () { openModal('a11y'); });
  }

  // ---------- statement / privacy dialogs ----------
  var MODALS = { a11y: statement, privacy: privacy };
  function openModal(name) {
    var el = MODALS[name];
    if (!el) return;
    if (panel && isOpen(panel)) closeDialog(panel);
    if (links && isOpen(links)) closeMenu();
    openDialog(el, { lock: true, fallback: a11yToggle });
  }
  function closeModal(name) { if (MODALS[name]) closeDialog(MODALS[name]); }
  [statement, privacy].forEach(function (el) {
    if (!el) return;
    el.addEventListener('click', function (e) { if (e.target === el) closeDialog(el); });
    el.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeDialog(el); }); });
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-open]') : null;
    if (!a) return;
    e.preventDefault();
    openModal(a.getAttribute('data-open'));
  });

  // ---------- cookie banner: each button does what it says (Google consent mode) ----------
  /* @src index.html · cookie banner buttons */
  // Cookie banner logic: each button sets Google consent to what it says and remembers the choice ('1' = granted, '0' = denied)
  function setCookieConsent(granted) {
    const v = granted ? 'granted' : 'denied';
    if (typeof gtag === 'function') gtag('consent', 'update', {ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v});
    const b = document.getElementById('cookie-banner');
    if (b) b.classList.remove('show');
    document.body.classList.remove('cookie-open');
    document.body.style.removeProperty('--cookie-h');
    try { localStorage.setItem('cookiesAccepted', granted ? '1' : '0'); } catch(e) {}
  }
  function acceptCookies() { setCookieConsent(true); }
  function declineCookies() { setCookieConsent(false); }
  /* @end-src */
  var cAccept = document.querySelector('.cookie-accept'), cDecline = document.querySelector('.cookie-decline');
  function focusMain() { var m = document.getElementById('main-content'); if (m) m.focus({ preventScroll: true }); }
  if (cAccept) cAccept.addEventListener('click', function () { acceptCookies(); focusMain(); });
  if (cDecline) cDecline.addEventListener('click', function () { declineCookies(); focusMain(); });

  // ---------- language button ----------
  var langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.addEventListener('click', toggleLang);

  // ---------- start: saved settings, saved language, marker ----------
  loadA11ySettings();
  syncMotion();
  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
  if (saved === 'ru' || html.lang === 'ru') applyLang('ru'); else mark();
  menuInert();

  /* @src index.html #ardudim-order-js · floating WhatsApp / call wait for the hero buttons to scroll away */
(function () {
  var html = document.documentElement;
  var groups = [].slice.call(document.querySelectorAll('.hero-btns, .hero-actions'));
  if (!groups.length || !('IntersectionObserver' in window)) { html.classList.remove('sticky-wait'); return; }
  var onScreen = [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { onScreen[groups.indexOf(e.target)] = e.isIntersecting; });
    document.body.classList.toggle('hero-btns-on', onScreen.indexOf(true) >= 0);
    html.classList.remove('sticky-wait');
  }, { rootMargin: '0px 0px 64px 0px' });
  groups.forEach(function (g) { io.observe(g); });
})();
  /* @end-src */

  /* @src index.html · top bar turns white after scrolling */
(function(){
  // Nav: transparent over hero, solid white on scroll
  var nav = document.querySelector('nav');
  function onNavScroll(){
    if(window.pageYOffset > 60){ nav.classList.add('nav-scrolled'); }
    else { nav.classList.remove('nav-scrolled'); }
  }
  window.addEventListener('scroll', onNavScroll, {passive:true});
  onNavScroll();
})();
  /* @end-src */

  /* @src index.html · cookie banner shows until a choice is saved */
  (function initCookieBanner() {
    const b = document.getElementById('cookie-banner');
    if (!b) return;
    let accepted = false;
    try { accepted = !!localStorage.getItem('cookiesAccepted'); } catch(e) {}
    if (accepted) return;
    b.classList.add('show');
    const syncHeight = () => {
      if (!b.classList.contains('show')) return;
      document.body.style.setProperty('--cookie-h', b.offsetHeight + 'px');
      document.body.classList.add('cookie-open');
    };
    syncHeight();
    window.addEventListener('resize', syncHeight);
    if (window.ResizeObserver) { new ResizeObserver(syncHeight).observe(b); }
  })();
  /* @end-src */

  // ---------- scroll entrances: index.html's motion engine on the subpage sections ----------
  (function () {
    if (!html.classList.contains('motion')) return;
    /* @src index.html #ardudim-motion-js · tagging helpers */
  function tag(sel, cls) { document.querySelectorAll(sel).forEach(function (el) { el.classList.add(cls); }); }
  function kids(sel, cls) {
    document.querySelectorAll(sel).forEach(function (p) {
      p.classList.add(cls);
      [].forEach.call(p.children, function (c, i) { c.style.setProperty('--i', i); });
    });
  }
    /* @end-src */
    // headers cascade as on index.html: label, heading, line under it, 90ms apart (the hero has its own entrance)
    document.querySelectorAll('main > section').forEach(function (s) {
      if (s.classList.contains('sub-hero')) return;
      [s.querySelector('.section-label'), s.querySelector('h2'), s.querySelector('.section-desc, .contact-desc')].forEach(function (el, i) {
        if (!el) return;
        el.classList.add('m');
        el.style.setProperty('--d', (i * 90) + 'ms');
      });
    });
    document.querySelectorAll('h2').forEach(function (h) { if (h.querySelector('mark.hl')) h.classList.add('m-mark'); });
    tag('.hc-stripe', 'm-draw');
    kids('.sub-probs', 'm-kids');
    kids('.how-steps', 'm-kids');
    kids('.calc-promise', 'm-kids');
    kids('.contact-btns', 'm-kids');
    tag('.sub-calc-btn, [data-m]', 'm');
    kids('[data-m-kids]', 'm-kids');
    /* @src index.html #ardudim-motion-js · reveal once on scroll, with the safety nets */
  var targets = [].slice.call(document.querySelectorAll('.m, .m-kids, .m-kids-pop, .m-slap, .m-kids-slap, .m-mark, .m-draw'));
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function (el) { io.observe(el); });
  function revealAll() { targets.forEach(function (el) { if (!el.classList.contains('in')) { el.classList.add('in'); io.unobserve(el); } }); }
  // safety nets: whatever is on screen 3s after load is shown even if the observer never fired; the bottom of the page shows everything
  setTimeout(function () {
    targets.forEach(function (el) {
      if (el.classList.contains('in')) return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); }
    });
  }, 3000);
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12) revealAll();
    });
  }, { passive: true });
    /* @end-src */
    // on screen at start: shown now, not after the 3s safety net
    targets.forEach(function (el) { if (el.classList.contains('in')) return; var r = el.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); } });
  })();

  // a few names other scripts or inline links may call
  window.applyLang = applyLang;
  window.toggleLang = toggleLang;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.toggleA11yPanel = toggleA11yPanel;
  window.acceptCookies = acceptCookies;
  window.declineCookies = declineCookies;
})();
