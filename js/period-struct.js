// «Деталі»: the seven tabs (Огляд, Реклама Google, Поведінка, Аудиторія, Замовлення, Товари, Утримання)
// and the blocks the report did not have before: where visitors come from, what they do, who they are, the funnel
// to an order, which products they look at and how many come back. Data: d.structure (Google Analytics) with
// d.sales (BAS) and d.site. All text goes through DOM APIs. Helpers come from period.js (ctx).
window.PeriodStruct = function (ctx) {
  const { h, clear, kpi, panel, table, chart, donut, meter, empty, head, num, dChip, state, keyOf, labelOf, longLabel } = ctx;
  const dash = '—';
  const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];

  // --- plain words for what Google Analytics names in English ---------------------------------
  const LANG = { Ukrainian: 'Українська', Russian: 'Російська', English: 'Англійська', Polish: 'Польська', German: 'Німецька', French: 'Французька', Spanish: 'Іспанська', Italian: 'Італійська', Portuguese: 'Португальська', Chinese: 'Китайська', Hungarian: 'Угорська', Czech: 'Чеська', Danish: 'Данська', Romanian: 'Румунська', Turkish: 'Турецька', Japanese: 'Японська', Korean: 'Корейська', Dutch: 'Нідерландська', Slovak: 'Словацька', Bulgarian: 'Болгарська', Lithuanian: 'Литовська', Latvian: 'Латвійська', Estonian: 'Естонська', Arabic: 'Арабська', Hebrew: 'Іврит', Belarusian: 'Білоруська', Georgian: 'Грузинська', Greek: 'Грецька', Swedish: 'Шведська', Norwegian: 'Норвезька', Finnish: 'Фінська' };
  const REGION = { 'Kyiv city': 'м. Київ', Kyiv: 'Київська область', Kharkiv: 'Харківська область', Odesa: 'Одеська область', Dnipropetrovsk: 'Дніпропетровська область', Lviv: 'Львівська область', Zaporizhzhia: 'Запорізька область', Poltava: 'Полтавська область', Vinnytsia: 'Вінницька область', Cherkasy: 'Черкаська область', Chernihiv: 'Чернігівська область', Sumy: 'Сумська область', Zhytomyr: 'Житомирська область', Khmelnytskyi: 'Хмельницька область', Rivne: 'Рівненська область', 'Ivano-Frankivsk': 'Івано-Франківська область', Ternopil: 'Тернопільська область', Volyn: 'Волинська область', Zakarpattia: 'Закарпатська область', Chernivtsi: 'Чернівецька область', Mykolaiv: 'Миколаївська область', Kherson: 'Херсонська область', Kirovohrad: 'Кіровоградська область', Donetsk: 'Донецька область', Luhansk: 'Луганська область', Crimea: 'Крим', Sevastopol: 'Севастополь', 'Autonomous Republic of Crimea': 'Крим' };
  const CITY = { Kyiv: 'Київ', Kharkiv: 'Харків', Odesa: 'Одеса', Dnipro: 'Дніпро', Lviv: 'Львів', Zaporizhzhia: 'Запоріжжя', 'Kryvyi Rih': 'Кривий Ріг', Vinnytsia: 'Вінниця', Poltava: 'Полтава', Chernihiv: 'Чернігів', Cherkasy: 'Черкаси', Sumy: 'Суми', Zhytomyr: 'Житомир', Khmelnytskyi: 'Хмельницький', Rivne: 'Рівне', 'Ivano-Frankivsk': 'Івано-Франківськ', Ternopil: 'Тернопіль', Lutsk: 'Луцьк', Uzhhorod: 'Ужгород', Chernivtsi: 'Чернівці', Mykolaiv: 'Миколаїв', Kherson: 'Херсон', Kropyvnytskyi: 'Кропивницький', 'Bila Tserkva': 'Біла Церква', Kremenchuk: 'Кременчук', Irpin: 'Ірпінь', Brovary: 'Бровари', Boryspil: 'Бориспіль', Bucha: 'Буча', Fastiv: 'Фастів', Obukhiv: 'Обухів', Mukachevo: 'Мукачево', Melitopol: 'Мелітополь', Mariupol: 'Маріуполь', Nikopol: 'Нікополь', Pavlohrad: 'Павлоград', Uman: 'Умань', Kamianske: 'Кам’янське', 'Kamianets-Podilskyi': 'Кам’янець-Подільський', Drohobych: 'Дрогобич', Stryi: 'Стрий', Kolomyia: 'Коломия', Berdychiv: 'Бердичів', Korosten: 'Коростень', Koriukivka: 'Корюківка', Shostka: 'Шостка', Konotop: 'Конотоп', Myrhorod: 'Миргород', Lubny: 'Лубни', Hostomel: 'Гостомель', 'Sofiivska Borshchahivka': 'Софіївська Борщагівка', 'Sofiivska Borschahivka': 'Софіївська Борщагівка', Vynohradiv: 'Виноградів', Chornomorsk: 'Чорноморськ', Ladyzhyn: 'Ладижин', Hrebinka: 'Гребінка', Novovolynsk: 'Нововолинськ', 'Novi Sanzhary': 'Нові Санжари' };
  const EVENT = { user_engagement: 'Активність на сторінці', session_start: 'Початок візиту', first_visit: 'Перший візит на сайт', page_view: 'Перегляд сторінки', view_item: 'Перегляд товару', scroll: 'Прокрутка сторінки', click: 'Клік по посиланню', form_start: 'Почали заповнювати форму', form_submit: 'Відправили форму', view_search_results: 'Пошук по сайту', view_cart: 'Перегляд кошика', add_to_cart: 'Додали в кошик', begin_checkout: 'Почали оформлення', add_shipping_info: 'Вказали доставку', add_payment_info: 'Вказали оплату', purchase: 'Покупка', file_download: 'Завантаження файлу', video_start: 'Початок відео', video_progress: 'Перегляд відео', video_complete: 'Відео переглянули до кінця', view_item_list: 'Перегляд списку товарів', select_item: 'Вибрали товар у списку', remove_from_cart: 'Прибрали з кошика' };
  const SYSTEM = { Android: 'Android', iOS: 'iPhone / iPad (iOS)', Windows: 'Windows', Macintosh: 'Mac', Linux: 'Linux', 'Chrome OS': 'Chromebook' };
  const GENDER = { female: 'Жінки', male: 'Чоловіки' };
  const DEVICE = { mobile: 'Телефон', desktop: 'Комп’ютер', tablet: 'Планшет', 'smart tv': 'Smart TV' };
  const word = (map, v) => (v === '(not set)' || v === '' || v == null ? 'не визначено' : map[v] || v);
  const regionName = (v) => word(REGION, String(v).replace(/ (Oblast|Region|Province)$/i, ''));
  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const pc = (a, b) => (b ? a / b : 0);

  const st = (d) => d.structure || null;
  const wholeShopNote = (d) => (d.scope && !d.scope.all
    ? h('p', { class: 'scope-note' }, 'Цей розділ показує весь магазин, а не вибрану категорію чи тип продажів: Google Analytics не ділить ці дані за категоріями.')
    : null);
  const noGa = (id, title) => h('section', { id }, head(title), empty('Google Analytics зараз недоступний.'));
  const missing = (what) => empty(`Google Analytics не віддав «${what}». Спробуйте оновити дані трохи згодом.`);

  // Short table that opens in full on a button.
  function longTable(cols, rows, limit, noun) {
    const wrap = h('div');
    let all = false;
    const draw = () => {
      clear(wrap);
      wrap.appendChild(table(cols, all ? rows : rows.slice(0, limit)));
      if (rows.length > limit) {
        const b = h('button', { type: 'button', class: 'linkbtn' }, all ? 'Показати менше' : `Показати всі ${num(rows.length)} ${noun || 'рядків'}`);
        b.addEventListener('click', () => { all = !all; draw(); });
        wrap.appendChild(b);
      }
    };
    draw();
    return wrap;
  }
  // Ranked list with bars: label, number and a bar against the biggest one.
  function ranked(list, { label, value, valueName = 'Візити', limit = 12, color }) {
    const top = list.slice(0, limit);
    const max = Math.max(1, ...top.map(value));
    return table([
      { t: '', r: (x) => label(x) },
      { t: valueName, n: true, r: (x) => num(value(x)) },
      { t: '', r: (x) => meter(value(x) / max, '') },
    ], top);
  }
  function ring(list, { label, value, limit = 5, total }) {
    const sum = total || list.reduce((t, x) => t + value(x), 0);
    const top = list.slice(0, limit);
    const rest = sum - top.reduce((t, x) => t + value(x), 0);
    const parts = top.map((x, i) => ({ name: label(x), value: value(x), color: PALETTE[i % PALETTE.length] }));
    if (rest > 0) parts.push({ name: 'Інші', value: rest, color: 'var(--c-other)' });
    return h('div', { class: 'ringrow' },
      donut(parts, { size: 130, thick: 18, big: num(sum), label: 'Розподіл' }),
      h('ul', { class: 'legendlist' }, parts.map((p) => h('li', null, h('i', { class: 'sw', style: { background: p.color } }), h('span', null, p.name), h('b', null, fmtPct(sum ? p.value / sum : 0))))));
  }
  const fmtPct = (r) => fmt.pct(r, r < 0.1 ? 1 : 0);

  // ===== Огляд ==================================================================================
  // Visitors by channel as a ring, the day-by-day table and the sources with their campaigns.
  function renderTraffic(d, rows) {
    const site = d.site, s = st(d);
    if (!site) return h('section', { id: 'sec-traffic' }, head('Звідки приходять і що з того виходить'), empty('Google Analytics зараз недоступний.'));
    const g = state.grain;
    const carts = new Map();
    for (const r of (s && s.daily) || []) { const k = keyOf(r.date, g); carts.set(k, (carts.get(k) || 0) + (r.addToCarts || 0)); }
    const dayRows = rows.slice().reverse();
    const maxS = Math.max(1, ...dayRows.map((r) => r.sessions || 0));
    const maxC = Math.max(1, ...dayRows.map((r) => carts.get(r.key) || 0));
    const maxO = Math.max(1, ...dayRows.map((r) => r.orders || 0));
    const hasSales = !!d.sales;
    const dayCols = [
      { t: g === 'month' ? 'Місяць' : g === 'week' ? 'Тиждень' : 'Дата', r: (r) => labelOf(r.key, g) },
      { t: 'Візити', r: (r) => meter((r.sessions || 0) / maxS, num(r.sessions || 0)) },
      ...(s && s.daily ? [{ t: 'Додали в кошик', r: (r) => meter((carts.get(r.key) || 0) / maxC, num(carts.get(r.key) || 0)) }] : []),
      ...(hasSales ? [{ t: 'Замовлень', r: (r) => meter((r.orders || 0) / maxO, num(r.orders || 0)) }, { t: 'Виручка, грн', n: true, r: (r) => num(r.revenue || 0) }] : []),
    ];
    const kids = [
      h('div', { class: 'grid two' },
        panel(h('h3', null, 'Звідки приходять'), ring(site.channels, { label: (c) => fmt.channel(c.name), value: (c) => c.sessions, total: site.totals.sessions })),
        panel(h('h3', null, 'Статистика по днях'), longTable(dayCols, dayRows, 12, g === 'month' ? 'місяців' : g === 'week' ? 'тижнів' : 'днів'),
          h('p', { class: 'note' }, 'Візити й кошики — з Google Analytics, замовлення й виручка — з BAS без ПДВ.'))),
    ];
    if (s && s.sources && s.sources.length) {
      const list = s.sources.filter((x) => x.sessions > 0);
      const maxV = Math.max(1, ...list.map((x) => x.sessions));
      kids.push(h('div', { style: { marginTop: '10px' } }, panel(h('h3', null, 'Які джерела дають відвідувачів і кошики'),
        longTable([
          { t: 'Канал', r: (x) => fmt.channel(x.channel) },
          { t: 'Джерело', r: (x) => fmt.source(x.source) },
          { t: 'Кампанія', r: (x) => h('div', { class: 'nm', title: x.campaign }, x.campaign === '(not set)' || x.campaign === '(direct)' ? dash : x.campaign) },
          { t: 'Візити', r: (x) => meter(x.sessions / maxV, num(x.sessions)) },
          { t: 'Відвідувачі', n: true, r: (x) => num(x.users) },
          { t: 'Не пішли одразу', n: true, r: (x) => fmt.pct(pc(x.engaged, x.sessions)) },
          { t: 'Додали в кошик', n: true, r: (x) => num(x.addToCarts) },
        ], list, 10, 'джерел'),
        h('p', { class: 'note' }, 'Скільки замовлень дало кожне джерело, Google Analytics тут не показуємо: його облік покупок поки ненадійний. Реальні замовлення — у BAS.'))));
    }
    return h('section', { id: 'sec-traffic' }, head('Звідки приходять і що з того виходить', null, 'sec-traffic'), kids);
  }

  // ===== Telegram-канал =========================================================================
  // Posts of the shop's channel in the period against the period before: views, reactions and the visits that came from it.
  function renderTelegram(d) {
    const t = d.telegram;
    if (!t) return null;
    const pv = t.previous || {};
    const chg = (a, b) => (b ? dChip(a, b) : null);
    const v = t.visits;
    const cards = [
      kpi('Підписників', t.subscribers === null ? dash : num(t.subscribers), t.subscribersChange ? `${t.subscribersChange > 0 ? '+' : ''}${t.subscribersChange} за період` : t.channel),
      kpi('Публікацій', num(t.posts), pv.posts !== undefined ? [chg(t.posts, pv.posts), h('span', null, `було ${num(pv.posts)}`)] : null),
      kpi('Середній перегляд поста', num(t.avgViews), pv.avgViews ? [chg(t.avgViews, pv.avgViews), h('span', null, `було ${num(pv.avgViews)}`)] : null),
      kpi('Реакцій', num(t.reactions), pv.reactions !== undefined ? chg(t.reactions, pv.reactions) : null),
      v ? kpi('Візитів із Telegram', num(v.sessions), `${num(v.addedToCart)} додали в кошик`) : null,
    ];
    const kids = [h('div', { class: 'grid kpis' }, cards)];
    const maxV = Math.max(1, ...t.list.map((x) => x.views));
    kids.push(h('div', { style: { marginTop: '10px', display: 'grid', gap: '10px' } },
      panel(h('h3', null, 'Публікації за період'), t.list.length ? longTable([
        { t: 'Дата', r: (x) => (x.day ? fmt.dateFull(x.day) : dash) },
        { t: 'Публікація', r: (x) => h('a', { class: 'nm', href: x.url, target: '_blank', rel: 'noopener', title: x.title }, x.title || 'пост') },
        { t: 'Перегляди', r: (x) => meter(x.views / maxV, num(x.views) + (x.final ? '' : ' …')) },
        { t: 'Реакції', n: true, r: (x) => num(x.reactions) },
        { t: 'Мітка посилання', r: (x) => (x.campaigns.length ? x.campaigns.join(', ') : h('span', { class: 'tag bad' }, 'немає')) },
      ], t.list, 10, 'публікацій') : empty('У цей період у каналі публікацій не було.'),
        h('p', { class: 'note' }, 'Перегляди поста ростуть ще 1–2 дні: біля свіжих постів стоїть «…», остаточне число фіксується через 48 годин. Підписники відомі від початку запису (ця історія накопичується щодня).')),
      panel(h('h3', null, 'Звідки приходять візити з каналу'), v && v.campaigns.length ? table([
        { t: 'Мітка посилання (кампанія)', r: (x) => x.name },
        { t: 'Візити', n: true, r: (x) => num(x.sessions) },
      ], v.campaigns) : empty('Візитів із Telegram за цей період не знайдено.'),
        t.best ? h('p', { class: 'note' }, 'Найкращий пост: ', h('a', { href: t.best.url, target: '_blank', rel: 'noopener' }, t.best.title || 'пост'), ` (${num(t.best.views)}). Найслабший: `, h('a', { href: t.weakest.url, target: '_blank', rel: 'noopener' }, t.weakest.title || 'пост'), ` (${num(t.weakest.views)}).`) : null)));
    return h('section', { id: 'sec-telegram' }, head('Telegram-канал', null, 'sec-telegram'), kids);
  }

  // ===== Поведінка ==============================================================================
  function renderBehaviour(d) {
    const s = st(d);
    if (!s || !s.totals) return noGa('sec-behaviour', 'Що роблять на сайті');
    const t = s.totals.cur, p = s.totals.prev;
    const daily = s.daily || [];
    const cards = [
      kpi('Переглядів сторінок', num(t.screenPageViews), p ? dChip(t.screenPageViews, p.screenPageViews) : null, { spark: daily.map((r) => r.sessions) }),
      kpi('Середній візит', mmss(t.averageSessionDuration), p ? dChip(t.averageSessionDuration, p.averageSessionDuration) : null, { spark: daily.map((r) => r.avgSec) }),
      kpi('Дій на відвідувача', fmt.dec1(t.eventCountPerUser), p ? dChip(t.eventCountPerUser, p.eventCountPerUser) : null, { spark: daily.map((r) => r.events) }),
      kpi('Активних відвідувачів', num(t.activeUsers), p ? dChip(t.activeUsers, p.activeUsers) : null, { spark: daily.map((r) => r.active) }),
    ];
    const kids = [h('div', { class: 'grid kpis' }, cards)];
    const ev = (s.events || []).filter((e) => e.count > 0);
    const maxE = Math.max(1, ...ev.map((e) => e.count));
    const langs = (s.languages || []).filter((l) => l.sessions > 0);
    kids.push(h('div', { class: 'grid two', style: { marginTop: '10px' } },
      panel(h('h3', null, 'Що роблять на сайті (дії)'), s.events ? table([
        { t: 'Дія', r: (e) => h('span', { title: e.name }, word(EVENT, e.name)) },
        { t: 'Разів', r: (e) => meter(e.count / maxE, num(e.count)) },
        { t: 'Людей', n: true, r: (e) => num(e.users) },
        ...(p ? [{ t: 'Зміна', n: true, r: (e) => (e.prevCount === null ? dash : dChip(e.count, e.prevCount) || dash) }] : []),
      ], ev.slice(0, 15)) : missing('дії')),
      panel(h('h3', null, 'Мова сайту в браузері'), s.languages ? longTable([
        { t: 'Мова', r: (l) => word(LANG, l.name) },
        { t: 'Візити', n: true, r: (l) => num(l.sessions) },
        { t: 'Частка', r: (l) => meter(pc(l.sessions, t.sessions)) },
        { t: 'Відвідувачі', n: true, r: (l) => num(l.activeUsers) },
      ], langs, 8, 'мов') : missing('мови'))));
    return h('section', { id: 'sec-behaviour' }, head('Що роблять на сайті', null, 'sec-behaviour'), wholeShopNote(d), kids);
  }

  // ===== Аудиторія ==============================================================================
  function renderAudience(d) {
    const s = st(d), site = d.site;
    if (!s) return noGa('sec-audience', 'Хто наші відвідувачі');
    const kids = [];
    // Age and gender: one bar per age bracket, split by gender.
    const ages = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    let ageBlock = missing('вік і стать');
    if (s.ageGender && s.ageGender.length) {
      const by = new Map(ages.map((a) => [a, { female: 0, male: 0 }]));
      for (const r of s.ageGender) if (by.has(r.age) && (r.gender === 'female' || r.gender === 'male')) by.get(r.age)[r.gender] += r.users;
      const max = Math.max(1, ...[...by.values()].map((v) => v.female + v.male));
      const total = [...by.values()].reduce((t, v) => t + v.female + v.male, 0);
      ageBlock = h('div', null,
        h('div', { class: 'legendline' }, ['female', 'male'].map((g, i) => h('span', null, h('i', { class: 'sw', style: { background: PALETTE[i === 0 ? 0 : 3] } }), GENDER[g]))),
        h('div', { class: 'stackrows' }, ages.map((a) => {
          const v = by.get(a), sum = v.female + v.male;
          return h('div', { class: 'stackrow' }, h('span', { class: 'sl' }, a),
            h('div', { class: 'sbar', title: `${a}: жінки ${num(v.female)}, чоловіки ${num(v.male)}` },
              h('b', { style: { width: `${(v.female / max) * 100}%`, background: PALETTE[0] } }), h('b', { style: { width: `${(v.male / max) * 100}%`, background: PALETTE[3] } })),
            h('span', { class: 'sv' }, `${num(sum)} · ${fmtPct(pc(sum, total))}`));
        })),
        h('p', { class: 'note' }, 'Вік і стать Google знає лише про частину відвідувачів, тому цифри показують структуру, а не точну кількість.'));
    }
    const geo = (list, nameFn, title, limit) => (list ? panel(h('h3', null, title), longTable([
      { t: '', r: (x) => nameFn(x.name) },
      { t: 'Візити', n: true, r: (x) => num(x.sessions) },
      { t: '', r: (x) => meter(x.sessions / Math.max(1, list[0].sessions), '') },
      { t: 'Відвідувачі', n: true, r: (x) => num(x.totalUsers) },
    ], list.filter((x) => x.sessions > 0), limit, 'рядків')) : panel(h('h3', null, title), missing(title.toLowerCase())));
    kids.push(h('div', { class: 'grid two' },
      geo(s.regions, regionName, 'Області', 12),
      panel(h('h3', null, 'Вік і стать'), ageBlock)));
    kids.push(h('div', { class: 'grid two', style: { marginTop: '10px' } },
      geo(s.cities, (n) => word(CITY, n), 'Міста', 12),
      panel(h('h3', null, 'Тип пристрою'), site && site.devices.length
        ? ring(site.devices, { label: (x) => DEVICE[x.name] || x.name, value: (x) => x.sessions, total: site.totals.sessions }) : missing('пристрої'))));
    const dev = (list, nameFn, title, limit) => (list ? panel(h('h3', null, title), ranked(list.filter((x) => x.sessions > 0), { label: (x) => nameFn(x.name), value: (x) => x.sessions, limit })) : panel(h('h3', null, title), missing(title.toLowerCase())));
    kids.push(h('div', { class: 'grid three', style: { marginTop: '10px' } },
      dev(s.brands, (n) => (n === '(not set)' ? 'не визначено' : n), 'Марка телефону', 10),
      dev(s.systems, (n) => word(SYSTEM, n), 'Операційна система', 8),
      dev(s.screens, (n) => (n === '(not set)' ? 'не визначено' : n), 'Розмір екрана', 10)));
    return h('section', { id: 'sec-audience' }, head('Хто наші відвідувачі', null, 'sec-audience'), wholeShopNote(d), kids);
  }

  // ===== Замовлення =============================================================================
  // The way from a visitor to an order. Steps up to checkout are Google Analytics (people), the last one is BAS (orders).
  function renderOrders(d) {
    const s = st(d), sales = d.sales;
    const kids = [];
    if (sales) {
      const k = sales.kpis;
      kids.push(h('div', { class: 'grid kpis' },
        kpi('Замовлень', num(k.orders), [dChip(k.orders, k.prev && k.prev.orders)]),
        kpi('Виручка без ПДВ, грн', fmt.compact(k.revenue), [dChip(k.revenue, k.prev && k.prev.revenue)]),
        kpi('Середній чек, грн', fmt.compact(k.aov), [dChip(k.aov, k.prev && k.prev.aov)]),
        d.site ? kpi('Замовлень на 1000 візитів', fmt.dec1((sales.conversion || 0) * 1000), sales.prevConversion != null ? [dChip(sales.conversion, sales.prevConversion)] : null) : null));
    }
    if (s && s.funnel && s.totals) {
      const f = s.funnel, users = s.totals.cur.totalUsers;
      const steps = [
        { name: 'Відвідувачів на сайті', n: users, note: 'усі, хто зайшов' },
        { name: 'Подивились товар', n: (f.view_item || {}).users || 0, note: 'відкрили картку товару' },
        { name: 'Додали в кошик', n: (f.add_to_cart || {}).users || 0, note: 'поклали товар у кошик' },
        { name: 'Почали оформлення', n: (f.begin_checkout || {}).users || 0, note: 'дійшли до оформлення' },
      ];
      if (sales && d.scope.all) steps.push({ name: 'Замовлень у BAS', n: sales.kpis.orders, note: 'реальні замовлення', bas: true });
      const max = Math.max(1, ...steps.map((x) => x.n));
      kids.push(panel(h('h3', null, 'Шлях від візиту до замовлення'),
        h('div', { class: 'funnel' }, steps.map((x, i) => h('div', { class: `fstep${x.bas ? ' bas' : ''}` },
          h('div', { class: 'fname' }, x.name, h('small', null, x.note)),
          h('div', { class: 'fbar' }, h('b', { style: { width: `${Math.max(1, (x.n / max) * 100)}%` } })),
          h('div', { class: 'fnum' }, h('b', null, num(x.n)), h('small', null, i === 0 ? '100%' : `${fmt.pct(pc(x.n, steps[i - 1].n), x.n && pc(x.n, steps[i - 1].n) < 0.1 ? 1 : 0)} від попереднього`))))),
        h('p', { class: 'note' }, 'Кроки до оформлення рахує Google Analytics (людей), останній крок — замовлення з BAS. Тому останнє число — це замовлення, а не люди, а різниця між кроками показує, де ми втрачаємо покупців.')));
    } else if (!sales) kids.push(missing('шлях до замовлення'));
    if (sales && !d.scope.all) kids.push(h('p', { class: 'scope-note' }, 'Шлях від візиту до замовлення рахується для всього магазину, тому в категорії чи типі продажів показуємо тільки цифри BAS.'));
    return h('section', { id: 'sec-orders' }, head('Шлях до замовлення', null, 'sec-orders'), kids.length ? kids : empty('Немає даних'));
  }

  // ===== Товари =================================================================================
  function renderItems(d) {
    const s = st(d);
    if (!s || !s.items) return noGa('sec-items', 'Що дивляться і кладуть у кошик');
    const f = s.funnel || {};
    const list = s.items.filter((x) => x.views > 0 || x.carts > 0);
    const totalViews = (f.view_item || {}).count || list.reduce((t, x) => t + x.views, 0);
    const totalCarts = (f.add_to_cart || {}).count || list.reduce((t, x) => t + x.carts, 0);
    const kids = [h('div', { class: 'grid kpis' },
      kpi('Переглядів товарів', num(totalViews), null, { spark: null }),
      kpi('Додавань у кошик', num(totalCarts), null),
      kpi('У кошик із 100 переглядів', fmt.dec1(pc(totalCarts, totalViews) * 100), null))];
    const body = h('div');
    const box = h('input', { type: 'search', class: 'finput', placeholder: 'Знайти товар…', 'aria-label': 'Пошук товару' });
    const sort = h('div', { class: 'seg', role: 'group', 'aria-label': 'Порядок' });
    let by = 'views';
    const draw = () => {
      clear(body);
      const q = box.value.trim().toLowerCase();
      const rows = list.filter((x) => !q || x.name.toLowerCase().includes(q)).sort((a, b) => b[by] - a[by]);
      const maxV = Math.max(1, ...rows.map((x) => x.views)), maxC = Math.max(1, ...rows.map((x) => x.carts));
      body.appendChild(longTable([
        { t: 'Товар', r: (x) => h('div', { class: 'nm', title: x.name }, x.name) },
        { t: 'Переглядів', r: (x) => meter(x.views / maxV, num(x.views)) },
        { t: 'У кошик', r: (x) => meter(x.carts / maxC, num(x.carts)) },
        { t: 'У кошик із 100 переглядів', n: true, r: (x) => (x.views >= 20 ? fmt.dec1(pc(x.carts, x.views) * 100) : dash) },
      ], rows, 15, 'товарів'));
    };
    for (const [id, text] of [['views', 'Найбільше переглядів'], ['carts', 'Найбільше в кошику']]) {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === by) }, text);
      b.addEventListener('click', () => { by = id; for (const x of sort.children) x.setAttribute('aria-pressed', String(x === b)); draw(); });
      sort.appendChild(b);
    }
    box.addEventListener('input', draw);
    draw();
    kids.push(panel(h('h3', null, 'Статистика по товарах (Google Analytics)'), h('div', { class: 'toolrow' }, box, sort), body,
      h('p', { class: 'note' }, 'Це те, що люди дивляться й кладуть у кошик. Що реально купили й на яку суму — у таблиці «Найкращі товари за продажами» вище, вона з BAS. Товар, який багато дивляться, але мало кладуть у кошик, — привід перевірити ціну й картку.')));
    return h('section', { id: 'sec-items' }, head('Що дивляться і кладуть у кошик', null, 'sec-items'), wholeShopNote(d), kids);
  }

  // ===== Утримання ==============================================================================
  function renderRetention(d) {
    const s = st(d);
    if (!s || !s.active || !s.active.length) return noGa('sec-retention', 'Скільки людей повертається');
    const a = s.active, last = a[a.length - 1];
    const t = s.totals;
    const sticky = pc(last.d1, last.d28);
    const days = a.map((r) => ({ label: r.date, long: r.date, values: { 'Активних за день': r.d1 } }));
    const kids = [h('div', { class: 'grid kpis' },
      kpi('Були на сайті за добу', num(last.d1), `на ${last.date}`, { spark: a.map((r) => r.d1) }),
      kpi('Були за 7 днів', num(last.d7), 'різних людей до цього дня включно', { spark: a.map((r) => r.d7) }),
      kpi('Були за 28 днів', num(last.d28), 'різних людей до цього дня включно', { spark: a.map((r) => r.d28) }),
      kpi('Повертаються щодня', fmtPct(sticky), 'частка місячної аудиторії, що заходить за добу'),
      t && t.cur ? kpi('Усього відвідувачів за період', num(t.cur.totalUsers), t.prev ? dChip(t.cur.totalUsers, t.prev.totalUsers) : null) : null)];
    kids.push(panel(h('h3', null, 'Активні відвідувачі по днях'), chart({ rows: days, series: [{ name: 'Активних за день', color: 'var(--c-zzr)' }], unit: ' людей', title: 'Активні відвідувачі' }),
      h('p', { class: 'note' }, '«Були за 7 і 28 днів» рахуємо назад від кожного дня: скільки різних людей заходили протягом останніх 7 або 28 днів. Чим ближче «за добу» до «за 28 днів», тим частіше люди повертаються.')));
    return h('section', { id: 'sec-retention' }, head('Скільки людей повертається', null, 'sec-retention'), wholeShopNote(d), kids);
  }

  return { renderTelegram, renderTraffic, renderBehaviour, renderAudience, renderOrders, renderItems, renderRetention };
};
