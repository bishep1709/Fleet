'use strict';
// «Ціни на ринку» by the user's draft («Ціни драфт.ods»): two price tables and four bases.
//   Наші ціни у партнерів   — our product ↔ the same product at a partner;
//   Наші ціни vs аналоги     — our product ↔ an analog (another product) at a partner;
//   Бази                     — Продукти SYT · Аналоги · Зіставлення · Партнери.
// «Інсайти» is not touched (prices-tabs.js). Uses the helpers of prices-app.js / prices-tabs.js ($, esc, money, papi,
// toast, ask, app, ptModal, ptCsv, ptHash) which exist by the time a route runs.

const pd = {
  same: { q: '', partner: '', section: '', update: '', status: '', diff: '' },
  analog: { q: '', partner: '', section: '', update: '', status: '', diff: '' },
  baseQ: { products: '', analogs: '', mapping: '', partners: '' },
  baseType: '',
};
const pdDmy = (iso) => { const s = String(iso || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '—'; }; // ISO 8601: 2026-10-18
const pdNum = (n, d = 2) => (n == null ? '—' : money(n, d));
const pdOpts = (list, cur, placeholder) => `${placeholder ? `<option value="">${esc(placeholder)}</option>` : ''}${list.map(([v, t]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}`;
const pdTypeOf = (types, short) => (types.find((t) => t.short === short) || {}).full || short;

// summary cards: [{ l: label, v: value, s: small text, cls: 'bad|good|warn', on: selected, set: click handler }]
function pdCardsHtml(cards) {
  return cards.map((c, i) => `<div class="card kpi ${c.cls || ''}${c.set ? ' click' : ''}${c.on ? ' sel' : ''}" data-c="${i}"${c.set ? ' role="button" tabindex="0"' : ''}><div class="l">${esc(c.l)}</div><div class="v">${c.v}</div><div class="l">${esc(c.s || '')}</div></div>`).join('');
}
function pdCardsShow(host, cards) {
  host.innerHTML = pdCardsHtml(cards);
  host.querySelectorAll('.click').forEach((el) => {
    const run = () => cards[Number(el.dataset.c)].set();
    el.onclick = run;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } };
  });
}

// «SYT дешевша / дорожча на N%»: diffPct > 0 means WE are dearer
function pdVerdict(r) {
  const v = r.diffPct;
  if (v == null) return ['—', '—', ''];
  if (Math.abs(v) < 0.5) return ['на рівні', '', ''];
  return [v > 0 ? 'дорожча' : 'дешевша', `${Math.abs(v).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`, v > 0 ? 'pos' : 'neg'];
}

function pdUpdateChip(r) {
  const cls = r.updateKind === 'auto' ? 'good' : r.updateKind === 'manual' ? 'mid' : 'warn';
  return `<span class="chip ${cls}">${esc(r.update)}</span>`;
}

// ---------------------------------------------------------------- the two price tables
async function pdPairs(kind) {
  const isAnalog = kind === 'analog';
  const S = pd[kind];
  const [data, partners] = await Promise.all([papi(isAnalog ? '/pairs/competitors' : '/pairs/partners'), papi('/bases/partners')]);
  const h = ptHash();
  if (h.q.gid) S.q = ''; // a link from Інсайти shows everything of one product
  if (h.q.section) S.section = h.q.section;
  if (h.q.diff) S.diff = h.q.diff;
  if (h.q.status) S.status = h.q.status === 'check' ? 'check' : S.status;
  const gid = h.q.gid || '';
  app.innerHTML = `<h1>${isAnalog ? 'Наші ціни vs аналоги' : 'Наші ціни у партнерів'}</h1>
    <p class="muted" style="margin:0 0 10px">${isAnalog
    ? 'Наш продукт і аналог (інший препарат) у партнера: ціна SYT проти ціни аналога. Аналог рахується в підсумках лише після підтвердження: ціна за літр різних препаратів без норми витрати може вводити в оману.'
    : 'Наш продукт і той самий продукт у партнера: ціна SYT проти ціни партнера.'}</p>
    <div class="grid kp" id="pcards" style="margin-bottom:12px"></div>
    <div class="bar">
      <input class="grow" id="pq" placeholder="Пошук: продукт, партнер…" value="${esc(S.q)}">
      <select id="ppartner">${pdOpts(data.sites.map((s) => [s, s]), S.partner, 'Усі партнери')}</select>
      <select id="psec">${pdOpts(data.sections.map((s) => [s, s]), S.section, 'Усі категорії')}</select>
      <select id="pupd">${pdOpts([['auto', 'Оновлено автоматично'], ['manual', 'Додано або введено вручну'], ['blocked', 'Сайт блокує']], S.update, 'Усі статуси оновлення')}</select>
      <select id="pst">${pdOpts([['ok', 'Ціна враховується'], ['check', 'Перевірте']], S.status, 'Уся перевірка')}</select>
      <select id="pdiff">${pdOpts([['pricier', 'Ми дорожчі'], ['cheaper', 'Ми дешевші']], S.diff, 'Уся різниця')}</select>
    </div>
    <div class="bar"><span id="pcount" class="muted"></span> <span class="muted">Ціни оновлено: ${esc(pdDmy(data.lastRefresh))}</span>
      <button class="btn primary" id="padd">＋ Додати ціну партнера</button> <button class="btn" id="pcsv">⬇ Завантажити в Excel (CSV)</button></div>
    <div class="card"><div class="tw"><table class="pdt"><thead>
      <tr class="gh"><th></th><th colspan="3" class="gc">SYT</th><th colspan="4" class="gc">${isAnalog ? 'Аналог' : 'Партнер'}</th><th colspan="2" class="gc">Порівняння</th><th colspan="2"></th><th></th></tr>
      <tr><th>Type</th><th>Продукт Сингента</th><th>Упаковка</th><th class="n">Ціна, грн</th><th>Партнер</th><th>${isAnalog ? 'Аналог' : 'Продукт у партнера'}</th><th>Упаковка</th><th class="n">Ціна, грн</th><th>SYT</th><th class="n">На</th><th>Статус оновлення цін</th><th>Ціна оновлена на</th><th></th></tr>
      </thead><tbody id="pbody"></tbody></table></div></div>
    <p class="muted small" style="margin:10px 0 0">Можна: додати партнера зі списку, посилання на сторінку, упаковку (літраж) і ціну. Якщо сайт партнера блокує автоматичне читання, впишіть ціну й упаковку вручну: у стовпчику «Статус оновлення цін» буде «додано вручну».</p>`;

  const match = (r) => {
    const q = S.q.trim().toLowerCase();
    return (!gid || r.groupId === gid)
      && (!S.partner || r.their.site === S.partner)
      && (!S.section || r.section === S.section)
      && (!S.update || r.updateKind === S.update)
      && (!S.status || (S.status === 'ok' ? r.status === 'ok' : r.status !== 'ok'))
      && (!S.diff || (S.diff === 'pricier' ? (r.diffPct != null && r.diffPct > 0.5) : (r.diffPct != null && r.diffPct < -0.5)))
      && (!q || [r.our.name, r.their.name, r.their.site, r.analog && r.analog.name].some((t) => String(t || '').toLowerCase().includes(q)));
  };
  // Summary cards over ALL pairs of this table. Only pairs whose price counts («Ціна враховується») feed the
  // «дорожча / дешевша» numbers; a click on a card applies the matching filter.
  const pdPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`);
  const drawCards = () => {
    const all = data.rows;
    const counted = all.filter((r) => r.status === 'ok' && r.diffPct != null);
    const up = counted.filter((r) => r.diffPct > 0.5);
    const down = counted.filter((r) => r.diffPct < -0.5);
    const level = counted.length - up.length - down.length;
    const mean = (a) => (a.length ? a.reduce((t, r) => t + r.diffPct, 0) / a.length : null);
    const check = all.filter((r) => r.status !== 'ok');
    const products = new Set(all.map((r) => r.groupId)).size;
    const who = isAnalog ? 'аналога' : 'партнера';
    const cards = [
      { l: 'Пар у таблиці', v: all.length, s: `${products} продуктів SYT`, on: !S.diff && !S.status, set: () => { S.diff = ''; S.status = ''; } },
      { l: `SYT дорожча за ${who}`, v: up.length, s: up.length ? `у середньому ${pdPct(mean(up))}` : 'таких пар немає', cls: up.length ? 'bad' : 'good', on: S.diff === 'pricier', set: () => { S.diff = S.diff === 'pricier' ? '' : 'pricier'; } },
      { l: `SYT дешевша за ${who}`, v: down.length, s: down.length ? `у середньому ${pdPct(mean(down))}` : 'таких пар немає', cls: down.length ? 'good' : '', on: S.diff === 'cheaper', set: () => { S.diff = S.diff === 'cheaper' ? '' : 'cheaper'; } },
      { l: 'На рівні', v: level, s: 'різниця до 0,5%' },
      { l: 'Перевірте', v: check.length, s: check.length ? 'не враховуються в підсумках' : 'усе враховується', cls: check.length ? 'warn' : 'good', on: S.status === 'check', set: () => { S.status = S.status === 'check' ? '' : 'check'; } },
      { l: 'Середня різниця', v: pdPct(mean(counted)), s: counted.length ? (mean(counted) > 0 ? 'SYT у середньому дорожча' : 'SYT у середньому дешевша') : 'ще немає цін для порівняння' },
    ];
    $('#pcards').innerHTML = cards.map((c, i) => `<div class="card kpi ${c.cls || ''}${c.set ? ' click' : ''}${c.on ? ' sel' : ''}" data-c="${i}"${c.set ? ' role="button" tabindex="0"' : ''}><div class="l">${esc(c.l)}</div><div class="v">${c.v}</div><div class="l">${esc(c.s)}</div></div>`).join('');
    $('#pcards').querySelectorAll('.click').forEach((el) => {
      const run = () => { cards[Number(el.dataset.c)].set(); $('#pst').value = S.status || ''; $('#pdiff').value = S.diff || ''; draw(); };
      el.onclick = run;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } };
    });
  };
  const draw = () => {
    drawCards();
    const rows = data.rows.filter(match);
    $('#pcount').textContent = `Показано ${rows.length} з ${data.rows.length}`;
    $('#pbody').innerHTML = rows.length ? rows.map((r) => {
      const [word, p, cls] = pdVerdict(r);
      const ok = r.status === 'ok';
      const sameTare = r.our.pack && r.their.pack && r.our.pack === r.their.pack;
      const theirName = isAnalog ? `<b>${esc(r.analog ? r.analog.name : r.their.name)}</b>${r.analog && r.analog.name !== r.their.name ? `<div class="muted small">${esc(r.their.name)}</div>` : ''}` : esc(r.their.name);
      return `<tr data-pid="${esc(r.pid)}" data-gid="${esc(r.groupId)}">
        <td><span title="${esc(r.section || '')}">${esc(r.type || '—')}</span></td>
        <td><a class="nm" href="${esc(r.our.url || '#')}" target="_blank" rel="noopener"><b>${esc(r.our.name)}</b></a></td><td class="nowrap">${esc(r.our.pack || '—')}</td><td class="n">${pdNum(r.our.price)}</td>
        <td>${esc(r.their.site)}</td>
        <td>${r.their.url ? `<a class="nm" href="${esc(r.their.url)}" target="_blank" rel="noopener">${theirName}</a>` : theirName}${r.their.brand && isAnalog ? ` <span class="muted small">· ${esc(r.their.brand)}</span>` : ''}</td>
        <td class="nowrap">${esc(r.their.pack || '—')}${r.their.packAssumed ? ' <span class="chip warn" title="Упаковку не вказано на сторінці: припущено, що вона така сама, як у нас">припущено</span>' : ''}</td>
        <td class="n">${pdNum(r.their.price)}${r.their.avail === 'out' ? '<div><span class="chip bad">немає в наявн.</span></div>' : ''}</td>
        <td class="${ok ? cls : 'muted'}">${esc(word)}</td>
        <td class="n ${ok ? cls : 'muted'}">${p ? `<b>${esc(p)}</b>` : ''}${p && !sameTare ? '<div class="muted small">за одиницю</div>' : ''}${!ok ? `<div><span class="chip warn" title="${esc(r.reasons.join('; '))}">Перевірте</span></div>` : ''}</td>
        <td>${pdUpdateChip(r)}</td><td class="nowrap">${esc(pdDmy(r.their.checkedAt))}</td>
        <td class="nowrap">${!ok && r.status === 'check' ? '<button class="btn sm" data-act="confirm" title="Підтвердити, що ця пара порівнянна, і врахувати її в підсумках">Підтвердити</button> ' : ''}<button class="btn sm" data-act="hist" title="Показати, як змінювалися ціни">Динаміка</button> <button class="btn sm" data-act="edit" title="Змінити ціну чи упаковку">✎</button> <button class="btn sm danger" data-act="del" title="Прибрати пару">✕</button></td></tr>`;
    }).join('') : `<tr><td colspan="13" class="muted" style="padding:14px">Немає пар за цими умовами. Додайте ціну партнера кнопкою вгорі.</td></tr>`;
  };
  draw();
  const bind = (id, key) => { $(id).oninput = $(id).onchange = (e) => { S[key] = e.target.value; draw(); }; };
  bind('#pq', 'q'); bind('#ppartner', 'partner'); bind('#psec', 'section'); bind('#pupd', 'update'); bind('#pst', 'status'); bind('#pdiff', 'diff');
  $('#pcsv').onclick = () => ptCsv(`${isAnalog ? 'ціни-vs-аналоги' : 'ціни-у-партнерів'}.csv`,
    ['Type', 'Продукт Сингента', 'Упаковка', 'Ціна SYT', 'Партнер', isAnalog ? 'Аналог' : 'Продукт у партнера', 'Упаковка', 'Ціна', 'SYT', 'На, %', 'Статус оновлення цін', 'Ціна оновлена на', 'Перевірка'],
    data.rows.filter(match).map((r) => { const [word, p] = pdVerdict(r); return [r.type, r.our.name, r.our.pack, r.our.price, r.their.site, isAnalog && r.analog ? r.analog.name : r.their.name, r.their.pack, r.their.price, word, p.replace('%', ''), r.update, pdDmy(r.their.checkedAt), r.status === 'ok' ? 'Ок' : 'Перевірте']; }));
  $('#padd').onclick = () => pdAddModal(kind, partners.rows, () => route());
  $('#pbody').onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const tr = b.closest('tr');
    const r = data.rows.find((x) => x.pid === tr.dataset.pid);
    if (!r) return;
    if (b.dataset.act === 'del') {
      if (!window.confirm(`Прибрати пару «${r.our.name}» — ${r.their.site}?`)) return;
      ask(null, async () => { await papi(`/groups/${r.groupId}/members/${r.pid}`, { method: 'DELETE' }); toast('Пару прибрано', 2500); route(); });
    } else if (b.dataset.act === 'confirm') {
      ask(null, async () => { await papi(`/pairs/${r.pid}`, { method: 'PATCH', body: { confirm: true } }); toast('Підтверджено: пара тепер враховується в підсумках', 3500); route(); });
    } else if (b.dataset.act === 'hist') {
      // the history of every price in this group: ours and the partners', one smooth line each
      ask(null, async () => {
        const res = await papi('/groups/' + r.groupId);
        ptModal('Динаміка цін: ' + r.our.name + (r.our.pack ? ' · ' + r.our.pack : ''), lineChart(res.history.series, res.history.metric) + '<p class="muted small" style="margin-top:8px">Зелена лінія — наша ціна. Наведіть на день, щоб побачити всі ціни цього дня.</p>', { wide: true });
      });
    } else pdEditModal(r, () => route());
  };
}

// «＋ Додати ціну партнера»: a partner from the list, a URL, a pack and/or a price
async function pdAddModal(kind, partners, done) {
  const isAnalog = kind === 'analog';
  const [prods, analogs] = await Promise.all([papi('/bases/products'), isAnalog ? papi('/bases/analogs') : Promise.resolve({ rows: [] })]);
  const byType = prods.types.map((t) => `<optgroup label="${esc(t.full)}">${prods.rows.filter((r) => r.type === t.short).map((r) => `<option value="${esc(r.groupId)}">${esc(r.name)} · ${esc(r.pack || '—')}</option>`).join('')}</optgroup>`).join('');
  const m = ptModal(isAnalog ? 'Додати ціну аналога' : 'Додати ціну партнера', `
    <div class="pd-form">
      <label>Наш продукт<select id="m-g"><option value="">— оберіть —</option>${byType}</select></label>
      ${isAnalog ? `<label>Аналог з бази<select id="m-a"><option value="">— оберіть —</option>${analogs.rows.map((a) => `<option value="${esc(a.id)}">${esc(a.type)} · ${esc(a.name)}${a.pack ? ` · ${esc(a.pack)}` : ''}</option>`).join('')}</select></label>
      <p class="muted small" style="margin:-4px 0 0">Немає потрібного аналога? Спочатку додайте його в «Бази → Аналоги».</p>` : ''}
      <label>Партнер<select id="m-s"><option value="">— оберіть —</option>${partners.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.domain)}</option>`).join('')}</select></label>
      <label>Посилання на сторінку товару <span class="muted">(необов'язково)</span><input id="m-u" placeholder="https://…"></label>
      <div class="row2"><label>Упаковка (літраж)<input id="m-p" placeholder="наприклад, 5 л або 1 кг"></label><label>Ціна, грн<input id="m-c" inputmode="decimal" placeholder="наприклад, 6180"></label></div>
      <p class="muted small" style="margin:0">Достатньо посилання АБО ціни з упаковкою. Якщо вказати посилання, ціну й назву система прочитає сама; те, що ви впишете вручну, має перевагу й позначиться «додано вручну».</p>
      <div id="m-err" class="err" style="display:none"></div>
      <div class="bar" style="margin:6px 0 0"><button class="btn primary" id="m-go">Додати</button></div>
    </div>`, { wide: false });
  m.el.querySelector('#m-go').onclick = async () => {
    const err = m.el.querySelector('#m-err');
    err.style.display = 'none';
    const btn = m.el.querySelector('#m-go');
    btn.disabled = true;
    try {
      await papi('/pairs/manual', { method: 'POST', body: { kind, groupId: m.el.querySelector('#m-g').value, analogId: isAnalog ? m.el.querySelector('#m-a').value : undefined, siteId: m.el.querySelector('#m-s').value, url: m.el.querySelector('#m-u').value, pack: m.el.querySelector('#m-p').value, price: m.el.querySelector('#m-c').value } });
      m.close(); toast('Додано', 2500); done();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; btn.disabled = false; }
  };
}

function pdEditModal(r, done) {
  const m = ptModal('Змінити ціну чи упаковку', `
    <div class="pd-form">
      <p style="margin:0"><b>${esc(r.our.name)}</b> ${esc(r.our.pack || '')}<br><span class="muted">${esc(r.their.site)} · ${esc(r.their.name)}</span></p>
      <div class="row2"><label>Упаковка<input id="e-p" value="${esc(r.their.pack || '')}" placeholder="наприклад, 5 л"></label><label>Ціна, грн<input id="e-c" inputmode="decimal" value="${r.their.price == null ? '' : esc(r.their.price)}"></label></div>
      <p class="muted small" style="margin:0">Те, що ви змінюєте, позначиться як «введено вручну». Якщо сайт читається автоматично, при наступному оновленні ціна підтягнеться знову.</p>
      <div id="e-err" class="err" style="display:none"></div>
      <div class="bar" style="margin:6px 0 0"><button class="btn primary" id="e-go">Зберегти</button></div>
    </div>`);
  m.el.querySelector('#e-go').onclick = async () => {
    const err = m.el.querySelector('#e-err');
    try {
      await papi(`/pairs/${r.pid}`, { method: 'PATCH', body: { pack: m.el.querySelector('#e-p').value, price: m.el.querySelector('#e-c').value } });
      m.close(); toast('Збережено', 2500); done();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
}

// ---------------------------------------------------------------- the bases
const PD_BASES = [['', 'Продукти SYT'], ['analogs', 'Аналоги'], ['mapping', 'Зіставлення'], ['partners', 'Партнери']];
async function pdBases(path) {
  const sub = path.split('/')[2] || 'products';
  const key = sub === 'products' ? '' : sub;
  app.innerHTML = `<h1>Бази</h1>
    <p class="muted" style="margin:0 0 10px">Довідники для порівняння цін. Порядок такий: <b>Аналоги</b> (що порівнюємо) → <b>Зіставлення</b> (з яким нашим товаром; система сама шукає ціни в партнерів) → <b>Партнери</b> (чиї сайти читаємо). Наші продукти підтягуються з каталогу самі.</p>
    <div class="pills">${PD_BASES.map(([k, t]) => `<a class="pill ${key === k ? 'on' : ''}" href="#/bases${k ? '/' + k : ''}" style="text-decoration:none">${t}</a>`).join('')}</div><div id="bbox"></div>`;
  const box = $('#bbox');
  if (sub === 'analogs') await pdAnalogs(box);
  else if (sub === 'mapping') await pdMapping(box);
  else if (sub === 'partners') await pdPartners(box);
  else await pdProducts(box);
}

async function pdProducts(box) {
  const data = await papi('/bases/products');
  const drawCards = () => {
    const all = data.rows;
    const pick = (t) => () => { pd.baseType = pd.baseType === t ? '' : t; $('#bt').value = pd.baseType; draw(); };
    pdCardsShow($('#bcards'), [
      { l: 'Усього продуктів SYT', v: all.length, s: 'фасувань у каталозі', on: !pd.baseType, set: pick('') },
      ...data.types.map((t) => ({ l: t.full, v: all.filter((r) => r.type === t.short).length, s: 'продуктів', on: pd.baseType === t.short, set: pick(t.short) })),
      { l: 'Без ціни на сайті', v: all.filter((r) => r.price == null).length, s: 'ціну не прочитано', cls: all.some((r) => r.price == null) ? 'warn' : 'good' },
      { l: 'Є залишок', v: all.filter((r) => r.stock > 0).length, s: 'за даними BAS' },
    ]);
  };
  const draw = () => {
    drawCards();
    const q = pd.baseQ.products.trim().toLowerCase();
    const rows = data.rows.filter((r) => (!pd.baseType || r.type === pd.baseType) && (!q || r.name.toLowerCase().includes(q)));
    $('#bpc').textContent = `Показано ${rows.length} з ${data.rows.length}`;
    $('#bpb').innerHTML = rows.map((r) => `<tr><td><span title="${esc(r.section || '')}">${esc(r.type || '—')}</span></td><td><a class="nm" href="${esc(r.url || '#')}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a></td><td class="nowrap">${esc(r.pack || '—')}</td><td class="n">${pdNum(r.price)}</td><td class="n muted">${r.stock == null ? '' : esc(money(r.stock, 0))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:14px">Нічого не знайдено</td></tr>';
  };
  box.innerHTML = `<div class="grid kp" id="bcards" style="margin-bottom:12px"></div><div class="bar"><input class="grow" id="bq" placeholder="Пошук продукту…" value="${esc(pd.baseQ.products)}"><select id="bt">${pdOpts(data.types.map((t) => [t.short, t.full]), pd.baseType, 'Усі категорії')}</select><span id="bpc" class="muted"></span><button class="btn" id="bcsv">⬇ CSV</button></div>
    <div class="card"><div class="tw"><table class="pdt"><thead><tr><th>Type</th><th>Продукт Сингента</th><th>Упаковка</th><th class="n">Ціна на сайті, грн</th><th class="n">Залишок</th></tr></thead><tbody id="bpb"></tbody></table></div></div>
    <p class="muted small" style="margin:10px 0 0">Ці дані беруться з нашого магазину автоматично: ціна й упаковка читаються зі сторінок store.syngenta.ua, залишок із BAS. Змінювати їх тут не потрібно.</p>`;
  draw();
  $('#bq').oninput = (e) => { pd.baseQ.products = e.target.value; draw(); };
  $('#bt').onchange = (e) => { pd.baseType = e.target.value; draw(); };
  $('#bcsv').onclick = () => ptCsv('база-продуктів-syt.csv', ['Type', 'Продукт Сингента', 'Упаковка', 'Ціна на сайті, грн', 'Залишок'], data.rows.map((r) => [r.type, r.name, r.pack, r.price, r.stock]));
}

async function pdAnalogs(box) {
  const data = await papi('/bases/analogs');
  const typeOpts = data.types.map((t) => [t.short, t.short]);
  const unmapped = data.rows.filter((a) => !a.mapped).length;
  box.innerHTML = `<div class="grid kp" id="bcards" style="margin-bottom:12px"></div><div class="card" style="margin-bottom:12px"><h2>Додати аналог</h2>
      <div class="bar"><select id="an-t">${pdOpts(typeOpts, '', 'Type')}</select><input class="grow" id="an-n" placeholder="Аналог, наприклад: Bayer Фалькон"><input id="an-p" placeholder="Упаковка: 1 л" size="10"><button class="btn primary" id="an-go">Додати</button></div>
      <div id="an-err" class="err" style="display:none"></div></div>
    <div class="card"><div class="tw"><table class="pdt"><thead><tr><th>Type</th><th>Аналог</th><th>Упаковка</th><th class="n">Зіставлено з нашими</th><th></th></tr></thead><tbody>
    ${data.rows.map((a) => `<tr data-id="${esc(a.id)}"><td>${esc(a.type)}</td><td><b>${esc(a.name)}</b></td><td class="nowrap">${esc(a.pack || '—')}</td><td class="n">${a.mapped}</td><td class="nowrap"><button class="btn sm" data-act="edit">✎</button> <button class="btn sm danger" data-act="del">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="padding:14px">Аналогів ще немає. Додайте перший вище.</td></tr>'}
    </tbody></table></div></div>`;
  pdCardsShow($('#bcards'), [
    { l: 'Аналогів у базі', v: data.rows.length, s: 'продуктів конкурентів' },
    ...data.types.map((t) => ({ l: t.short, v: data.rows.filter((a) => a.type === t.short).length, s: 'аналогів' })),
    { l: 'Зіставлено з нашими', v: data.rows.length - unmapped, s: 'мають пару серед продуктів SYT', cls: 'good' },
    { l: 'Без зіставлення', v: unmapped, s: unmapped ? 'не порівнюються з нашими' : 'усі зіставлені', cls: unmapped ? 'warn' : 'good' },
  ]);
  $('#an-go').onclick = async () => {
    const err = $('#an-err');
    err.style.display = 'none';
    try { await papi('/bases/analogs', { method: 'POST', body: { type: $('#an-t').value, name: $('#an-n').value, pack: $('#an-p').value } }); toast('Аналог додано', 2500); route(); } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  box.querySelector('tbody').onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = data.rows.find((x) => x.id === b.closest('tr').dataset.id);
    if (b.dataset.act === 'del') {
      if (!window.confirm(`Видалити аналог «${a.name}»${a.mapped ? ` разом із ${a.mapped} зіставленнями` : ''}? Ціни, що вже додані, залишаться в таблиці.`)) return;
      ask(null, async () => { await papi(`/bases/analogs/${a.id}`, { method: 'DELETE' }); toast('Видалено', 2500); route(); });
    } else {
      const m = ptModal('Змінити аналог', `<div class="pd-form"><label>Type<select id="x-t">${pdOpts(typeOpts, a.type)}</select></label><label>Аналог<input id="x-n" value="${esc(a.name)}"></label><label>Упаковка<input id="x-p" value="${esc(a.pack || '')}"></label><div id="x-err" class="err" style="display:none"></div><div class="bar" style="margin:6px 0 0"><button class="btn primary" id="x-go">Зберегти</button></div></div>`);
      m.el.querySelector('#x-go').onclick = async () => {
        try { await papi(`/bases/analogs/${a.id}`, { method: 'PATCH', body: { type: m.el.querySelector('#x-t').value, name: m.el.querySelector('#x-n').value, pack: m.el.querySelector('#x-p').value } }); m.close(); toast('Збережено', 2500); route(); } catch (er) { const x = m.el.querySelector('#x-err'); x.textContent = er.message; x.style.display = 'block'; }
      };
    }
  };
}

// «Зіставлення»: by our product. Under each product: its analogs, and for every analog what was found at the partners.
// An analog put against a product is searched at the partners at once; what is found has to be confirmed, and from then on
// its price is read like all the others.
const pdSafeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
const PD_STATE = {
  linked: ['є ціна', 'good'],
  candidates: ['знайдено, підтвердіть', 'warn'],
  searching: ['шукаємо…', 'mid'],
  new: ['ще не шукали', 'mid'],
  none: ['не знайдено в партнерів', 'warn'],
};
const pdMp = { filter: '', q: '', type: '', open: new Set(), timer: null };

async function pdMapping(box) {
  const [cmp, analogsAll] = await Promise.all([papi('/bases/compare'), papi('/bases/analogs')]);
  const rows = cmp.rows;
  const withAn = rows.filter((r) => r.analogs.length);
  const priced = (r) => has(r, 'linked') || (r.existing || []).length > 0;
  const has = (r, st) => r.analogs.some((a) => a.state === st);
  const needsConfirm = withAn.filter((r) => has(r, 'candidates'));
  const withPrice = rows.filter(priced);
  const notFound = withAn.filter((r) => r.analogs.some((a) => a.state === 'none') && !priced(r) && !has(r, 'candidates'));
  const notSearched = withAn.filter((r) => r.analogs.some((a) => a.state === 'new') && !priced(r) && !has(r, 'candidates') && !has(r, 'none'));
  const noAnalog = rows.filter((r) => !r.analogs.length && !(r.existing || []).length);
  const neverSearched = withAn.reduce((t, r) => t + r.analogs.filter((a) => a.state === 'new').length, 0);
  const anySearching = rows.some((r) => has(r, 'searching')) || (cmp.job && cmp.job.running);

  const FILTERS = [
    ['', 'Усі товари', rows.length, 'всі наші продукти'],
    ['price', 'Мають ціни аналогів', withPrice.length, 'підтверджено, або додано раніше', 'good'],
    ['confirm', 'Чекають підтвердження', needsConfirm.length, 'система знайшла, потрібне ваше «так»', needsConfirm.length ? 'warn' : 'good'],
    ['none', 'Не знайдено', notFound.length, 'на сайтах партнерів аналога немає', notFound.length ? 'warn' : 'good'],
    ['new', 'Ще не шукали', notSearched.length, 'натисніть «Знайти ціни для всіх»', notSearched.length ? 'warn' : 'good'],
    ['empty', 'Без аналога', noAnalog.length, 'порівнювати поки нема з чим', noAnalog.length ? 'warn' : 'good'],
  ];
  const match = (r) => {
    if (pdMp.type && r.type !== pdMp.type) return false;
    const q = pdMp.q.trim().toLowerCase();
    if (q && !(`${r.name} ${r.analogs.map((a) => a.name).join(' ')}`.toLowerCase().includes(q))) return false;
    if (pdMp.filter === 'price') return withPrice.includes(r);
    if (pdMp.filter === 'confirm') return needsConfirm.includes(r);
    if (pdMp.filter === 'none') return notFound.includes(r);
    if (pdMp.filter === 'new') return notSearched.includes(r);
    if (pdMp.filter === 'empty') return !r.analogs.length && !(r.existing || []).length;
    return true;
  };

  const diffText = (r, l) => {
    if (l.price == null || r.price == null) return '';
    if (!l.samePack) return `<span class="muted small">інша упаковка (${esc(l.pack || '—')})</span>`;
    const pct = ((r.price - l.price) / l.price) * 100;
    if (Math.abs(pct) < 0.5) return '<span class="muted small">ціна на рівні</span>';
    return `<span class="small ${pct > 0 ? 'pos' : 'neg'}">SYT ${pct > 0 ? 'дорожча' : 'дешевша'} на ${Math.abs(pct).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%</span>`;
  };
  const when = (iso) => (iso ? String(iso).slice(0, 10) : '—');

  const analogRow = (r, a) => {
    const [label, cls] = PD_STATE[a.state] || PD_STATE.new;
    const linked = a.linked.map((l) => `<div class="pdl"><b>${esc(l.site)}</b> · ${l.price == null ? '<span class="muted">ціни немає</span>' : `${pdNum(l.price)} грн`} · ${esc(l.pack || '—')} ${diffText(r, l)}
      <a href="${esc(pdSafeUrl(l.url))}" target="_blank" rel="noopener" title="Сторінка партнера">↗</a>${l.manual ? ' <span class="chip mid">вручну</span>' : ''}
      <button class="btn sm" data-act="unlink" data-m="${esc(a.id)}" data-p="${esc(l.productId)}" title="Це не той товар: прибрати з порівняння">✕</button>
      <span class="muted small">перевірено ${esc(when(l.checkedAt))}</span></div>`).join('');
    const cands = a.cands.map((c) => `<div class="pdl"><b>${esc(c.site)}</b> · ${esc(c.name || 'без назви')} · ${c.price == null ? '<span class="muted">ціни немає</span>' : `${pdNum(c.price)} грн`} · ${esc(c.pack || 'упаковка не вказана')}${c.packMatch ? ' <span class="chip good">та сама упаковка</span>' : ''}
      <a href="${esc(pdSafeUrl(c.url))}" target="_blank" rel="noopener" title="Відкрити сторінку">↗</a> <button class="btn sm primary" data-act="link" data-m="${esc(a.id)}" data-u="${esc(c.url)}">Підтвердити</button></div>`).join('');
    const none = a.state === 'none' ? `<div class="muted small">Шукали ${esc(when(a.searchedAt))} на ${a.sites || 0} сайтах. Якщо сайт блокує роботів, ціну можна додати вручну.</div>` : '';
    return `<tr><td><b>${esc(a.name)}</b><div class="muted small">${esc(a.pack || 'упаковка не вказана')}</div></td>
      <td><span class="chip ${cls}">${label}</span></td>
      <td>${linked}${a.cands.length ? `<div class="muted small" style="margin:4px 0 2px">Знайдено, чекає підтвердження:</div>${cands}` : ''}${none}</td>
      <td class="nowrap"><button class="btn sm" data-act="search" data-m="${esc(a.id)}" title="Шукати цей аналог у партнерів ще раз">🔍 Шукати</button> <button class="btn sm danger" data-act="del" data-m="${esc(a.id)}" title="Прибрати зіставлення">✕</button></td></tr>`;
  };

  const mappedIds = (r) => new Set(r.analogs.map((a) => a.analogId));
  const body = (r) => {
    const free = analogsAll.rows.filter((a) => a.type === r.type && !mappedIds(r).has(a.id));
    const ex = (r.existing || []).length ? `<div class="muted small" style="margin:0 0 4px">Вже в порівнянні (додано раніше, без зіставлення з базою аналогів):</div>${r.existing.map((l) => `<div class="pdl"><b>${esc(l.site)}</b> · ${esc(l.name || '')} · ${pdNum(l.price)} грн · ${esc(l.pack || '—')} ${diffText(r, l)} <a href="${esc(pdSafeUrl(l.url))}" target="_blank" rel="noopener">↗</a> <span class="muted small">перевірено ${esc(when(l.checkedAt))}</span></div>`).join('')}` : '';
    return `${ex}<div class="tw"><table class="pdt"><thead><tr><th>Аналог</th><th>Стан</th><th>Де знайдено</th><th></th></tr></thead><tbody>${r.analogs.map((a) => analogRow(r, a)).join('') || '<tr><td colspan="4" class="muted" style="padding:10px">Аналогів ще немає. Додайте перший нижче: система одразу почне його шукати в партнерів.</td></tr>'}</tbody></table></div>
      <div class="bar" style="margin:8px 0 0"><input class="grow" list="pdl-${esc(r.groupId)}" data-add-input placeholder="Додати аналог до цього товару: почніть вводити назву" aria-label="Аналог"><datalist id="pdl-${esc(r.groupId)}">${free.map((a) => `<option value="${esc(a.name)}${a.pack ? ` · ${esc(a.pack)}` : ''}"></option>`).join('')}</datalist><button class="btn primary" data-act="add" data-g="${esc(r.groupId)}">Додати й шукати</button></div>`;
  };
  const summary = (r) => {
    const n = (st) => r.analogs.filter((a) => a.state === st).length;
    const bits = [n('linked') ? `<span class="chip good">${n('linked')} з ціною</span>` : '', n('candidates') ? `<span class="chip warn">${n('candidates')} чекає підтвердження</span>` : '', n('searching') ? '<span class="chip mid">шукаємо…</span>' : '', (r.existing || []).length ? `<span class="chip good">${r.existing.length} вже в порівнянні</span>` : '', n('none') + n('new') ? `<span class="chip mid">${n('none') + n('new')} без ціни</span>` : '', r.analogs.length || (r.existing || []).length ? '' : '<span class="chip warn">без аналога</span>'].filter(Boolean).join(' ');
    return `<summary><b>${esc(r.name)}</b> <span class="muted">${esc(r.pack || '')}</span> · наша ціна ${pdNum(r.price)} грн <span class="pdsum">${bits}</span></summary>`;
  };

  box.innerHTML = `<p class="muted" style="margin:0 0 10px"><b>Як це працює.</b> Для кожного нашого товару тут видно його аналоги. Додали аналог, і система сама шукає його на сайтах партнерів. Знайдене показується з кнопкою «Підтвердити». Після підтвердження ціна оновлюється сама, як і решта цін.</p>
    <div class="grid kp" id="bcards" style="margin-bottom:12px"></div>
    <div class="bar"><input class="grow" id="mq" placeholder="Пошук: наш товар або аналог…" value="${esc(pdMp.q)}"><select id="mt">${pdOpts(cmp.types.map((t) => [t.short, t.full]), pdMp.type, 'Усі категорії')}</select><button class="btn" id="msa" ${neverSearched ? '' : 'disabled'}>Знайти ціни для всіх нешуканих (${neverSearched})</button></div>
    <div id="mjob" class="muted small" style="margin:0 0 8px"></div>
    <div id="mlist"></div>`;
  pdCardsShow($('#bcards'), FILTERS.map(([k, l, v, s, cls]) => ({ l, v, s, cls, on: pdMp.filter === k, set: () => { pdMp.filter = pdMp.filter === k ? '' : k; drawList(); drawCardsOnly(); } })));
  const drawCardsOnly = () => pdCardsShow($('#bcards'), FILTERS.map(([k, l, v, s, cls]) => ({ l, v, s, cls, on: pdMp.filter === k, set: () => { pdMp.filter = pdMp.filter === k ? '' : k; drawList(); drawCardsOnly(); } })));
  const jobEl = $('#mjob');
  if (cmp.job && cmp.job.running) jobEl.textContent = `Шукаємо аналоги в партнерів: ${cmp.job.done} з ${cmp.job.total}. Знайдено для ${cmp.job.found}.`;
  else if (cmp.job && cmp.job.total && cmp.job.done === cmp.job.total) jobEl.textContent = `Останній пошук: перевірено ${cmp.job.total}, знайдено для ${cmp.job.found}.`;

  function drawList() {
    const list = rows.filter(match);
    $('#mlist').innerHTML = list.length
      ? `<div class="card pdmp">${list.slice(0, 150).map((r) => `<details data-g="${esc(r.groupId)}" ${pdMp.open.has(r.groupId) ? 'open' : ''}>${summary(r)}<div class="pdmb"></div></details>`).join('')}</div>${list.length > 150 ? `<p class="muted small">Показано 150 з ${list.length}. Уточніть пошук.</p>` : ''}`
      : '<p class="muted">За цими умовами нічого немає.</p>';
    $('#mlist').querySelectorAll('details').forEach((det) => {
      const r = rows.find((x) => x.groupId === det.dataset.g);
      const fill = () => { const b = det.querySelector('.pdmb'); if (!b.dataset.f) { b.innerHTML = body(r); b.dataset.f = '1'; } };
      if (det.open) fill();
      det.addEventListener('toggle', () => { if (det.open) { pdMp.open.add(r.groupId); fill(); } else pdMp.open.delete(r.groupId); });
    });
  }
  drawList();

  $('#mq').oninput = (e) => { pdMp.q = e.target.value; drawList(); };
  $('#mt').onchange = (e) => { pdMp.type = e.target.value; drawList(); };
  $('#msa').onclick = () => ask(null, async () => { await papi('/bases/search-all', { method: 'POST' }); toast('Пошук запущено: можна лишатися на сторінці', 3500); route(); });

  const keepOpenRefresh = () => { clearTimeout(pdMp.timer); route(); };
  $('#mlist').onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'link') ask(null, async () => { b.disabled = true; await papi(`/bases/mapping/${b.dataset.m}/link`, { method: 'POST', body: { url: b.dataset.u } }); toast('Підтверджено: ціна читається далі сама', 3000); keepOpenRefresh(); });
    else if (act === 'unlink') { if (window.confirm('Це не той товар? Сторінку буде прибрано з порівняння.')) ask(null, async () => { await papi(`/bases/mapping/${b.dataset.m}/link/${b.dataset.p}`, { method: 'DELETE' }); toast('Прибрано', 2500); keepOpenRefresh(); }); }
    else if (act === 'search') ask(null, async () => { b.disabled = true; b.textContent = 'Шукаємо…'; await papi(`/bases/mapping/${b.dataset.m}/search`, { method: 'POST' }); keepOpenRefresh(); });
    else if (act === 'del') { if (window.confirm('Прибрати це зіставлення? Ціни, що вже підтверджені, залишаться в таблицях.')) ask(null, async () => { await papi(`/bases/mapping/${b.dataset.m}`, { method: 'DELETE' }); toast('Прибрано', 2500); keepOpenRefresh(); }); }
    else if (act === 'add') {
      const r = rows.find((x) => x.groupId === b.dataset.g);
      const input = b.parentElement.querySelector('[data-add-input]').value.trim();
      const a = analogsAll.rows.find((x) => x.type === r.type && !mappedIds(r).has(x.id) && (`${x.name}${x.pack ? ` · ${x.pack}` : ''}` === input || x.name === input));
      if (!a) { toast('Оберіть аналог зі списку підказок. Нового аналога можна створити у вкладці «Аналоги».', 5000); return; }
      ask(null, async () => { b.disabled = true; await papi('/bases/mapping', { method: 'POST', body: { analogId: a.id, groupId: r.groupId } }); toast('Додано. Шукаємо аналог у партнерів…', 3500); keepOpenRefresh(); });
    }
  };

  // while a search is running the page refreshes itself
  clearTimeout(pdMp.timer);
  if (anySearching) pdMp.timer = setTimeout(() => { if (location.hash.startsWith('#/bases/mapping')) route(); }, 4000);
}

async function pdPartners(box) {
  const data = await papi('/bases/partners');
  const chip = (s) => `<span class="chip ${s === 'ok' ? 'good' : s === 'ще немає товарів' ? 'mid' : 'warn'}">${esc(s)}</span>`;
  box.innerHTML = `<div class="grid kp" id="bcards" style="margin-bottom:12px"></div><div class="card" style="margin-bottom:12px"><h2>Додати партнера</h2>
      <div class="bar"><input id="pn-n" placeholder="Назва, наприклад: Growex"><input class="grow" id="pn-u" placeholder="Сайт: https://growex.market/"><button class="btn primary" id="pn-go">Додати</button></div>
      <div id="pn-err" class="err" style="display:none"></div></div>
    <div class="card"><div class="tw"><table class="pdt"><thead><tr><th>Назва</th><th>Сайт</th><th>Статус підключення</th><th class="n">Позицій</th><th>Останнє читання</th><th></th></tr></thead><tbody>
    ${data.rows.map((r) => `<tr data-id="${esc(r.id)}"><td><b>${esc(r.name)}</b></td><td><a href="${esc(r.site)}" target="_blank" rel="noopener">${esc(r.domain)} ↗</a></td><td>${chip(r.status)}${r.blocked ? `<div class="muted small">${r.blocked} з ${r.tracked} позицій блокує автоматичне читання: ціни можна вписати вручну в таблиці</div>` : ''}</td><td class="n">${r.tracked}</td><td class="nowrap">${esc(pdDmy(r.lastRead))}</td><td><button class="btn sm danger" data-act="del">✕</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const blockedN = data.rows.filter((r) => /блокує/.test(r.status)).length;
  const emptyN = data.rows.filter((r) => r.status === 'ще немає товарів').length;
  pdCardsShow($('#bcards'), [
    { l: 'Партнерів і сайтів', v: data.rows.length, s: 'з яких читаємо ціни' },
    { l: 'Читаються без проблем', v: data.rows.filter((r) => r.status === 'ok').length, s: 'ціни оновлюються кнопкою «Оновити ціни»', cls: 'good' },
    { l: 'Блокують перевірку', v: blockedN, s: blockedN ? 'ціни доведеться вводити вручну' : 'таких немає', cls: blockedN ? 'warn' : 'good' },
    { l: 'Ще без товарів', v: emptyN, s: emptyN ? 'додайте позиції' : 'таких немає', cls: emptyN ? 'warn' : 'good' },
    { l: 'Позицій усього', v: data.rows.reduce((t, r) => t + r.tracked, 0), s: 'сторінок товарів під наглядом' },
  ]);
  $('#pn-go').onclick = async () => {
    const err = $('#pn-err');
    err.style.display = 'none';
    try {
      const raw = $('#pn-u').value.trim();
      const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
      await papi('/sites', { method: 'POST', body: { name: $('#pn-n').value, domain: host } });
      toast('Партнера додано', 2500); route();
    } catch (e) { err.textContent = e.message === 'Invalid URL' ? 'Вкажіть адресу сайту, наприклад: https://growex.market/' : e.message; err.style.display = 'block'; }
  };
  box.querySelector('tbody').onclick = (e) => {
    const b = e.target.closest('[data-act="del"]');
    if (!b) return;
    const r = data.rows.find((x) => x.id === b.closest('tr').dataset.id);
    if (!window.confirm(`Видалити партнера «${r.name}» разом з усіма ${r.tracked} його позиціями й цінами? Це не можна скасувати.`)) return;
    ask(null, async () => { await papi(`/sites/${r.id}`, { method: 'DELETE' }); toast('Партнера видалено', 2500); route(); });
  };
}

// ---------------------------------------------------------------- router: the new tabs replace the old ones
const pdOrigRoute = window.v2Route;
window.v2Route = async (h) => {
  const { path } = ptHash();
  let handled = true;
  if (path === '/partners') await pdPairs('same');
  else if (path === '/vs') await pdPairs('analog');
  else if (path.startsWith('/bases')) await pdBases(path);
  else if (path.startsWith('/import') || path === '/s' || path === '/i' || path === '/m') location.hash = '#/bases';
  else handled = await pdOrigRoute(h);
  document.querySelectorAll('#nav a').forEach((a) => {
    const base = a.getAttribute('href').replace(/^#/, '');
    a.classList.toggle('on', base === path || (base === '/bases' && path.startsWith('/bases')));
  });
  return handled;
};
