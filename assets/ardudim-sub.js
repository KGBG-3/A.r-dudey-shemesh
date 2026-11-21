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
    ui_skip: { he: 'דלגו לתוכן הראשי', ru: 'Перейти к основному содержанию' },
    ui_brand: { he: 'א.ר דודי שמש', ru: 'А.Р Дудей Шемеш' },
    ui_nav_main: { he: 'ניווט ראשי', ru: 'Главное меню' },
    ui_menu: { he: 'תפריט', ru: 'Меню' },
    ui_menu_close: { he: 'סגירת התפריט', ru: 'Закрыть меню' },
    ui_nav_calc: { he: 'מחשבון מחיר', ru: 'Расчёт цены' },
    ui_nav_reviews: { he: 'ביקורות', ru: 'Отзывы' },
    ui_nav_repairs: { he: 'תיקונים', ru: 'Ремонт' },
    ui_nav_gallery: { he: 'גלריה', ru: 'Галерея' },
    ui_nav_about: { he: 'אודות', ru: 'О нас' },
    ui_nav_contact: { he: 'צרו קשר', ru: 'Свяжитесь с нами' },
    ui_call_us: { he: 'חייגו אלינו', ru: 'Позвонить нам' },
    ui_close: { he: 'סגירה', ru: 'Закрыть' },
    ui_a11y_open: { he: 'פתחו כלי נגישות', ru: 'Открыть инструменты доступности' },
    ui_a11y_title: { he: 'כלי נגישות', ru: 'Инструменты доступности' },
    ui_a11y_textlg: { he: 'הגדילו טקסט', ru: 'Увеличить текст' },
    ui_a11y_textxl: { he: 'טקסט גדול מאוד', ru: 'Очень крупный текст' },
    ui_a11y_font: { he: 'גופן קריא', ru: 'Читаемый шрифт' },
    ui_a11y_contrast: { he: 'ניגודיות גבוהה', ru: 'Высокая контрастность' },
    ui_a11y_links: { he: 'הדגישו קישורים', ru: 'Выделить ссылки' },
    ui_a11y_anim: { he: 'עצרו אנימציות', ru: 'Остановить анимации' },
    ui_a11y_cursor: { he: 'סמן גדול', ru: 'Крупный курсор' },
    ui_a11y_reset: { he: 'איפוס הגדרות נגישות', ru: 'Сбросить настройки доступности' },
    ui_a11y_statement: { he: 'הצהרת נגישות', ru: 'Декларация доступности' },
    ui_cookie_label: { he: 'הודעה על עוגיות', ru: 'Уведомление о файлах cookie' },
    ui_cookie_text: { he: 'האתר משתמש בעוגיות בסיסיות לתפקוד האתר, ובעוגיות של Google Ads למדידת פניות שמגיעות מהמודעות שלנו. אפשר לסרב לעוגיות המדידה.', ru: 'Сайт использует базовые файлы cookie для работы и файлы cookie Google Ads для учёта обращений, пришедших из нашей рекламы. От файлов cookie для учёта можно отказаться.' },
    ui_cookie_more: { he: 'לפרטים נוספים ראו את <a href="#privacy" data-open="privacy">מדיניות הפרטיות</a> שלנו.', ru: 'Подробнее в нашей <a href="#privacy" data-open="privacy">политике конфиденциальности</a>.' },
    ui_cookie_accept: { he: 'הבנתי, אני מסכים', ru: 'Понятно, согласен' },
    ui_cookie_decline: { he: 'המשך בלי הסכמה', ru: 'Продолжить без согласия' },
    ui_ft_more: { he: 'מידע נוסף', ru: 'Дополнительная информация' },
    ui_ft_calc: { he: 'מחשבון מחירים לדודי שמש', ru: 'Калькулятор цен на солнечные бойлеры' },
    ui_ft_tikun: { he: 'תיקון דוד שמש', ru: 'Ремонт солнечного бойлера' },
    ui_ft_guf: { he: 'החלפת גוף חימום', ru: 'Замена ТЭНа' },
    ui_ft_chromagen: { he: 'מתקין מורשה כרומגן', ru: 'Монтажник Chromagen' },
    ui_ft_areas: { he: 'אזורי שירות', ru: 'Зоны обслуживания' },
    ui_ft_sanan: { he: 'סנן אבנית לדוד שמש', ru: 'Фильтр от накипи для бойлера' },
    // the full privacy policy (ui_pv_*), the full accessibility statement (ui_st_*), the footer's identity line and cookie link:
    // made by script from index.html's dialogs in both languages; on the subpages the privacy phone is a plain tel: link and
    // the menu's feature list has the large cursor too. The Hebrew is also written in each page's HTML, word for word.
    ui_pv_title: { he: 'מדיניות פרטיות — א.ר דודי שמש', ru: 'Политика конфиденциальности — А.Р Дудей Шемеш' },
    ui_pv_1: { he: '<strong>מי אחראי על המידע?</strong><br> האתר ardudim.co.il מופעל על ידי א.ר דודי שמש — איליה ריים, השיקמה 3, פתח תקווה. אנחנו בעל השליטה במידע שנמסר דרך האתר.', ru: '<strong>Кто отвечает за данные?</strong><br> Сайтом ardudim.co.il управляет «А.Р Дудей Шемеш» — Илья Рейм, ул. Ха-Шикма, 3, Петах-Тиква. Мы — владелец базы данных, в которую попадает информация, переданная через сайт.' },
    ui_pv_2: { he: '<strong>איזה מידע נאסף, ולמה?</strong><br> מידע שאתם מוסרים: בבקשה לתיאום מועד במחשבון — שם, טלפון, יישוב, הימים והשעות שבחרתם וההצעה שבניתם. בפנייה בוואטסאפ או בטלפון — מספר הטלפון ותוכן הפנייה. המידע משמש לתיאום העבודה, להצעת מחיר, לביצוע השירות ולאחריות.<br> מידע שנאסף אוטומטית: בזמן טעינת האתר, ספקי האחסון והגופנים (GitHub ו-Google) מקבלים את כתובת ה-IP ואת סוג הדפדפן, כמו בכל אתר. אם הסכמתם לעוגיות המדידה, Google Ads מקבל גם מזהה שמאפשר לדעת שפנייה הגיעה ממודעה שלנו.', ru: '<strong>Какие данные собираются и зачем?</strong><br> Данные, которые вы сообщаете сами: в заявке на согласование даты в калькуляторе — имя, телефон, населённый пункт, выбранные дни и время, а также составленное вами предложение. При обращении в WhatsApp или по телефону — номер телефона и содержание обращения. Эти данные нужны, чтобы согласовать работу, рассчитать цену, выполнить заказ и обеспечить гарантию.<br> Данные, которые собираются автоматически: при загрузке сайта хостинг и сервис шрифтов (GitHub и Google) получают IP-адрес и тип браузера — как на любом сайте. Если вы согласились на файлы cookie для учёта, Google Ads получает также идентификатор, по которому видно, что обращение пришло из нашей рекламы.' },
    ui_pv_3: { he: '<strong>האם חייבים למסור מידע?</strong><br> אין חובה חוקית למסור לנו מידע; המסירה תלויה ברצונכם ובהסכמתכם. אפשר לראות מחירים ולבנות הצעה במחשבון בלי להשאיר פרטים. בלי שם וטלפון לא נוכל לתאם איתכם מועד.', ru: '<strong>Обязательно ли сообщать данные?</strong><br> По закону вы не обязаны сообщать нам данные — это зависит только от вашего желания и согласия. Посмотреть цены и составить предложение в калькуляторе можно, не оставляя данных. Без имени и телефона мы не сможем согласовать с вами дату.' },
    ui_pv_4: { he: '<strong>עוגיות (Cookies) ומדידה</strong><br> האתר שומר בדפדפן שלכם הגדרות שנחוצות לפעולתו: שפה, הגדרות נגישות, בחירת העוגיות וההצעה שבניתם. בנוסף, האתר מודד פניות שהגיעו ממודעות Google Ads (לחיצה על טלפון או על וואטסאפ) בעזרת עוגיות של Google. המדידה פועלת רק אחרי שלחצתם "הבנתי, אני מסכים" בהודעת העוגיות. אפשר לשנות את הבחירה בכל רגע בקישור "הגדרות עוגיות" בתחתית כל דף.', ru: '<strong>Файлы cookie и учёт обращений</strong><br> Сайт сохраняет в вашем браузере настройки, необходимые для его работы: язык, настройки доступности, ваш выбор по файлам cookie и составленное вами предложение. Кроме того, сайт учитывает обращения, пришедшие из рекламы Google Ads (нажатие на телефон или WhatsApp), с помощью файлов cookie Google. Этот учёт включается только после того, как вы нажали «Понятно, согласен» в уведомлении о cookie. Изменить выбор можно в любой момент по ссылке «Настройки cookie» внизу каждой страницы.' },
    ui_pv_5: { he: '<strong>למי המידע מועבר?</strong><br> אנחנו לא מוכרים מידע ולא מעבירים אותו לאחרים לצורכי שיווק. המידע נשמר ומעובד אצל ספקי שירות שפועלים עבורנו: Supabase (מסד הנתונים של מערכת התיאום), Google (יומן העבודות ומדידת המודעות), WhatsApp (כשפונים אלינו בוואטסאפ) ו-GitHub (אחסון האתר). ייתכן שהשרתים שלהם נמצאים מחוץ לישראל.', ru: '<strong>Кому передаются данные?</strong><br> Мы не продаём данные и не передаём их другим для их маркетинга. Данные хранятся и обрабатываются у поставщиков услуг, которые работают для нас: Supabase (база данных системы согласования), Google (рабочий календарь и учёт рекламы), WhatsApp (когда вы пишете нам в WhatsApp) и GitHub (хостинг сайта). Их серверы могут находиться за пределами Израиля.' },
    ui_pv_6: { he: '<strong>כמה זמן נשמר המידע?</strong><br> כל עוד הוא נחוץ לתיאום העבודה, לאחריות ולחובות הנהלת החשבונות.', ru: '<strong>Как долго хранятся данные?</strong><br> Пока они нужны для согласования работы, гарантии и ведения бухгалтерского учёта.' },
    ui_pv_7: { he: '<strong>הזכויות שלכם</strong><br> לפי חוק הגנת הפרטיות, התשמ"א-1981, אתם זכאים לעיין במידע שנשמר עליכם, ולבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן. לפנייה — בפרטים שלמטה.', ru: '<strong>Ваши права</strong><br> Согласно Закону о защите частной жизни (1981), вы вправе ознакомиться с данными, которые хранятся о вас, и попросить исправить или удалить данные, если они неверны, неполны, неясны или устарели. Для обращения используйте контакты ниже.' },
    ui_pv_8: { he: '<strong>יצירת קשר בנושא פרטיות</strong><br> טלפון: <a href="tel:+972545642426">054-564-2426</a> · דוא"ל: <a href="mailto:moshereym1@gmail.com">moshereym1@gmail.com</a>', ru: '<strong>Контакт по вопросам конфиденциальности</strong><br> Телефон: <a href="tel:+972545642426">054-564-2426</a> · Эл. почта: <a href="mailto:moshereym1@gmail.com">moshereym1@gmail.com</a>' },
    ui_pv_updated: { he: 'עדכון אחרון: נובמבר 2026', ru: 'Последнее обновление: ноябрь 2026' },
    ui_st_1: { he: 'המחויבות שלנו לנגישות', ru: 'Наши обязательства по доступности' },
    ui_st_2: { he: 'בא.ר דודי שמש אנו רואים בנגישות האתר ערך חשוב, ומאמינים שכל אדם זכאי לקבל מידע על השירותים שלנו באופן שווה ועצמאי, ללא תלות במגבלות פיזיות, חושיות או קוגניטיביות. אנו פועלים להנגיש את האתר באופן שוטף בהתאם להוראות תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013, ולתקן הישראלי ת"י 5568 לנגישות תכנים באינטרנט ברמה AA.', ru: 'В А.Р Дудей Шемеш мы считаем доступность сайта важной ценностью и верим, что каждый человек имеет право получать информацию о наших услугах равным и независимым образом, независимо от физических, сенсорных или когнитивных ограничений. Мы постоянно работаем над доступностью сайта в соответствии с положениями Постановления о равных правах для людей с инвалидностью (Адаптация доступности к услугам) 2013 года и израильским стандартом IS 5568 по доступности интернет-контента уровня AA.' },
    ui_st_3: { he: 'אופן ההנגשה של האתר', ru: 'Как сайт сделан доступным' },
    ui_st_4: { he: 'האתר נבנה תוך הקפדה על עקרונות הנגישות, וכולל בין היתר:', ru: 'Сайт построен с соблюдением принципов доступности и включает, в частности:' },
    ui_st_5: { he: '<li>תמיכה בניווט מלא באמצעות מקלדת (מקש Tab) עם סימוני פוקוס ברורים</li> <li>מבנה כותרות סמנטי (H1, H2, H3) לקריאה נוחה בקוראי מסך</li> <li>תיאורי טקסט חלופיים (alt) לתמונות משמעותיות</li> <li>קישור "דלג לתוכן הראשי" המופיע בעת ניווט במקלדת</li> <li>ניגודיות צבעים תקינה בין טקסט לרקע</li> <li>תמיכה בהקטנת אנימציות עבור משתמשים עם רגישות לתנועה (prefers-reduced-motion)</li> <li>תמיכה בעברית (RTL) וברוסית (LTR) באתר דו-לשוני</li> <li>כפתורי קריאה לפעולה (טלפון, וואטסאפ) בגדלים נוחים ללחיצה</li>', ru: '<li>Поддержка полной навигации с клавиатуры (клавиша Tab) с чёткой индикацией фокуса</li> <li>Семантическая структура заголовков (H1, H2, H3) для удобного чтения программами чтения с экрана</li> <li>Альтернативные текстовые описания (alt) для значимых изображений</li> <li>Ссылка "Перейти к основному содержанию", появляющаяся при навигации с клавиатуры</li> <li>Корректная контрастность цветов между текстом и фоном</li> <li>Поддержка уменьшения анимаций для пользователей с чувствительностью к движению (prefers-reduced-motion)</li> <li>Поддержка иврита (RTL) и русского (LTR) на двуязычном сайте</li> <li>Кнопки призыва к действию (телефон, WhatsApp) удобного размера для нажатия</li>' },
    ui_st_6: { he: 'סרגל כלי הנגישות באתר', ru: 'Панель инструментов доступности сайта' },
    ui_st_7: { he: 'בפינה הימנית התחתונה של האתר מופיע סמל נגישות <span style="white-space:nowrap">(<svg class="a11y-inline-ic" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="סמל הנגישות" style="width:1.15em;height:1.15em;vertical-align:-.2em"><path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2zM12 7.5c-2.5 0-3 1.5-3 1.5l-.5-1.7s1.4-1.3 3.5-1.3 3.5 1.3 3.5 1.3l-.5 1.7s-.5-1.5-3-1.5z"></path></svg>).</span> לחיצה עליו פותחת סרגל המאפשר:', ru: 'В правом нижнем углу сайта находится значок доступности <span style="white-space:nowrap">(<svg class="a11y-inline-ic" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="значок доступности" style="width:1.15em;height:1.15em;vertical-align:-.2em"><path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2zM12 7.5c-2.5 0-3 1.5-3 1.5l-.5-1.7s1.4-1.3 3.5-1.3 3.5 1.3 3.5 1.3l-.5 1.7s-.5-1.5-3-1.5z"></path></svg>).</span> Нажатие на него открывает панель, позволяющую:' },
    ui_st_8: { he: '<li><strong>הגדלת גודל הטקסט</strong> בשתי רמות (115% ו-130%)</li> <li><strong>החלפה לגופן קריא</strong> (Arial) עם ריווח אותיות מוגדל</li> <li><strong>מצב ניגודיות גבוהה</strong> (רקע שחור, טקסט לבן, קישורים בצהוב)</li> <li><strong>הדגשת קישורים</strong> בצבע ובקו תחתי בולט</li> <li><strong>עצירת אנימציות</strong> ותנועות באתר</li> <li><strong>סמן גדול</strong> — סמן עכבר מוגדל</li> <li><strong>איפוס</strong> ההגדרות לברירת המחדל</li>', ru: '<li><strong>Увеличить размер текста</strong> на двух уровнях (115% и 130%)</li> <li><strong>Переключиться на читаемый шрифт</strong> (Arial) с увеличенным интервалом между буквами</li> <li><strong>Режим высокой контрастности</strong> (чёрный фон, белый текст, жёлтые ссылки)</li> <li><strong>Подсветка ссылок</strong> цветом и заметным подчёркиванием</li> <li><strong>Остановка анимаций</strong> и движений на сайте</li> <li><strong>Крупный курсор</strong> — увеличенный указатель мыши</li> <li><strong>Сброс</strong> настроек к значениям по умолчанию</li>' },
    ui_st_9: { he: 'ההעדפות שלך נשמרות בדפדפן ויחולו אוטומטית בביקוריך הבאים.', ru: 'Ваши предпочтения сохраняются в браузере и автоматически применяются при следующих посещениях.' },
    ui_st_10: { he: 'חלקים שעדיין לא נגישים במלואם', ru: 'Разделы, ещё не полностью доступные' },
    ui_st_11: { he: 'אנו עובדים באופן שוטף לשיפור הנגישות. נכון להיום ייתכן ויימצאו באתר רכיבים שאינם נגישים במלואם, ביניהם:', ru: 'Мы постоянно работаем над улучшением доступности. На сегодняшний день на сайте могут быть элементы, не полностью доступные, в том числе:' },
    ui_st_12: { he: '<li>קובץ ה-PDF של הצעת המחיר נשמר כתמונה של ההצעה, בלי שכבת טקסט, ולכן אינו נגיש לקוראי מסך. כל המידע שבו מופיע גם על המסך.</li> <li>תכנים של צד שלישי — ביקורות מ-Google ושיחות בוואטסאפ — מוצגים כפי שהם במערכות של הספקים.</li>', ru: '<li>PDF-файл с предложением сохраняется как изображение, без текстового слоя, поэтому он недоступен для программ чтения с экрана. Вся информация из него есть и на экране.</li> <li>Сторонние материалы — отзывы из Google и переписка в WhatsApp — отображаются так, как они представлены в системах этих сервисов.</li>' },
    ui_st_13: { he: 'במקרה של קושי בגישה לתוכן מסוים, נשמח לסייע באמצעי חלופי — שיחת טלפון, הודעת וואטסאפ או דוא"ל.', ru: 'В случае трудностей с доступом к определённому содержанию мы будем рады помочь альтернативным способом — по телефону, в WhatsApp или по электронной почте.' },
    ui_st_14: { he: 'הסדרי נגישות חלופיים', ru: 'Альтернативные средства доступа' },
    ui_st_15: { he: 'לעסק אין משרד או אולם תצוגה לקבלת קהל. השירות ניתן בטלפון, בוואטסאפ ובהגעה של בעל העסק לבית הלקוח. נשמח לקבל פניות בערוצים הבאים:', ru: 'У компании нет офиса или шоурума для приёма посетителей. Мы работаем по телефону, в WhatsApp и с выездом владельца компании к клиенту на дом. Будем рады обращениям по следующим каналам:' },
    ui_st_16: { he: '<li><strong>שיחת טלפון:</strong> 054-564-2426</li> <li><strong>וואטסאפ:</strong> 055-997-6041 (ניתן לשלוח גם הודעות קוליות)</li> <li><strong>דוא"ל:</strong> moshereym1@gmail.com</li>', ru: '<li><strong>Звонок по телефону:</strong> 054-564-2426</li> <li><strong>WhatsApp:</strong> 055-997-6041 (можно отправлять и голосовые сообщения)</li> <li><strong>Эл. почта:</strong> moshereym1@gmail.com</li>' },
    ui_st_17: { he: 'פנייה בנושא נגישות', ru: 'Обращение по вопросам доступности' },
    ui_st_18: { he: 'נתקלת בבעיית נגישות באתר? יש לך הצעה לשיפור? נשמח לשמוע ולטפל בכך בהקדם.', ru: 'Столкнулись с проблемой доступности на сайте? Есть предложение по улучшению? Мы будем рады услышать и оперативно отреагировать.' },
    ui_st_19: { he: '<p><strong>רכז נגישות:</strong> משה ריים</p> <p><strong>טלפון:</strong> <a href="tel:+972559976041">055-997-6041</a></p> <p><strong>דוא"ל:</strong> <a href="mailto:moshereym1@gmail.com">moshereym1@gmail.com</a></p> <p><strong>זמן מענה:</strong> נשתדל להגיב לפניות נגישות בתוך 5 ימי עסקים.</p>', ru: '<p><strong>Координатор по доступности:</strong> Моше Рейм</p> <p><strong>Телефон:</strong> <a href="tel:+972559976041">055-997-6041</a></p> <p><strong>Эл. почта:</strong> <a href="mailto:moshereym1@gmail.com">moshereym1@gmail.com</a></p> <p><strong>Время ответа:</strong> Мы постараемся ответить на обращения по доступности в течение 5 рабочих дней.</p>' },
    ui_st_date: { he: 'תאריך עדכון אחרון: נובמבר 2026', ru: 'Дата последнего обновления: ноябрь 2026' },
    ui_ft_ident: { he: 'א.ר דודי שמש · איליה ריים · מספר עוסק 321576191 · השיקמה 3, פתח תקווה (אין קבלת קהל)', ru: 'А.Р Дудей Шемеш · Илья Рейм · рег. номер 321576191 · ул. Ха-Шикма, 3, Петах-Тиква (без приёма посетителей)' },
    ui_ft_cookies: { he: 'הגדרות עוגיות', ru: 'Настройки cookie' }
  };
  var PAGE = window.I18N || {};
  function str(key, lang) {
    var e = Object.prototype.hasOwnProperty.call(PAGE, key) ? PAGE[key] : UI[key];
    return e && e[lang] !== undefined ? e[lang] : null;
  }

  var curLang = 'he';
  var isRu = function () { return curLang === 'ru'; };

  // the language button says in its own language which language it switches to (it shows "RU" in Hebrew, "HE" in Russian)
  var LANG_BTN = { he: { label: 'Русский — переключить язык', lang: 'ru' }, ru: { label: 'עברית — החלפת שפה', lang: 'he' } };
  function syncLangBtn() {
    var b = document.getElementById('lang-btn');
    if (!b) return;
    b.setAttribute('aria-label', LANG_BTN[curLang].label);
    b.setAttribute('lang', LANG_BTN[curLang].lang);
  }

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
    // the page's title and description, when its I18N has them
    var t = str('doc_title', curLang);
    if (t !== null) document.title = t;
    var d = str('doc_desc', curLang), md = document.querySelector('meta[name="description"]');
    if (d !== null && md) md.setAttribute('content', d);
    syncLangBtn();
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
    openDialog(el, { lock: true, fallback: a11yToggle, focus: name === 'privacy' ? '#privacy-title' : null });
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

  // The cookie banner is a fixed bar (it never adds page height). showCookieBanner() shows it and keeps --cookie-h in step
  // with its height, for the floating buttons above it. Safe to call again: one resize listener, one ResizeObserver.
  let cookieBannerSync = null;
  let cookieSettingsOpener = null;
  function showCookieBanner() {
    const b = document.getElementById('cookie-banner');
    if (!b) return null;
    b.classList.add('show');
    if (!cookieBannerSync) {
      cookieBannerSync = () => {
        if (!b.classList.contains('show')) return;
        document.body.style.setProperty('--cookie-h', b.offsetHeight + 'px');
        document.body.classList.add('cookie-open');
      };
      window.addEventListener('resize', cookieBannerSync);
      if (window.ResizeObserver) { new ResizeObserver(cookieBannerSync).observe(b); }
      // a choice made after "הגדרות עוגיות" opened the banner: the buttons' own handlers run first and hide it,
      // then the focus goes back to that link
      b.addEventListener('click', (e) => {
        const opener = cookieSettingsOpener;
        if (!opener || !e.target.closest('.cookie-accept, .cookie-decline')) return;
        cookieSettingsOpener = null;
        opener.focus();
      });
    }
    cookieBannerSync();
    return b;
  }
  // "הגדרות עוגיות" (footer): the banner shows again, also when a choice is already saved, and takes the focus
  function openCookieSettings(opener) {
    const b = showCookieBanner();
    if (!b) return;
    cookieSettingsOpener = opener || null;
    b.focus();
  }
  /* @end-src */
  var cAccept = document.querySelector('.cookie-accept'), cDecline = document.querySelector('.cookie-decline');
  function focusMain() { var m = document.getElementById('main-content'); if (m) m.focus({ preventScroll: true }); }
  if (cAccept) cAccept.addEventListener('click', function () { acceptCookies(); focusMain(); });
  if (cDecline) cDecline.addEventListener('click', function () { declineCookies(); focusMain(); });
  // footer link "הגדרות עוגיות" (no onclick on the subpages)
  document.querySelectorAll('[data-cookie-settings]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); openCookieSettings(a); });
  });

  // ---------- language button ----------
  var langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.addEventListener('click', toggleLang);

  // ---------- start: saved settings, saved language, marker ----------
  loadA11ySettings();
  syncMotion();
  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
  if (saved === 'ru' || html.lang === 'ru') applyLang('ru'); else { syncLangBtn(); mark(); }
  menuInert();

  // subpage-only: keep the floating buttons hidden until the hero entrance and the web fonts have settled
  // (the copied observer below reads the hero buttons while the entrance still holds them 22px lower)
  (function () {
    var hb = document.querySelector('.sub-hero .hero-btns');
    if (!hb) return;
    html.classList.add('sticky-hold');
    var anim = new Promise(function (r) {
      if (!html.classList.contains('motion')) return r();
      hb.addEventListener('animationend', function f(e) { if (e.target === hb) { hb.removeEventListener('animationend', f); r(); } });
      setTimeout(r, 1600);
    });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    function off() { html.classList.remove('sticky-hold'); }
    Promise.all([anim, fonts]).then(off, off);
    setTimeout(off, 3000);
  })();

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
  // First visit (no choice saved yet): the banner shows by itself, without taking the focus
  (function initCookieBanner() {
    let chosen = false;
    try { chosen = !!localStorage.getItem('cookiesAccepted'); } catch(e) {}
    if (!chosen) showCookieBanner();
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
    // service areas (azorey-sherut): the panel rises, the city pills pop in one after another, as on index.html
    tag('.areas-glass-card', 'm');
    kids('.areas-cluster', 'm-kids-pop');
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
  window.openCookieSettings = openCookieSettings;
})();
