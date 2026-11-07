// Drill-down drawer: click a chart bar/point to see what the number is made of.
// Sales drills come from BAS (categories, products, customer type, payment, days, and — for admins —
// the biggest orders); traffic drills come from GA4 (channels, sources, landing pages, devices).
// Everything is rendered with DOM APIs.
const drillState = { el: null, token: 0 };

function drillDates(range) {
  return range.from === range.to ? fmt.dateFull(range.from) : `${fmt.dateFull(range.from)} — ${fmt.dateFull(range.to)}`;
}

function drillClose() {
  if (drillState.el) { drillState.el.remove(); drillState.el = null; }
  document.removeEventListener('keydown', drillKey);
}
function drillKey(e) { if (e.key === 'Escape') drillClose(); }

function drillShell(title, sub) {
  drillClose();
  const body = h('div', { class: 'drill-body' }, h('p', { class: 'vb-muted', role: 'status' }, 'Завантажую…'));
  const panel = h('aside', { class: 'drill-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'drill-head' },
      h('div', null, h('h3', null, title), h('p', { class: 'sub' }, sub)),
      h('button', { type: 'button', class: 'vira-icon drill-x', 'aria-label': 'Закрити', onclick: drillClose }, '×')),
    body);
  const wrap = h('div', { class: 'drill-wrap' }, h('div', { class: 'drill-backdrop', onclick: drillClose }), panel);
  document.body.appendChild(wrap);
  drillState.el = wrap;
  document.addEventListener('keydown', drillKey);
  return body;
}

const dTable = (rows, cols) => (rows && rows.length ? dataTable({ rows, cols }) : h('p', { class: 'empty' }, 'Немає даних.'));
const dSection = (title, node) => h('section', { class: 'drill-sec' }, h('h4', null, title), node);
const shareCol = { label: 'Частка', num: true, render: (r) => fmt.pct(r.share || 0, (r.share || 0) < 0.1 ? 1 : 0) };

function drillSalesView(d, forcedOrganic) {
  const box = h('div', null);
  box.appendChild(h('div', { class: 'kpis' },
    kpiTile({ label: 'Виручка без ПДВ', value: fmt.money(d.revenue), note: 'без скасованих' }),
    kpiTile({ label: 'Замовлень', value: fmt.int(d.orders) }),
    kpiTile({ label: 'Середній чек', value: fmt.money(d.aov) }),
    kpiTile({ label: 'Органічний попит', value: fmt.money(d.organic.revenue), note: `${fmt.pct(d.organic.share, 1)} виручки · ${fmt.int(d.organic.orders)} замовл.` })));
  if (forcedOrganic) box.appendChild(h('div', { class: 'notice', style: { marginTop: '10px' } }, 'Показано лише органічний попит: замовлення без менеджера й без менеджерських промокодів.'));

  box.appendChild(dSection('За категоріями', dTable(d.types.filter((r) => r.revenue > 0 || r.orders > 0), [
    { label: 'Категорія', render: (r) => r.name },
    { label: 'Виручка', num: true, render: (r) => fmt.moneyFull(r.revenue) },
    shareCol,
    { label: 'Замовл.', num: true, render: (r) => fmt.int(r.orders) },
  ])));
  box.appendChild(dSection('Топ товарів', dTable(d.products, [
    { label: 'Товар', render: (r) => r.name },
    { label: 'Виручка', num: true, render: (r) => fmt.moneyFull(r.revenue) },
    { label: 'Кількість', num: true, render: (r) => fmt.compact(r.qty) },
    { label: 'Замовл.', num: true, render: (r) => fmt.int(r.orders) },
  ])));
  box.appendChild(h('div', { class: 'grid g-1-1' },
    dSection('Тип клієнта', dTable(d.customerType, [{ label: '', render: (r) => r.name }, { label: 'Виручка', num: true, render: (r) => fmt.money(r.revenue) }, shareCol])),
    dSection('Спосіб оплати', dTable(d.payment, [{ label: '', render: (r) => r.name }, { label: 'Виручка', num: true, render: (r) => fmt.money(r.revenue) }, shareCol]))));
  if (d.daily && d.daily.length > 1) {
    box.appendChild(dSection('По днях', dTable(d.daily, [
      { label: 'Дата', render: (r) => fmt.dateFull(r.date) },
      { label: 'Виручка', num: true, render: (r) => fmt.moneyFull(r.revenue) },
      { label: 'Замовл.', num: true, render: (r) => fmt.int(r.orders) },
    ])));
  }
  if (d.orderList) {
    box.appendChild(dSection(`Найбільші замовлення (${d.orderList.length} із ${fmt.int(d.orderListTotal)})`, dTable(d.orderList, [
      { label: '№', render: (r) => r.order },
      { label: 'Дата', render: (r) => fmt.dateFull(r.date) },
      { label: 'Категорія', render: (r) => r.categories.join(', ') },
      { label: 'Клієнт', render: (r) => (r.customerType || '').replace('Юридична особа', 'юрособа').replace('Фізична особа', 'фізособа') },
      { label: 'Оплата', render: (r) => r.payment },
      { label: 'Органіка', render: (r) => (r.organic ? 'так' : '—') },
      { label: 'Сума без ПДВ', num: true, render: (r) => fmt.moneyFull(r.revenue) },
    ])));
  } else {
    box.appendChild(h('p', { class: 'bar-note' }, 'Список окремих замовлень доступний адміністратору.'));
  }
  return box;
}

function drillTrafficView(d) {
  const box = h('div', null);
  box.appendChild(h('div', { class: 'kpis' },
    kpiTile({ label: 'Сесії', value: fmt.int(d.kpis.sessions) }),
    kpiTile({ label: 'Користувачі', value: fmt.int(d.kpis.users) }),
    kpiTile({ label: 'Нові користувачі', value: fmt.int(d.kpis.newUsers) }),
    kpiTile({ label: 'Залученість', value: fmt.pct(d.kpis.engagementRate) })));
  const cols = (label) => [
    { label, render: (r) => r.name },
    { label: 'Сесії', num: true, render: (r) => fmt.int(r.sessions) },
    { label: 'Корист.', num: true, render: (r) => fmt.int(r.users) },
    { label: 'Залуч.', num: true, render: (r) => fmt.pct(r.engagementRate) },
  ];
  if (d.mode === 'all') box.appendChild(dSection('Канали', dTable(d.channels, cols('Канал'))));
  box.appendChild(dSection('Джерела', dTable(d.sources, cols('Джерело / канал'))));
  box.appendChild(dSection('Сторінки входу', dTable(d.landing, cols('Сторінка'))));
  box.appendChild(dSection('Пристрої', dTable(d.devices, cols('Пристрій'))));
  return box;
}

// kind: 'sales' | 'traffic'; mode (traffic): 'all' | 'search' | 'organicChannel'.
async function openDrill({ kind, range, label, title, mode, forceOrganic }) {
  const scope = typeof drillScope === 'function' ? drillScope() : null;
  const scopeText = kind === 'sales' && scope && scope.category ? ` · ${(SCOPE_CATEGORIES.find((c) => c.id === scope.category) || {}).label}` : '';
  const modeText = kind === 'traffic' && mode === 'search' ? ' · лише пошукові системи' : kind === 'traffic' && mode === 'organicChannel' ? ' · канал Organic Search' : '';
  const body = drillShell(`${title || 'Склад значення'}: ${label}`, `${drillDates(range)}${scopeText}${modeText}`);
  const token = ++drillState.token;
  try {
    const d = kind === 'sales' ? await api.drillSales(range, scope, forceOrganic) : await api.drillTraffic(range, mode);
    if (token !== drillState.token || !drillState.el) return;
    clear(body);
    body.appendChild(kind === 'sales' ? drillSalesView(d, forceOrganic || (scope && scope.organic)) : drillTrafficView(d));
  } catch (err) {
    if (token !== drillState.token) return;
    clear(body);
    body.appendChild(h('div', { class: 'notice crit', role: 'alert' }, err.status === 503 ? 'Джерело даних недоступне.' : `Не вдалося завантажити склад значення: ${err.message}`));
  }
}
