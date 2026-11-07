'use strict';
// «Ціни на ринку»: four simple tabs over one model — pairs (our product ↔ the same product at a partner, or ↔
// a competitor product).  Інсайти · Наші товари у партнерів · Наші товари vs. конкуренти · Імпорт.
// Tables are flat (one pair = one row), filterable, and export to CSV that opens in Excel.
// Relies on the helpers of prices-app.js ($, esc, money, papi, toast, ask, app) which are defined by the time a route runs.

// ---------------------------------------------------------------- shared helpers
const pt = {
  partners: { q: '', site: '', section: '', status: '', sort: 'our', dir: 1 },
  vs: { q: '', site: '', section: '', status: '', diff: '', sort: 'our', dir: 1 },
};
const ptDay = (iso) => (iso ? String(iso).slice(0, 10) : '—');
const ptHash = () => {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const [path, qs] = raw.split('?');
  return { path: path || '/', q: Object.fromEntries(new URLSearchParams(qs || '')) };
};

function ptModal(title, bodyHtml, { wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'tk-overlay';
  wrap.innerHTML = `<div class="tk-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="width:min(${wide ? 860 : 560}px,100%)"><h2>${esc(title)}</h2><div id="ptm-body">${bodyHtml}</div><div class="tk-actions"><button type="button" class="tk-cancel" id="ptm-close">Закрити</button></div></div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('#ptm-close').onclick = close;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  return { el: wrap.querySelector('#ptm-body'), close };
}

function ptCsv(filename, header, rows) {
  const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const text = '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const ptChip = (r) => {
  if (r.status === 'error') return `<span class="chip bad" title="${esc(r.reasons.join('; '))}">Помилка</span>`;
  if (r.status === 'check') return `<span class="chip warn" title="${esc(r.reasons.join('; '))}">Перевірте</span>`;
  return `<span class="chip good" title="${esc(r.reasons.join('; '))}">${r.confirmed ? 'Підтверджено' : 'Ок'}</span>`;
};
const ptDiff = (r) => {
  if (r.diffPct == null) return '<span class="muted">—</span>';
  const v = r.diffPct;
  if (Math.abs(v) < 0.5) return '<span class="muted">на рівні</span>';
  // A pair nobody has checked (or an out-of-stock / implausible one) is shown greyed and is left out of the totals.
  if (r.status !== 'ok') return `<span class="muted" title="${esc(r.reasons.join('; '))}"><b>${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%</b> ${v > 0 ? 'ми дорожчі' : 'ми дешевші'}<br><span class="small">не враховано в підсумках</span></span>`;
  return `<span class="${v > 0 ? 'pos' : 'neg'}"><b>${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%</b> ${v > 0 ? 'ми дорожчі' : 'ми дешевші'}</span>`;
};

// ---------------------------------------------------------------- pairs tables (tabs 2 and 3)
async function ptPairsTab(kind) {
  const isVs = kind === 'analog';
  const S = isVs ? pt.vs : pt.partners;
  const data = await papi(isVs ? '/pairs/competitors' : '/pairs/partners');
  const h = ptHash();
  if (h.q.gid) S.gid = h.q.gid; else delete S.gid;
  if (h.q.diff) S.diff = h.q.diff;
  if (h.q.status) S.status = h.q.status;
  if (h.q.section) S.section = h.q.section;
  const title = isVs ? 'Наші товари vs. товари конкурентів' : 'Наші товари у партнерів';
  const lead = isVs
    ? 'Кожен рядок — наш товар і продукт конкурента, з яким ми його порівнюємо (на сайті партнера або іншому сайті, який ви додали). Порівняння за ціною літра/кг, коли фасування відоме.'
    : 'Кожен рядок — наш товар і той самий товар на сайті нашого партнера: наша ціна проти ціни партнера.';
  app.innerHTML = `<h1>${title}</h1>
    <p class="muted" style="margin:0 0 10px">${lead}</p>
    <div class="bar">
      <input class="grow" id="pq" placeholder="Пошук: наш товар, товар конкурента, сайт…" value="${esc(S.q)}">
      <select id="psite"><option value="">Усі сайти</option>${data.sites.map((s) => `<option ${S.site === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select id="psec"><option value="">Усі категорії</option>${data.sections.map((s) => `<option ${S.section === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select id="pst"><option value="">Усі стани</option><option value="check" ${S.status === 'check' ? 'selected' : ''}>Потребують уваги</option><option value="ok" ${S.status === 'ok' ? 'selected' : ''}>Тільки в порядку</option></select>
      ${isVs ? `<select id="pdiff"><option value="">Уся різниця</option><option value="pricier" ${S.diff === 'pricier' ? 'selected' : ''}>Ми дорожчі</option><option value="cheaper" ${S.diff === 'cheaper' ? 'selected' : ''}>Ми дешевші</option></select>` : ''}
    </div>
    <div class="bar"><span class="muted" id="pcount"></span><span class="muted">Ціни оновлено: ${esc(ptDay(data.lastRefresh))}</span>
      <button class="btn" id="padd">＋ Додати пару за посиланням</button><button class="btn primary" id="pcsv">⬇ Завантажити в Excel (CSV)</button></div>
    <div class="card"><div class="tw"><table class="mt"><thead><tr>
      <th class="s" data-s="our">Наш товар</th><th class="n s" data-s="ourp">Наша ціна</th>
      <th class="s" data-s="their">${isVs ? 'Продукт конкурента' : 'Назва у партнера'}</th><th class="s" data-s="site">${isVs ? 'Сайт' : 'Партнер'}</th>
      <th class="n s" data-s="theirp">Ціна</th><th class="n s" data-s="diff">Різниця</th><th class="s" data-s="at">Оновлено</th><th>Стан</th><th></th></tr></thead><tbody id="pbody"></tbody></table></div></div>`;

  const keyFns = {
    our: (r) => r.our.name + ' ' + (r.our.pack || ''), ourp: (r) => r.our.unit ?? r.our.price ?? 0, their: (r) => r.their.name || '', site: (r) => r.their.site,
    theirp: (r) => r.their.unit ?? r.their.price ?? 0, diff: (r) => r.diffPct ?? -1e9, at: (r) => r.their.checkedAt || '',
  };
  const view = () => {
    const q = S.q.trim().toLowerCase();
    let list = data.rows.filter((r) => (!S.gid || r.groupId === S.gid) && (!S.site || r.their.site === S.site) && (!S.section || r.section === S.section)
      && (!S.status || (S.status === 'check' ? r.status !== 'ok' : r.status === 'ok'))
      && (!S.diff || (S.diff === 'pricier' ? (r.diffPct != null && r.diffPct > 0.5) : (r.diffPct != null && r.diffPct < -0.5)))
      && (!q || (r.our.name + ' ' + r.their.name + ' ' + r.their.site + ' ' + (r.their.brand || '')).toLowerCase().includes(q)));
    const f = keyFns[S.sort] || keyFns.our;
    list = list.slice().sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'string' ? x.localeCompare(y, 'uk') : x - y) * S.dir; });
    return list;
  };
  const draw = () => {
    const list = view();
    $('#pcount').textContent = `Показано ${list.length} з ${data.rows.length}${S.gid ? ' · один товар' : ''}`;
    $('#pbody').innerHTML = list.map((r, i) => {
      const otherPack = r.our.pack && r.their.pack && r.our.pack !== r.their.pack;
      return `<tr data-i="${i}">
        <td><a class="nm" href="${esc(r.our.url)}" target="_blank" rel="noopener"><b>${esc(r.our.name)}</b></a>${r.our.pack ? ` <span class="muted small">· ${esc(r.our.pack)}</span>` : ''}${r.section ? `<div class="muted small">${esc(r.section)}</div>` : ''}</td>
        <td class="n">${money(r.our.price, 0)} ₴${r.our.unit ? `<div class="muted small">${money(r.our.unit)} ${esc(r.our.unitLabel || '')}</div>` : ''}</td>
        <td><a href="${esc(r.their.url)}" target="_blank" rel="noopener">${esc(r.their.name)} ↗</a>${r.their.brand ? ` <span class="muted small">${esc(r.their.brand)}</span>` : ''}${r.their.pack ? `<div class="muted small">${esc(r.their.pack)}${otherPack ? ' · інша тара' : ''}${r.their.packAssumed ? ' · припущено' : ''}</div>` : ''}</td>
        <td>${esc(r.their.site)}${r.source && r.source.list ? `<div class="muted small" title="Із списку ${esc(r.source.list)}">${esc(r.source.list)}</div>` : ''}</td>
        <td class="n">${r.their.price == null ? '—' : money(r.their.price, 0) + ' ₴'}${r.their.unit ? `<div class="muted small">${money(r.their.unit)} ${esc(r.their.unitLabel || '')}</div>` : ''}${availBadge(r.their.avail)}${r.their.manualPrice ? '<div class="muted small">вручну</div>' : ''}</td>
        <td class="n">${ptDiff(r)}${r.their.change7 != null && Math.abs(r.their.change7) >= 1 ? `<div class="muted small">за 7 дн.: ${r.their.change7 > 0 ? '+' : '−'}${Math.abs(r.their.change7)}%</div>` : ''}</td>
        <td class="nowrap">${esc(ptDay(r.their.checkedAt))}</td>
        <td>${ptChip(r)}</td>
        <td class="nowrap"><details class="rowmenu"><summary class="btn sm">Дії ▾</summary><div class="menu">
          ${r.status !== 'ok' || !r.confirmed ? '<button data-act="ok">✓ Підтвердити пару</button>' : ''}
          <button data-act="check">⟳ Перечитати ціну</button>
          <button data-act="price">₴ Ввести ціну вручну</button>
          <button data-act="move">⇄ Інший наш товар…</button>
          ${isVs ? '<button data-act="find">🔎 Знайти іншу сторінку…</button>' : ''}
          <button data-act="del">✕ Прибрати пару</button></div></details>
          <span data-task></span></td></tr>`;
    }).join('') || `<tr><td colspan="9" class="muted">Нічого не знайдено. ${data.rows.length ? 'Змініть фільтри.' : 'Пар поки немає: додайте їх у вкладці «Імпорт».'}</td></tr>`;
    $('#pbody').querySelectorAll('[data-task]').forEach((el) => {
      const r = list[Number(el.closest('tr').dataset.i)];
      if (window.TaskUI) el.appendChild(TaskUI.button(() => ({ area: 'prices', title: `${isVs ? 'Конкурент' : 'Партнер'} ${r.their.site}: ${r.our.name}${r.our.pack ? ' ' + r.our.pack : ''}: `, context: `${title} · ${r.their.site}`, link: `prices.html?v=20261017c#/${isVs ? 'vs' : 'partners'}?gid=${r.groupId}` }), { small: true }));
    });
    $('#pbody').onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const r = list[Number(b.closest('tr').dataset.i)];
      b.closest('details').open = false;
      act(b.dataset.act, r);
    };
  };
  const reload = () => ptPairsTab(kind);
  const act = (a, r) => ask(null, async () => {
    if (a === 'ok') { await papi(`/v2/groups/${r.groupId}/confirm`, { method: 'POST', body: { pid: r.pid, confirmed: true } }); toast('Підтверджено', 2000); reload(); }
    else if (a === 'check') { const x = await papi(`/products/${r.pid}/check`, { method: 'POST' }); toast(x.ok ? `Ціна оновлена: ${x.after == null ? '—' : money(x.after, 0) + ' ₴'}` : `Не вдалося прочитати: ${x.error || 'помилка'}`, 4000); reload(); }
    else if (a === 'price') {
      const v = window.prompt('Ціна, ₴ (за всю упаковку):', r.their.price || '');
      if (v == null || !String(v).trim()) return;
      await papi(`/products/${r.pid}/price`, { method: 'POST', body: { price: v } }); toast('Ціну збережено', 2000); reload();
    } else if (a === 'del') {
      if (!window.confirm(`Прибрати пару «${r.our.name}» ↔ «${r.their.name}»?`)) return;
      await papi(`/groups/${r.groupId}/members/${r.pid}`, { method: 'DELETE' }); toast('Пару прибрано', 2000); reload();
    } else if (a === 'move') ptMove(r, kind, reload);
    else if (a === 'find') ptFind(r, reload);
  });

  $('#pq').oninput = (e) => { S.q = e.target.value; draw(); };
  $('#psite').onchange = (e) => { S.site = e.target.value; draw(); };
  $('#psec').onchange = (e) => { S.section = e.target.value; draw(); };
  $('#pst').onchange = (e) => { S.status = e.target.value; draw(); };
  if ($('#pdiff')) $('#pdiff').onchange = (e) => { S.diff = e.target.value; draw(); };
  document.querySelectorAll('#pbody ~ *').forEach(() => {});
  app.querySelectorAll('th.s').forEach((th) => (th.onclick = () => { S.dir = S.sort === th.dataset.s ? -S.dir : 1; S.sort = th.dataset.s; draw(); }));
  $('#padd').onclick = () => ptAdd(data, kind, reload);
  $('#pcsv').onclick = () => {
    const list = view();
    const head = ['Наш товар', 'Фасування', 'Наша ціна, ₴', 'Наша ціна за л/кг', isVs ? 'Продукт конкурента' : 'Назва у партнера', 'Сайт', 'Фасування (сайт)', 'Ціна, ₴', 'Ціна за л/кг', 'Різниця, % (+ ми дорожчі)', 'Оновлено', 'Стан', 'Посилання', 'Список'];
    ptCsv(`${isVs ? 'наші-vs-конкуренти' : 'наші-у-партнерів'}_${new Date().toISOString().slice(0, 10)}.csv`, head, list.map((r) => [
      r.our.name, r.our.pack, r.our.price, r.our.unit, r.their.name, r.their.site, r.their.pack, r.their.price, r.their.unit, r.diffPct, ptDay(r.their.checkedAt),
      r.status === 'ok' ? (r.confirmed ? 'Підтверджено' : 'Ок') : r.status === 'check' ? 'Перевірте' : 'Помилка', r.their.url, r.source && r.source.list]));
  };
  draw();
}

// re-map a pair to another of our products
function ptMove(r, kind, reload) {
  const data = { ourProducts: [] };
  papi(kind === 'analog' ? '/pairs/competitors' : '/pairs/partners').then((d) => {
    const m = ptModal('Інший наш товар для цієї пари', `<p>Сторінка: <b>${esc(r.their.name)}</b> (${esc(r.their.site)})<br>Зараз порівнюється з: <b>${esc(r.our.name)}${r.our.pack ? ' · ' + esc(r.our.pack) : ''}</b></p>
      <label class="tk-field"><span class="tk-l">Порівнювати з нашим товаром</span><select id="pm-to">${d.ourProducts.map((o) => `<option value="${esc(o.groupId)}" ${o.groupId === r.groupId ? 'selected' : ''}>${esc(o.name)}${o.pack ? ' · ' + esc(o.pack) : ''}</option>`).join('')}</select></label>
      <div class="tk-actions"><button class="tk-primary" id="pm-go">Перенести пару</button></div>`);
    m.el.querySelector('#pm-go').onclick = () => ask(null, async () => {
      const to = m.el.querySelector('#pm-to').value;
      if (to === r.groupId) { m.close(); return; }
      await papi(`/groups/${to}/move`, { method: 'POST', body: { from: r.groupId, pid: r.pid, kind } });
      m.close(); toast('Пару перенесено', 2500); reload();
    });
  }).catch(() => {});
  void data;
}

// look for another page of this competitor product (the first guess was wrong) and replace the pair
function ptFind(r, reload) {
  const m = ptModal('Знайти іншу сторінку конкурента', `<p>Наш товар: <b>${esc(r.our.name)}${r.our.pack ? ' · ' + esc(r.our.pack) : ''}</b><br>Зараз: <b>${esc(r.their.name)}</b> (${esc(r.their.site)})</p>
    <div class="bar"><input class="grow" id="pf-q" value="${esc((r.their.name || '').replace(/^(Фунгіцид|Інсектицид|Гербіцид|Протруйник|Біостимулятор)\s+/i, ''))}"><button class="btn primary" id="pf-go">Шукати на сайтах</button></div>
    <div id="pf-res" class="muted">Змініть назву за потреби й натисніть «Шукати». Це кілька секунд.</div>`, { wide: true });
  const res = m.el.querySelector('#pf-res');
  m.el.querySelector('#pf-go').onclick = () => ask(null, async () => {
    res.textContent = 'Шукаю…';
    const out = await papi(`/groups/${r.groupId}/search`, { method: 'POST', body: { query: m.el.querySelector('#pf-q').value } });
    if (!out.results.length) { res.textContent = 'Нічого не знайдено. Спробуйте іншу назву.'; return; }
    res.innerHTML = `<div class="tw"><table><thead><tr><th>Знайдено</th><th class="n">Ціна</th><th>Сайт</th><th></th></tr></thead><tbody>${out.results.map((x, i) => `<tr><td><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>${x.pack ? ` <span class="muted small">${esc(x.pack)}</span>` : ''}</td><td class="n">${x.price == null ? '—' : money(x.price, 0) + ' ₴'}</td><td>${esc(x.site)}</td><td><button class="btn sm primary" data-i="${i}">Замінити на цю</button></td></tr>`).join('')}</tbody></table></div>`;
    res.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => ask(null, async () => {
      const pick = out.results[Number(b.dataset.i)];
      await papi(`/groups/${r.groupId}/members`, { method: 'POST', body: { url: pick.url, kind: 'analog' } });
      if (pick.url !== r.their.url) await papi(`/groups/${r.groupId}/members/${r.pid}`, { method: 'DELETE' });
      m.close(); toast('Сторінку замінено', 2500); reload();
    })));
  });
}

// add one pair by hand: our product + a page URL
function ptAdd(data, kind, reload) {
  const isVs = kind === 'analog';
  const m = ptModal(isVs ? 'Додати конкурента за посиланням' : 'Додати наш товар у партнера за посиланням', `<label class="tk-field"><span class="tk-l">Наш товар</span><select id="pa-g">${data.ourProducts.map((o) => `<option value="${esc(o.groupId)}">${esc(o.name)}${o.pack ? ' · ' + esc(o.pack) : ''}</option>`).join('')}</select></label>
    <label class="tk-field"><span class="tk-l">${isVs ? 'Посилання на сторінку товару конкурента' : 'Посилання на наш товар на сайті партнера'}</span><input id="pa-u" placeholder="https://…"></label>
    <p class="muted small">Ціну й фасування система прочитає зі сторінки сама. Новий сайт зареєструється автоматично.</p>
    <div class="tk-actions"><button class="tk-primary" id="pa-go">Додати</button></div>`);
  m.el.querySelector('#pa-go').onclick = () => ask(null, async () => {
    const url = m.el.querySelector('#pa-u').value.trim();
    if (!url) throw new Error('Вставте посилання');
    await papi(`/groups/${m.el.querySelector('#pa-g').value}/members`, { method: 'POST', body: { url, kind } });
    m.close(); toast('Пару додано', 2500); reload();
  });
}

// ---------------------------------------------------------------- insights (tab 1)
async function ptInsights() {
  const d = await papi('/insights');
  const t = d.totals;
  const tile = (l, v, s, cls) => `<div class="card kpi ${cls || ''}"><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="l">${s}</div>` : ''}</div>`;
  const link = (hash, text) => `<a href="${hash}">${text} →</a>`;
  const empty = '<p class="muted">Поки порожньо.</p>';
  app.innerHTML = `<h1>Інсайти</h1>
    <p class="muted" style="margin:0 0 10px">Короткі висновки з усіх цін. Ціни оновлено: <b>${esc(ptDay(d.lastRefresh))}</b>. Свіжі ціни — кнопка «Оновити ціни» угорі.</p>
    <div class="grid kp">
      ${tile('Наших товарів (фасувань)', t.ourProducts)}
      ${tile('З цінами конкурентів', t.withCompetitors, `${t.competitorPairs} пар`, t.withCompetitors ? '' : 'warn')}
      ${tile('Є у партнерів', t.withPartners, `${t.partnerPairs} пар`)}
      ${tile('KPI: у межах допуску', `${d.kpi.within} з ${d.kpi.checked}`, d.kpi.checked ? `${Math.round((d.kpi.within / d.kpi.checked) * 100)}% товарів, які порівняли з партнером` : 'ще немає перевірених пар із партнерами', d.kpi.checked && d.kpi.within < d.kpi.checked ? 'warn' : 'good')}
      ${tile('Дорожчі за партнера понад допуск', d.dearerPartners.count, `ми найдешевші: ${d.cheaperThanPartners} · на рівні: ${d.parityPartners}`, d.dearerPartners.count ? 'warn' : 'good')}
      ${tile('Ми дорожчі на 10%+', d.pricier.count, 'проти найдешевшого конкурента', d.pricier.count ? 'bad' : 'good')}
      ${tile('Потребують уваги', d.unconfirmed, `${d.stale} із застарілою ціною`, d.unconfirmed ? 'warn' : 'good')}
    </div>
    ${d.ownSuspects && d.ownSuspects.length ? `<div class="card" style="margin-top:14px"><h2>Наші сторінки з підозрілою ціною чи фасуванням (${d.ownSuspects.length})</h2>
      <p class="muted small" style="margin:0 0 8px">Ціна на сторінці не збігається з фасуванням у її адресі, тому порівняння з нею хибні. Пари для цих товарів позначено «Перевірте» й не враховано в підсумках. Виправте сторінку в магазині, і ціни перерахуються.</p>
      <div class="tw"><table><thead><tr><th>Товар</th><th>Фасування</th><th class="n">Ціна</th><th>Що не так</th></tr></thead><tbody>
      ${d.ownSuspects.map((x) => `<tr><td><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b></a></td><td>${esc(x.pack)}</td><td class="n">${money(x.price, 2)} ₴</td><td class="small">${esc(x.why)}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    <div class="card" style="margin-top:14px"><h2>По категоріях</h2>
      <p class="muted small" style="margin:0 0 8px">Скільки наших товарів уже має пари з продавцями чи конкурентами, і де ми дорожчі. Клацніть на число, щоб побачити пари цієї категорії.</p>
      <div class="tw"><table><thead><tr><th>Категорія</th><th class="n">Наших товарів</th><th class="n">На складі</th><th class="n">Є партнер</th><th class="n">Є конкурент</th><th class="n">Ще без пари</th><th class="n" title="KPI: наскільки можна бути дорожчими за партнера (той самий товар, та сама упаковка). Змініть число, і підсумки перерахуються.">Допуск, % (KPI)</th><th class="n">У межах допуску</th><th class="n">Поза допуском</th><th class="n">Дорожчі за конкурента (10%+)</th></tr></thead><tbody>
        ${d.bySection.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="n">${s.ours}</td><td class="n">${s.inStock}</td>
          <td class="n">${s.withPartner ? `<a href="#/partners?section=${encodeURIComponent(s.name)}">${s.withPartner}</a>` : '0'} <span class="muted small">${s.ours ? Math.round((s.withPartner / s.ours) * 100) : 0}%</span></td>
          <td class="n">${s.withCompetitor ? `<a href="#/vs?section=${encodeURIComponent(s.name)}">${s.withCompetitor}</a>` : '0'} <span class="muted small">${s.ours ? Math.round((s.withCompetitor / s.ours) * 100) : 0}%</span></td>
          <td class="n ${s.bare ? 'warn' : ''}">${s.bare}</td><td class="n"><input class="pm" type="number" min="0" max="100" step="0.5" data-sec="${esc(s.name)}" value="${s.limit}" style="width:64px" aria-label="Допуск у відсотках для категорії ${esc(s.name)}"></td><td class="n">${s.withinLimit} з ${s.checked}</td><td class="n ${s.dearerThanPartner ? 'warn' : ''}">${s.dearerThanPartner}</td><td class="n">${s.dearerThanCompetitor}</td></tr>`).join('')}
        <tr><td><b>Разом</b></td><td class="n"><b>${d.totals.ourProducts}</b></td><td class="n"><b>${d.bySection.reduce((a, s) => a + s.inStock, 0)}</b></td><td class="n"><b>${d.totals.withPartners}</b></td><td class="n"><b>${d.totals.withCompetitors}</b></td><td class="n"><b>${d.bySection.reduce((a, s) => a + s.bare, 0)}</b></td><td class="n"></td><td class="n"><b>${d.kpi.within} з ${d.kpi.checked}</b></td><td class="n"><b>${d.bySection.reduce((a, s) => a + s.dearerThanPartner, 0)}</b></td><td class="n"><b>${d.pricier.count}</b></td></tr>
      </tbody></table></div></div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Де ми дорожчі за партнерів</h2>
        <p class="muted small" style="margin:0 0 8px">Той самий товар у тій самій упаковці на сайті партнера. Показуємо, де наша ціна вища за допуск (KPI) категорії; число допуску можна змінити в таблиці «По категоріях». Рахуємо лише перевірені пари, де товар є в наявності.</p>
        ${d.dearerPartners.count ? `<div class="tw"><table><thead><tr><th>Наш товар</th><th class="n">Наша ціна</th><th>Найдешевший партнер</th><th class="n">Різниця</th></tr></thead><tbody>${d.dearerPartners.top.map((x) => `<tr class="click" data-go="#/partners?gid=${esc(x.groupId)}"><td><b>${esc(x.name)}</b>${x.pack ? ` <span class="muted small">· ${esc(x.pack)}</span>` : ''}<div class="muted small">${esc(x.section || '')}</div></td><td class="n">${money(x.ours)} ${esc(x.unit || '')}</td><td>${esc(x.site)}<div class="muted small">${money(x.theirs)} ${esc(x.unit || '')}</div></td><td class="n pos"><b>+${x.diffPct.toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%</b><div class="muted small">допуск ${x.limit}%</div></td></tr>`).join('')}</tbody></table></div><p style="margin:8px 0 0">${link('#/partners', `Усі ${d.dearerPartners.count}`)}</p>` : '<p class="muted">Немає товарів, де ми дорожчі за партнера більше за допуск.</p>'}</div>
      <div class="card"><h2>Де ми дорожчі за конкурентів</h2>
        ${d.pricier.count ? `<div class="tw"><table><thead><tr><th>Наш товар</th><th class="n">Наша ціна</th><th>Найдешевший конкурент</th><th class="n">Різниця</th></tr></thead><tbody>${d.pricier.top.map((x) => `<tr class="click" data-go="#/vs?gid=${esc(x.groupId)}"><td><b>${esc(x.name)}</b>${x.pack ? ` <span class="muted small">· ${esc(x.pack)}</span>` : ''}</td><td class="n">${money(x.ours)} ${esc(x.unit || '')}</td><td>${esc(x.cheapestName || '')} <span class="muted small">${esc(x.cheapestSite || '')}</span><div class="muted small">${money(x.cheapest)} ${esc(x.unit || '')}</div></td><td class="n pos"><b>+${x.diffPct.toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%</b></td></tr>`).join('')}</tbody></table></div><p style="margin:8px 0 0">${link('#/vs?diff=pricier', `Усі ${d.pricier.count}`)}</p>` : '<p class="muted">Немає товарів, де ми дорожчі за найдешевшого конкурента більше ніж на 10%.</p>'}
        <p class="muted small" style="margin:8px 0 0">Ми найдешевші: <b>${d.cheapest}</b> · на рівні: <b>${d.parity}</b></p></div>
      <div class="card"><h2>Немає жодної конкурентної ціни</h2>
        ${d.noCompetitors.count ? `<p style="margin:0 0 6px">Таких наших товарів: <b>${d.noCompetitors.count}</b>. Спершу ті, що в нас на складі:</p><div class="tw"><table><tbody>${d.noCompetitors.top.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.pack ? ` <span class="muted small">· ${esc(x.pack)}</span>` : ''}</td><td class="n muted">${x.stock == null ? '' : 'залишок ' + money(x.stock, 0)}</td></tr>`).join('')}</tbody></table></div><p style="margin:8px 0 0">${link('#/bases/analogs', 'Додати конкурентів: імпорт з Excel')}</p>` : '<p class="muted">У кожного нашого товару є конкурентні ціни.</p>'}</div>
      <div class="card"><h2>Що змінилось за 7 днів</h2>${d.movers.length ? `<div class="tw"><table><tbody>${d.movers.map((x) => `<tr class="click" data-go="#/${x.kind === 'analog' ? 'vs' : 'partners'}?gid=${esc(x.groupId)}"><td>${esc(x.ours)}<div class="muted small">${esc(x.name)} · ${esc(x.site)}</div></td><td class="n">${money(x.price, 0)} ₴</td><td class="n ${x.change7 > 0 ? 'pos' : 'neg'}"><b>${x.change7 > 0 ? '+' : '−'}${Math.abs(x.change7)}%</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Різких змін цін (5% і більше) не було. Історія накопичується з кожним оновленням цін.</p>'}</div>
      <div class="card"><h2>Увага</h2><ul class="plain">
        <li>Пар, що потребують перевірки: <b>${d.unconfirmed}</b> ${d.unconfirmed ? link('#/vs?status=check', 'переглянути') : ''}</li>
        <li>Цін, які не оновлювались або не прочитані: <b>${d.stale}</b></li>
        <li>Наших товарів без партнерів: <b>${d.noPartners}</b> ${link('#/partners', 'партнери')}</li></ul></div>
    </div>`;
  ptBindKpi();
}

// KPI inputs of the «По категоріях» table: a changed number is saved and the totals are recalculated.
function ptBindKpi() {
  app.querySelectorAll('input.pm').forEach((inp) => {
    inp.onchange = async () => {
      const v = Number(inp.value);
      if (!Number.isFinite(v) || v < 0 || v > 100) { toast('Допуск: число від 0 до 100', 3500); return; }
      try { await papi('/settings', { method: 'POST', body: { partnerMax: { [inp.dataset.sec]: v } } }); toast('Допуск збережено', 2000); ptInsights(); } catch (e) { toast(e.message || 'Не вдалося зберегти', 3500); }
    };
  });
}

// ---------------------------------------------------------------- import (tab 4)
const impTab = { sub: 'lists' };
async function ptImport() {
  const h = ptHash();
  const sub = ['lists', 'map', 'find', 'sites'].includes(h.path.split('/')[2]) ? h.path.split('/')[2] : impTab.sub;
  impTab.sub = sub;
  const tabs = [['lists', '1. Списки з Excel'], ['map', '2. Зіставити товари'], ['find', '3. Знайти ціни'], ['sites', 'Сайти для пошуку']];
  app.innerHTML = `<h1>Імпорт</h1>
    <p class="muted" style="margin:0 0 10px">Усе, що ви тут імпортуєте й підтвердите, потрапляє у вкладку «Наші товари vs. конкуренти». Можна завантажити кілька Excel і додавати нові; хибну пару легко виправити у вкладці «Наші товари vs. конкуренти».</p>
    <div class="pills" id="itabs">${tabs.map(([k, t]) => `<a class="pill ${sub === k ? 'on' : ''}" href="#/import/${k}" style="text-decoration:none">${t}</a>`).join('')}</div><div id="ibody"></div>`;
  const box = $('#ibody');
  if (sub === 'map') await v2Mapping(box);
  else if (sub === 'find') importBox(box);
  else if (sub === 'sites') await v2Sellers(box);
  else await ptLists(box);
}

async function ptLists(box) {
  const { lists } = await papi('/lists');
  box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Списки конкурентів (Excel)</h2>
    <p style="margin:0 0 8px">Файл Excel із такими колонками: <b>A</b> — напрям (наприклад, FUNGICIDES), <b>B</b> — продукт Syngenta, <b>C</b> — тип (<i>Product Name</i> для нашої повної назви, <i>Competitor …</i> для конкурента), <b>D</b> — назва, <b>E</b> — відповідальний (необов'язково). Можна завантажувати кілька файлів: нові рядки додаються до наявних.</p>
    ${lists.length ? `<div class="tw"><table><thead><tr><th>Список</th><th>Файл</th><th>Додано</th><th class="n">Груп</th><th class="n">Конкурентів</th><th class="n">Пар у цінах</th><th></th></tr></thead><tbody>${lists.map((l) => `<tr data-id="${esc(l.id)}"><td><b>${esc(l.name)}</b></td><td class="muted small">${esc(l.file || '')}</td><td class="nowrap">${esc(ptDay(l.at))}</td><td class="n">${l.groups}</td><td class="n">${l.competitors}</td><td class="n">${l.pairs}</td>
      <td class="nowrap"><a class="btn sm" href="#/import/map">Зіставити</a> <button class="btn sm" data-roll title="Прибрати з цін усі пари, додані з цього списку">Відкотити пари</button> <button class="btn sm danger" data-del>Видалити список</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Списків ще немає.</p>'}
    </div>
    <div class="card"><h2>Завантажити новий Excel</h2>
      <div class="bar"><input id="lname" placeholder="Назва списку (наприклад, GainLoss осінь 2026)" class="grow"><input type="file" id="lfile" accept=".xlsx"><button class="btn primary" id="lgo">Завантажити</button></div>
      <p class="muted small" style="margin:6px 0 0">Після завантаження перейдіть до кроку «2. Зіставити товари».</p></div>`;
  box.querySelectorAll('[data-roll]').forEach((b) => (b.onclick = () => {
    const id = b.closest('tr').dataset.id;
    const l = lists.find((x) => x.id === id);
    if (!window.confirm(`Прибрати з цін усі пари зі списку «${l.name}» (${l.pairs})? Сам список залишиться, пошук можна повторити.`)) return;
    ask(null, async () => { const r = await papi(`/lists/${id}/rollback`, { method: 'POST' }); toast(`Прибрано пар: ${r.removed}`, 3000); ptLists(box); });
  }));
  box.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
    const id = b.closest('tr').dataset.id;
    const l = lists.find((x) => x.id === id);
    if (!window.confirm(`Видалити список «${l.name}» разом із зіставленнями? Пари, що вже в цінах, залишаться (їх можна відкотити окремо).`)) return;
    ask(null, async () => { await papi(`/lists/${id}`, { method: 'DELETE' }); toast('Список видалено', 2500); ptLists(box); });
  }));
  $('#lgo').onclick = () => ask(null, async () => {
    const f = $('#lfile').files[0];
    if (!f) throw new Error('Оберіть файл .xlsx');
    if (f.size > 4 * 1024 * 1024) throw new Error('Файл завеликий (понад 4 МБ)');
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const r = await papi('/lists', { method: 'POST', body: { name: $('#lname').value, fileName: f.name, file: btoa(bin) } });
    toast(`Список додано: ${r.list.groups} груп, ${r.list.competitors} конкурентів`, 5000);
    location.hash = '#/import/map';
  });
}

// ---------------------------------------------------------------- router
window.v2Route = async (h) => {
  const { path } = ptHash();
  if (path === '/' || path === '') await ptInsights();
  else if (path === '/partners') await ptPairsTab('same');
  else if (path === '/vs') await ptPairsTab('analog');
  else if (path.startsWith('/import')) await ptImport();
  else if (/^\/p\/.+/.test(path)) { location.hash = `#/vs?gid=${path.slice(3)}`; }
  else if (path === '/s') location.hash = '#/import/sites';
  else if (path === '/i' || path === '/m') location.hash = '#/import/map';
  else location.hash = '#/';
  return true;
};
