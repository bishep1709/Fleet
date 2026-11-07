// SytBoard «Головна»: three short looks (yesterday, last 7 days, last 30 days) with plain findings, ad spend,
// the market price picture and orders the customers placed themselves, by product type. Details live in the other
// pages. All text goes through DOM APIs. Texts are plain words (see js/glossary.js for the terms).
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('«Головна» доступна лише адміністраторам SytBoard. Вам доступні «Ціни на ринку» й «Задачі».', true); return; }

  const COLORS = { 'ЗЗР': 'var(--c-zzr)', 'Насіння': 'var(--c-seed)', 'Дрібне фасування ЗЗР': 'var(--c-small)', 'Outcast (побутові шкідники)': 'var(--c-outcast)', 'Розпилювачі': 'var(--c-spray)' };
  const SHORT = { 'Дрібне фасування ЗЗР': 'Дрібне фасування', 'Outcast (побутові шкідники)': 'Outcast' };
  const colorOf = (n) => COLORS[n] || 'var(--c-other)';
  const short = (n) => SHORT[n] || n;
  const dChip = (cur, prev) => (prev === null || prev === undefined ? null : deltaChip(prev ? (cur - prev) / prev : (cur ? null : 0)));
  const num = (n) => fmt.int(n);
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100; const b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  // Spend going up is neither good nor bad on its own, so its change chip is neutral.
  const spendChip = (cur, prev) => (prev === null || prev === undefined ? null : deltaChip(prev ? (cur - prev) / prev : (cur ? null : 0), { good: 'neutral' }));

  // The campaigns behind a change in ad spend: «нова, з 26.10: +851 грн», «зупинена: −255 грн».
  const spendWhy = (drivers) => (drivers && drivers.length ? drivers.map((c) => {
    const what = c.state === 'new' ? (c.since ? `нова, з ${c.since}` : 'нова') : c.state === 'stopped' ? 'зупинена' : null;
    return `«${c.name}»${what ? ` — ${what}` : ''}: ${c.diff >= 0 ? '+' : '−'}${num(Math.abs(c.diff))} грн`;
  }).join('; ') : null);

  const rangeText = (r) => (r.from === r.to ? r.from : `${r.from} — ${r.to}`);
  const reportLink = (w, extra) => (w.id === 'day' ? `report.html?view=day&date=${w.range.from}` : `report.html?from=${w.range.from}&to=${w.range.to}${extra || ''}`);
  const tabLink = (w, tab) => (w.id === 'day' ? `report.html?view=day&date=${w.range.from}` : `report.html?from=${w.range.from}&to=${w.range.to}&tab=${tab}`);
  const V = '?v=20261018a';

  // «Рух до цілі»: where the shop is on the way to the strategy's goal, organic sales only (no manager, no manager
  // promo code). Dollars with VAT, as in the strategy. Opens to the months: organic per month against the plan for
  // the same month of the goal year.
  const usd = (n) => (n === null || n === undefined ? '—' : `$${n >= 100000 ? Math.round(n / 1000) : fmt.dec1(n / 1000)} тис.`);
  const dmy = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  const mLabel = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
  function goalSection(d) {
    const g = d.goal;
    if (!g) return h('section', { class: 'goal' }, h('div', { class: 'empty' }, 'Рух до цілі зараз порахувати не вдалося (BAS недоступний).'));
    const at = (v) => Math.max(0, Math.min(100, (v / g.goalUsd) * 100));
    const now = g.organicUsd;
    const times = now ? g.goalUsd / now : null;
    const today = new Date().toISOString().slice(0, 10);
    const toSeason = g.seasonStart ? Math.ceil((new Date(`${g.seasonStart}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000) : null;
    const status = g.goalYear
      ? `${g.year}: продано ${usd(g.goalYear.fact)} органіки з плану на сьогодні ${usd(g.goalYear.planToDate)} (${g.goalYear.planToDate ? fmt.pct(g.goalYear.fact / g.goalYear.planToDate, 0) : '—'}).`
      : `Рік цілі починається 01.01.${g.year}${toSeason && toSeason > 0 ? `, сезон — ${dmy(g.seasonStart)} (через ${toSeason} ${plural(toSeason, 'день', 'дні', 'днів')})` : ''}.`;

    // Each month: what the shop sold as organic (green) against what it would have to sell in the same month of the goal
    // year to reach the goal (grey) — the goal spread over the months by the season. Newest month first; months before
    // BAS has any data are left out and named once.
    const shown = g.monthly.filter((m) => !g.firstDate || `${m.month}-31` >= g.firstDate).reverse();
    const skipped = g.monthly.length - shown.length;
    const maxM = Math.max(1, ...shown.map((m) => Math.max(m.organic, m.plan)));
    const months = h('div', null,
      h('p', { class: 'gline' }, h('b', null, 'Скільки продаємо щомісяця і скільки треба. '),
        `Сіра смуга — скільки органіки треба продавати в цей місяць ${g.year} року, щоб за рік вийти на ${usd(g.goalUsd)} (ціль розкладена по сезону: навесні треба більше). Зелена — скільки продали в цей місяць зараз. Відсоток — яку частину потрібного вже продаємо.`),
      h('div', { class: 'sv gmonths', role: 'list' }, shown.map((m) => {
        const share = m.plan ? m.organic / m.plan : null;
        const tip = `${mLabel(m.month)}: продали ${usd(m.organic)}${m.partial ? ' (місяць ще триває)' : ''}, треба ${usd(m.plan)}`;
        return h('div', { class: 'sv-row', role: 'listitem', 'aria-label': tip },
          h('span', { class: 'sv-n' }, mLabel(m.month), m.partial ? h('small', { class: 'muted' }, ' · триває') : null),
          h('span', { class: 'sv-bars', 'aria-hidden': 'true', title: tip },
            h('i', { class: 'now', style: { width: `${(m.organic / maxM) * 100}%`, background: 'var(--brand)', opacity: m.partial ? 0.5 : 1 } }),
            h('i', { class: 'was', style: { width: `${(m.plan / maxM) * 100}%` } })),
          h('span', { class: 'sv-v' }, `${usd(m.organic)} з ${usd(m.plan)}`, h('small', null, share === null ? '—' : `${fmt.pct(share, 0)} потрібного`)));
      })),
      h('div', { class: 'sv-cap' }, h('i', { class: 'sv-key gnow' }), ' продали (органіка) ', h('i', { class: 'sv-key was' }), ` треба в цей місяць ${g.year}, щоб вийти на ціль${skipped ? `. Раніше ${dmy(g.firstDate)} даних у BAS немає` : ''}.`),
      h('p', { class: 'hsub' }, `Для довідки: за правилом стратегії (ЗЗР і дрібне фасування через менеджера теж рахуються як самостійні) за 12 місяців — ${usd(g.strategyRuleUsd)}; усі продажі магазину — ${usd(g.allUsd)}. Коли писали стратегію, за ${g.startPeriod} було ${usd(g.startUsd)}.`),
      h('a', { class: 'more', href: `strategy.html${V}` }, 'Уся стратегія →'));
    // Closed: the goal, what is gathered and what is left, on one bar. Opened: only what the three numbers do not say
    // — the pace, the months.
    // Before the goal year begins «накопичено» is the organic of the last 12 months (the yearly pace now); from
    // 01.01 of the goal year it is the organic sold since then.
    const got = g.goalYear ? g.goalYear.fact : now;
    const gotNote = g.goalYear ? `з 01.01.${g.year}` : `органіка за ${dmy(g.window.from)} — ${dmy(g.window.to)}`;
    const rest = Math.max(0, g.goalUsd - got);
    const full = h('div', { class: 'gfull' },
      h('p', { class: 'gline' }, `${g.goalYear ? '' : `Рік цілі ще не почався, тож поки показуємо, скільки органіки магазин продає за рік зараз; з 01.01.${g.year} тут буде «Накопичено з початку року». `}`,
        h('b', null, `Зараз продаємо ${fmt.pct(now / g.goalUsd, 0)} того, що треба продавати у ${g.year}`), times && times >= 1.5 ? `, треба вирости в ${Math.round(times)} ${plural(Math.round(times), 'раз', 'рази', 'разів')}` : '', `. ${status}`),
      months);
    const x = expander('goal', full);
    const cell = (cls, label, value, extra, note) => h('div', { class: cls },
      h('div', { class: 'l' }, label), h('div', { class: 'v' }, value, extra ? h('small', null, extra) : null), h('div', { class: 's' }, note || ' '));

    return h('article', { class: 'hcard goal', 'aria-label': 'Рух до цілі стратегії' },
      h('div', { class: 'hh' }, h('span', { class: 'hl' }, `Рух до цілі ${g.year}`), h('span', { class: 'hr' }, 'органічні продажі: без менеджера і без його промокоду · з ПДВ, у доларах')),
      h('div', { class: 'htop' },
        h('div', { class: 'gsum' },
          cell('', 'Ціль на рік', usd(g.goalUsd), null, `органічних продажів у ${g.year}`),
          // Until the goal year starts nothing counts toward it yet: the middle number is the yearly pace now.
          cell('got', g.goalYear ? 'Накопичено' : 'Зараз продаємо за рік', usd(got), g.goalYear ? fmt.pct(got / g.goalUsd, 0) : `${fmt.pct(got / g.goalUsd, 0)} потрібного темпу`, gotNote),
          cell('', g.goalYear ? 'Залишок' : 'Не вистачає до цілі', usd(rest), null, g.goalYear ? `ще продати до кінця ${g.year}` : 'на рік, якщо темп не зміниться')),
        x.btn),
      g.goalYear
        ? h('div', { class: 'gbar', role: 'img', 'aria-label': `Накопичено ${usd(got)} з ${usd(g.goalUsd)}, залишок ${usd(rest)}.` },
          h('i', { class: 'gfill', style: { width: `${at(got)}%` } }))
        : h('div', { class: 'gpace', role: 'list', 'aria-label': 'Скільки органіки продаємо за рік: треба і зараз' },
          [[`Треба у ${g.year}`, g.goalUsd, 'need'], ['Зараз за рік', now, 'now']].map(([label, v, cls]) => h('div', { class: `gp-row ${cls}`, role: 'listitem' },
            h('span', { class: 'gp-l' }, label),
            h('span', { class: 'gp-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${at(v)}%` } })),
            h('span', { class: 'gp-v' }, usd(v))))),
      x.body);
  }

  // «Звідки зміна»: how much each kind of sale added or lost against the period before, in hryvnias. Bars grow from
  // the middle: right = more than before, left = less. It explains the big number above, which a share-of-sales strip
  // could not (it showed shares only, with nothing to compare against).
  function changeChart(s) {
    const rows = s.types.filter((t) => t.revenue > 0 || t.prevRevenue > 0)
      .map((t) => ({ name: short(t.name), cur: t.revenue, prev: t.prevRevenue, color: colorOf(t.name) }));
    const manPrev = Math.max(0, s.prev.revenue - s.organic.prevRevenue);
    if (s.manual.revenue > 0 || manPrev > 0) rows.push({ name: 'Через менеджера', cur: s.manual.revenue, prev: manPrev, color: 'var(--c-other)' });
    rows.forEach((r) => { r.diff = r.cur - r.prev; });
    rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));
    if (!rows.length) return null;
    const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
    return h('div', { class: 'chg' },
      h('div', { class: 'chg-h' }, 'Звідки зміна продажів'),
      h('div', { class: 'chg-rows', role: 'list' }, rows.map((r) => {
        const w = Math.max(r.diff ? 2 : 0, (Math.abs(r.diff) / max) * 50);
        const tip = `${r.name}: ${num(r.cur)} грн, було ${num(r.prev)} грн (${sign(r.diff)}${num(Math.abs(r.diff))} грн)`;
        return h('div', { class: 'chg-row', role: 'listitem', title: tip, 'aria-label': tip },
          h('span', { class: 'chg-n' }, h('i', { class: 'sw', style: { background: r.color } }), r.name),
          h('span', { class: 'chg-bar', 'aria-hidden': 'true' },
            h('i', { class: r.diff >= 0 ? 'up' : 'down', style: { width: `${w}%`, [r.diff >= 0 ? 'left' : 'right']: '50%' } })),
          h('span', { class: `chg-v ${r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : ''}` }, r.diff ? `${r.diff > 0 ? '▲' : '▼'} ${sign(r.diff)}${num(Math.abs(r.diff))} грн` : 'без змін',
            h('small', null, `було ${num(r.prev)}`)));
      })),
      h('div', { class: 'chg-cap' }, 'Праворуч — більше, ніж було, ліворуч — менше. Категорії — це замовлення, які клієнт оформив сам; окремо — продажі через менеджера.'));
  }

  // One row of the details table: what it is, now, before, and the change.
  const drow = (label, cur, prev, chip, hint) => h('tr', null,
    h('th', { scope: 'row' }, label, hint ? h('small', null, hint) : null),
    h('td', { class: 'n' }, cur),
    h('td', { class: 'n muted' }, prev === null || prev === undefined ? '—' : prev),
    h('td', { class: 'n' }, chip || ''));
  const dgroup = (title) => h('tr', { class: 'dg' }, h('th', { colspan: '4', scope: 'colgroup' }, title));

  function details(w) {
    const s = w.sales;
    const st = w.site;
    const a = w.ads;
    const manPrev = Math.max(0, s.prev.revenue - s.organic.prevRevenue);
    const rows = [
      dgroup('Продажі'),
      drow('Замовлень', num(s.orders), num(s.prev.orders), dChip(s.orders, s.prev.orders)),
      drow('Середній чек', s.orders ? `${num(s.aov)} грн` : '—', s.prev.orders ? `${num(s.prev.aov)} грн` : '—', s.orders && s.prev.orders ? dChip(s.aov, s.prev.aov) : null),
      drow('Самі оформили', `${num(s.organic.revenue)} грн`, `${num(s.organic.prevRevenue)} грн`, dChip(s.organic.revenue, s.organic.prevRevenue), `${fmt.pct(s.organic.share, 0)} продажів · ${num(s.organic.orders)} замовлень`),
      drow('Через менеджера', `${num(s.manual.revenue)} грн`, `${num(manPrev)} грн`, dChip(s.manual.revenue, manPrev), `${num(s.manual.orders)} замовлень`),
    ];
    rows.push(dgroup('Сайт'));
    if (st) {
      const gs = st.sessions && st.googleSessions !== null && st.googleSessions !== undefined ? st.googleSessions / st.sessions : null;
      const gp = st.prevSessions && st.prevGoogleSessions !== null && st.prevGoogleSessions !== undefined ? st.prevGoogleSessions / st.prevSessions : null;
      rows.push(
        drow('Відвідувачів', num(st.users), num(st.prevUsers), dChip(st.users, st.prevUsers)),
        drow('Візитів', num(st.sessions), num(st.prevSessions), dChip(st.sessions, st.prevSessions)),
        drow('Замовлень на 1000 візитів', st.sessions ? fmt.dec1((s.orders / st.sessions) * 1000) : '—', st.prevSessions ? fmt.dec1((s.prev.orders / st.prevSessions) * 1000) : '—',
          st.sessions && st.prevSessions && s.prev.orders ? dChip(s.orders / st.sessions, s.prev.orders / st.prevSessions) : null));
      if (st.avgSec) rows.push(drow('Середній час на сайті', fmt.duration(st.avgSec), st.prevAvgSec ? fmt.duration(st.prevAvgSec) : null, st.prevAvgSec ? dChip(st.avgSec, st.prevAvgSec) : null));
      if (gs !== null) rows.push(drow('Візитів із Google', fmt.pct(gs, 0), gp === null ? null : fmt.pct(gp, 0), null, `${num(st.googleSessions)} візитів`));
    } else {
      rows.push(h('tr', null, h('td', { colspan: '4', class: 'muted' }, 'Google Analytics зараз недоступний')));
    }
    rows.push(dgroup('Реклама Google'));
    if (a) {
      const prevShare = s.prev.revenue ? a.prevCost / s.prev.revenue : null;
      rows.push(
        drow('Витрати', `${num(a.cost)} грн`, `${num(a.prevCost)} грн`, spendChip(a.cost, a.prevCost)),
        drow('Кліків', num(a.clicks), num(a.prevClicks), dChip(a.clicks, a.prevClicks)),
        drow('Ціна кліку', a.clicks ? `${fmt.dec1(a.cpc)} грн` : '—', a.prevClicks ? `${fmt.dec1(a.prevCpc)} грн` : '—', a.clicks && a.prevClicks ? deltaChip((a.cpc - a.prevCpc) / a.prevCpc, { good: 'down' }) : null),
        drow('Реклама від продажів', a.costShare === null || !s.revenue ? '—' : fmt.pct(a.costShare, 1), prevShare === null ? null : fmt.pct(prevShare, 1), null, a.costPerOrder && s.orders ? `${num(a.costPerOrder)} грн на замовлення` : 'від усіх продажів магазину'));
    } else {
      rows.push(h('tr', null, h('td', { colspan: '4', class: 'muted' }, `Google Ads: ${adsErr || 'недоступний'}`)));
    }
    const why = a ? spendWhy(a.drivers) : null;
    return h('div', { class: 'hdet' },
      h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, ''), h('th', { class: 'n', scope: 'col' }, 'Зараз'), h('th', { class: 'n', scope: 'col' }, 'Було'), h('th', { class: 'n', scope: 'col' }, 'Зміна'))),
        h('tbody', null, rows))),
      why || (a && w.id === 'day') ? h('div', { class: 'adwhy' },
        why ? h('div', null, h('b', null, a.cost >= a.prevCost ? 'Чому витрати на рекламу більші: ' : 'Чому витрати на рекламу менші: '), why) : null,
        w.id === 'day' ? h('div', null, 'Реклама приносить замовлення не в той самий день, тож витрати й продажі за один день порівнювати не варто. Дивіться картки за 7 і 30 днів.') : null) : null,
      changeChart(s),
      h('a', { class: 'more', href: reportLink(w) }, 'Усі цифри в «Деталях» →'));
  }

  let adsErr = '';
  const open = new Set();
  function card(w) {
    const s = w.sales;
    const x = expander(`card-${w.id}`, details(w));
    return h('article', { class: 'hcard', 'aria-label': w.label },
      h('div', { class: 'hh' }, h('span', { class: 'hl' }, w.label), h('span', { class: 'hr' }, rangeText(w.range))),
      h('div', { class: 'htop' },
        h('div', null,
          h('div', { class: 'big' }, `${num(s.revenue)} грн`, h('small', null, 'без ПДВ')),
          h('div', { class: 's' }, dChip(s.revenue, s.prev.revenue), ' ', h('span', { class: 'hr' }, `${w.against} · було ${num(s.prev.revenue)} грн`))),
        x.btn),
      x.body);
  }

  // «Детальніше» / «Згорнути»: a button that shows or hides a block. What is open stays open after «Оновити».
  function expander(key, content) {
    const id = `hx-${key}`;
    const body = h('div', { id, class: 'hxbody', hidden: !open.has(key) }, content);
    const btn = h('button', { type: 'button', class: 'hx', 'aria-expanded': String(open.has(key)), 'aria-controls': id }, open.has(key) ? 'Згорнути' : 'Детальніше');
    btn.addEventListener('click', () => {
      const on = body.hidden;
      body.hidden = !on;
      if (on) open.add(key); else open.delete(key);
      btn.setAttribute('aria-expanded', String(on));
      btn.textContent = on ? 'Згорнути' : 'Детальніше';
    });
    return { btn, body };
  }

  function typesTable(windows) {
    const names = windows[0].sales.types.map((t) => t.name).filter((n) => windows.some((w) => w.sales.types.find((t) => t.name === n).revenue > 0 || w.sales.types.find((t) => t.name === n).prevRevenue > 0) || ['ЗЗР', 'Насіння', 'Дрібне фасування ЗЗР', 'Outcast (побутові шкідники)'].includes(n));
    const head = h('tr', null, h('th', { scope: 'col' }, 'Тип'), windows.map((w) => h('th', { class: 'n', scope: 'col' }, w.label)));
    const cell = (rev, delta, orders) => h('td', { class: 'n cell' }, `${num(rev)} грн`, h('small', null, delta === undefined ? '' : (delta === null ? 'нове' : deltaChip(delta)), orders !== undefined ? ` · ${orders} замовлень` : ''));
    const rows = names.map((n) => h('tr', null,
      h('td', null, h('i', { class: 'sw', style: { background: colorOf(n) } }), short(n)),
      windows.map((w) => { const t = w.sales.types.find((x) => x.name === n); return cell(t.revenue, t.delta, t.orders); })));
    rows.push(h('tr', { class: 'total' }, h('td', null, 'Самі оформили, разом'), windows.map((w) => cell(w.sales.organic.revenue, w.sales.organic.prevRevenue ? (w.sales.organic.revenue - w.sales.organic.prevRevenue) / w.sales.organic.prevRevenue : (w.sales.organic.revenue ? null : 0), w.sales.organic.orders))));
    rows.push(h('tr', null, h('td', { class: 'muted' }, 'Через менеджера (або з його промокодом)'), windows.map((w) => h('td', { class: 'n cell muted' }, `${num(w.sales.manual.revenue)} грн`, h('small', null, `${w.sales.manual.orders} замовлень`)))));
    return h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, head), h('tbody', null, rows)));
  }

  // «Що клієнти замовляють самі» as a chart: per product type the sales of the chosen period (coloured bar) and of the
  // period before (grey bar under it), on one scale, biggest first. The table with all three periods opens below.
  const selfView = { win: 'week' };
  const periodSegs = [];
  function periodSeg(d) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'За який період' });
    for (const w of d.windows) {
      const b = h('button', { type: 'button', 'aria-pressed': String(w.id === selfView.win), 'data-win': w.id }, w.label);
      b.addEventListener('click', () => {
        selfView.win = w.id;
        for (const p of periodSegs) {
          for (const x of p.seg.children) x.setAttribute('aria-pressed', String(x.dataset.win === w.id));
          p.draw();
        }
      });
      seg.appendChild(b);
    }
    return seg;
  }

  function selfSection(d) {
    const chart = h('div');
    const draw = () => {
      clear(chart);
      const w = d.windows.find((x) => x.id === selfView.win) || d.windows[1];
      const o = w.sales.organic;
      const rows = w.sales.types.filter((t) => t.revenue > 0 || t.prevRevenue > 0).sort((a, b) => b.revenue - a.revenue);
      const max = Math.max(1, ...rows.map((t) => Math.max(t.revenue, t.prevRevenue)));
      chart.append(
        h('div', { class: 'sv-total' }, h('b', null, `${num(o.revenue)} грн`), ` клієнти оформили самі · ${num(o.orders)} замовлень · ${fmt.pct(o.share, 0)} усіх продажів `,
          dChip(o.revenue, o.prevRevenue), h('span', { class: 'muted' }, ` · було ${num(o.prevRevenue)} грн`)),
        rows.length ? h('div', { class: 'sv', role: 'list' }, rows.map((t) => {
          const tip = `${short(t.name)}: ${num(t.revenue)} грн, ${t.orders} замовлень; було ${num(t.prevRevenue)} грн`;
          return h('div', { class: 'sv-row', role: 'listitem', title: tip, 'aria-label': tip },
            h('span', { class: 'sv-n' }, h('i', { class: 'sw', style: { background: colorOf(t.name) } }), short(t.name)),
            h('span', { class: 'sv-bars', 'aria-hidden': 'true' },
              h('i', { class: 'now', style: { width: `${(t.revenue / max) * 100}%`, background: colorOf(t.name) } }),
              h('i', { class: 'was', style: { width: `${(t.prevRevenue / max) * 100}%` } })),
            h('span', { class: 'sv-v' }, `${num(t.revenue)} грн `, t.delta === null ? h('span', { class: 'delta neutral' }, 'нове') : deltaChip(t.delta),
              h('small', null, `${t.orders} замовлень · було ${num(t.prevRevenue)}`)));
        })) : h('div', { class: 'empty' }, 'За цей період клієнти самі нічого не замовили.'),
        h('div', { class: 'sv-cap' }, h('i', { class: 'sv-key now' }), ' цей період ', h('i', { class: 'sv-key was' }), ` ${w.against.replace(/^проти /, '')}. Суми без ПДВ.`));
    };
    const seg = periodSeg(d);
    periodSegs.push({ seg, draw });
    draw();
    const x = expander('self-table', h('div', null, h('p', { class: 'hsub' }, 'Усі три періоди поруч. Стрілка — зміна проти такого ж попереднього періоду.'), typesTable(d.windows),
      h('a', { class: 'more', href: `report.html?from=${d.windows[2].range.from}&to=${d.windows[2].range.to}&mode=organic` }, 'Замовлення «від себе» за 30 днів у звіті →')));
    return h('section', null,
      h('div', { class: 'sechead', style: { marginTop: '22px' } }, h('h2', null, 'Що клієнти замовляють самі · органіка'), seg),
      h('p', { class: 'hsub' }, 'Органіка — замовлення, які клієнт оформив сам: без менеджера і без його промокоду. Саме вона рахується в ціль стратегії.'),
      h('div', { class: 'panel selfp' }, chart, h('div', { class: 'hxrow' }, h('span', { class: 'muted' }, 'Таблиця за всі три періоди'), x.btn), x.body));
  }

  // «Що клієнти шукають на сайті»: the words typed into the shop's search box, by product type, this period (coloured)
  // against the period before (grey), with the most frequent words of each type under its bar. Same period as above.
  function searchSection(d) {
    const chart = h('div');
    const draw = () => {
      clear(chart);
      const w = d.windows.find((x) => x.id === selfView.win) || d.windows[1];
      const q = w.search;
      if (!q) { chart.appendChild(h('div', { class: 'empty' }, 'Google Analytics зараз недоступний, пошукових запитів немає.')); return; }
      if (!q.total && !q.prevTotal) { chart.appendChild(h('div', { class: 'empty' }, 'За цей період пошуком на сайті ніхто не користувався.')); return; }
      const rows = q.cats.filter((c) => c.searches || c.prevSearches);
      const max = Math.max(1, ...rows.map((c) => Math.max(c.searches, c.prevSearches)));
      const color = (n) => (COLORS[n] ? colorOf(n) : 'var(--c-other)');
      chart.append(
        h('div', { class: 'sv-total' }, h('b', null, num(q.total)), ` ${plural(q.total, 'пошук', 'пошуки', 'пошуків')} · ${num(q.distinct)} різних запитів `,
          dChip(q.total, q.prevTotal), h('span', { class: 'muted' }, ` · було ${num(q.prevTotal)}`)),
        h('div', { class: 'sv', role: 'list' }, rows.map((c) => {
          const tip = `${short(c.name)}: ${num(c.searches)} пошуків, було ${num(c.prevSearches)}`;
          return h('div', { class: 'sv-row sq-row', role: 'listitem', 'aria-label': tip },
            h('span', { class: 'sv-n', title: c.name }, h('i', { class: 'sw', style: { background: color(c.name) } }), short(c.name)),
            h('span', { class: 'sv-bars', 'aria-hidden': 'true', title: tip },
              h('i', { class: 'now', style: { width: `${(c.searches / max) * 100}%`, background: color(c.name) } }),
              h('i', { class: 'was', style: { width: `${(c.prevSearches / max) * 100}%` } })),
            h('span', { class: 'sv-v' }, `${num(c.searches)} `, dChip(c.searches, c.prevSearches), h('small', null, `${q.total ? fmt.pct(c.searches / q.total, 0) : '—'} пошуків · було ${num(c.prevSearches)}`)),
            c.terms.length ? h('span', { class: 'sq-terms' }, c.terms.map((t) => h('span', { class: 'sq-t' }, t.term, h('b', null, ` ${num(t.searches)}`)))) : null);
        })),
        h('div', { class: 'sv-cap' }, h('i', { class: 'sv-key now' }), ' цей період ', h('i', { class: 'sv-key was' }), ` ${w.against.replace(/^проти /, '')}. Запит відносимо до типу товару за назвами препаратів у BAS.`));
    };
    const seg = periodSeg(d);
    periodSegs.push({ seg, draw });
    draw();
    const table = () => {
      const w = d.windows.find((x) => x.id === selfView.win) || d.windows[1];
      const q = w.search;
      if (!q || !q.top.length) return h('p', { class: 'hsub' }, 'Запитів немає.');
      return h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Запит'), h('th', { scope: 'col' }, 'Тип товару'), h('th', { class: 'n', scope: 'col' }, 'Пошуків'), h('th', { class: 'n', scope: 'col' }, 'Було'))),
        h('tbody', null, q.top.map((t) => h('tr', null,
          h('th', { scope: 'row' }, t.term),
          h('td', null, h('i', { class: 'sw', style: { background: COLORS[t.category] ? colorOf(t.category) : 'var(--c-other)' } }), short(t.category)),
          h('td', { class: 'n' }, num(t.searches)),
          h('td', { class: 'n muted' }, num(t.prevSearches)))))));
    };
    const holder = h('div');
    const x = expander('search-table', holder);
    const fillTable = () => { clear(holder); holder.append(h('p', { class: 'hsub' }, 'Найчастіші запити за вибраний період.'), table()); };
    fillTable();
    periodSegs.push({ seg: h('div'), draw: fillTable });
    return h('section', null,
      h('div', { class: 'sechead', style: { marginTop: '22px' } }, h('h2', null, 'Що клієнти шукають на сайті'), seg),
      h('p', { class: 'hsub' }, 'Що відвідувачі вводять у пошук магазину. Видно, який товар шукають і чи стало пошуків більше.'),
      h('div', { class: 'panel selfp' }, chart, h('div', { class: 'hxrow' }, h('span', { class: 'muted' }, 'Найчастіші запити таблицею'), x.btn), x.body));
  }

  // «Поведінка та проблеми клієнтів»: the day pulse added up over the chosen period, for management. Four cards: the way
  // to an order, money left on the way, trouble on the site, and why people at checkout did not buy. Each card shows
  // one number outside; the details open as tables. Same period switch as the blocks above.
  const ISSUE_TEXT = { rage: 'Злі кліки (клацають кілька разів підряд)', dead: 'Марні кліки (клацнули — нічого не сталося)', errorClick: 'Клік, після якого помилка', scriptError: 'Помилки на сторінці', quickback: 'Швидко повернулись назад' };
  // Cart products grouped by product type (the same four types as everywhere on the page, then «інше»): a total row per
  // type, so management sees which type people drop, and up to five products under it.
  const TYPE_ORDER = ['ЗЗР', 'Дрібне фасування ЗЗР', 'Outcast (побутові шкідники)', 'Насіння', 'Розпилювачі'];
  function cartByType(items) {
    const groups = new Map();
    for (const i of items) { const g = groups.get(i.category) || []; g.push(i); groups.set(i.category, g); }
    const order = [...TYPE_ORDER.filter((t) => groups.has(t)), ...[...groups.keys()].filter((t) => !TYPE_ORDER.includes(t))];
    const total = (list, k) => list.reduce((t, i) => t + (i[k] || 0), 0);
    const rows = [];
    for (const t of order) {
      const list = groups.get(t);
      rows.push(h('tr', { class: 'dg-type' },
        h('th', { scope: 'rowgroup' }, h('i', { class: 'sw', style: { background: COLORS[t] ? colorOf(t) : 'var(--c-other)' } }), short(t)),
        h('td', { class: 'n' }, num(total(list, 'added'))), h('td', { class: 'n' }, num(total(list, 'checkedOut'))), h('td', { class: 'n' }, num(total(list, 'purchased')))));
      for (const i of list.slice(0, 5)) rows.push(h('tr', null, h('th', { scope: 'row', class: 'sub' }, i.name), h('td', { class: 'n' }, num(i.added)), h('td', { class: 'n' }, num(i.checkedOut)), h('td', { class: 'n' }, num(i.purchased))));
      if (list.length > 5) rows.push(h('tr', null, h('td', { colspan: '4', class: 'muted sub' }, `і ще ${list.length - 5} ${plural(list.length - 5, 'товар', 'товари', 'товарів')}`)));
    }
    return h('table', { class: 'dtab' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Тип / товар'), h('th', { class: 'n', scope: 'col' }, 'У кошик'), h('th', { class: 'n', scope: 'col' }, 'Оформлення'), h('th', { class: 'n', scope: 'col' }, 'Купили'))),
      h('tbody', null, rows));
  }

  function behaviourSection(d) {
    const holder = h('div');
    const draw = () => {
      clear(holder);
      const w = d.windows.find((x) => x.id === selfView.win) || d.windows[1];
      const b = w.behaviour;
      if (!b) { holder.appendChild(h('div', { class: 'empty' }, 'Збережених звітів «Пульсу дня» за цей період немає.')); return; }
      const cards = [];
      const bcard = (key, title, big, bigCls, sub, content) => {
        const x = content ? expander(`bh-${key}-${w.id}`, content) : null;
        return h('article', { class: 'hcard', 'aria-label': title },
          h('div', { class: 'hh' }, h('span', { class: 'hl' }, title)),
          h('div', { class: 'htop' }, h('div', null, h('div', { class: `big ${bigCls || ''}` }, big), h('div', { class: 's hr' }, sub)), x ? x.btn : null),
          x ? x.body : null);
      };

      // 1. The way to an order
      const f = b.funnel; const pf = b.prevFunnel;
      if (f) {
        const conv = f.steps[0] ? f.steps[f.steps.length - 1] / f.steps[0] : null;
        const pconv = pf && pf.steps[0] ? pf.steps[pf.steps.length - 1] / pf.steps[0] : null;
        const max = Math.max(1, ...f.steps);
        cards.push(bcard('funnel', 'Шлях до замовлення', conv === null ? '—' : fmt.pct(conv, 1), '',
          ['з тих, хто дивився товар, купили ', conv !== null && pconv ? dChip(conv, pconv) : null, ` · було ${pconv === null ? '—' : fmt.pct(pconv, 1)}`],
          h('div', null,
            h('div', { class: 'sv', role: 'list' }, f.names.map((n, i) => {
              const pass = i && f.steps[i - 1] ? f.steps[i] / f.steps[i - 1] : null;
              const was = pf ? pf.steps[i] : null;
              return h('div', { class: 'sv-row', role: 'listitem' },
                h('span', { class: 'sv-n' }, n),
                h('span', { class: 'sv-bars', 'aria-hidden': 'true' }, h('i', { class: 'now', style: { width: `${(f.steps[i] / max) * 100}%`, background: 'var(--brand)' } })),
                h('span', { class: 'sv-v' }, `${num(f.steps[i])} `, was !== null ? dChip(f.steps[i], was) : null, h('small', null, `${pass === null ? 'початок' : `${fmt.pct(pass, 0)} з попереднього кроку`}${was !== null ? ` · було ${num(was)}` : ''}`)));
            })),
            w.cartItems && w.cartItems.length ? h('div', null, h('div', { class: 'chg-h' }, 'Які товари додавали в кошик і оформлювали — за типами'),
              h('div', { class: 'tablewrap prlist' }, cartByType(w.cartItems)),
              h('p', { class: 'hsub' }, 'Скільки разів товар додали в кошик, взяли в оформлення й купили за даними сайту. Покупок сайт записує менше, ніж є насправді, — точні продажі дивіться в BAS (блок «Що клієнти замовляють самі»).'))
              : (w.cartItems ? h('p', { class: 'hsub' }, 'За цей період товари в кошик не додавали.') : null),
            h('p', { class: 'hsub' }, `Люди за кожен день разом (одна людина в різні дні рахується кілька разів). Google Analytics, звітів за ${b.coverage.days} з ${b.coverage.of} днів.${f.trackingOk ? '' : ' Увага: у деякі дні покупки на сайті не записувались — останній крок занижений.'}`))));
      }

      // 2. Money left on the way
      const lo = b.lost; const plo = b.prevLost; const o = b.orders; const po = b.prevOrders;
      if (lo || o) {
        const site = lo ? lo.cart + lo.checkout : null;
        const psite = plo ? plo.cart + plo.checkout : null;
        const row = (label, cur, prev, hint) => drow(label, cur, prev, null, hint);
        cards.push(bcard('lost', 'Втрачені продажі', site === null ? '—' : `${num(site)} грн`, 'bad',
          ['оцінка за даними сайту: кошики, з якими не купили (з ПДВ) ', site !== null && psite ? deltaChip((site - psite) / psite, { good: 'down' }) : null, psite !== null ? ` · було ${num(psite)} грн` : ''],
          h('div', null,
            h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
              h('thead', null, h('tr', null, h('th', { scope: 'col' }, ''), h('th', { class: 'n', scope: 'col' }, 'Зараз'), h('th', { class: 'n', scope: 'col' }, 'Було'), h('th', { class: 'n', scope: 'col' }, ''))),
              h('tbody', null,
                lo ? row('Лишилось у кошику', `${num(lo.cart)} грн`, plo ? `${num(plo.cart)} грн` : null, 'товари, з якими не перейшли до оформлення') : null,
                lo ? row('Почали оформлення, але покупки сайт не побачив', `${num(lo.checkout)} грн`, plo ? `${num(plo.checkout)} грн` : null, 'увесь кошик на оформленні мінус куплене') : null,
                o ? row('Скасовані замовлення', `${num(o.cancelled.orders)} · ${num(o.cancelled.amount)} грн`, po ? `${num(po.cancelled.orders)} · ${num(po.cancelled.amount)} грн` : null, 'BAS, без ПДВ') : null,
                o ? row(`Не оплачені понад ${o.unpaid.days} днів`, `${num(o.unpaid.orders)} · ${num(o.unpaid.amount)} грн`, null, 'BAS, зараз висять') : null))),
            // Why the checkout row can be bigger than the cart row, and a warning when the site misses purchases
            // that BAS has: both make the «lost» money an estimate, so it is said here rather than hidden.
            lo ? h('p', { class: 'hsub' }, 'Чому на оформленні сума більша, ніж у кошику: коли товар кладуть у кошик, сайт записує ціну лише цього товару, а на оформленні — весь кошик, разом із товарами, доданими раніше (і в попередні дні).',
              f && w.sales.organic.orders > f.steps[f.steps.length - 1] ? h('b', { class: 'cm-warn' }, ` Сайт записав ${num(f.steps[f.steps.length - 1])} покупок, а в BAS ${num(w.sales.organic.orders)} замовлень, які клієнти оформили самі, — частина «незавершених» оформлень насправді куплена, тож втрати менші, ніж тут.`) : null) : null,
            b.abandoned.length ? h('div', null, h('div', { class: 'chg-h' }, 'Що найчастіше кидають у кошику'),
              h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
                h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Товар'), h('th', { class: 'n', scope: 'col' }, 'Додали'), h('th', { class: 'n', scope: 'col' }, 'Купили'), h('th', { class: 'n', scope: 'col' }, 'Не купили'))),
                h('tbody', null, b.abandoned.map((i) => h('tr', null, h('th', { scope: 'row' }, i.name), h('td', { class: 'n' }, num(i.added)), h('td', { class: 'n' }, num(i.purchased)), h('td', { class: 'n bad' }, num(i.left)))))))) : null)));
      }

      // 3. Trouble on the site (Clarity)
      const c = b.clarity; const pc = b.prevClarity;
      if (c) {
        const main = c.issues.rage.share + c.issues.errorClick.share;
        cards.push(bcard('site', 'Проблеми на сайті', fmt.pct(c.issues.dead.share, 0), c.issues.dead.share > 0.1 ? 'bad' : '',
          ['візитів із марними кліками ', pc ? deltaChip(c.issues.dead.share - pc.issues.dead.share, { kind: 'pp', good: 'down' }) : null, ` · злі кліки й помилки — ${fmt.pct(main, 1)} візитів`],
          h('div', null,
            h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
              h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Що сталося'), h('th', { class: 'n', scope: 'col' }, 'Частка візитів'), h('th', { class: 'n', scope: 'col' }, 'Було'), h('th', { class: 'n', scope: 'col' }, 'Зміна'))),
              h('tbody', null, Object.keys(ISSUE_TEXT).map((k) => drow(ISSUE_TEXT[k], fmt.pct(c.issues[k].share, 1), pc ? fmt.pct(pc.issues[k].share, 1) : null, pc ? deltaChip(c.issues[k].share - pc.issues[k].share, { kind: 'pp', good: 'down' }) : null))))),
            c.pages.length ? h('div', null, h('div', { class: 'chg-h' }, 'Де найбільше проблем'),
              h('div', { class: 'tablewrap' }, h('table', { class: 'dtab' },
                h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Сторінка'), h('th', { class: 'n', scope: 'col' }, 'Злі кліки'), h('th', { class: 'n', scope: 'col' }, 'Марні кліки'), h('th', { class: 'n', scope: 'col' }, 'Помилки'))),
                h('tbody', null, c.pages.map((p) => h('tr', null, h('th', { scope: 'row' }, p.name, h('small', null, p.path)), h('td', { class: 'n' }, num(p.rage)), h('td', { class: 'n' }, num(p.dead)), h('td', { class: 'n' }, num(p.errorClick + p.scriptError)))))))) : null,
            c.clicks.length ? h('div', null, h('div', { class: 'chg-h' }, 'На що клацають і нічого не відбувається'),
              h('ul', { class: 'blist' }, c.clicks.map((k) => h('li', { class: k.type === 'rage' ? 'bad' : 'warn' }, `${k.page}: «${k.text || 'без підпису'}» — ${num(k.count)} ${plural(k.count, 'раз', 'рази', 'разів')}${k.type === 'rage' ? ' (злі кліки)' : ''}`)))) : null,
            h('p', { class: 'hsub' }, `Microsoft Clarity, ${num(c.sessions)} візитів за ${c.days} з ${b.coverage.of} днів. Частка — скільки візитів мали таку проблему.`))));
      }

      // 4. Why people at checkout did not buy (Clarity recordings)
      const co = c && c.checkout;
      if (co) {
        const lostN = co.reached - co.bought;
        // A sample of recorded visits, not all of them: the counts differ from «Шлях до замовлення» (all visits, Google
        // Analytics) on purpose, so the caption says so and points to the full numbers.
        cards.push(bcard('why', 'Чому не купують на оформленні', `${num(lostN)} з ${num(co.reached)}`, lostN > co.bought ? 'bad' : '',
          [`записаних візитів дійшли до оформлення й не купили${co.reasons[0] ? `; найчастіше — ${co.reasons[0].text}` : ''}`,
            f ? h('div', null, `Це вибірка записів Clarity. Усього на сайті оформлення почали ${num(f.steps[2] || 0)}, купили ${num(f.steps[f.steps.length - 1] || 0)} — див. «Шлях до замовлення».`) : null],
          co.reasons.length ? h('div', null,
            h('ul', { class: 'blist' }, co.reasons.map((r) => h('li', { class: r.kind === 'error' || r.kind === 'confirm' ? 'bad' : 'warn' }, `${r.text} — ${num(r.count)}`))),
            h('p', { class: 'hsub' }, `З записів візитів Clarity: дійшли до оформлення ${num(co.reached)}, купили ${num(co.bought)}. Це вибірка записів, а не всі візити.`)) : null));
      }
      holder.appendChild(cards.length ? h('div', { class: 'hgrid bhgrid' }, cards) : h('div', { class: 'empty' }, 'За цей період даних про поведінку немає.'));
    };
    const seg = periodSeg(d);
    periodSegs.push({ seg, draw });
    draw();
    return h('section', null,
      h('div', { class: 'sechead', style: { marginTop: '22px' } }, h('h2', null, 'Поведінка та проблеми клієнтів'), seg),
      h('p', { class: 'hsub' }, 'Що заважає купити: де люди відпадають, скільки грошей лишається в кошику, що ламається на сайті. Зібрано зі щоденних звітів «Пульсу дня».'),
      holder);
  }

  // «Ціни на ринку»: two numbers — products where we are dearer than the partners (beyond the category's tolerance)
  // and products dearer than competitor products (by more than 10%). Each card opens the list of those products.
  function pricesSection(d) {
    const p = d.prices;
    const head = h('div', { class: 'sechead', style: { marginTop: '22px' } }, h('h2', null, 'Ціни на ринку'), h('a', { class: 'more', href: `prices.html${V}` }, 'Усі ціни →'));
    if (!p) return h('section', null, head, h('div', { class: 'empty' }, 'Дані про ціни зараз недоступні.'));
    const money = (n, unit) => `${fmt.dec1(n)} ${unit && unit !== '₴' ? `грн/${unit}` : 'грн'}`;
    const priceCard = (key, title, block, of, rule, theirHead, theirCell, emptyText) => {
      const x = expander(key, block.rows.length
        ? h('div', null,
          h('div', { class: 'tablewrap prlist' }, h('table', { class: 'dtab' },
            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Наш товар'), h('th', { class: 'n', scope: 'col' }, 'Наша ціна'), h('th', { class: 'n', scope: 'col' }, theirHead), h('th', { class: 'n', scope: 'col' }, 'Дорожче на'))),
            h('tbody', null, block.rows.map((r) => h('tr', null,
              h('th', { scope: 'row' }, r.name, r.pack ? ` · ${r.pack}` : '', r.section ? h('small', null, r.section) : null),
              h('td', { class: 'n' }, money(r.ours, r.unit)),
              h('td', { class: 'n' }, theirCell(r, money)),
              h('td', { class: 'n bad' }, `+${fmt.dec1(r.diffPct)}%`, r.limit !== undefined && r.limit !== null ? h('small', null, `допуск ${r.limit}%`) : null)))))),
          block.count > block.rows.length ? h('p', { class: 'hsub' }, `Показано ${block.rows.length} із ${block.count}. Усі — на сторінці «Ціни на ринку».`) : null)
        : h('p', { class: 'hsub' }, emptyText));
      return h('article', { class: 'hcard', 'aria-label': title },
        h('div', { class: 'hh' }, h('span', { class: 'hl' }, title)),
        h('div', { class: 'htop' },
          h('div', null,
            h('div', { class: `big ${block.count ? 'bad' : 'good'}` }, num(block.count), h('small', null, plural(block.count, 'товар', 'товари', 'товарів'))),
            h('div', { class: 's hr' }, `із ${num(of)} наших товарів, що є ${rule}`)),
          block.rows.length ? x.btn : null),
        x.body);
    };
    return h('section', null, head,
      h('p', { class: 'hsub' }, `Де наша ціна вища, ніж треба${p.lastRefresh ? `. Ціни оновлено ${p.lastRefresh.slice(8, 10)}.${p.lastRefresh.slice(5, 7)}.${p.lastRefresh.slice(0, 4)}` : ''}.`),
      h('div', { class: 'hgrid' },
        priceCard('pr-partners', 'Дорожчі за партнерів', p.dearerPartners, p.totals.withPartners, 'у партнерів; рахуємо, коли різниця більша за допуск категорії', 'У партнера',
          (r, m) => [m(r.theirs, r.unit), h('small', null, r.site || '')], 'Немає товарів, де ми дорожчі за партнера понад допуск.'),
        priceCard('pr-comp', 'Дорожчі за конкурентні товари', p.pricier, p.totals.withCompetitors, 'у конкурентів; рахуємо, коли ми дорожчі за найдешевший аналог більш ніж на 10%', 'Найдешевший аналог',
          (r, m) => [m(r.theirs, r.unit), h('small', null, [r.theirName, r.site].filter(Boolean).join(' · '))], 'Немає товарів, де ми дорожчі за конкурентні більш ніж на 10%.')));
  }

  // «Висновки»: findings grouped like the tabs of the manager report, for the look the person picks.
  const concl = { win: 'week' };
  function conclusions(d) {
    const body = h('div');
    const draw = () => {
      clear(body);
      const w = d.windows.find((x) => x.id === concl.win) || d.windows[1];
      body.appendChild(h('p', { class: 'hsub' }, `${w.label}, ${rangeText(w.range)}. Кожна цифра порівнюється ${w.against.replace(/^проти /, 'з ')}.`));
      if (!w.detailed) body.appendChild(h('p', { class: 'hsub' }, 'За один день показуємо огляд і рекламу. Решту (аудиторію, шлях до замовлення, товари) дивіться за 7 або 30 днів, а день докладно — у «Пульсі дня».'));
      const groups = w.conclusions || [];
      if (!groups.length) body.appendChild(h('div', { class: 'empty' }, 'Для цього періоду поки нічого сказати.'));
      body.appendChild(h('div', { class: 'cgrid' }, groups.map((g) => h('section', { class: 'cgroup' },
        h('h3', null, g.title),
        h('ul', null, g.items.map((i) => h('li', { class: i.tone }, i.text))),
        h('a', { class: 'more', href: tabLink(w, g.tab) }, 'Детальніше →')))));
    };
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'За який період висновки' });
    for (const w of d.windows) {
      const b = h('button', { type: 'button', 'aria-pressed': String(w.id === concl.win) }, w.label);
      b.addEventListener('click', () => { concl.win = w.id; for (const x of seg.children) x.setAttribute('aria-pressed', String(x === b)); draw(); });
      seg.appendChild(b);
    }
    draw();
    return h('section', null, h('div', { class: 'sechead', style: { marginTop: '22px' } }, h('h2', null, 'Висновки'), seg), body);
  }

  function render(d) {
    const root = $('home');
    clear(root);
    adsErr = d.sources.gads && !d.sources.gads.ok ? d.sources.gads.error : '';
    root.appendChild(goalSection(d));
    root.appendChild(h('div', { class: 'hgrid' }, d.windows.map(card)));
    root.appendChild(conclusions(d));
    periodSegs.length = 0;
    root.appendChild(selfSection(d));
    root.appendChild(searchSection(d));
    root.appendChild(behaviourSection(d));
    root.appendChild(pricesSection(d));
    root.appendChild(h('section', null,
      h('div', { class: 'hlinks', style: { marginTop: '18px' } },
        h('a', { href: `day.html${V}` }, 'Пульс дня →'),
        h('a', { href: `report.html${V}` }, 'Деталі за весь час →'),
        h('a', { href: `prices.html${V}` }, 'Ціни на ринку →'),
        h('a', { id: 'tasks-link', href: `tasks.html${V}` }, 'Задачі →'))));
    root.setAttribute('aria-busy', 'false');
    Glossary.mount(root, ['bas', 'vat', 'self', 'manager', 'aov', 'visitor', 'visit', 'ga', 'click', 'goal', 'pricier', 'delta']);
    root.appendChild(h('p', { class: 'hsub', style: { marginTop: '14px' } }, `Дані на ${fmt.time(d.generatedAt)} за київським часом. Продажі беремо з BAS наживо. Google Analytics уточнює дані про відвідувачів до двох діб, тому цифри за вчора вранці й ввечері трохи різняться. Збережений «Пульс дня» може показувати трохи менше відвідувачів: його збирають раз на день.`));
    const SRC = { ga4: 'Google Analytics', bas: 'BAS', gads: 'Google Ads', prices: 'Ціни' };
    const failed = Object.entries(d.sources).filter(([, v]) => !v.ok).map(([k, v]) => `${SRC[k] || k}: ${v.error || 'недоступно'}`);
    status(failed.length ? `Частину даних не отримано: ${failed.join('; ')}.` : '', failed.length > 0);
    apiCall('/tasks/summary').then((t) => { const a = $('tasks-link'); if (a) a.textContent = `Задачі: відкрито ${t.open}${t.overdue ? `, прострочено ${t.overdue}` : ''} →`; }).catch(() => {});
  }

  async function load(force) {
    status('');
    $('home').setAttribute('aria-busy', 'true');
    const loader = Loading.show($('home'), {
      title: 'Головна завантажується…',
      text: 'Збираємо продажі, відвідувачів, рекламу й ціни. Перший раз це займає до 15 секунд.',
      sources: ['BAS — продажі', 'Google Analytics — сайт', 'Google Ads — реклама', 'Ціни на ринку'],
      skeleton: 3,
    });
    try {
      let d;
      for (let attempt = 0; ; attempt++) {
        try { d = await apiCall(`/home${force ? '?refresh=1' : ''}`); break; } catch (err) {
          if ((err.status && err.status < 500) || attempt >= 2) throw err;
          loader.note('Сервер на мить недоступний (можливо, оновлюється). Повторюємо спробу…');
          await new Promise((r) => setTimeout(r, 4000));
          loader.note('');
        }
      }
      render(d);
    } catch (err) {
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      status(`Не вдалося зібрати дані (${err.status ? `помилка ${err.status}` : 'немає звʼязку із сервером'}). Спробуйте ще раз за хвилину.`, true);
    } finally {
      loader.stop();
    }
  }
  $('refresh').addEventListener('click', () => load(true));
  load(false);
})();
