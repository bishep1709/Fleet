'use strict';
const $ = (s, r = document) => r.querySelector(s);
// short "what is this page / how to use it" block shown on every page; remembers if the user collapsed it
function about(key, text) {
  let closed = false;
  try { closed = localStorage.getItem('about:' + key) === '0'; } catch { /* storage blocked */ }
  return `<details class="about" data-k="${key}" ${closed ? '' : 'open'}><summary>Що це за сторінка</summary><div>${text}</div></details>`;
}
const app = $('#app');
document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-go]'); if (t && !e.target.closest('a,button,input,select')) location.hash = t.dataset.go; });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, d = 2) => (n == null ? '—' : Number(n).toLocaleString('uk-UA', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toLocaleString('uk-UA', { maximumFractionDigits: 1 }) + ' %');
const pctCls = (n) => (n == null || Math.abs(n) < 0.05 ? '' : n > 0 ? 'pos' : 'neg'); // + = we are more expensive
const COLORS = ['#00a04b', '#d9951a', '#334c56', '#c4623b', '#7a6fb0', '#2e8bb8', '#9a8a3a', '#8a988f'];

const STATUS = {
  cheapest: ['good', 'Найдешевший'],
  parity: ['good', 'На рівні'],
  mid: ['warn', 'Посередині'],
  priciest: ['bad', 'Найдорожчий'],
  nocomp: ['mid', 'Немає даних'],
  noown: ['mid', 'Немає нашої ціни'],
};
const chip = (s) => { const [c, t] = STATUS[s] || ['mid', s]; return `<span class="chip ${c}">${t}</span>`; };

async function papi(path, opts = {}) {
  const r = await fetch('/api/prices' + path, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = 'login.html'; throw new Error('Потрібен вхід'); }
  if (!r.ok) throw new Error(j.error || 'Помилка ' + r.status);
  return j;
}
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}
const ask = (e, fn) => fn().catch((err) => toast(err.message, 6000));

// ---------- charts (plain SVG) ----------
// A smooth curve through the points that never swings past them (monotone cubic).
function smoothPath(pts) {
  const n = pts.length;
  if (n === 1) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    d += ` C${(pts[i][0] + dx[i] / 3).toFixed(1)},${(pts[i][1] + (t[i] * dx[i]) / 3).toFixed(1)} ${(pts[i + 1][0] - dx[i] / 3).toFixed(1)},${(pts[i + 1][1] - (t[i + 1] * dx[i]) / 3).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}
let lineChartUid = 0;
// Smooth lines, our own price shaded and thicker, dotted grid, the last value labelled, a tooltip per day with every price of that day.
function lineChart(series, metric) {
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return '<p class="muted">Історії поки немає — вона накопичується щодня.</p>';
  const uid = ++lineChartUid;
  const days = [...new Set(pts.map((p) => p[0]))].sort();
  const vals = pts.map((p) => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo *= 0.95; hi *= 1.05; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  const W = 760, H = 280, L = 58, R = 54, T = 18, B = 28;
  const x = (d) => L + (days.length === 1 ? (W - L - R) / 2 : (days.indexOf(d) / (days.length - 1)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const colorOf = (s, i) => (s.own ? 'var(--own)' : COLORS[(i + 1) % COLORS.length]);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="${i ? '2 5' : ''}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${money(v, 0)}</text>`;
  }
  const step = Math.max(1, Math.ceil(days.length / 6));
  // ISO 8601 dates, counted back from the last day so the last one is always shown and none touch
  for (let i = days.length - 1; i >= 0; i -= step) g += `<text x="${Math.min(Math.max(x(days[i]), L + 32), W - R - 32)}" y="${H - 8}" text-anchor="middle">${days[i]}</text>`;
  let defs = '', body = '';
  const endLabels = [];
  series.forEach((s, i) => {
    const c = colorOf(s, i);
    const p = s.points.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((q) => [x(q[0]), y(q[1]), q]);
    if (!p.length) return;
    const d = smoothPath(p);
    if (s.own && p.length > 1) {
      defs += `<linearGradient id="lg${uid}-${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:${c};stop-opacity:.25"/><stop offset="100%" style="stop-color:${c};stop-opacity:0"/></linearGradient>`;
      body += `<path d="${d} L${p[p.length - 1][0].toFixed(1)},${H - B} L${p[0][0].toFixed(1)},${H - B} Z" fill="url(#lg${uid}-${i})"/>`;
    }
    body += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${s.own ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const last = p[p.length - 1];
    body += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="${s.own ? 5 : 4}" fill="${c}" stroke="var(--card, #fff)" stroke-width="2.5"/>`;
    endLabels.push({ x: Math.min(last[0] + 8, W - 2), y: last[1] + 4, c, text: money(last[2][1], 0) });
  });
  // the last values, pushed apart so two lines that end close together do not print over each other
  endLabels.sort((p, q) => p.y - q.y).forEach((l, k, all) => { if (k && l.y - all[k - 1].y < 13) l.y = all[k - 1].y + 13; body += `<text class="mk" x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="start" fill="${l.c}">${l.text}</text>`; });
  // one invisible column per day: hover shows a guide line and the native tooltip lists every price of that day
  const colW = days.length === 1 ? W - L - R : (W - L - R) / (days.length - 1);
  const cols = days.map((d) => {
    const tip = [d, ...series.map((s) => { const q = s.points.find((z) => z[0] === d); return q ? `${s.label}: ${money(q[1])}` : null; }).filter(Boolean)].join('\n');
    return `<g class="lc-col"><line class="lc-guide" x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}"/><rect x="${(x(d) - colW / 2).toFixed(1)}" y="${T}" width="${colW.toFixed(1)}" height="${H - T - B}" fill="transparent"><title>${esc(tip)}</title></rect></g>`;
  }).join('');
  const legend = series.map((s, i) => `<span><i style="background:${colorOf(s, i)}"></i>${esc(s.label)}</span>`).join('');
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Динаміка цін, ${esc(metric)}"><defs>${defs}</defs>${g}${body}${cols}</svg><div class="legend">${legend}</div>`;
}

function hbars(rows, { max, fmt = (v) => money(v, 1), cls = () => '' } = {}) {
  const m = max || Math.max(...rows.map((r) => Math.abs(r.v)), 1);
  return `<div class="bars">${rows.map((r) => `<div class="row"><span title="${esc(r.label)}">${esc(r.label)}</span><div class="track"><div class="fill ${cls(r)}" style="width:${Math.min(100, (Math.abs(r.v) / m) * 100)}%"></div></div><span class="n">${fmt(r.v)}</span></div>`).join('')}</div>`;
}

// ---------- sortable table helper ----------
function sortRows(rows, key, dir) {
  return rows.slice().sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'uk') : x - y) * dir;
  });
}

// ---------- pages ----------
// ---------- Огляд для власника: що робити сьогодні ----------
const hState = { get section() { return mState.section; }, set section(v) { mState.section = v; }, list: 'losing', all: false };

const sec = (arr, s) => (s ? arr.filter((x) => x.section === s) : arr);
const mny = (n) => (n == null ? '—' : Math.round(n).toLocaleString('uk-UA'));
const kfmt = (n) => (n == null ? '—' : n >= 1e6 ? (n / 1e6).toLocaleString('uk-UA', { maximumFractionDigits: 1 }) + ' млн' : n >= 1e3 ? Math.round(n / 1e3) + ' тис' : String(Math.round(n)));

// importance of a product for the business: A = most important, C = least; no money is shown anywhere
const TIER_TIP = { A: 'Важливість A: найважливіші товари', B: 'Важливість B: середня важливість', C: 'Важливість C: менш важливі' };
const revHead = () => 'Важливість';
const revCell = (x, i) => (i.tier
  ? `<span class="chip ${i.tier === 'A' ? 'bad' : i.tier === 'B' ? 'warn' : 'mid'}" title="${TIER_TIP[i.tier]}">${i.tier}</span>`
  : '<span class="muted">—</span>');

// "немає в наявності" / "під замовлення" mark: the price stays visible, just flagged
const availBadge = (a) => (a === 'out' ? '<span class="chip bad avail" title="У цьому магазині: немає в наявності. Ціну лишаємо останню відому">немає в наявн.</span>'
  : a === 'order' ? '<span class="chip warn avail" title="У цьому магазині: очікується / під замовлення">під замовл.</span>' : '');

// the shop refuses automatic requests (e.g. Cloudflare 403): last known price is shown with a flag
const blockedBadge = (c) => (c && c.blocked
  ? `<span class="chip warn avail" title="Сайт блокує автоматичну перевірку. Показано ${c.manualPrice ? 'ціну, введену вручну' : 'останню відому ціну'}. Її можна оновити вручну кнопкою ₴.">${c.manualPrice ? 'ціна вручну' : 'не оновлюється'}</span>`
  : (c && c.manualPrice ? '<span class="chip mid avail" title="Ціна введена вручну">вручну</span>' : ''));
// our own brand listed by another shop (e.g. Syngenta's Topaz): shown, but it is not a competitor
const brandChip = (c) => (c && c.ownBrand ? ' <span class="chip mid" title="Це продукт нашого ж бренду Syngenta на сайті іншого магазину, а не конкурента">наш бренд</span>' : '');
// diffPct = (ours - theirs) / theirs. Same product: "we are pricier by X %"; analog: how the analog compares with us
const pctAbs = (n) => Math.abs(n).toLocaleString('uk-UA', { maximumFractionDigits: 1 });
const weText = (d) => (d == null ? '<span class="muted">—</span>'
  : Math.abs(d) < 0.5 ? '<span class="chip mid">ціна однакова</span>'
    : d > 0 ? `<span class="chip bad">ми дорожчі на ${pctAbs(d)} %</span>` : `<span class="chip good">ми дешевші на ${pctAbs(d)} %</span>`);
const theyText = (d) => {
  if (d == null) return '<span class="muted">—</span>';
  const rel = (1 / (1 + d / 100) - 1) * 100;
  return Math.abs(rel) < 0.5 ? '<span class="chip mid">приблизно як ми</span>'
    : rel < 0 ? `<span class="chip bad">конкурент дешевший на ${pctAbs(rel)} %</span>` : `<span class="chip good">конкурент дорожчий на ${pctAbs(rel)} %</span>`;
};

function sectionPills(sections, current, onPick, counts) {
  return `<div class="pills" id="hsec">${['', ...sections].map((s) => `<button class="pill ${s === current ? 'on' : ''}" data-s="${esc(s)}">${esc(s || 'Усі розділи')}</button>`).join('')}</div>`;
}

async function home() {
  const x = await papi('/dashboard?section=' + encodeURIComponent(hState.section));
  const k = x.kpi;
  if (!x.lists || (!k.positions && !x.job.running)) {
    app.innerHTML = `<div class="card"><h1>Збираємо дані</h1><p>Йде перше завантаження каталогу (${x.job.done}/${x.job.total || '…'}). Сторінка оновиться сама.</p></div>`;
    setTimeout(() => { if (!location.hash || location.hash === '#/') route(); }, 5000);
    return;
  }
  const set = x.settings;
  const tabs = [
    { key: 'pricier', title: 'Дорожчі за конкурентів', hint: `Наш товар дорожчий за найдешевший конкурентний продукт більш ніж на ${set.tooHigh} %, і товар є на складі. Тут ми, найімовірніше, віддаємо покупця. Конкурентів без наявності не враховуємо.`, tone: 'bad' },
    { key: 'raise', title: 'Можна підняти ціну', hint: `Ми дешевші за всі конкурентні продукти більш ніж на ${set.canRaise} %, і товар є на складі. Орієнтир: на 1 % нижче найдешевшого конкурента.`, tone: 'good' },
    { key: 'sellers', title: 'Наші продавці дешевше', hint: `Наш товар у наших продавців (дилерів) дешевший, ніж у нас, більш ніж на ${set.tooHigh} %. Це не конкуренти, а перепродаж нашого ж товару: порушення цінової дисципліни або наша ціна вища за ринкову.`, tone: 'warn' },
    { key: 'drops', title: 'Ціна знизилась', hint: `За 7 днів конкурентний продукт або продавець подешевшав щонайменше на ${set.drop} %. Червоним, якщо тепер дешевший за нас.`, tone: 'warn' },
    { key: 'noStock', title: 'Немає залишку', hint: 'Товар продавався протягом року, а зараз його немає на складі. Сортовано за важливістю.', tone: 'mid' },
  ];
  const cur = tabs.find((t) => t.key === hState.list) || tabs[0];
  const list = x.lists[cur.key];
  const shown = hState.all ? list : list.slice(0, 12);

  const stockCell = (i) => (i.stock == null ? '<span class="muted" title="Немає в BAS або не зіставлено">—</span>' : i.stock > 0 ? mny(i.stock) : '<span class="chip bad">0</span>');
  const rowFor = (i) => {
    const nameCell = `<td><b>${esc(i.name)}</b><div class="muted small">${esc(i.section || '')}</div></td>`;
    const go = `class="click" data-go="#/g/${i.id}"`;
    if (cur.key === 'drops') {
      return `<tr ${go}>${nameCell}
        <td>${i.who === 'competitor' ? '<span class="chip warn">конкурент</span>' : '<span class="chip mid">продавець</span>'}<div class="small">${esc(i.productName || '')}</div><div class="muted small">${esc(i.site)}</div></td>
        <td class="n">${mny(i.from)} → <b>${mny(i.to)}</b></td><td class="n"><span class="chip ${i.below ? 'bad' : 'warn'}">${pct(i.pct)}</span></td>
        <td class="n">${mny(i.ours)} <span class="muted small">${esc(i.metric || '')}</span><div class="muted small">${i.below ? 'тепер дешевший за нас' : 'ми ще дешевші'}</div></td>
        <td class="n">${stockCell(i)}</td><td class="n">${revCell(x, i)}</td></tr>`;
    }
    if (cur.key === 'pricier' || cur.key === 'raise') {
      const rel = i.relPct;
      const verdict = rel == null ? '—' : cur.key === 'pricier'
        ? `<span class="chip bad">конкурент дешевший на ${pctAbs(rel)} %</span>`
        : `<span class="chip good">ми дешевші на ${pctAbs(i.diffPct)} %</span>`;
      const hint = cur.key === 'raise' && i.newPrice ? `<div class="muted small">можна до ${mny(i.newPrice)} ${esc(i.metric || '')}</div>` : '';
      return `<tr ${go}>${nameCell}
        <td class="n"><b>${mny(i.ours)}</b> <span class="muted small">${esc(i.metric || '')}</span></td>
        <td>${esc(i.analogName || '')}<div class="muted small">${esc(i.cheapest || '')} · ${mny(i.compMin)} ${esc(i.metric || '')}</div></td>
        <td class="n">${verdict}${hint}</td><td class="n">${stockCell(i)}</td><td class="n">${revCell(x, i)}</td></tr>`;
    }
    if (cur.key === 'sellers') {
      return `<tr ${go}>${nameCell}
        <td class="n"><b>${mny(i.ours)}</b> <span class="muted small">${esc(i.metric || '')}</span></td>
        <td class="n">${mny(i.compMin)}<div class="muted small">${esc(i.cheapest || '')}</div></td>
        <td class="n"><span class="chip warn">у них дешевше на ${pctAbs(i.diffPct / (1 + i.diffPct / 100))} %</span></td>
        <td class="n">${stockCell(i)}</td><td class="n">${revCell(x, i)}</td></tr>`;
    }
    return `<tr ${go}>${nameCell}
      <td class="n"><b>${mny(i.ours)}</b> <span class="muted small">${esc(i.metric || '')}</span></td>
      <td class="n">${i.compMin == null ? '<span class="muted">—</span>' : mny(i.compMin)}<div class="muted small">${esc(i.cheapest || '')}</div></td>
      <td class="n">${i.diffPct == null ? '<span class="muted">немає конкурентів</span>' : pct(i.diffPct)}</td>
      <td class="n">${stockCell(i)}</td><td class="n">${revCell(x, i)}</td></tr>`;
  };
  const head = cur.key === 'drops'
    ? `<th>Наш товар</th><th>Хто знизив</th><th class="n">Ціна</th><th class="n">Зміна</th><th class="n">Наша ціна</th><th class="n">Залишок</th><th class="n">${revHead()}</th>`
    : cur.key === 'pricier' || cur.key === 'raise'
      ? `<th>Наш товар</th><th class="n">Наша ціна</th><th>Найдешевший конкурентний продукт</th><th class="n">Порівняно з нами</th><th class="n">Залишок</th><th class="n">${revHead()}</th>`
      : cur.key === 'sellers'
        ? `<th>Наш товар</th><th class="n">Наша ціна</th><th class="n">Найнижча в наших продавців</th><th class="n">Різниця</th><th class="n">Залишок</th><th class="n">${revHead()}</th>`
        : `<th>Наш товар</th><th class="n">Наша ціна</th><th class="n">Мін. конкурентного продукту</th><th class="n">Різниця</th><th class="n">Залишок</th><th class="n">${revHead()}</th>`;

  const q = x.quality;
  const spreadN = q.spread.length;
  app.innerHTML = `
    <div class="bar" style="align-items:baseline"><h1 style="margin:0" class="grow">Головна</h1>
      <span class="muted small">Ціни оновлено: ${x.lastRefresh ? ago(x.lastRefresh) : '—'} · залишки: ${x.stockAt ? ago(x.stockAt) : '—'}</span></div>
    ${about('home', '<b>Що це.</b> Щоденна підказка щодо цін. <b>Продукти-конкуренти</b> тут — це <b>конкурентні продукти</b> інших брендів: відносно них визначається наше цінове позиціонування. <b>Наші продавці</b> — магазини й дилери, які продають і наші, і конкурентні продукти: ми відстежуємо в них і ціну нашого товару (контроль), і ціну конкурентних продуктів. <b>Як користуватись.</b> Оберіть розділ, відкрийте вкладку («Дорожчі за конкурентів», «Можна підняти ціну», «Наші продавці дешевше»…) і клікніть товар. Картки зверху показують кількість товарів, клік по картці відкриває список.')}
    <div id="reconStrip"></div>
    ${sectionPills(x.sections, hState.section)}
    <div class="grid kp">
      <div class="card kpi"><div class="l">Задано конкурентів</div>
        <div class="v">${k.assigned} <span class="muted small">з ${k.positions} товарів</span></div>
        <div class="l">стільки товарів мають конкурентний продукт із ціною. <a href="#/gaps">Кому додати →</a></div></div>
      <div class="card kpi bad click" data-goto="pricier"><div class="l">Дорожчі за конкурента</div>
        <div class="v">${k.pricier} <span class="muted small">товарів</span></div>
        <div class="l">більш ніж на ${set.tooHigh} % вище найдешевшого конкурентного продукту</div></div>
      <div class="card kpi click" data-goto="pricier"><div class="l">Ціна на рівні</div>
        <div class="v">${k.equal} <span class="muted small">товарів</span></div>
        <div class="l">різниця в межах ${set.tooHigh} % вгору і ${set.canRaise} % вниз</div></div>
      <div class="card kpi good click" data-goto="raise"><div class="l">Дешевші за конкурента</div>
        <div class="v">${k.cheaper} <span class="muted small">товарів</span></div>
        <div class="l">більш ніж на ${set.canRaise} % нижче. Можна підняти ціну</div></div>
      <div class="card kpi warn click" data-goto="sellers"><div class="l">Наші продавці дешевше</div>
        <div class="v">${k.sellersCheaper} <span class="muted small">з ${k.withSellers}</span></div>
        <div class="l">наш товар у дилерів коштує менше, ніж у нас</div></div>
    </div>
    ${k.index == null ? `<p class="muted" style="margin:10px 0 0">Конкурентні продукти ще не задані. Додайте список конкурентів (його веде відділ ціноутворення), і тут з'явиться наше позиціонування.</p>` : `<p class="muted" style="margin:10px 0 0">Відносно найдешевшого конкурентного продукту ми в середньому ${k.index - 100 > 0.5 ? '<b>дорожчі</b> на ' + (k.index - 100).toLocaleString('uk-UA', { maximumFractionDigits: 1 }) + ' %' : k.index - 100 < -0.5 ? '<b>дешевші</b> на ' + Math.abs(k.index - 100).toLocaleString('uk-UA', { maximumFractionDigits: 1 }) + ' %' : '<b>на рівні</b>'} (за ${k.compared} товарами).</p>`}

    <div class="card" style="margin-top:14px">
      <div class="tabs" id="htabs">${tabs.map((t) => `<button class="tab ${t.key === cur.key ? 'on' : ''}" data-k="${t.key}">${esc(t.title)} <span class="cnt ${t.tone}">${x.lists[t.key].length}</span></button>`).join('')}</div>
      <p class="muted" style="margin:10px 0 8px">${esc(cur.hint)}</p>
      ${shown.length ? `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${shown.map(rowFor).join('')}</tbody></table></div>
        ${list.length > shown.length ? `<div class="bar" style="margin-top:10px"><button class="btn" id="hall">Показати всі ${list.length}</button></div>` : ''}`
        : `<p class="muted pad">${(cur.key === 'pricier' || cur.key === 'raise') && !k.compared ? 'Для цього списку потрібні конкурентні продукти. Додайте їх на вкладці «Продукти-конкуренти».' : 'Таких позицій немає.'}</p>`}
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Як змінюється наша ціна відносно конкурентних продуктів</h2><div id="htrend"></div>
        <p class="hint">100 — ми на рівні з найдешевшим конкурентним продуктом; 104 — ми дорожчі на 4 %; 96 — дешевші на 4 %.</p></div>
      <div class="card"><h2>Ціна в наших продавців</h2><div class="tw"><table>
        <thead><tr><th>Продавець</th><th class="n">Товарів</th><th class="n">Порівняно з нами</th><th class="n">Дешевше за нас</th><th class="n">Найдешевший</th><th class="n">Змін ціни, 30 дн.</th></tr></thead>
        <tbody>${x.siteStats.map((s) => `<tr><td><a href="https://${esc(s.domain)}" target="_blank" rel="noopener">${esc(s.name)}</a></td><td class="n">${s.matched}</td><td class="n ${pctCls(s.avgDiff)}">${pct(s.avgDiff)}</td><td class="n">${s.theyCheaper}/${s.matched}</td><td class="n">${s.cheapestCount}</td><td class="n">${s.changes30}${s.avgMove ? ` <span class="muted small">(≈${s.avgMove} %)</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Немає</td></tr>'}</tbody>
      </table></div></div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Кому додати конкурентів першим</h2>
        <p class="muted" style="margin:0 0 8px">Найважливіші товари, для яких ще не задано конкурентний продукт. Позиціонувати їхню ціну поки нема відносно чого.</p>
        ${x.lists.uncovered.length ? `<div class="tw"><table><tbody>${x.lists.uncovered.slice(0, 8).map((i) => `<tr class="click" data-go="#/g/${i.id}"><td><b>${esc(i.name)}</b><div class="muted small">${esc(i.section || '')}</div></td><td class="n">${revCell(x, i)}</td><td class="n">${i.stock == null ? '' : 'залишок ' + mny(i.stock)}</td></tr>`).join('')}</tbody></table></div>
          <div class="bar" style="margin-top:10px"><a class="btn" href="#/gaps">Усі ${x.lists.uncovered.length} →</a></div>` : '<p class="muted">Для всіх товарів задано конкурентні продукти.</p>'}
      </div>
      <div class="card"><h2>Якість даних</h2>
        <ul class="plain">
          <li>${q.stale ? `<span class="chip warn">${q.stale}</span> позицій (конкуренти й продавці) не перевірялись понад 36 год` : '<span class="chip good">ок</span> усі ціни свіжі'}</li>
          <li>${q.oos ? `<span class="chip warn">${q.oos}</span> позицій зараз без наявності в магазині (ціну лишаємо з позначкою, у списках дій вони не враховуються)` : '<span class="chip good">ок</span> усі позиції в наявності'}</li>
          <li>${q.blocked ? `<span class="chip warn">${q.blocked}</span> позицій на сайтах, що блокують автоматичну перевірку (${esc((q.blockedSites || []).join(', '))}): ціна не оновлюється, можна ввести вручну кнопкою ₴` : '<span class="chip good">ок</span> жоден сайт не блокує перевірку'}</li>
          <li>${q.errors ? `<span class="chip bad">${q.errors}</span> сторінок без ціни або з помилкою читання` : '<span class="chip good">ок</span> помилок читання немає'}</li>
          <li>${q.assumed ? `<span class="chip warn">${q.assumed}</span> порівнянь з припущеним фасуванням` : '<span class="chip good">ок</span> фасування визначене скрізь'}</li>
          <li>${q.noBas ? `<span class="chip mid">${q.noBas}</span> наших позицій без зіставлення з BAS (немає даних про залишок)` : '<span class="chip good">ок</span> усі зіставлені з BAS'}</li>
          <li>${spreadN ? `<span class="chip warn">${spreadN}</span> товарів із різною ціною на копіях нашого сайту` : '<span class="chip good">ок</span> різних цін на копіях немає'}</li>
        </ul>
        ${spreadN ? `<details><summary class="muted">Показати розбіжності</summary><div class="tw"><table><tbody>${q.spread.slice(0, 15).map((i) => `<tr class="click" data-go="#/g/${i.id}"><td>${esc(i.name)}</td><td class="n">${mny(i.min)} – ${mny(i.max)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      </div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Щоденний дайджест</h2><pre class="digest" id="hdig">завантаження…</pre>
        <div class="bar"><button class="btn" id="hcopy">Скопіювати</button></div></div>
      <div class="card"><h2>Пороги і цілі</h2>
        <div class="setgrid">
          <label>Дорожчі за конкурента більш ніж на, % <input type="number" min="0" step="0.5" id="s-high" value="${set.tooHigh}"></label>
          <label>Дешевші за конкурента більш ніж на, % <input type="number" min="0" step="0.5" id="s-raise" value="${set.canRaise}"></label>
          <label>Падіння ціни (конкурент або продавець), % <input type="number" min="0" step="0.5" id="s-drop" value="${set.drop}"></label>
        </div>
        <h2 style="margin-top:14px">Ціль по розділах</h2><p class="hint" style="margin:0 0 6px">Скільки відсотків вище найдешевшого конкурентного продукту вважаємо прийнятним.</p>
        <div class="setgrid">${x.sections.map((s, i) => `<label>${esc(s)}, % <input type="number" min="0" step="0.5" data-t="${esc(s)}" value="${set.target[s]}"></label>`).join('')}</div>
        <div class="bar" style="margin-top:12px"><button class="btn primary" id="hsave">Зберегти</button></div></div>
    </div>`;

  if (window.v2Strip) window.v2Strip();
  $('#htrend').innerHTML = x.trend.length > 1
    ? lineChart([{ label: 'Індекс цін', own: true, points: x.trend.map((t) => [t.day, t.index]) }], 'індекс')
    : '<p class="muted">Динаміка зʼявиться, коли накопичиться кілька днів перевірок.</p>';

  app.querySelectorAll('#hsec .pill').forEach((b) => (b.onclick = () => { hState.section = b.dataset.s; hState.all = false; route(); }));
  app.querySelectorAll('[data-goto]').forEach((c) => (c.onclick = () => { hState.list = c.dataset.goto; hState.all = false; route(); window.scrollTo(0, 0); }));
  app.querySelectorAll('#htabs .tab').forEach((b) => (b.onclick = () => { hState.list = b.dataset.k; hState.all = false; route(); }));
  const all = $('#hall'); if (all) all.onclick = () => { hState.all = true; route(); };
  $('#hsave').onclick = () => ask(null, async () => {
    const target = {};
    app.querySelectorAll('[data-t]').forEach((i) => (target[i.dataset.t] = Number(i.value)));
    await papi('/settings', { method: 'POST', body: { tooHigh: Number($('#s-high').value), canRaise: Number($('#s-raise').value), drop: Number($('#s-drop').value), target } });
    toast('Збережено', 2500);
    route();
  });
  papi('/digest?section=' + encodeURIComponent(hState.section)).then((d) => {
    $('#hdig').textContent = d.text;
    $('#hcopy').onclick = () => { navigator.clipboard.writeText(d.text).then(() => toast('Скопійовано', 2000)).catch(() => toast('Не вдалося скопіювати', 3000)); };
  }).catch(() => { $('#hdig').textContent = 'Немає даних'; });
}

// ---------- «Кого додати»: товари без прямих конкурентів ----------
async function gapsPage() {
  const x = await papi('/dashboard?section=' + encodeURIComponent(hState.section));
  const list = x.lists.uncovered;
  app.innerHTML = `
    <h1>Кому додати конкурентів: товари без конкурентних продуктів</h1>
    ${about('gaps', '<b>Що це.</b> Наші товари, для яких ще <b>не задано конкурентний продукт</b>: ціну позиціонувати нема відносно чого. Списки конкурентних продуктів веде відділ ціноутворення (Валерій). <b>Як користуватись.</b> Найважливіші (A) зверху. Клікніть товар → у блоці «Продукти-конкуренти» додайте посилання або натисніть «Шукати на сайтах». Або скористайтесь кнопкою «Імпорт списку конкурентів» на вкладці «Продукти-конкуренти».')}
    ${sectionPills(x.sections, hState.section)}
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Товар</th><th>Розділ</th><th class="n">Наша ціна</th><th class="n">${revHead()}</th><th class="n">Залишок</th><th class="n">Ціна в наших продавців</th></tr></thead>
      <tbody>${list.slice(0, 300).map((i) => `<tr class="click" data-go="#/g/${i.id}"><td><b>${esc(i.name)}</b></td><td class="muted">${esc(i.section || '')}</td><td class="n">${mny(i.ours)}</td><td class="n">${revCell(x, i)}</td><td class="n">${i.stock == null ? '—' : mny(i.stock)}</td><td class="n">${i.sellersCount || ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Усе покрито</td></tr>'}</tbody>
    </table></div>${list.length > 300 ? `<p class="hint">Показано 300 з ${list.length}.</p>` : ''}</div>`;
  app.querySelectorAll('#hsec .pill').forEach((b) => (b.onclick = () => { hState.section = b.dataset.s; route(); }));
}

function gapTable(rows) {
  if (!rows.length) return '<p class="muted">Немає даних</p>';
  return `<div class="tw"><table><tbody>${rows.map((g) => `<tr class="click" data-go="#/g/${g.id}"><td>${esc(g.name)}<div class="muted">найдешевший: ${esc(g.cheapest)}</div></td><td class="n">${money(g.ours)} / ${money(g.compMin)} ${esc(g.metric)}</td><td class="n ${pctCls(g.diffMinPct)}">${pct(g.diffMinPct)}</td></tr>`).join('')}</tbody></table></div>`;
}

const gState = { q: '', cat: '', status: '', onlyComp: false, key: 'compCount', dir: -1 };

async function groups() {
  const { groups: all, categories } = await papi('/groups');
  all.sort((a, b) => a.name.localeCompare(b.name, 'uk')); // ties in any sort stay alphabetical
  const draw = () => {
    let rows = all.filter((g) => g.ownCount);
    if (mState.section) rows = rows.filter((g) => g.section === mState.section);
    if (gState.q) rows = rows.filter((g) => g.name.toLowerCase().includes(gState.q.toLowerCase()));
    if (gState.cat) rows = rows.filter((g) => g.category === gState.cat);
    if (gState.status) rows = rows.filter((g) => g.status === gState.status);
    if (gState.onlyComp) rows = rows.filter((g) => g.compCount);
    rows = sortRows(rows, gState.key, gState.dir);
    const th = (k, t, n, tip) => `<th class="s ${n ? 'n' : ''}" data-k="${k}" title="${esc(tip || '')}">${t}${gState.key === k ? (gState.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    $('#gbody').innerHTML = rows.map((g) => `<tr class="click" data-go="#/g/${g.id}">
      <td>${esc(g.name)}</td><td class="muted">${esc(g.category || '')}</td>
      <td class="n">${money(g.ours, 0)} <span class="muted small">${esc(g.metric || '')}</span></td>
      <td>${g.compMin == null ? '<span class="muted">не задано</span>' : esc(g.cheapestName || '') + '<div class="muted small">' + esc(g.cheapest || '') + ' · ' + money(g.compMin, 0) + ' ' + esc(g.metric || '') + '</div>'}</td>
      <td class="n">${g.diffMinPct == null ? '<span class="muted">—</span>' : theyText(g.diffMinPct)}</td>
      <td class="n">${g.compCount || '<span class="muted">0</span>'}</td>
      <td class="n">${g.sellerCount ? g.sellerCount + (g.sellerMin != null ? ' <span class="muted small">· від ' + money(g.sellerMin, 0) + '</span>' : '') : '<span class="muted">0</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Нічого не знайдено</td></tr>';
    $('#ghead').innerHTML = `<tr>${th('name', 'Товар')}${th('category', 'Категорія')}${th('ours', 'Наша ціна', 1, 'За літр/кг, якщо відоме фасування')}<th>Найдешевший конкурентний продукт</th>${th('diffMinPct', 'Порівняно з нами', 1, 'Відносно найдешевшого конкурентного продукту')}${th('compCount', 'Конкурентних продуктів', 1, 'Скільки продуктів-конкурентів задано')}${th('sellerCount', 'Ціна в наших продавців', 1, 'Той самий наш товар у наших продавців')}</tr>`;
    $('#gcount').textContent = rows.length + ' товарів';
    document.querySelectorAll('#ghead th.s').forEach((h) => (h.onclick = () => { const k = h.dataset.k; gState.dir = gState.key === k ? -gState.dir : 1; gState.key = k; draw(); }));
  };
  const sections = [...new Set(all.map((g) => g.section).filter(Boolean))];
  app.innerHTML = `
    <h1>Каталог: усі наші товари</h1>
    ${about('groups', '<b>Що це.</b> Повний список наших товарів. Для кожного видно найдешевший <b>конкурентний продукт</b> (інший бренд), відносно якого ми позиціонуємо ціну, і скільки в нього конкурентів, а також ціну нашого товару в <b>наших продавців</b> (дилерів). <b>Як користуватись.</b> Шукайте за назвою, фільтруйте за розділом чи категорією, сортуйте кліком по заголовку. Клік по товару відкриває картку, де додаються конкуренти й продавці.')}
    <div class="pills" id="gsec">${['', ...sections].map((sn) => `<button class="pill ${sn === mState.section ? 'on' : ''}" data-s="${esc(sn)}">${esc(sn || 'Усі розділи')}</button>`).join('')}</div>
    <div class="bar">
      <input class="grow" id="gq" placeholder="Пошук товару…" value="${esc(gState.q)}">
      <select id="gcat"><option value="">Усі категорії</option>${categories.map((c) => `<option ${c === gState.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="gst"><option value="">Усі статуси</option>${['cheapest', 'parity', 'mid', 'priciest', 'nocomp'].map((st) => `<option value="${st}" ${st === gState.status ? 'selected' : ''}>${STATUS[st][1]}</option>`).join('')}</select>
      <label><input type="checkbox" id="gcomp" ${gState.onlyComp ? 'checked' : ''}> лише з конкурентними продуктами</label>
      <span class="muted" id="gcount"></span>
      <button class="btn" id="gnew">+ Нова група</button>
      <a class="btn" href="/api/prices/export.csv">CSV</a>
    </div>
    <div class="card"><div class="tw"><table><thead id="ghead"></thead><tbody id="gbody"></tbody></table></div></div>`;
  app.querySelectorAll('#gsec .pill').forEach((b) => (b.onclick = () => { mState.section = b.dataset.s; app.querySelectorAll('#gsec .pill').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  $('#gq').oninput = (e) => { gState.q = e.target.value; draw(); };
  $('#gcat').onchange = (e) => { gState.cat = e.target.value; draw(); };
  $('#gst').onchange = (e) => { gState.status = e.target.value; draw(); };
  $('#gcomp').onchange = (e) => { gState.onlyComp = e.target.checked; draw(); };
  $('#gnew').onclick = () => {
    const name = prompt('Назва групи (напр. «Фунгіциди на азоксистробіні»):');
    if (name) ask(null, async () => { const r = await papi('/groups', { method: 'POST', body: { name } }); location.hash = '#/g/' + r.group.id; });
  };
  draw();
}

const ago = (iso) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'щойно';
  if (m < 60) return m + ' хв тому';
  if (m < 1440) return Math.round(m / 60) + ' год тому';
  return Math.round(m / 1440) + ' дн тому';
};

async function groupPage(id) {
  const [r, sitesRes] = await Promise.all([papi('/groups/' + id), papi('/sites')]);
  const g = r.group;
  const ours = g.members.filter((m) => m.own);
  const same = g.members.filter((m) => !m.own && m.kind === 'same');
  const showOwnBrand = !!groupPage.showOwn;
  const analogAll = g.members.filter((m) => !m.own && m.kind === 'analog');
  const analogHidden = analogAll.filter((m) => m.ownBrand).length;
  const analog = showOwnBrand ? analogAll : analogAll.filter((m) => !m.ownBrand);
  const sub = (s, title) => `<div class="card kpi"><div class="l">${title}</div>
      <div class="v ${pctCls(s && s.diffMinPct)}">${s && s.priced ? pct(s.diffMinPct) : '—'}</div>
      <div class="l">${s && s.priced ? `мін. ${money(s.min)} · серед. ${money(s.avg)} ${esc(g.metric || '')}${s.cheapest ? '<br>найдешевший: ' + esc(s.cheapest) : ''}` : 'немає даних для порівняння'}</div></div>`;

  const row = (m) => `<tr>
      <td>${esc(m.site)}</td>
      <td><a href="${esc(m.url)}" target="_blank" rel="noopener" title="Відкрити сторінку для перевірки">${esc(m.name)} ↗</a>${brandChip(m)}${m.error && !m.blocked ? `<div class="err">${esc(m.error)}</div>` : ''}</td>
      <td>${esc(m.pack || '—')} <button class="btn sm" data-pack="${m.id}" title="Вказати фасування вручну">✎</button>${m.packAssumed ? ' <span class="muted" title="Фасування не вказане на сторінці — припущено таким самим, як у нас">(припущено)</span>' : m.packManual ? ' <span class="muted">(вручну)</span>' : ''}</td>
      <td class="n">${m.price == null ? '—' : money(m.price)}${(availBadge(m.avail) + blockedBadge(m)) ? '<div>' + availBadge(m.avail) + blockedBadge(m) + '</div>' : ''}</td>
      <td class="n">${m.unit == null ? '—' : money(m.unit) + ' <span class="muted">' + esc(m.unitLabel) + '</span>'}</td>
      <td class="n">${m.kind === 'analog' ? theyText(m.diffPct) : weText(m.diffPct)}</td>
      <td class="n ${m.change7 > 0 ? 'pos' : m.change7 < 0 ? 'neg' : ''}">${m.change7 == null ? '—' : pct(m.change7)}</td>
      <td class="muted" title="${esc(m.checkedAt || '')}">${ago(m.checkedAt)}</td>
      <td class="nowrap"><button class="btn sm" data-check="${m.id}" title="Перечитати ціну зараз">⟳</button>
        <button class="btn sm" data-setprice="${m.id}" title="Ввести ціну вручну">₴</button>
        <button class="btn sm" data-kind="${m.id}" data-to="${m.kind === 'same' ? 'analog' : 'same'}" title="${m.kind === 'same' ? 'Це конкурентний продукт іншого бренду' : 'Це наш товар у нашого продавця'}">${m.kind === 'same' ? '→ конкурент' : '→ продавець'}</button>
        <button class="btn sm danger" data-del="${m.id}" title="Прибрати з групи">✕</button></td></tr>`;

  const table = (list, empty) => list.length
    ? `<div class="tw"><table><thead><tr><th>Сайт</th><th>Товар (клік — відкрити)</th><th>Фасування</th><th class="n">Ціна, ₴</th><th class="n">За од.</th><th class="n">Порівняно з нами</th><th class="n">Зміна за 7 дн.</th><th>Перевірено</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`
    : `<p class="muted">${empty}</p>`;

  const panel = (kind, hint) => `<details class="add" ${kind === 'analog' && !analog.length ? 'open' : ''}><summary>+ Додати ${kind === 'same' ? 'продавця' : 'конкурентний продукт'}</summary>
      <div class="bar"><input class="grow" id="url-${kind}" placeholder="Посилання на сторінку товару (https://…)"><button class="btn primary" data-addurl="${kind}">Додати</button></div>
      <div class="bar"><input class="grow" id="sq-${kind}" placeholder="${kind === 'same' ? 'Шукати за назвою (порожньо — за нашим товаром)' : 'Назва конкурентного продукту, напр. «Топсін», «Фалькон»'}"><button class="btn" data-search="${kind}">Шукати на сайтах</button></div>
      <p class="hint">${hint}</p><div id="cands-${kind}" class="cands"></div></details>`;

  app.innerHTML = `
    <p><a href="#/groups">← Каталог</a></p>
    ${about('card', '<b>Що це.</b> Картка одного нашого товару. <b>Продукти-конкуренти</b> — це конкурентні продукти інших брендів: відносно них визначається наше цінове позиціонування. <b>Ціна в наших продавців</b> — це наш же товар у магазинів-дилерів (вони продають і наші, і конкурентні продукти, але самі не є конкурентами). «Наш бренд» біля назви — продукт Syngenta в іншому магазині. <b>Як користуватись.</b> Додайте конкурентний продукт посиланням або кнопкою «Шукати на сайтах»; ⟳ перечитує ціну зараз; ₴ вводить ціну вручну; ✎ виправляє фасування.')}
    <div class="bar"><h1 style="margin:0" class="grow">${esc(g.name)}</h1>
      <button class="btn" id="grename">Перейменувати</button><button class="btn danger" id="gdel">Видалити групу</button></div>
    <div class="grid g3">
      <div class="card kpi"><div class="l">Наша ціна</div><div class="v">${money(g.ours)} <span class="muted small">${esc(g.metric || '₴')}</span></div>
        <div class="l">${ours.map((m) => (m.stock != null ? 'залишок ' + money(m.stock, 0) + ' ' + esc(m.stockUnit || '') : '')).filter(Boolean).join(' · ') || '&nbsp;'}</div></div>
      <div class="card kpi"><div class="l">Продукти-конкуренти</div>
        ${g.analogExt && g.analogExt.priced
          ? `<div class="v" style="font-size:20px">${theyText(g.analogExt.diffMinPct)}</div><div class="l">найдешевший: ${esc(g.analogExt.cheapestName || '')} (${esc(g.analogExt.cheapest || '')}), ${money(g.analogExt.min)} ${esc(g.metric || '')}</div>`
          : `<div class="v">—</div><div class="l">${g.analogCount ? 'є лише продукти нашого бренду Syngenta, вони не рахуються як конкуренти' : 'не задано. Додайте нижче, у блоці «Продукти-конкуренти»'}</div>`}
        ${g.analogOwnBrand ? `<div class="l">+ ${g.analogOwnBrand} продукт(и) нашого бренду Syngenta, не рахуються</div>` : ''}</div>
      <div class="card kpi"><div class="l">Ціна в наших продавців</div>
        ${g.same && g.same.priced
          ? `<div class="v" style="font-size:20px">${weText(g.same.diffMinPct)}</div><div class="l">найдешевше: ${esc(g.same.cheapest || '')}, ${money(g.same.min)} ${esc(g.metric || '')}</div>`
          : `<div class="v">—</div><div class="l">ще немає. Додайте нижче, у блоці «Ціна в наших продавців»</div>`}</div>
    </div>
    ${g.mixedPacks ? '<p class="hint">⚠ Фасування різні й не визначені для всіх позицій — порівняння за ціною упаковки. Вкажіть фасування (✎), щоб рахувати ₴/л або ₴/кг.</p>' : ''}

    <div class="card" style="margin-top:14px"><h2>Наш товар</h2>
      <div class="tw"><table><tbody>${ours.map((m) => `<tr class="own"><td>${esc(m.site)}</td><td><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)} ↗</a></td><td>${esc(m.pack || '—')}</td><td class="n">${money(m.price)} ₴</td><td class="n">${m.unit == null ? '' : money(m.unit) + ' ' + esc(m.unitLabel)}</td><td class="n">${m.stock != null ? 'залишок <b>' + money(m.stock, 0) + '</b> ' + esc(m.stockUnit || '') : ''}</td><td class="n"><button class="btn sm danger" data-del="${m.id}">✕</button></td></tr>`).join('') || '<tr><td class="muted">Немає нашого товару в групі — додайте нижче</td></tr>'}</tbody></table></div></div>

    <div class="card" style="margin-top:14px"><h2>Продукти-конкуренти <span class="muted small">(продукти інших брендів)</span></h2>
      ${table(analog, 'Поки немає. Додайте конкурентні продукти інших виробників (список веде відділ ціноутворення), і вони порівнюватимуться з нашою ціною.')}
      ${analogHidden ? `<p class="hint">${showOwnBrand ? 'Показано' : 'Приховано'} ${analogHidden} продукт(и) нашого бренду Syngenta на чужих сайтах: це не конкуренти. <a href="#" id="ownToggle">${showOwnBrand ? 'Сховати' : 'Показати'}</a></p>` : ''}
      ${panel('analog', 'Порівняння іде за ціною за літр/кілограм, якщо фасування відоме; якщо воно не вказане на сторінці — припускається таким самим, як у нас (змінюється кнопкою ✎).')}</div>

    <div class="card" style="margin-top:14px"><h2>Ціна в наших продавців <span class="muted small">(наш товар у наших дилерів)</span></h2>
      ${table(same, 'Поки немає. Додайте сторінку цього товару в нашого продавця.')}
      ${panel('same', 'Пошук іде по sitemap кожного сайту і одразу читає ціни. Перевірте, що це справді наш товар і те саме фасування.')}</div>

    <div class="card" style="margin-top:14px"><h2>Динаміка цін</h2><div id="chart"></div></div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Сайти для пошуку</h2>
        <p>${sitesRes.sites.filter((s) => !s.own).map((s) => `<a class="chip mid" href="https://${esc(s.domain)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`).join(' ') || '<span class="muted">Немає</span>'}</p>
        <div class="bar"><input id="newdom" class="grow" placeholder="Додати сайт: agrohim.ua"><button class="btn" id="addsite">Додати сайт</button></div></div>
      <div class="card"><h2>Додати наш товар до групи</h2>
        <div class="bar"><input class="grow" id="oq" placeholder="Пошук у нашому каталозі…"></div><div id="olist" class="cands"></div></div>
    </div>`;
  $('#chart').innerHTML = lineChart(r.history.series, r.history.metric);

  const ot = $('#ownToggle');
  if (ot) ot.onclick = (e) => { e.preventDefault(); groupPage.showOwn = !groupPage.showOwn; route(); };
  $('#grename').onclick = () => { const n = prompt('Нова назва:', g.name); if (n) ask(null, async () => { await papi('/groups/' + id, { method: 'PATCH', body: { name: n } }); route(); }); };
  $('#gdel').onclick = () => { if (confirm('Видалити групу? Додані конкуренти й продавці з неї теж будуть прибрані.')) ask(null, async () => { await papi('/groups/' + id, { method: 'DELETE' }); location.hash = '#/groups'; }); };
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/groups/${id}/members/${b.dataset.del}`, { method: 'DELETE' }); route(); })));
  app.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/groups/${id}/members/${b.dataset.kind}`, { method: 'PATCH', body: { kind: b.dataset.to } }); route(); })));
  app.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => ask(null, async () => {
    b.disabled = true;
    const x = await papi(`/products/${b.dataset.check}/check`, { method: 'POST' });
    toast(x.error ? 'Помилка: ' + x.error : x.before === x.after ? 'Ціна не змінилась: ' + money(x.after) : `Ціна змінилась: ${money(x.before)} → ${money(x.after)}`);
    route();
  })));
  app.querySelectorAll('[data-setprice]').forEach((b) => (b.onclick = () => {
    const v = prompt('Ціна на сайті, ₴:');
    if (v == null || !v.trim()) return;
    ask(null, async () => { await papi('/products/' + b.dataset.setprice + '/price', { method: 'POST', body: { price: v } }); toast('Ціну збережено', 2500); route(); });
  }));
  app.querySelectorAll('[data-pack]').forEach((b) => (b.onclick = () => {
    const v = prompt('Фасування (напр. 5 л, 250 мл, 1 кг, 100 г). Порожньо — скинути до автоматичного:');
    if (v == null) return;
    ask(null, async () => {
      if (!v.trim()) await papi('/products/' + b.dataset.pack, { method: 'PATCH', body: { reset: true } });
      else {
        const m = v.trim().toLowerCase().match(/^([\d.,]+)\s*(мл|ml|л|l|кг|kg|г|g)$/);
        if (!m) throw new Error('Формат: «5 л», «250 мл», «1 кг», «100 г»');
        const u = { мл: ['l', 0.001], ml: ['l', 0.001], л: ['l', 1], l: ['l', 1], кг: ['kg', 1], kg: ['kg', 1], г: ['kg', 0.001], g: ['kg', 0.001] }[m[2]];
        await papi('/products/' + b.dataset.pack, { method: 'PATCH', body: { amount: Number(m[1].replace(',', '.')) * u[1], dim: u[0] } });
      }
      route();
    });
  }));

  const add = (url, kind, btn) => ask(null, async () => {
    if (btn) btn.disabled = true;
    try {
      // the "same product" panel lets the server classify by name; the analogs panel forces "analog"
      const r = await papi(`/groups/${id}/members`, { method: 'POST', body: { url, kind: kind === 'analog' ? 'analog' : undefined } });
      toast(kind !== 'analog' && r.kind === 'analog' ? 'Додано як конкурентний продукт: назва не збігається з нашим товаром' : 'Додано', 5000);
      route();
    }
    finally { if (btn) btn.disabled = false; }
  });
  app.querySelectorAll('[data-addurl]').forEach((b) => (b.onclick = () => { const k = b.dataset.addurl; const u = $('#url-' + k).value.trim(); if (u) add(u, k, b); }));
  app.querySelectorAll('[data-search]').forEach((b) => (b.onclick = () => ask(null, async () => {
    const k = b.dataset.search; const box = $('#cands-' + k);
    b.disabled = true; box.innerHTML = '<p class="muted">Шукаю на сайтах і читаю ціни…</p>';
    try {
      const s = await papi(`/groups/${id}/search`, { method: 'POST', body: { query: $('#sq-' + k).value } });
      box.innerHTML = s.results.length ? s.results.map((c, i) => `<div class="c"><div><b>${esc(c.site)}</b> · <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)} ↗</a><div class="muted">${esc(c.pack || 'фасування не вказане — припустимо як у нас')}</div></div>
        <div class="n"><b>${money(c.price)}</b> ₴ ${c.already ? '<span class="chip mid">вже в групі</span>' : `<button class="btn sm primary" data-add="${i}">Додати</button>`}</div></div>`).join('') : `<p class="muted">Нічого не знайдено за «${esc(s.query)}». Спробуйте іншу назву або вставте посилання.</p>`;
      box.querySelectorAll('[data-add]').forEach((x) => (x.onclick = () => add(s.results[x.dataset.add].url, k, x)));
    } finally { b.disabled = false; }
  })));
  $('#addsite').onclick = () => ask(null, async () => { const dom = $('#newdom').value.trim(); if (!dom) return; await papi('/sites', { method: 'POST', body: { domain: dom } }); toast('Сайт додано — тепер він бере участь у пошуку'); route(); });
  let t;
  $('#oq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => ask(null, async () => {
    const q = e.target.value.trim(); if (q.length < 2) { $('#olist').innerHTML = ''; return; }
    const r2 = await papi('/own-products?q=' + encodeURIComponent(q));
    $('#olist').innerHTML = r2.items.map((p) => `<div class="c"><div>${esc(p.name)} <span class="muted">${esc(p.pack)}</span></div><div class="n">${money(p.price)} ₴ <button class="btn sm" data-own="${p.id}">Додати</button></div></div>`).join('');
    $('#olist').querySelectorAll('[data-own]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/groups/${id}/own`, { method: 'POST', body: { productId: b.dataset.own } }); route(); })));
  }), 250); };
}

const pState = { q: '', site: '', kind: '' };

async function pairsPage() {
  const { pairs } = await papi('/pairs');
  const sites = [...new Set(pairs.map((p) => p.comp.site))].sort();
  const draw = () => {
    let rows = pairs.filter((p) => !(p.kind === 'analog' && p.comp.ownBrand));
    if (pState.q) { const q = pState.q.toLowerCase(); rows = rows.filter((p) => (p.group + ' ' + p.comp.name).toLowerCase().includes(q)); }
    if (pState.site) rows = rows.filter((p) => p.comp.site === pState.site);
    if (pState.kind) rows = rows.filter((p) => p.kind === pState.kind);
    rows = rows.slice().sort((a, b) => Math.abs(b.diffPct || 0) - Math.abs(a.diffPct || 0));
    $('#pcount').textContent = rows.length + ' пар';
    $('#pbody').innerHTML = rows.map((p) => `<tr>
      <td><a href="#/g/${p.groupId}">${esc(p.own ? p.own.name : p.group)}</a>${p.own ? ` <a href="${esc(p.own.url)}" target="_blank" rel="noopener" title="Наша сторінка">↗</a>` : ''}<div class="muted">${esc(p.own ? p.own.pack || '' : '')}</div></td>
      <td class="n">${money(p.own && p.own.price)}</td>
      <td><span class="chip ${p.kind === 'same' ? 'mid' : 'warn'}">${p.kind === 'same' ? 'продавець' : 'конкурент'}</span></td>
      <td>${esc(p.comp.site)}</td>
      <td><a href="${esc(p.comp.url)}" target="_blank" rel="noopener">${esc(p.comp.name)} ↗</a>${p.comp.error ? `<div class="err">${esc(p.comp.error)}</div>` : ''}<div class="muted">${esc(p.comp.pack || '')}${p.comp.packAssumed ? ' (припущено)' : ''}</div></td>
      <td class="n">${p.comp.price == null ? '—' : money(p.comp.price)}${availBadge(p.comp.avail) ? '<div>' + availBadge(p.comp.avail) + '</div>' : ''}</td>
      <td class="n ${pctCls(p.diffPct)}"><b>${pct(p.diffPct)}</b></td>
      <td class="muted">${ago(p.comp.checkedAt)}</td>
      <td><button class="btn sm" data-check="${p.comp.id}" title="Перечитати ціну зараз">⟳</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">Пар ще немає. Відкрийте товар у «Порівняння» і додайте конкурентів.</td></tr>';
    $('#pbody').querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => ask(null, async () => {
      b.disabled = true;
      const x = await papi(`/products/${b.dataset.check}/check`, { method: 'POST' });
      toast(x.error ? 'Помилка: ' + x.error : x.before === x.after ? 'Ціна не змінилась: ' + money(x.after) : `Ціна змінилась: ${money(x.before)} → ${money(x.after)}`);
      route();
    })));
  };
  app.innerHTML = `
    <h1>Перевірка: що з чим порівнюється</h1>
    ${about('pairs', '<b>Що це.</b> Усі пари «наш товар — позиція в іншому магазині» одним списком, щоб швидко переконатись, що порівнюються правильні речі. «Продавець» — наш товар у дилера, «конкурент» — конкурентний продукт іншого бренду. <b>Як користуватись.</b> Клік по назві відкриває сторінку на сайті; ⟳ перечитує ціну зараз. Якщо пара помилкова, відкрийте товар (клік по його назві) і виправте.')}
    <div class="bar"><input class="grow" id="pq" placeholder="Пошук…" value="${esc(pState.q)}">
      <select id="psite"><option value="">Усі сайти</option>${sites.map((s) => `<option ${s === pState.site ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select id="pkind"><option value="">Усі типи</option><option value="same" ${pState.kind === 'same' ? 'selected' : ''}>Наші продавці</option><option value="analog" ${pState.kind === 'analog' ? 'selected' : ''}>Конкуренти</option></select>
      <span class="muted" id="pcount"></span></div>
    <div class="card"><div class="tw"><table><thead><tr><th>Наш товар</th><th class="n">Наша, ₴</th><th>Тип</th><th>Сайт</th><th>Позиція (продавець / конкурент)</th><th class="n">Ціна, ₴</th><th class="n">Ми vs вони</th><th>Перевірено</th><th></th></tr></thead><tbody id="pbody"></tbody></table></div></div>`;
  $('#pq').oninput = (e) => { pState.q = e.target.value; draw(); };
  $('#psite').onchange = (e) => { pState.site = e.target.value; draw(); };
  $('#pkind').onchange = (e) => { pState.kind = e.target.value; draw(); };
  draw();
}

// ---------- matrix tabs: ONE layout for "direct" (same product) and "analogs" ----------
// Row group = one of our products; under it the competitor positions of this tab's kind.
// Positions can be dragged onto another of our products when the auto-match was wrong.
const mState = {
  section: '',
  collapsed: null, // Set of parent labels, initialised on first load
  same: { q: '', cat: '', filled: false, limit: 120 },
  analog: { q: '', cat: '', filled: false, limit: 120 },
};

async function matrixPage(kind) {
  const st = mState[kind];
  const data = await papi('/matrix');
  const isSame = kind === 'same';
  let hiddenOwn = 0;
  if (!isSame && !mState.showOwnBrand) {
    for (const r of data.rows) {
      const keep = r.analog.filter((c) => !c.ownBrand);
      hiddenOwn += r.analog.length - keep.length;
      r.analog = keep;
    }
  }
  const sections = data.sections || [];
  const cats = [...new Set(data.rows.map((r) => r.category).filter(Boolean))].sort();
  const parentsAll = [...new Set(data.rows.map((r) => r.parent))].sort((a, b) => a.localeCompare(b, 'uk'));
  const secCount = (sname) => data.rows.filter((r) => !sname || r.section === sname).length;

  // first visit: collapse parents that have nothing to look at
  if (!mState.collapsed) {
    mState.collapsed = new Set();
    for (const par of parentsAll) {
      const kids = data.rows.filter((r) => r.parent === par);
      if (kids.length > 1 && !kids.some((k) => k.same.length || k.analog.length)) mState.collapsed.add(par);
    }
  }
  const collapsed = mState.collapsed;

  app.innerHTML = `
    <h1>${isSame ? 'Ціна в наших продавців' : 'Продукти-конкуренти'}</h1>
    ${about(kind, isSame
      ? '<b>Що це.</b> Наш товар у <b>наших продавців</b> (магазинів і дилерів). Вони продають і наші, і конкурентні продукти, але тут показано лише ціну <b>нашого</b> товару в них: це контроль цін, а не конкуренція. У комірці — ціна продавця і наша різниця з нею: <span class="pos">+ червоне</span> — ми дорожчі, <span class="neg">− зелене</span> — дешевші. Якщо в продавця <b>немає в наявності</b>, ціна лишається з позначкою. <b>Як користуватись.</b> Натисніть «+», вставте посилання на наш товар у продавця й Enter. Помилилось зіставлення? Перетягніть ціну на потрібний наш товар (або ⇄).'
      : '<b>Що це.</b> <b>Конкурентні продукти</b> інших брендів: відносно них визначається наше цінове позиціонування і оптимальна ціна. Їх ціни беруться з тих самих сайтів продавців (Growex та ін.), де вони продаються поруч з нашими. Порівняння йде за ціною за літр/кг. Червоне: конкурент дешевший за нас, зелене: дорожчий. Продукти нашого бренду Syngenta на чужих сайтах сюди не входять. <b>Як користуватись.</b> «+ додати конкурентний продукт» під товаром, або «Імпорт списку конкурентів»: вставте список (з відділу ціноутворення) і підтвердьте збіги. Помилилось? Перетягніть рядок на інший наш товар або ⇄.')}
    <div class="pills" id="msec">${['', ...sections].map((sname) => `<button class="pill ${st && mState.section === sname ? 'on' : ''}" data-s="${esc(sname)}">${esc(sname || 'Усі розділи')} <span class="muted">${secCount(sname)}</span></button>`).join('')}</div>
    <div class="bar">
      <input class="grow" id="mq" placeholder="Пошук нашого товару…" value="${esc(st.q)}">
      <select id="mcat"><option value="">Усі категорії</option>${cats.map((c) => `<option ${c === st.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label><input type="checkbox" id="mfill" ${st.filled ? 'checked' : ''}> лише заповнені</label>
      <span class="muted" id="mcount"></span>
      ${isSame ? '' : `<label title="Продукти Syngenta на чужих сайтах: це не конкуренти"><input type="checkbox" id="mown" ${mState.showOwnBrand ? 'checked' : ''}> показувати наш бренд${hiddenOwn ? ' (' + hiddenOwn + ' приховано)' : ''}</label>`}
      <button class="btn" id="mfold">Згорнути все</button>
      <button class="btn ${isSame ? '' : 'primary'}" id="mimp">${isSame ? 'Імпорт посилань' : 'Імпорт списку конкурентів'}</button>
    </div>
    <div id="mimport"></div>
    <datalist id="dl-products">${data.rows.map((r) => `<option value="${esc(r.name + ' · ' + (r.pack || '') + ' [' + r.groupId + ']')}"></option>`).join('')}</datalist>
    <datalist id="dl-parents">${parentsAll.map((p) => `<option value="${esc(p)}"></option>`).join('')}</datalist>
    ${isSame ? '<p class="hint" style="margin:0 0 8px">У комірці конкурента: його ціна і наша різниця з нею. <span class="pos">+ червоне</span> — ми дорожчі, <span class="neg">− зелене</span> — ми дешевші.</p>' : ''}
    <div class="card"><div class="tw mtw"><table class="mt"><thead>${isSame
      ? `<tr><th>Наш товар</th><th class="n">Наша ціна, ₴</th>${data.sites.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr>`
      : '<tr><th>Наш товар</th><th class="n">Наша ціна</th><th>Конкурентний продукт</th><th>Де продається</th><th>Фасування</th><th class="n">Ціна, ₴</th><th class="n">За л/кг</th><th class="n">Відносно нас</th><th></th></tr>'
    }</thead><tbody id="mbody"></tbody></table>
      <div class="bar" style="margin-top:10px"><button class="btn" id="mmore" hidden>Показати ще</button></div></div></div>`;

  const copiesChip = (r) => {
    if (!(r.copies > 1)) return '';
    const range = r.priceMin != null && r.priceMax != null && r.priceMin !== r.priceMax ? ` · ціни ${money(r.priceMin, 0)}–${money(r.priceMax, 0)}` : '';
    const tip = r.copyUrls.map((c) => (c.price == null ? '— ' : money(c.price, 0) + ' ₴ ') + c.url).join('\n');
    return ` <span class="chip warn" title="Той самий товар опубліковано на ${r.copies} сторінках нашого сайту:\n${esc(tip)}">×${r.copies}${range}</span>`;
  };

  const verdictOf = (c) => {
    // c.diffPct = (ours - theirs) / theirs. Show theirs relative to ours.
    if (c.diffPct == null) return '<span class="muted">—</span>';
    const rel = Math.round((1 / (1 + c.diffPct / 100) - 1) * 1000) / 10;
    const cls = rel < -2 ? 'bad' : rel > 2 ? 'good' : 'mid';
    const word = rel < -2 ? 'дешевший за нас' : rel > 2 ? 'дорожчий за нас' : 'приблизно як ми';
    return `<span class="chip ${cls}">${rel > 0 ? '+' : ''}${rel.toLocaleString('uk-UA')} %</span><div class="muted small">${word}</div>`;
  };

  const itemRow = (r, c, first, span, child) => {
    const stock = r.stock == null ? '' : r.stock > 0 ? ' · залишок ' + money(r.stock, 0) : ' · <span class="err">немає на залишку</span>';
    const head = first ? `<td rowspan="${span}" class="gcell ${child ? 'child' : ''}">
        <a href="${esc(r.url)}" target="_blank" rel="noopener" class="nm">${esc(r.name)}${r.pack ? ' · ' + esc(r.pack) : ''}</a>${copiesChip(r)}
        <div class="muted small">${r.unit == null ? '' : money(r.unit, 0) + ' ' + esc(r.unitLabel) + ' · '}${stock ? stock.slice(3) + ' · ' : ''}<a href="#/g/${r.groupId}">група</a>
          <button class="ib" data-parent="${r.groupId}" title="Перенести до іншої батьківської групи">↦</button></div></td>
        <td rowspan="${span}" class="n gcell"><b>${money(r.price, 0)}</b></td>` : '';
    return `<tr class="${first ? 'grp' : ''} item" data-g="${r.groupId}" ${c ? `draggable="true" data-pid="${c.pid}"` : ''}>${head}
      <td>${c ? `<span class="grab" title="Перетягніть на інший наш товар">⠿</span> <a href="${esc(c.url)}" target="_blank" rel="noopener" title="Відкрити сторінку конкурента">${esc(c.name)}</a>${brandChip(c)}${c.error ? ' <span class="err" title="' + esc(c.error) + '">!</span>' : ''}` : '<span class="muted">—</span>'}</td>
      <td>${c ? esc(c.site) : ''}</td>
      <td>${c ? esc(c.pack || '?') + (c.packAssumed ? ' <span class="muted small" title="Фасування не вказане на сторінці — припущено таким самим, як у нас">(припущено)</span>' : '') : ''}</td>
      <td class="n">${c ? (c.price == null ? '—' : money(c.price, 0)) + ((availBadge(c.avail) + blockedBadge(c)) ? '<div>' + availBadge(c.avail) + blockedBadge(c) + '</div>' : '') : ''}</td>
      <td class="n">${c && c.unit != null ? money(c.unit, 0) + ' <span class="muted small">' + esc(c.unitLabel) + '</span>' : ''}</td>
      <td class="n">${c ? verdictOf(c) : ''}</td>
      <td class="nowrap">${c ? `<span class="acts2"><button class="ib" data-check="${c.pid}" title="Перечитати ціну зараз">⟳</button>
        <button class="ib" data-setprice="${c.pid}" title="Ввести ціну вручну">₴</button>
        <button class="ib" data-move="${c.pid}" title="Перемістити до іншого нашого товару">⇄</button>
        <button class="ib" data-kind="${c.pid}" data-to="${isSame ? 'analog' : 'same'}" title="${isSame ? 'Це конкурентний продукт іншого бренду' : 'Це наш товар у нашого продавця'}">${isSame ? '→ конкурент' : '→ продавець'}</button>
        <button class="ib" data-rm="${c.pid}" title="Прибрати">✕</button></span>` : ''}</td></tr>`;
  };

  const colSites = data.sites;
  const mCell = (c) => `<div class="mc ${c.avail === 'out' || c.avail === 'order' ? 'oos' : ''}" draggable="true" data-pid="${c.pid}" title="${esc(c.name)}\n${esc(c.pack || 'фасування?')}${c.packAssumed ? ' (припущено)' : ''} · перевірено ${ago(c.checkedAt)}${c.error ? '\n' + esc(c.error) : ''}">
      <span class="grab" title="Перетягніть на інший наш товар">⠿</span><a href="${esc(c.url)}" target="_blank" rel="noopener" class="px">${c.price == null ? '—' : money(c.price, 0)}</a>
      <span class="df ${pctCls(c.diffPct)}">${c.diffPct == null ? '' : pct(c.diffPct)}</span>${availBadge(c.avail)}${blockedBadge(c)}${c.error && !c.blocked ? '<span class="err" title="' + esc(c.error) + '">!</span>' : ''}
      <span class="acts"><button class="ib" data-check="${c.pid}" title="Перечитати ціну зараз">⟳</button><button class="ib" data-setprice="${c.pid}" title="Ввести ціну вручну">₴</button><button class="ib" data-move="${c.pid}" title="Перемістити до іншого нашого товару (або перетягніть)">⇄</button><button class="ib" data-kind="${c.pid}" data-to="analog" title="Це конкурентний продукт іншого бренду">→ конкурент</button><button class="ib" data-rm="${c.pid}" title="Прибрати">✕</button></span></div>`;
  const matrixRow = (r, child) => {
    const stock = r.stock == null ? '' : r.stock > 0 ? ` · залишок ${money(r.stock, 0)}` : ' · <span class="err">немає на залишку</span>';
    return `<tr class="mrow" data-g="${r.groupId}"><td class="${child ? 'child' : ''}"><a href="${esc(r.url)}" target="_blank" rel="noopener" class="nm">${esc(r.name)}${r.pack ? ' · ' + esc(r.pack) : ''}</a>${copiesChip(r)}
        <div class="muted small">${r.unit == null ? '' : money(r.unit, 0) + ' ' + esc(r.unitLabel)}${stock} · <a href="#/g/${r.groupId}">група</a>
          <button class="ib" data-parent="${r.groupId}" title="Перенести до іншої батьківської групи">↦</button></div></td>
      <td class="n"><b>${money(r.price, 0)}</b></td>${colSites.map((s) => {
        const cs = r.same.filter((c) => c.siteId === s.id);
        return `<td>${cs.map(mCell).join('')}${cs.length ? '' : `<button class="plus" data-g="${r.groupId}" title="Додати посилання на ${esc(s.name)}">＋</button>`}</td>`;
      }).join('')}</tr>`;
  };

  const groupRows = (r, child) => {
    if (isSame) return matrixRow(r, child);
    const items = r[kind].slice().sort((x, y) => (x.unit || x.price || 0) - (y.unit || y.price || 0));
    const addRow = `<tr class="addrow" data-g="${r.groupId}"><td colspan="7"><button class="plus" data-g="${r.groupId}">${isSame ? '＋ додати продавця (посилання)' : '＋ додати конкурентний продукт'}</button></td></tr>`;
    if (!items.length) return itemRow(r, null, true, 2, child) + addRow;
    return items.map((c, i) => itemRow(r, c, i === 0, items.length + 1, child)).join('') + addRow;
  };

  const grouped = (list) => {
    const out = [];
    let i = 0;
    while (i < list.length) {
      const par = list[i].parent;
      let j = i;
      while (j < list.length && list[j].parent === par) j++;
      const kids = list.slice(i, j);
      if (kids.length > 1) {
        const open = !collapsed.has(par);
        const n = kids.reduce((a, k) => a + k[kind].length, 0);
        out.push(`<tr class="phead" data-p="${esc(par)}"><td class="pname" colspan="2"><span class="car">${open ? '▾' : '▸'}</span> <b>${esc(par)}</b>
          <span class="muted small">${kids.length} позицій${isSame ? '' : ' · ' + n + ' конкурентних продуктів'}</span> <button class="ib" data-rename="${esc(par)}" title="Перейменувати або об'єднати з іншою групою">✎</button></td>${
            isSame ? colSites.map((s) => `<td class="muted small">${kids.filter((k) => k.same.some((c) => c.siteId === s.id)).length}/${kids.length}</td>`).join('') : '<td colspan="7"></td>'}</tr>`);
        if (open) out.push(...kids.map((k) => groupRows(k, true)));
      } else out.push(groupRows(kids[0], false));
      i = j;
    }
    return out.join('');
  };

  const reload = async () => { const y = window.scrollY; const x = $('.mtw') ? $('.mtw').scrollLeft : 0; await matrixPage(kind); window.scrollTo(0, y); if ($('.mtw')) $('.mtw').scrollLeft = x; };

  const parseGid = (txt) => { const m = String(txt).match(/\[(g\d+)\]\s*$/); return m ? m[1] : null; };

  // small inline input with a datalist, replaces the clicked button until Enter / blur
  const inlinePick = (btn, listId, placeholder, onPick) => {
    const inp = document.createElement('input');
    inp.className = 'cellin';
    inp.setAttribute('list', listId);
    inp.placeholder = placeholder;
    btn.replaceWith(inp);
    inp.focus();
    inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) onPick(inp.value.trim(), inp); if (e.key === 'Escape') draw(); };
    inp.onchange = () => { if (inp.value.trim()) onPick(inp.value.trim(), inp); };
    inp.onblur = () => setTimeout(() => { if (document.body.contains(inp) && !inp.value.trim()) draw(); }, 150);
  };

  const move = (pid, fromG, toG) => ask(null, async () => {
    if (!toG || toG === fromG) return;
    await papi(`/groups/${toG}/move`, { method: 'POST', body: { pid, from: fromG, kind } });
    toast('Перенесено', 2500);
    await reload();
  });

  const attachUrl = (inp) => {
    const go = () => {
      const url = inp.value.trim();
      if (!/^https?:\/\//i.test(url)) return;
      inp.disabled = true;
      ask(null, async () => {
        try {
          const r = await papi(`/groups/${inp.dataset.g}/members`, { method: 'POST', body: { url, kind } });
          if (isSame && r.looksLike === 'analog') toast('Додано, але назва не схожа на наш товар — можливо, це конкурентний продукт. Перевірте посилання', 7000);
          else toast('Додано: ' + ((r.group.members.find((m) => m.url === url) || {}).name || ''), 3000);
        } finally { await reload(); }
      });
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') draw(); };
    inp.onpaste = () => setTimeout(go, 50);
  };

  const wire = () => {
    const body = $('#mbody');
    body.querySelectorAll('.plus').forEach((b) => (b.onclick = () => {
      const inp = document.createElement('input');
      inp.className = 'cellin' + (isSame ? '' : ' wide');
      inp.dataset.g = b.dataset.g;
      inp.placeholder = isSame ? 'посилання + Enter' : 'вставте посилання на сторінку товару і Enter';
      b.replaceWith(inp);
      attachUrl(inp);
      inp.focus();
      inp.onblur = () => { if (!inp.value.trim() && !inp.disabled) draw(); };
    }));
    body.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => ask(null, async () => {
      b.disabled = true;
      const x = await papi(`/products/${b.dataset.check}/check`, { method: 'POST' });
      toast(x.error ? 'Помилка: ' + x.error : x.before === x.after ? 'Ціна не змінилась: ' + money(x.after) : `Ціна змінилась: ${money(x.before)} → ${money(x.after)}`);
      await reload();
    })));
    body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => ask(null, async () => {
      await papi(`/groups/${b.closest('tr').dataset.g}/members/${b.dataset.rm}`, { method: 'DELETE' });
      await reload();
    })));
    body.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => ask(null, async () => {
      await papi(`/groups/${b.closest('tr').dataset.g}/members/${b.dataset.kind}`, { method: 'PATCH', body: { kind: b.dataset.to } });
      toast(b.dataset.to === 'analog' ? 'Перенесено у «Продукти-конкуренти»' : 'Перенесено в «Ціна в наших продавців»', 3000);
      await reload();
    })));
    body.querySelectorAll('[data-setprice]').forEach((b) => (b.onclick = () => {
      const pid = b.dataset.setprice;
      inlinePick(b, '', 'ціна, ₴ (з сайту)…', (val) => ask(null, async () => {
        await papi('/products/' + pid + '/price', { method: 'POST', body: { price: val } });
        toast('Ціну збережено', 2500);
        await reload();
      }));
    }));
    body.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => {
      const pid = b.dataset.move, from = b.closest('tr').dataset.g;
      inlinePick(b, 'dl-products', 'до якого нашого товару? почніть вводити назву…', (val) => {
        const to = parseGid(val);
        if (!to) { toast('Оберіть товар зі списку підказок', 4000); return; }
        move(pid, from, to);
      });
    }));
    body.querySelectorAll('[data-parent]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const gid = b.dataset.parent;
      inlinePick(b, 'dl-parents', 'батьківська група…', (val) => ask(null, async () => {
        await papi('/groups/' + gid, { method: 'PATCH', body: { parent: val } });
        toast('Перенесено до групи «' + val + '»', 3000);
        await reload();
      }));
    }));
    body.querySelectorAll('[data-rename]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const from = b.dataset.rename;
      inlinePick(b, 'dl-parents', 'нова назва групи (або існуюча — щоб обʼєднати)…', (val) => ask(null, async () => {
        await papi('/parents', { method: 'POST', body: { from, to: val } });
        collapsed.delete(from);
        toast(`«${from}» → «${val}»`, 3500);
        await reload();
      }));
    }));
    body.querySelectorAll('tr.phead').forEach((tr) => (tr.onclick = (e) => {
      if (e.target.closest('button,input')) return;
      const k = tr.dataset.p;
      collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k);
      draw();
    }));

    // drag & drop: any competitor position -> any block of our product
    let dragging = null;
    const clearDrop = () => body.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    body.querySelectorAll('[draggable="true"]').forEach((el) => {
      el.ondragstart = (e) => {
        const row = el.closest('tr');
        dragging = { pid: el.dataset.pid, from: row.dataset.g };
        e.dataTransfer.setData('text/plain', el.dataset.pid);
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
        e.stopPropagation();
      };
      el.ondragend = () => { el.classList.remove('dragging'); clearDrop(); dragging = null; };
    });
    body.querySelectorAll('tr[data-g]').forEach((tr) => {
      tr.ondragover = (e) => {
        if (!dragging || tr.dataset.g === dragging.from) return;
        e.preventDefault();
        clearDrop();
        body.querySelectorAll(`tr[data-g="${tr.dataset.g}"]`).forEach((x) => x.classList.add('drop'));
      };
      tr.ondrop = (e) => {
        e.preventDefault();
        const d = dragging; clearDrop(); dragging = null;
        if (d && tr.dataset.g !== d.from) move(d.pid, d.from, tr.dataset.g);
      };
    });
  };

  const draw = () => {
    let rows = data.rows;
    if (mState.section) rows = rows.filter((r) => r.section === mState.section);
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => (r.name + ' ' + r.parent).toLowerCase().includes(q)); }
    if (st.cat) rows = rows.filter((r) => r.category === st.cat);
    if (st.filled) rows = rows.filter((r) => r[kind].length);
    $('#mcount').textContent = rows.length + ' поз.';
    const shown = rows.slice(0, st.limit);
    $('#mmore').hidden = rows.length <= st.limit;
    $('#mbody').innerHTML = shown.length ? grouped(shown) : '<tr><td colspan="12" class="muted">Нічого не знайдено. Змініть розділ чи фільтри.</td></tr>';
    wire();
  };

  app.querySelectorAll('#msec .pill').forEach((b) => (b.onclick = () => {
    mState.section = b.dataset.s;
    app.querySelectorAll('#msec .pill').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  // mark the active pill on first paint
  app.querySelectorAll('#msec .pill').forEach((x) => x.classList.toggle('on', x.dataset.s === mState.section));
  const own = $('#mown');
  if (own) own.onchange = (e) => { mState.showOwnBrand = e.target.checked; route(); };
  $('#mfold').onclick = () => {
    const allCollapsed = parentsAll.every((p) => collapsed.has(p));
    collapsed.clear();
    if (!allCollapsed) parentsAll.forEach((p) => collapsed.add(p));
    $('#mfold').textContent = allCollapsed ? 'Згорнути все' : 'Розгорнути все';
    draw();
  };
  $('#mq').oninput = (e) => { st.q = e.target.value; st.limit = 120; draw(); };
  $('#mcat').onchange = (e) => { st.cat = e.target.value; st.limit = 120; draw(); };
  $('#mfill').onchange = (e) => { st.filled = e.target.checked; draw(); };
  $('#mmore').onclick = () => { st.limit += 150; draw(); };
  $('#mimp').onclick = () => importPanel(kind, data, reload);
  draw();
}

/** Bulk import: paste a list of competitor URLs. Direct tab: auto-match to our products; analog tab: pick our product first. */
function importPanel(kind, data, reload) {
  const box = $('#mimport');
  if (box.innerHTML) { box.innerHTML = ''; return; }
  const isSame = kind === 'same';

  if (!isSame) {
    // Competitors: paste the list kept by the pricing department, we find the prices and ask for confirmation
    box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Імпорт списку конкурентів</h2>
      <p class="muted" style="margin:0 0 8px">Вставте список, по одному рядку: <b>наш товар ; конкурентний продукт</b> (розділювач — «;», табуляція з Excel або «|»). Приклад: <i>Міравіс 200 SC 1 л ; Фалькон</i>. Ми знайдемо ціни цих конкурентних продуктів на сайтах продавців, а ви підтвердите.</p>
      <textarea id="clist" rows="7" placeholder="Міравіс 200 SC 1 л ; Фалькон&#10;Амістар Голд 5 л ; Колосаль Про"></textarea>
      <div class="bar"><button class="btn primary" id="cgo">Знайти ціни</button><span class="muted" id="cstat"></span></div>
      <div id="cres"></div>
      <details style="margin-top:10px"><summary class="muted">Або вставити посилання на конкурентні продукти для одного товару</summary>
        <div class="bar" style="margin-top:8px"><input id="itgt" class="grow" list="itlist" placeholder="Наш товар (почніть вводити назву)"><datalist id="itlist">${data.rows.map((r) => `<option value="${esc(r.name + ' · ' + (r.pack || ''))}"></option>`).join('')}</datalist></div>
        <textarea id="iurls" rows="4" placeholder="Посилання, по одному в рядку"></textarea>
        <div class="bar"><button class="btn" id="ipre">Додати посилання як конкурентні продукти</button><span class="muted" id="istat"></span></div>
        <div id="iprev"></div></details></div>`;

    let timer;
    const draw = (st) => {
      const res = $('#cres');
      $('#cstat').textContent = st.running ? `Опрацьовано ${st.done} з ${st.total}…` : '';
      if (st.error) { res.innerHTML = `<p class="err">${esc(st.error)}</p>`; return; }
      if (!st.rows.length) { res.innerHTML = ''; return; }
      res.innerHTML = `<div class="tw"><table><thead><tr><th></th><th>Рядок зі списку</th><th>Наш товар</th><th>Знайдений конкурентний продукт</th><th class="n">Ціна</th><th>Де</th></tr></thead><tbody>
        ${st.rows.map((r, ri) => {
          const opts = r.ourMatches.length ? `<select data-o="${ri}">${r.ourMatches.map((m) => `<option value="${m.groupId}">${esc(m.name)}${m.pack ? ' · ' + esc(m.pack) : ''}${m.packOk ? ' ✓' : ''}</option>`).join('')}</select>` : '<span class="err">наш товар не знайдено</span>';
          if (!r.found.length) return `<tr><td></td><td>${esc(r.ours)} ; <b>${esc(r.competitor)}</b></td><td>${opts}</td><td colspan="3" class="muted">на сайтах продавців не знайдено</td></tr>`;
          return r.found.map((f, fi) => `<tr>
            <td><input type="checkbox" data-r="${ri}" data-f="${fi}" ${r.ourMatches.length && fi === 0 ? 'checked' : ''}></td>
            <td>${fi === 0 ? esc(r.ours) + ' ; <b>' + esc(r.competitor) + '</b>' : ''}</td>
            <td>${fi === 0 ? opts : ''}</td>
            <td><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)} ↗</a>${f.brand ? ' <span class="muted small">' + esc(f.brand) + '</span>' : ''}<div class="muted small">${esc(f.pack || 'фасування?')}</div></td>
            <td class="n">${f.price == null ? '—' : money(f.price)}${availBadge(f.avail)}</td><td>${esc(f.site)}</td></tr>`).join('');
        }).join('')}
      </tbody></table></div>
      ${st.running ? '' : '<div class="bar" style="margin-top:10px"><button class="btn primary" id="capply">Додати вибрані як конкурентні продукти</button></div>'}`;
      const ap = $('#capply');
      if (ap) ap.onclick = () => ask(null, async () => {
        const items = [...res.querySelectorAll('input[type=checkbox]:checked')].map((cb) => {
          const ri = Number(cb.dataset.r), fi = Number(cb.dataset.f);
          const sel = res.querySelector(`select[data-o="${ri}"]`);
          return sel ? { groupId: sel.value, url: st.rows[ri].found[fi].url, kind: 'analog' } : null;
        }).filter(Boolean);
        if (!items.length) throw new Error('Нічого не відмічено');
        ap.disabled = true;
        const r = await papi('/autofill/apply', { method: 'POST', body: { items } });
        toast(`Додано: ${r.added}${r.failed.length ? '. Не вдалося: ' + r.failed.length + ' (' + r.failed[0].error + ')' : ''}`, 7000);
        reload();
      });
    };
    const poll = async () => {
      clearTimeout(timer);
      try { const st = await papi('/competitors/import'); draw(st); if (st.running) timer = setTimeout(poll, 2500); } catch { /* ignore */ }
    };
    $('#cgo').onclick = () => ask(null, async () => {
      const rows = $('#clist').value.split(/\r?\n/).map((l) => l.split(/\t|;|\|/).map((x) => x.trim())).filter((p) => p.length >= 2 && p[0] && p[1]).map((p) => ({ ours: p[0], competitor: p[1] }));
      if (!rows.length) throw new Error('Формат рядка: наш товар ; конкурентний продукт');
      await papi('/competitors/import', { method: 'POST', body: { rows } });
      poll();
    });
    // the manual URL mode keeps working
    const urls = () => $('#iurls').value.split(/[\s,;]+/).filter((u) => /^https?:\/\//i.test(u));
    $('#ipre').onclick = () => ask(null, async () => {
      const list = urls();
      if (!list.length) throw new Error('Вставте посилання (https://…)');
      const label = $('#itgt').value.trim();
      const row = data.rows.find((r) => r.name + ' · ' + (r.pack || '') === label);
      if (!row) throw new Error('Оберіть наш товар зі списку');
      let ok = 0; const bad = [];
      for (const u of list) {
        $('#istat').textContent = `Додаю ${ok + bad.length + 1}/${list.length}…`;
        try { await papi(`/groups/${row.groupId}/members`, { method: 'POST', body: { url: u, kind: 'analog' } }); ok++; } catch (e) { bad.push(u + ' — ' + e.message); }
      }
      toast(`Додано ${ok} з ${list.length}${bad.length ? '. Помилки: ' + bad.length : ''}`, 6000);
      if (bad.length) $('#iprev').innerHTML = `<p class="err">${bad.map(esc).join('<br>')}</p>`; else reload();
    });
    poll(); // show the result of a previous run, if any
    return;
  }

  box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Імпорт посилань</h2>
    <textarea id="iurls" rows="6" placeholder="Вставте посилання на наш товар у продавців, по одному в рядку (можна з Excel)"></textarea>
    <div class="bar"><button class="btn primary" id="ipre">Розпізнати та зіставити</button><span class="muted" id="istat"></span></div>
    <div id="iprev"></div></div>`;
  const urls = () => $('#iurls').value.split(/[\s,;]+/).filter((u) => /^https?:\/\//i.test(u));
  $('#ipre').onclick = () => ask(null, async () => {
    const list = urls();
    if (!list.length) throw new Error('Вставте посилання (https://…)');
    $('#istat').textContent = 'Читаю сторінки…';
    const { items } = await papi('/import/preview', { method: 'POST', body: { urls: list } });
    $('#istat').textContent = '';
    $('#iprev').innerHTML = `<div class="tw"><table><thead><tr><th></th><th>Посилання / товар продавця</th><th class="n">Ціна</th><th>Зіставлено з нашим</th></tr></thead><tbody>${items.map((it, i) => `<tr>
      <td><input type="checkbox" data-i="${i}" ${it.candidates.length && !it.error ? (it.candidates[0].score >= 20 ? 'checked' : '') : 'disabled'}></td>
      <td><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name || it.url)} ↗</a><div class="muted small">${esc(it.site || '')} · ${esc(it.pack || 'фасування?')}${it.error ? ' · <span class="err">' + esc(it.error) + '</span>' : ''}</div></td>
      <td class="n">${money(it.price)}</td>
      <td>${it.candidates.length ? `<select data-s="${i}">${it.candidates.map((c) => `<option value="${c.groupId}">${esc(c.name)} · ${esc(c.pack || 'пак?')}${c.packOk ? ' ✓' : ''}${c.score < 20 ? ' (слабкий збіг)' : ''}</option>`).join('')}</select>` : '<span class="muted">не знайдено — додайте вручну в таблиці</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="bar" style="margin-top:10px"><button class="btn primary" id="iapply">Додати вибрані</button></div>`;
    $('#iapply').onclick = () => ask(null, async () => {
      let ok = 0;
      for (const cb of $('#iprev').querySelectorAll('input[type=checkbox]:checked')) {
        const i = Number(cb.dataset.i);
        const gid = $(`select[data-s="${i}"]`).value;
        await papi(`/groups/${gid}/members`, { method: 'POST', body: { url: items[i].url, kind: 'same' } });
        ok++;
      }
      toast('Додано: ' + ok, 5000);
      reload();
    });
  });
}

const cState = { ids: new Set(JSON.parse(localStorage.getItem('cmpIds') || '[]')), q: '' };

async function compare() {
  const { groups: all, categories } = await papi('/groups');
  const withComp = all.filter((g) => g.ownCount && g.compCount);
  app.innerHTML = `
    <h1>Порівняти товари між собою</h1>
    ${about('compare', '<b>Що це.</b> Поставити кілька наших товарів поруч і побачити, де ми дорожчі, а де дешевші. <b>Як користуватись.</b> Позначте товари зліва (або оберіть цілу категорію) — справа зʼявиться індекс цін (100 — на рівні з середньою конкурентів) і різниця по кожному сайту.')}
    <div class="grid g2">
      <div class="card"><h2>Оберіть групи</h2>
        <div class="bar"><input class="grow" id="cq" placeholder="Пошук…"><select id="ccat"><option value="">Категорія → обрати всі</option>${categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select><button class="btn sm" id="cclear">Очистити</button></div>
        <div class="pick" id="cpick"></div>
        <p class="hint">Показано лише групи з конкурентами (${withComp.length}). Вибір запам’ятовується.</p></div>
      <div class="card" id="cres"><p class="muted">Оберіть дві або більше груп.</p></div>
    </div>`;
  const drawPick = () => {
    const q = $('#cq').value.toLowerCase();
    $('#cpick').innerHTML = withComp.filter((g) => !q || g.name.toLowerCase().includes(q)).map((g) => `<label><input type="checkbox" data-id="${g.id}" ${cState.ids.has(g.id) ? 'checked' : ''}> <span>${esc(g.name)}<br><span class="muted">${esc(g.category || '')}</span></span></label>`).join('');
    $('#cpick').querySelectorAll('input').forEach((i) => (i.onchange = () => { i.checked ? cState.ids.add(i.dataset.id) : cState.ids.delete(i.dataset.id); persist(); drawRes(); }));
  };
  const persist = () => { try { localStorage.setItem('cmpIds', JSON.stringify([...cState.ids])); } catch { /* storage blocked */ } };
  const drawRes = async () => {
    const ids = [...cState.ids].filter((id) => withComp.some((g) => g.id === id));
    if (ids.length < 1) { $('#cres').innerHTML = '<p class="muted">Оберіть групи зліва.</p>'; return; }
    const r = await papi('/compare?ids=' + ids.join(','));
    const gs = r.groups;
    const idx = gs.map((g) => ({ label: g.name, v: g.indexAvg })).filter((x) => x.v != null);
    const sites = [...new Set(gs.flatMap((g) => g.members.filter((m) => !m.own).map((m) => m.site)))];
    $('#cres').innerHTML = `
      <h2>Наша ціна відносно середньої в наших продавців</h2>
      ${hbars(idx, { max: Math.max(150, ...idx.map((x) => x.v)), fmt: (v) => money(v, 0), cls: (x) => (x.v > 102 ? 'bad' : x.v < 98 ? 'good' : '') })}
      <p class="hint">100 = паритет. Вище — ми дорожчі за середню.</p>
      <h2 style="margin-top:16px">Деталі</h2>
      <div class="tw"><table><thead><tr><th>Група</th><th class="n">Наша</th><th class="n">Мін.</th><th class="n">Серед.</th><th class="n">Макс.</th><th class="n">До мін.</th>${sites.map((s) => `<th class="n">${esc(s)}</th>`).join('')}</tr></thead><tbody>
      ${gs.map((g) => `<tr class="click" data-go="#/g/${g.id}"><td>${esc(g.name)}<div class="muted">${esc(g.metric || '')}</div></td><td class="n">${money(g.ours)}</td><td class="n">${money(g.compMin)}</td><td class="n">${money(g.compAvg)}</td><td class="n">${money(g.compMax)}</td><td class="n ${pctCls(g.diffMinPct)}">${pct(g.diffMinPct)}</td>
        ${sites.map((s) => { const m = g.members.filter((x) => x.site === s && x.diffPct != null); const v = m.length ? Math.min(...m.map((x) => x.diffPct)) : null; return `<td class="n ${pctCls(v)}">${v == null ? '—' : pct(v)}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div><p class="hint">У колонках сайтів: на скільки % наша ціна вища (+) або нижча (−) за цей сайт.</p>`;
  };
  $('#cq').oninput = drawPick;
  $('#ccat').onchange = (e) => { const c = e.target.value; if (!c) return; withComp.filter((g) => g.category === c).forEach((g) => cState.ids.add(g.id)); e.target.value = ''; persist(); drawPick(); drawRes(); };
  $('#cclear').onclick = () => { cState.ids.clear(); persist(); drawPick(); drawRes(); };
  drawPick(); drawRes();
}

async function sites() {
  const { sites: list } = await papi('/sites');
  app.innerHTML = `
    <h1>Наші продавці</h1>
    ${about('sites', '<b>Що це.</b> Магазини й дилери, які продають <b>і наші продукти, і конкурентні</b> (наприклад, Growex продає і Syngenta, і Фалькон). Тут ми відстежуємо: 1) ціну <b>нашого товару</b> в них (контроль цін дилерів); 2) ціну <b>конкурентних продуктів</b> (з чим порівнюємо нашу ціну). Самі ці сайти не вважаються конкурентами. <b>Як користуватись.</b> Додайте новий сайт нижче: він одразу зʼявиться колонкою у «Ціна в наших продавців», але <b>порожньою</b>. Щоб наповнити, натисніть <b>«Підібрати товари»</b>: ми знайдемо на ньому наші товари, а ви підтвердите. Конкурентні продукти шукаються на цих же сайтах через «Імпорт списку конкурентів». Мітка «заблоковано» означає, що сайт не віддає ціни автоматично.')}
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Сайт</th><th>Домен</th><th class="n">Позицій</th><th class="n">Збігів</th><th class="n">Середня різниця</th><th class="n">Дешевші за нас</th><th></th></tr></thead>
      <tbody>${list.map((s) => `<tr><td>${esc(s.name)}${s.own ? ' <span class="chip mid">ми</span>' : ''}</td><td><a href="https://${esc(s.domain)}" target="_blank" rel="noopener">${esc(s.domain)}</a></td>
        <td class="n">${s.tracked ?? ''}</td><td class="n">${s.own ? '' : s.matched ?? ''}</td><td class="n ${pctCls(s.avgDiffPct)}">${s.own ? '' : pct(s.avgDiffPct)}</td><td class="n">${s.own ? '' : (s.cheaperThanUs ?? 0) + '/' + (s.matched ?? 0)}</td>
        <td class="nowrap">${s.own ? '' : `${s.blocked ? '<span class="chip warn" title="Сайт відповідає 403: автоматична перевірка заблокована, ціни не оновлюються">заблоковано</span> ' : ''}<button class="btn sm primary" data-fill="${s.id}" title="Знайти на цьому сайті товари, що відповідають нашим">Підібрати товари</button> <button class="btn sm danger" data-rm="${s.id}">Видалити</button>`}</td></tr>`).join('')}</tbody></table></div></div>
    <div id="fillbox"></div>
    <div class="card" style="margin-top:14px"><h2>Додати сайт</h2>
      <div class="bar"><input id="sname" placeholder="Назва (напр. Агрохім)"><input class="grow" id="sdom" placeholder="Домен або посилання: agrohim.ua"><input id="smap" placeholder="Sitemap (необов’язково)"><button class="btn primary" id="sadd">Додати</button></div>
      <p class="hint">Після додавання на сторінці будь-якої групи натисніть «Шукати» — пошук піде і по новому сайту. Або просто вставте посилання на товар у групу: сайт додасться сам. Підходять сайти з розміткою schema.org Product (більшість інтернет-магазинів).</p></div>`;
  // ---- pick products for a site: read its sitemap and pages, propose matches, save only what is confirmed
  const fillbox = $('#fillbox');
  const drawFill = (st) => {
    if (!st.siteId) { fillbox.innerHTML = ''; return; }
    if (st.running) {
      fillbox.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»</h2><p class="muted">${esc(st.phase)}: ${st.done} з ${st.total || '…'}. Це займає кілька хвилин, сторінку можна не закривати.</p></div>`;
      return;
    }
    if (st.error) { fillbox.innerHTML = `<div class="card err" style="margin-top:14px">Підбір не вдався: ${esc(st.error)}</div>`; return; }
    if (!st.proposals.length) { fillbox.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»</h2><p class="muted">Збігів із нашими товарами не знайдено. Спробуйте додати кілька товарів посиланнями в картці.</p></div>`; return; }
    fillbox.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»: знайдено ${st.proposals.length}</h2>
      <p class="muted">Нічого не збережено. Відмічено позиції, де збіглися і назва, і фасування. Перевірте (назва — посилання на сторінку) і натисніть «Додати вибрані». Якщо наш товар визначено невірно, змініть його у списку справа.</p>
      <div class="tw"><table><thead><tr><th></th><th>Товар на сайті</th><th class="n">Ціна</th><th>Фасування</th><th>Це наш товар</th></tr></thead><tbody>
      ${st.proposals.map((it, i) => `<tr><td><input type="checkbox" data-i="${i}" ${it.packOk ? 'checked' : ''}></td>
        <td><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)} ↗</a>${availBadge(it.avail)}</td>
        <td class="n">${it.price == null ? '—' : money(it.price)}</td><td>${esc(it.pack || '?')}</td>
        <td><select data-s="${i}">${it.alternatives.map((a) => `<option value="${a.groupId}" ${a.groupId === it.groupId ? 'selected' : ''}>${esc(a.label)}${a.packOk ? ' ✓' : ''}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="bar" style="margin-top:10px"><button class="btn primary" id="fillapply">Додати вибрані</button><span class="muted" id="fillstat"></span></div></div>`;
    $('#fillapply').onclick = () => ask(null, async () => {
      const items = [...fillbox.querySelectorAll('input[type=checkbox]:checked')].map((cb) => {
        const i = Number(cb.dataset.i);
        return { groupId: fillbox.querySelector(`select[data-s="${i}"]`).value, url: st.proposals[i].url };
      });
      if (!items.length) throw new Error('Нічого не відмічено');
      $('#fillapply').disabled = true; $('#fillstat').textContent = 'Додаю…';
      const r = await papi('/autofill/apply', { method: 'POST', body: { items } });
      toast(`Додано: ${r.added}${r.failed.length ? ', не вдалося: ' + r.failed.length : ''}`, 6000);
      route();
    });
  };
  let fillTimer;
  const pollFill = async () => {
    clearTimeout(fillTimer);
    try { const st = await papi('/autofill'); drawFill(st); if (st.running) fillTimer = setTimeout(pollFill, 2000); } catch { /* ignore */ }
  };
  app.querySelectorAll('[data-fill]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi('/sites/' + b.dataset.fill + '/autofill', { method: 'POST', body: {} }); pollFill(); })));
  pollFill();
  $('#sadd').onclick = () => ask(null, async () => {
    await papi('/sites', { method: 'POST', body: { name: $('#sname').value, domain: $('#sdom').value, sitemap: $('#smap').value } });
    toast('Сайт додано'); route();
  });
  app.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { if (confirm('Видалити сайт і всі його товари з груп?')) ask(null, async () => { await papi('/sites/' + b.dataset.rm, { method: 'DELETE' }); route(); }); }));
}

// ---------- router + refresh ----------
// A deploy changes the stamp; an already open tab then reloads itself on the next click (or within 2 minutes).
async function versionChanged() { return false; }

window.homePage = () => home();

async function route() {
  if (await versionChanged()) { location.reload(); return; }
  const h = location.hash || '#/';
  document.querySelectorAll('#nav a').forEach((a) => { const base = a.getAttribute('href'); a.classList.toggle('on', base === h.split('?')[0] || (base === '#/import' && h.startsWith('#/import')) || (base === '#/' && h === '#/')); });
  try {
    const handled = window.v2Route ? await window.v2Route(h) : false; // v2 pages live in v2.js
    const m = h.match(/^#\/g\/(.+)$/);
    if (handled) { /* rendered by v2.js */ } else if (m) await groupPage(m[1]);
    else if (h === '#/groups') await groups();
    else if (h === '#/gaps') await gapsPage();
    else if (h === '#/direct') await matrixPage('same');
    else if (h === '#/analogs') await matrixPage('analog');
    else if (h === '#/pairs') await pairsPage();
    else if (h === '#/compare') await compare();
    else if (h === '#/sites') await sites();
    else await home();
  } catch (e) { app.innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
  document.querySelectorAll('details.about').forEach((el) => (el.ontoggle = () => { try { localStorage.setItem('about:' + el.dataset.k, el.open ? '1' : '0'); } catch { /* storage blocked */ } }));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

let pollT;
async function pollJob() {
  clearTimeout(pollT);
  try {
    const j = await papi('/refresh');
    const btn = $('#refBtn');
    btn.disabled = j.running;
    $('#refStatus').textContent = j.running ? `${j.phase}: ${j.done}/${j.total || '…'}` : (j.finishedAt ? 'Оновлено ' + new Date(j.finishedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '');
    if (j.running) pollT = setTimeout(pollJob, 2000);
    else if (pollJob.was) { pollJob.was = false; route(); }
    if (j.running) pollJob.was = true;
  } catch { /* offline */ }
}
$('#refBtn').onclick = () => ask(null, async () => { await papi('/refresh', { method: 'POST', body: {} }); pollJob(); });

apiCall('/auth/me').then((me) => { if (me.role !== 'admin') document.body.classList.add('ro'); }).catch(() => {});
route();
pollJob();

// ---------- tasks: a «＋ задача» next to every page heading and table row, pointing back at this exact place ----------
function enhanceTasks() {
  if (!window.TaskUI) return;
  const place = (what) => ({ area: 'prices', context: what || '', link: 'prices.html?v=20261017c' + location.hash });
  const h = app.querySelector('h1, h2');
  if (h && !h.querySelector('.taskbtn')) { const b = TaskUI.button(() => place((h.textContent || '').trim())); b.style.marginLeft = '10px'; h.appendChild(b); }
  app.querySelectorAll('tr[data-go]').forEach((tr) => {
    if (tr.querySelector('.taskbtn')) return;
    const name = ((tr.cells[0] && tr.cells[0].querySelector('b')) || tr.cells[0] || {}).textContent;
    const td = document.createElement('td');
    td.appendChild(TaskUI.button(() => ({ ...place((name || '').trim()), title: 'Ціни: ' + (name || '').trim() + ': ', link: 'prices.html?v=20261017c' + tr.dataset.go }), { small: true }));
    tr.appendChild(td);
  });
  // price table rows (one per our product) and mapping rows (one per group from the department's list)
  app.querySelectorAll('tr.prow[data-g]').forEach((tr) => {
    if (tr.querySelector('.taskbtn')) return;
    const name = ((tr.querySelector('b') || {}).textContent || '').trim();
    const td = document.createElement('td');
    td.appendChild(TaskUI.button(() => ({ ...place(name), title: 'Ціни: ' + name + ': ', link: 'prices.html?v=20261017c#/p/' + tr.dataset.g }), { small: true }));
    tr.appendChild(td);
  });
  app.querySelectorAll('#mbody tr[data-k]').forEach((tr) => {
    if (tr.querySelector('.taskbtn')) return;
    const name = ((tr.cells[0] && tr.cells[0].innerText) || '').split('\n')[0].trim();
    const td = document.createElement('td');
    td.appendChild(TaskUI.button(() => ({ ...place('Мепінг'), title: 'Знайти пару в каталозі для «' + name + '»', link: 'prices.html?v=20261017c#/i' }), { small: true }));
    tr.appendChild(td);
  });
}
new MutationObserver(() => { clearTimeout(enhanceTasks.t); enhanceTasks.t = setTimeout(enhanceTasks, 120); }).observe(app, { childList: true, subtree: true });

