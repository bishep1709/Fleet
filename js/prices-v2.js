'use strict';
// v2 prototype: Головна · Товари · Продавці · Конкуренти · Звірка.
// One model: our product → its page at another seller (ціна в наших продавців) and → competitor products.
// Every link has a verdict (✓ зійшлося / ⚠ перевірте / ✕ помилка), so it is obvious that everything matches.

const v2s = { q: '', section: '', filter: 'all', limit: 150, fill: null };

const vChip = (a) => {
  if (a.status === 'ok') return '<span class="chip good" title="' + esc(a.reasons.map((r) => r.t).join('\n')) + '">✓ зійшлося</span>';
  const txt = a.reasons.filter((r) => r.level !== 'info').map((r) => r.t).join('\n');
  return a.status === 'error'
    ? '<span class="chip bad" title="' + esc(txt) + '">✕ помилка</span>'
    : '<span class="chip warn" title="' + esc(txt) + '">⚠ перевірте</span>';
};
const vReasons = (a) => {
  const rs = a.reasons.filter((r) => r.level !== 'info');
  return rs.length ? '<div class="small muted">' + rs.map((r) => esc(r.t)).join('<br>') + '</div>' : '';
};

// ================= Товари =================
async function v2Products() {
  const data = await papi('/v2/products');
  const rows = data.rows;
  const count = (f) => rows.filter(f).length;
  app.innerHTML = `
    <div class="bar" style="align-items:baseline"><h1 class="grow" style="margin:0">Наші товари</h1>
      <button class="btn primary" id="vadd">+ Додати наш товар</button></div>
    ${about('v2p', '<b>Що це.</b> Усі наші товари в одній таблиці: наша ціна, ціна цього ж товару в <b>наших продавців</b> і ціна <b>продуктів-конкурентів</b>, з різницею. Колонка «Зв\'язок» показує, чи все зійшлося: <span class="chip good">✓ зійшлося</span> — звʼязані сторінки перевірені; <span class="chip warn">⚠ перевірте</span> — є сумнів (фасування, назва, застаріла ціна); «не звʼязано» — для товару ще нічого не додано. <b>Як користуватись.</b> Клікніть товар: у картці додаються продавці та конкуренти.')}
    <div id="vaddbox"></div>
    <div class="pills" id="vsec">${['', ...data.sections].map((s) => `<button class="pill ${s === v2s.section ? 'on' : ''}" data-s="${esc(s)}">${esc(s || 'Усі розділи')}</button>`).join('')}</div>
    <div class="bar">
      <input class="grow" id="vq" placeholder="Пошук товару…" value="${esc(v2s.q)}">
      <div class="pills" id="vflt" style="margin:0">
        ${[['all', 'Усі', rows.length], ['ok', '✓ Зійшлося', count((r) => r.link === 'ok')], ['check', '⚠ Перевірити', count((r) => r.link === 'check')], ['none', 'Не звʼязані', count((r) => r.link === 'none')]]
          .map(([k, t, n]) => `<button class="pill ${v2s.filter === k ? 'on' : ''}" data-f="${k}">${t} <span class="muted">${n}</span></button>`).join('')}
      </div>
      <span class="muted" id="vcount"></span>
    </div>
    <div class="card"><div class="tw"><table class="vt">
      <thead><tr><th>Наш товар</th><th class="n">Наша ціна</th><th>Ціна в наших продавців</th><th>Продукти-конкуренти</th><th>Зв'язок</th></tr></thead>
      <tbody id="vbody"></tbody></table>
      <div class="bar" style="margin-top:10px"><button class="btn" id="vmore" hidden>Показати ще</button></div></div></div>`;

  const cellS = (S) => (!S.count ? '<span class="muted">—</span>'
    : `<b>${S.count}</b> ${S.min != null ? '· від ' + money(S.min, 0) + ' ' + (S.diffPct != null ? weText(S.diffPct) : '') : '<span class="muted">без ціни</span>'}`);
  const cellC = (C) => (!C.count ? '<span class="muted">—</span>'
    : `<b>${C.count}</b> ${C.min != null ? '· від ' + money(C.min, 0) + ' ' + (C.diffPct != null ? theyText(C.diffPct) : '') : '<span class="muted">без ціни</span>'}`);
  const linkCell = (r) => (r.link === 'none' ? '<span class="muted">не звʼязано</span>'
    : r.link === 'ok' ? '<span class="chip good">✓ зійшлося</span>'
      : `<span class="chip warn">⚠ перевірте: ${r.issues}</span>`);

  const draw = () => {
    let list = rows;
    if (v2s.section) list = list.filter((r) => r.section === v2s.section);
    if (v2s.q) { const q = v2s.q.toLowerCase(); list = list.filter((r) => r.name.toLowerCase().includes(q)); }
    if (v2s.filter !== 'all') list = list.filter((r) => r.link === v2s.filter);
    $('#vcount').textContent = list.length + ' товарів';
    const shown = list.slice(0, v2s.limit);
    $('#vmore').hidden = list.length <= v2s.limit;
    $('#vbody').innerHTML = shown.map((r) => `<tr class="click" data-go="#/p/${r.groupId}">
      <td><b>${esc(r.name)}</b>${r.pack ? ' <span class="muted">· ' + esc(r.pack) + '</span>' : ''}<div class="muted small">${esc(r.section || '')}${r.stock != null ? ' · залишок ' + money(r.stock, 0) : ''}</div></td>
      <td class="n"><b>${money(r.price, 0)}</b>${r.unit != null ? '<div class="muted small">' + money(r.unit, 0) + ' ' + esc(r.unitLabel || '') + '</div>' : ''}</td>
      <td>${cellS(r.sellers)}</td><td>${cellC(r.comps)}</td><td>${linkCell(r)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Нічого не знайдено</td></tr>';
  };
  app.querySelectorAll('#vsec .pill').forEach((b) => (b.onclick = () => { v2s.section = b.dataset.s; v2Products(); }));
  app.querySelectorAll('#vflt .pill').forEach((b) => (b.onclick = () => { v2s.filter = b.dataset.f; v2s.limit = 150; v2Products(); }));
  $('#vq').oninput = (e) => { v2s.q = e.target.value; v2s.limit = 150; draw(); };
  $('#vmore').onclick = () => { v2s.limit += 200; draw(); };

  $('#vadd').onclick = () => {
    const box = $('#vaddbox');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Додати наш товар</h2>
      <div class="grid g2">
        <div><b>За посиланням на сторінку нашого магазину</b>
          <div class="bar" style="margin-top:6px"><input class="grow" id="vown-url" placeholder="https://store.syngenta.ua/product/…"><button class="btn primary" id="vown-go">Додати</button></div>
          <p class="hint">Назва, ціна й фасування зчитаються зі сторінки. Новий товар зʼявляється й сам при кожному оновленні каталогу.</p></div>
        <div><b>Вручну</b>
          <div class="bar" style="margin-top:6px"><input class="grow" id="vown-name" placeholder="Назва"><input id="vown-pack" placeholder="Фасування, напр. 5 л" size="14"><input id="vown-price" placeholder="Ціна, ₴" size="9"><button class="btn" id="vown-man">Додати</button></div>
          <p class="hint">Для товару, якого нема на сайті (наприклад, нова позиція).</p></div>
      </div></div>`;
    const done = (r) => { toast(r.existed ? 'Цей товар уже є' : 'Додано', 3000); location.hash = '#/p/' + r.groupId; };
    $('#vown-go').onclick = () => ask(null, async () => { done(await papi('/v2/own', { method: 'POST', body: { url: $('#vown-url').value.trim() } })); });
    $('#vown-man').onclick = () => ask(null, async () => { done(await papi('/v2/own', { method: 'POST', body: { name: $('#vown-name').value, pack: $('#vown-pack').value, price: $('#vown-price').value } })); });
  };
  draw();
}

// ================= Картка товару =================
async function v2Card(gid) {
  const c = await papi('/v2/product/' + gid);
  const metric = esc(c.metric || '₴');
  const sumLine = (s, label) => {
    if (!s.count) return `<span class="muted">${label}: не додано</span>`;
    const parts = [`${label}: ${s.count}`];
    if (s.ok) parts.push(`<span class="chip good">✓ ${s.ok}</span>`);
    if (s.check) parts.push(`<span class="chip warn">⚠ ${s.check}</span>`);
    if (s.error) parts.push(`<span class="chip bad">✕ ${s.error}</span>`);
    return parts.join(' ');
  };

  // price ladder: where our price stands among all linked pages (per litre/kg when possible)
  const maxV = Math.max(...c.ladder.map((l) => l.value), 1);
  const ladder = c.ladder.length > 1 ? `<div class="ladder">${c.ladder.map((l) => `
      <div class="lrow ${l.kind}"><span class="llab" title="${esc(l.label)}">${esc(l.label)}</span>
        <span class="lbar"><span style="width:${Math.max(3, (l.value / maxV) * 100)}%"></span></span>
        <span class="lval">${money(l.value, 0)} ${metric}</span></div>`).join('')}</div>
    <p class="hint"><span class="dot own"></span> наша ціна · <span class="dot seller"></span> наш товар у продавця · <span class="dot comp"></span> продукт-конкурент. Від дешевшого до дорожчого.</p>` : '<p class="muted">Щоб побачити порівняння цін, додайте хоча б одну сторінку продавця чи конкурента.</p>';

  const row = (m, kind) => `<tr>
      <td>${esc(m.site)}</td>
      <td><a href="${esc(m.url)}" target="_blank" rel="noopener" title="Відкрити сторінку для перевірки">${esc(m.name)} ↗</a>${m.brand ? ' <span class="muted small">' + esc(m.brand) + '</span>' : ''}${vReasons(m)}</td>
      <td>${esc(m.pack || '—')}${m.packAssumed ? ' <span class="muted small">(припущено)</span>' : ''}</td>
      <td class="n">${m.price == null ? '—' : money(m.price)}${availBadge(m.avail)}${blockedBadge(m)}</td>
      <td class="n">${m.unit == null ? '—' : money(m.unit) + ' <span class="muted small">' + esc(m.unitLabel || '') + '</span>'}</td>
      <td class="n">${kind === 'same' ? weText(m.diffPct) : theyText(m.diffPct)}</td>
      <td>${vChip(m)}</td>
      <td class="nowrap">${m.status !== 'ok' ? `<button class="btn sm primary" data-confirm="${m.pid}" title="Я перевірив: це правильна пара">✓ Підтвердити</button> ` : ''}<button class="btn sm" data-check="${m.pid}" title="Перечитати ціну зараз">⟳</button>
        <button class="btn sm" data-price="${m.pid}" title="Ввести ціну вручну">₴</button>
        <button class="btn sm" data-flip="${m.pid}" data-to="${kind === 'same' ? 'analog' : 'same'}" title="${kind === 'same' ? 'Це конкурентний продукт, а не наш товар' : 'Це наш товар у продавця, а не конкурент'}">${kind === 'same' ? '→ конкурент' : '→ продавець'}</button>
        <button class="btn sm danger" data-rm="${m.pid}" title="Прибрати зв'язок">✕</button></td></tr>`;
  const table = (list, kind, empty) => (list.length
    ? `<div class="tw"><table><thead><tr><th>${kind === 'same' ? 'Продавець' : 'Де продається'}</th><th>Назва на сайті (клік — відкрити)</th><th>Фасування</th><th class="n">Ціна, ₴</th><th class="n">За од.</th><th class="n">Порівняно з нами</th><th>Зв'язок</th><th></th></tr></thead><tbody>${list.map((m) => row(m, kind)).join('')}</tbody></table></div>`
    : `<p class="muted">${empty}</p>`);

  const addPanel = (kind) => `<details class="add" ${(kind === 'same' ? c.sellers : c.comps).length ? '' : 'open'}><summary>+ Додати ${kind === 'same' ? 'сторінку нашого товару в продавця' : 'продукт-конкурент'}</summary>
      <div class="bar"><input class="grow" id="u-${kind}" placeholder="Посилання на сторінку товару (https://…)"><button class="btn primary" data-addurl="${kind}">Додати</button></div>
      <div class="bar"><input class="grow" id="q-${kind}" placeholder="${kind === 'same' ? 'Шукати за назвою на сайтах продавців (порожньо — за нашим товаром)' : 'Назва конкурентного продукту, напр. «Фалькон»'}"><button class="btn" data-search="${kind}">Шукати на сайтах</button></div>
      <div id="r-${kind}" class="cands"></div></details>`;

  app.innerHTML = `
    <p><a href="#/p">← Усі товари</a></p>
    <div class="bar"><h1 class="grow" style="margin:0">${esc(c.name)}${c.pack ? ' <span class="muted">· ' + esc(c.pack) + '</span>' : ''}</h1>
      ${c.url && !String(c.url).startsWith('manual:') ? `<a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">Наша сторінка ↗</a>` : ''}</div>
    ${about('v2c', '<b>Що це.</b> Картка одного нашого товару. Зверху: наша ціна й порівняння з усіма звʼязаними сторінками. Нижче два блоки: <b>наш товар у наших продавців</b> (контроль ціни) і <b>продукти-конкуренти</b> (відносно них позиціонуємо ціну). У кожного звʼязку є вердикт: ✓ зійшлося, ⚠ перевірте (є сумнів, натисніть «Підтвердити», якщо все вірно) або ✕ помилка.')}
    <div class="grid g3">
      <div class="card kpi"><div class="l">Наша ціна</div><div class="v">${money(c.price)} <span class="muted small">₴</span></div>
        <div class="l">${c.unit != null ? money(c.unit) + ' ' + esc(c.unitLabel || '') + ' · ' : ''}${c.stock != null ? 'залишок ' + money(c.stock, 0) + ' ' + esc(c.stockUnit || '') : 'залишок невідомий'}</div></div>
      <div class="card kpi"><div class="l">Чи все зійшлося</div>
        <div style="margin:8px 0;line-height:2">${sumLine(c.summary.sellers, 'Продавці')}<br>${sumLine(c.summary.comps, 'Конкуренти')}</div></div>
      <div class="card kpi"><div class="l">Позиція</div>
        <div style="margin-top:8px">${c.summary.comps.priced ? '<div>Проти конкурентів: ' + theyText(c.summary.comps.diffPct) + '</div>' : '<div class="muted">Конкурентів із ціною ще немає</div>'}
          ${c.summary.sellers.priced ? '<div style="margin-top:6px">Проти продавців: ' + weText(c.summary.sellers.diffPct) + '</div>' : ''}</div></div>
    </div>
    <div class="card" style="margin-top:14px"><h2>Порівняння цін</h2>${ladder}</div>

    <div class="card" style="margin-top:14px"><h2>Ціна в наших продавців <span class="muted small">(наш товар у магазинів і дилерів)</span></h2>
      ${table(c.sellers, 'same', 'Поки немає. Додайте сторінку цього товару на сайті продавця.')}
      ${addPanel('same')}</div>

    <div class="card" style="margin-top:14px"><h2>Продукти-конкуренти <span class="muted small">(продукти інших брендів)</span></h2>
      ${table(c.comps, 'analog', 'Поки немає. Додайте конкурентний продукт (список веде відділ ціноутворення).')}
      ${c.hiddenOwnBrand ? `<p class="hint">Приховано ${c.hiddenOwnBrand} продукт(и) нашого бренду Syngenta: це не конкуренти.</p>` : ''}
      ${addPanel('analog')}</div>`;

  const reload = () => v2Card(gid);
  const add = (url, kind, btn) => ask(null, async () => {
    if (btn) btn.disabled = true;
    try { await papi(`/groups/${gid}/members`, { method: 'POST', body: { url, kind } }); toast('Додано', 2500); await reload(); }
    finally { if (btn) btn.disabled = false; }
  });
  app.querySelectorAll('[data-addurl]').forEach((b) => (b.onclick = () => { const k = b.dataset.addurl; const u = $('#u-' + k).value.trim(); if (u) add(u, k, b); }));
  app.querySelectorAll('[data-search]').forEach((b) => (b.onclick = () => ask(null, async () => {
    const k = b.dataset.search, box = $('#r-' + k);
    b.disabled = true; box.innerHTML = '<p class="muted">Шукаю на сайтах продавців і читаю ціни…</p>';
    try {
      const s = await papi(`/groups/${gid}/search`, { method: 'POST', body: { query: $('#q-' + k).value } });
      box.innerHTML = s.results.length ? s.results.map((r, i) => `<div class="c"><div><b>${esc(r.site)}</b> · <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)} ↗</a><div class="muted small">${esc(r.pack || 'фасування не вказане')}</div></div>
        <div class="n"><b>${money(r.price)}</b> ₴ ${r.already ? '<span class="chip mid">вже додано</span>' : `<button class="btn sm primary" data-pick="${i}">Додати</button>`}</div></div>`).join('') : `<p class="muted">Нічого не знайдено за «${esc(s.query)}». Спробуйте іншу назву або вставте посилання.</p>`;
      box.querySelectorAll('[data-pick]').forEach((x) => (x.onclick = () => add(s.results[x.dataset.pick].url, k, x)));
    } finally { b.disabled = false; }
  })));
  app.querySelectorAll('[data-confirm]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/v2/groups/${gid}/confirm`, { method: 'POST', body: { pid: b.dataset.confirm } }); toast('Підтверджено', 2000); await reload(); })));
  app.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => ask(null, async () => {
    b.disabled = true;
    const x = await papi(`/products/${b.dataset.check}/check`, { method: 'POST' });
    toast(x.error ? 'Помилка: ' + x.error : x.before === x.after ? 'Ціна не змінилась: ' + money(x.after) : `Ціна змінилась: ${money(x.before)} → ${money(x.after)}`, 4000);
    await reload();
  })));
  app.querySelectorAll('[data-price]').forEach((b) => (b.onclick = () => {
    const v = prompt('Ціна на сайті, ₴:');
    if (v == null || !v.trim()) return;
    ask(null, async () => { await papi(`/products/${b.dataset.price}/price`, { method: 'POST', body: { price: v } }); toast('Ціну збережено', 2500); await reload(); });
  }));
  app.querySelectorAll('[data-flip]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/groups/${gid}/members/${b.dataset.flip}`, { method: 'PATCH', body: { kind: b.dataset.to } }); await reload(); })));
  app.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { if (confirm('Прибрати цей звʼязок?')) ask(null, async () => { await papi(`/groups/${gid}/members/${b.dataset.rm}`, { method: 'DELETE' }); await reload(); }); }));
}

// ================= Продавці =================
async function v2Sellers(root) {
  root = root || app;
  const { sellers } = await papi('/v2/sellers');
  const stateChip = (s) => ({
    ok: '<span class="chip good">✓ читається</span>',
    empty: '<span class="chip mid">немає товарів</span>',
    blocked: '<span class="chip warn" title="Сайт відповідає 403: автоматично ціни не читаються">⚠ блокує перевірку</span>',
    errors: '<span class="chip warn">⚠ частина сторінок без ціни</span>',
  }[s.state]);
  root.innerHTML = `
    <h2 style="margin:0 0 8px">Сайти для пошуку цін</h2><p class="muted" style="margin:0 0 10px">Сюди додайте сайти партнерів і конкурентів, на яких система шукатиме ціни. Для партнерів натисніть «Підібрати наші товари»: наші товари з цін на їхньому сайті з’являться у вкладці «Наші товари у партнерів».</p>
    ${about('v2s', '<b>Що це.</b> Сайти наших продавців (магазинів і дилерів). Вони продають і наші товари, і конкурентні: з кожного ми читаємо ціну нашого товару та ціни продуктів-конкурентів. <b>Як користуватись.</b> Введіть домен і натисніть «Перевірити сайт»: ми подивимось, чи читаються ціни. Далі «Додати сайт» і «Підібрати наші товари», щоб одразу звʼязати знайдені сторінки з нашими товарами.')}
    <div class="card"><h2>Додати сайт продавця</h2>
      <div class="bar"><input class="grow" id="sd" placeholder="Домен, напр. agrohim.ua"><button class="btn" id="sprobe">Перевірити сайт</button></div>
      <div id="sres"></div></div>
    <div class="card" style="margin-top:14px"><div class="tw"><table>
      <thead><tr><th>Продавець</th><th class="n">Наших товарів</th><th class="n">Конкурентних</th><th class="n">З ціною / всього</th><th>Останнє читання</th><th>Стан</th><th></th></tr></thead>
      <tbody>${sellers.map((s) => `<tr><td><a href="https://${esc(s.domain)}" target="_blank" rel="noopener"><b>${esc(s.name)}</b> ↗</a><div class="muted small">${esc(s.domain)}</div></td>
        <td class="n">${s.ours}</td><td class="n">${s.competitors}</td><td class="n">${s.priced} / ${s.total}</td>
        <td class="muted">${s.lastRead ? ago(s.lastRead) : '—'}</td><td>${stateChip(s)}</td>
        <td class="nowrap"><button class="btn sm" data-read="${s.id}" title="Перечитати ціни всіх його сторінок">⟳ Прочитати</button>
          <button class="btn sm primary" data-fill="${s.id}">Підібрати наші товари</button>
          <button class="btn sm danger" data-del="${s.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Продавців ще немає</td></tr>'}</tbody></table></div></div>
    <div id="sfill"></div>`;

  $('#sprobe').onclick = () => ask(null, async () => {
    const domain = $('#sd').value.trim();
    if (!domain) throw new Error('Введіть домен');
    const box = $('#sres');
    box.innerHTML = '<p class="muted">Перевіряю сайт: головна сторінка, карта сайту, кілька сторінок товарів…</p>';
    const r = await papi('/v2/sites/probe', { method: 'POST', body: { domain } });
    const good = r.readable > 0;
    box.innerHTML = `<div class="probe ${r.blocked ? 'bad' : good ? 'good' : 'warn'}">
      <b>${r.blocked ? '⚠ Сайт блокує автоматичні запити' : good ? '✓ Сайт читається' : '⚠ Ціни автоматично не прочитались'}</b>
      <div>${esc(r.note)}</div>
      ${r.sample.length ? '<div class="small" style="margin-top:6px">Приклади: ' + r.sample.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a> — ${money(x.price)} ₴`).join('; ') + '</div>' : ''}
      <div class="bar" style="margin-top:10px"><button class="btn primary" id="sadd2">Додати сайт</button></div></div>`;
    $('#sadd2').onclick = () => ask(null, async () => { await papi('/sites', { method: 'POST', body: { domain: r.domain, name: '' } }); toast('Сайт додано', 3000); v2Sellers(root); });
  });
  root.querySelectorAll('[data-read]').forEach((b) => (b.onclick = () => ask(null, async () => {
    b.disabled = true; b.textContent = 'Читаю…';
    const r = await papi('/v2/sites/' + b.dataset.read + '/refresh', { method: 'POST', body: {} });
    toast(`Прочитано ${r.ok} з ${r.total}${r.blocked ? ', заблоковано: ' + r.blocked : ''}`, 5000);
    v2Sellers(root);
  })));
  root.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { if (confirm('Видалити продавця і всі його сторінки зі звʼязків?')) ask(null, async () => { await papi('/sites/' + b.dataset.del, { method: 'DELETE' }); v2Sellers(root); }); }));

  // pick OUR products on this seller; proposals are confirmed by the owner
  const box = $('#sfill');
  const drawFill = (st) => {
    if (!st.siteId) { box.innerHTML = ''; return; }
    if (st.running) { box.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»</h2><p class="muted">${esc(st.phase)}: ${st.done} з ${st.total || '…'}. Це кілька хвилин.</p></div>`; return; }
    if (st.error) { box.innerHTML = `<div class="card err" style="margin-top:14px">${esc(st.error)}</div>`; return; }
    if (!st.proposals.length) { box.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»</h2><p class="muted">Збігів із нашими товарами не знайдено.</p></div>`; return; }
    box.innerHTML = `<div class="card" style="margin-top:14px"><h2>Підбір для «${esc(st.siteName)}»: знайдено ${st.proposals.length}</h2>
      <p class="muted">Нічого не збережено. Відмічено пари, де збіглися назва й фасування. Перевірте і натисніть «Додати вибрані».</p>
      <div class="tw"><table><thead><tr><th></th><th>Товар на сайті продавця</th><th class="n">Ціна</th><th>Фасування</th><th>Наш товар</th></tr></thead><tbody>
      ${st.proposals.map((it, i) => `<tr><td><input type="checkbox" data-i="${i}" ${it.packOk ? 'checked' : ''}></td>
        <td><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)} ↗</a>${availBadge(it.avail)}</td>
        <td class="n">${it.price == null ? '—' : money(it.price)}</td><td>${esc(it.pack || '?')}</td>
        <td><select data-s="${i}">${it.alternatives.map((a) => `<option value="${a.groupId}" ${a.groupId === it.groupId ? 'selected' : ''}>${esc(a.label)}${a.packOk ? ' ✓' : ''}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="bar" style="margin-top:10px"><button class="btn primary" id="fapply">Додати вибрані</button></div></div>`;
    $('#fapply').onclick = () => ask(null, async () => {
      const items = [...box.querySelectorAll('input[type=checkbox]:checked')].map((cb) => ({ groupId: box.querySelector(`select[data-s="${cb.dataset.i}"]`).value, url: st.proposals[Number(cb.dataset.i)].url }));
      if (!items.length) throw new Error('Нічого не відмічено');
      const r = await papi('/autofill/apply', { method: 'POST', body: { items } });
      toast(`Додано: ${r.added}${r.failed.length ? ', не вдалося: ' + r.failed.length : ''}`, 5000);
      v2Sellers(root);
    });
  };
  let t;
  const poll = async () => { clearTimeout(t); try { const st = await papi('/autofill'); drawFill(st); if (st.running) t = setTimeout(poll, 2000); } catch { /* ignore */ } };
  root.querySelectorAll('[data-fill]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi('/sites/' + b.dataset.fill + '/autofill', { method: 'POST', body: {} }); poll(); })));
  poll();
}

// ================= Продукти-конкуренти =================
async function v2Competitors() {
  const [{ rows }, prod] = await Promise.all([papi('/v2/competitors'), papi('/v2/products')]);
  const ours = prod.rows;
  app.innerHTML = `
    <div class="bar" style="align-items:baseline"><h1 class="grow" style="margin:0">Продукти-конкуренти</h1><button class="btn primary" id="cimp">Імпорт списку конкурентів</button></div>
    ${about('v2k', '<b>Що це.</b> Продукти інших брендів, відносно яких ми позиціонуємо нашу ціну. Для кожного видно, з яким нашим товаром він звʼязаний, його ціну та чи все зійшлося. Список «наш товар → конкурентний продукт» веде відділ ціноутворення. <b>Як користуватись.</b> Натисніть «Імпорт списку»: вставте рядки «наш товар ; конкурентний продукт», ми знайдемо ціни на сайтах продавців, ви підтвердите. Поодинці конкурентів додають у картці товару.')}
    <div id="cbox"></div>
    <div class="card"><div class="tw"><table>
      <thead><tr><th>Продукт-конкурент</th><th>Бренд</th><th>Де продається</th><th class="n">Ціна</th><th>Фасування</th><th>Звʼязаний з нашим товаром</th><th>Зв'язок</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)} ↗</a></td><td>${esc(r.brand || '—')}</td><td>${esc(r.site)}</td>
        <td class="n">${r.price == null ? '—' : money(r.price)}${availBadge(r.avail)}</td><td>${esc(r.pack || '—')}</td>
        <td>${r.links.map((l) => `<a href="#/p/${l.groupId}">${esc(l.name)}${l.pack ? ' · ' + esc(l.pack) : ''}</a>`).join('<br>')}</td>
        <td>${vChip({ status: r.status, reasons: r.reasons.map((t) => ({ t, level: 'check' })) })}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Конкурентних продуктів ще не додано. Скористайтесь «Імпорт списку конкурентів».</td></tr>'}</tbody></table></div></div>`;

  $('#cimp').onclick = () => {
    const box = $('#cbox');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    importBox(box);
  };
}

// Search competitor products on sellers' sites for a pasted list, confirm, add. Long lists go in batches of 150.
function importBox(box) {
  box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Знайти ціни конкурентів на сайтах</h2>
    <p style="margin:0 0 8px">Система бере конкурентний продукт, шукає його на всіх сайтах з розділу «Сайти» (наші партнери й конкуренти), читає ціну й показує знайдене. <b>Нічого не зберігається, поки ви не поставите галочки й не підтвердите.</b></p>
    <ol style="margin:0 0 10px;padding-left:20px;line-height:1.6">
      <li>Натисніть <b>«Взяти з Excel (за зіставленням)»</b>: у поле нижче підставляться пари для всіх препаратів, які ви зіставили на вкладці 1.</li>
      <li>Натисніть <b>«Знайти ціни»</b> і зачекайте: пошук іде пакетами по 150 рядків.</li>
      <li>Перегляньте знайдене, залиште галочки біля правильних пар і підтвердьте. Після цього ціни з'являться в розділі «Ціни».</li>
    </ol>
    <p class="muted" style="margin:0 0 8px">Можна й вручну: по одному рядку <b>наш товар ; конкурентний продукт</b> (розділювач «;» або «|»). Приклад: <i>Міравіс 200 SC 1 л ; Фалькон</i>.</p>
    <textarea id="clist" rows="7" placeholder="Міравіс 200 SC 1 л ; Фалькон&#10;Амістар Голд 5 л ; Колосаль"></textarea>
    <div class="bar"><button class="btn primary" id="cgo">Знайти ціни</button><button class="btn" id="cfrom" title="Підставити пари «наш товар ; конкурент» з Excel-списку для всіх зіставлених товарів">Взяти з Excel (за зіставленням)</button><span class="muted" id="cstat"></span></div><div id="cres"></div></div>`;
  let timer;
  const draw = (st) => {
    const res = $('#cres');
    $('#cstat').textContent = st.running ? `Опрацьовано ${st.done} з ${st.total}…` : '';
    if (st.error) { res.innerHTML = `<p class="err">${esc(st.error)}</p>`; return; }
    if (!st.rows.length) { res.innerHTML = ''; return; }
    const withFound = st.rows.filter((r) => r.found.length).length;
    const pages = st.rows.reduce((t, r) => t + r.found.length, 0);
    const noOurs = st.rows.filter((r) => !r.ourMatches.length).length;
    const banner = st.running ? '' : `<div class="card" style="margin:12px 0;border-color:var(--good);background:var(--good-bg)">
      <h2 style="margin:0 0 6px">✅ Пошук завершено: що далі</h2>
      <p style="margin:0 0 6px">Оброблено рядків: <b>${st.rows.length}</b>. Знайдено пропозицій: <b>${pages}</b> (для <b>${withFound}</b> рядків), нічого не знайшли для <b>${st.rows.length - withFound}</b>${noOurs ? `, не визначено наш товар у <b>${noOurs}</b>` : ''}.</p>
      <ol style="margin:0 0 8px;padding-left:20px;line-height:1.6">
        <li>Перегляньте таблицю нижче: у кожному рядку наш товар, знайдений продукт конкурента, його ціна й сайт. Посилання «↗» відкриває сторінку на сайті.</li>
        <li>Залиште галочки лише біля <b>правильних</b> пар. Помилкові (інший препарат, інше фасування) зніміть.</li>
        <li>Натисніть <b>«Додати вибране»</b>. Після цього ціни з'являться в розділі <b>«Ціни»</b>: клік по нашому товару розгорне порівняння з конкурентами.</li>
      </ol>
      <div class="bar" style="margin:0"><button class="btn primary" id="capply2">Додати вибране (<span id="csel">0</span>)</button><button class="btn sm" id="call">Вибрати всі</button><button class="btn sm" id="cnone">Зняти всі</button></div></div>`;
    // Compact layout: one heading line per competitor product (with the choice of our product), the pages found
    // for it right below, no empty cells; competitors nothing was found for go to one collapsed list.
    const ourSelect = (r, ri) => (r.ourMatches.length ? `<select data-o="${ri}">${r.ourMatches.map((m) => `<option value="${m.groupId}">${esc(m.name)}${m.pack ? ' · ' + esc(m.pack) : ''}${m.packOk ? ' ✓' : ''}</option>`).join('')}</select>` : '<span class="err">наш товар не знайдено</span>');
    const foundRows = st.rows.map((r, ri) => ({ r, ri })).filter((x) => x.r.found.length);
    const missing = st.rows.filter((r) => !r.found.length);
    res.innerHTML = banner + `<div class="tw"><table class="imp"><thead><tr><th style="width:28px"></th><th>Знайдений продукт-конкурент</th><th class="n">Ціна</th><th>Де</th></tr></thead><tbody>
      ${foundRows.map(({ r, ri }) => `<tr class="igrp"><td colspan="4"><b>${esc(r.competitor)}</b> <span class="muted">— порівнюємо з нашим:</span> ${ourSelect(r, ri)} <span class="muted small">(рядок списку: ${esc(r.ours)})</span></td></tr>
        ${r.found.map((f, fi) => `<tr><td><input type="checkbox" data-r="${ri}" data-f="${fi}" ${r.ourMatches.length ? 'checked' : ''}></td>
          <td><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)} ↗</a>${f.brand ? ' <span class="muted small">' + esc(f.brand) + '</span>' : ''}</td>
          <td class="n">${f.price == null ? '—' : money(f.price)}${availBadge(f.avail)}</td><td>${esc(f.site)}</td></tr>`).join('')}`).join('') || '<tr><td colspan="4" class="muted">Нічого не знайдено</td></tr>'}
    </tbody></table></div>
    ${missing.length ? `<details style="margin-top:10px"><summary class="muted">Нічого не знайшли на сайтах для ${missing.length} позицій (показати список)</summary><ul class="plain small" style="margin:6px 0 0">${missing.map((r) => `<li>${esc(r.competitor)} <span class="muted">· наш: ${esc(r.ours)}</span></li>`).join('')}</ul></details>` : ''}
    ${st.running ? '' : '<div class="bar" style="margin-top:10px"><button class="btn primary" id="capply">Додати вибрані</button></div>'}`;
    const counter = () => { const el = $('#csel'); if (el) el.textContent = res.querySelectorAll('input[type=checkbox]:checked').length; };
    res.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.onchange = counter));
    const setAll = (v) => { res.querySelectorAll('input[type=checkbox]').forEach((cb) => (cb.checked = v)); counter(); };
    if ($('#call')) $('#call').onclick = () => setAll(true);
    if ($('#cnone')) $('#cnone').onclick = () => setAll(false);
    counter();
    const doApply = () => ask(null, async () => {
      const items = [...res.querySelectorAll('input[type=checkbox]:checked')].map((cb) => {
        const ri = Number(cb.dataset.r), fi = Number(cb.dataset.f);
        const sel = res.querySelector(`select[data-o="${ri}"]`);
        return sel ? { groupId: sel.value, url: st.rows[ri].found[fi].url, kind: 'analog', list: st.rows[ri].list || '' } : null;
      }).filter(Boolean);
      if (!items.length) throw new Error('Нічого не відмічено');
      const r = await papi('/autofill/apply', { method: 'POST', body: { items } });
      toast(`Додано: ${r.added}${r.failed.length ? '. Не вдалося: ' + r.failed.length + ' (' + r.failed[0].error + ')' : ''}. Порівняння дивіться в розділі «Ціни».`, 9000);
      location.hash = '#/p';
    });
    const ap = $('#capply');
    if (ap) ap.onclick = doApply;
    if ($('#capply2')) $('#capply2').onclick = doApply;
  };
  const poll = async () => { clearTimeout(timer); try { const st = await papi('/competitors/import'); draw(st); if (st.running) timer = setTimeout(poll, 2500); } catch { /* ignore */ } };
  $('#cfrom').onclick = () => ask(null, async () => { const r = await papi('/mapping/rows'); $('#clist').value = r.rows.map((x) => x.ours + ' ; ' + x.competitor + ' ; ' + (x.list || '')).join('\n'); $('#cstat').textContent = `Підставлено ${r.rows.length} пар. Натисніть «Знайти ціни»: це кілька хвилин, пошук іде пакетами.`; });
  $('#cgo').onclick = () => ask(null, async () => {
    const list = $('#clist').value.split(/\r?\n/).map((l) => l.split(/\t|;|\|/).map((x) => x.trim())).filter((p) => p.length >= 2 && p[0] && p[1]).map((p) => ({ ours: p[0], competitor: p[1], list: p[2] || '' }));
    if (!list.length) throw new Error('Формат рядка: наш товар ; конкурентний продукт');
    for (let i = 0; i < list.length; i += 150) {
      await papi('/competitors/import', { method: 'POST', body: { rows: list.slice(i, i + 150), append: i > 0 } });
      let st;
      do { await new Promise((r) => setTimeout(r, 2500)); st = await papi('/competitors/import'); draw(st); } while (st.running);
    }
  });
  poll();

}

// ================= Звірка =================
async function v2Reconcile() {
  const r = await papi('/v2/reconcile');
  const linked = r.products - r.none;
  const cover = r.products ? Math.round((linked / r.products) * 100) : 0;
  const big = r.verdict === 'ok'
    ? ['good', '✓ Усе зійшлося', `Усі ${r.products} товарів мають звʼязки, усі ${r.links.total} звʼязків перевірені, дублів немає.`]
    : r.verdict === 'empty'
      ? ['mid', 'Зв\'язків ще немає', 'Додайте продавців і конкурентів, і тут зʼявиться підсумок.']
      : r.verdict === 'partial'
        ? ['warn', `Зійшлося не все: ${r.none} з ${r.products} товарів ще без звʼязків`, `Те, що вже додано, у порядку: усі ${r.links.total} звʼязків перевірені. Але звʼязки є лише для ${linked} товарів (${cover} %), решту ще треба додати.`]
        : ['warn', `⚠ Потребує уваги: ${r.problems}`, `Із ${r.links.total} звʼязків ${r.links.ok} в порядку, ${r.links.check} потребують перевірки, ${r.links.error} з помилками${r.dupes.length ? ', ' + r.dupes.length + ' дублів' : ''}. Ще ${r.none} з ${r.products} товарів без звʼязків.`];
  app.innerHTML = `
    <h1>Звірка: чи все зійшлося</h1>
    ${about('v2r', '<b>Що це.</b> Єдине місце, де видно, що наші товари правильно звʼязані зі сторінками продавців і продуктами-конкурентами, а ціни прочитані. <b>Як користуватись.</b> Зверху загальний вердикт. Нижче перелік того, що потребує уваги: відкрийте товар і виправте, або натисніть «Підтвердити», якщо пара вірна.')}
    <div class="card verdict ${big[0]}"><div class="vbig">${big[1]}</div><div>${esc(big[2])}</div>
      ${r.products ? `<div class="cover"><div class="cbar"><span style="width:${cover}%"></span></div><span class="small">Покриття: ${linked} з ${r.products} товарів мають звʼязки (${cover} %)</span></div>` : ''}</div>
    <div class="grid kp" style="margin-top:14px">
      <div class="card kpi"><div class="l">Наших товарів</div><div class="v">${r.products}</div></div>
      <div class="card kpi"><div class="l">Звʼязані з продавцями</div><div class="v">${r.withSellers}</div><div class="l">мають ціну в наших продавців</div></div>
      <div class="card kpi"><div class="l">Звʼязані з конкурентами</div><div class="v">${r.withComps}</div><div class="l">мають продукт-конкурент</div></div>
      <div class="card kpi ${r.none ? 'bad' : ''}"><div class="l">Без жодного звʼязку</div><div class="v">${r.none}</div><div class="l">позиціонувати ціну нема з чим</div></div>
      <div class="card kpi ${r.problems ? 'warn' : 'good'}"><div class="l">Звʼязки: у порядку</div><div class="v">${r.links.ok} <span class="muted small">з ${r.links.total}</span></div><div class="l">${r.links.check} перевірити · ${r.links.error} помилок</div></div>
    </div>

    <div class="card" style="margin-top:14px"><h2>Потребують перевірки <span class="muted small">(${r.attention.length})</span></h2>
      ${r.attention.length ? `<div class="tw"><table><thead><tr><th>Наш товар</th><th>Тип</th><th>Сторінка</th><th>Чому</th><th></th></tr></thead><tbody>
        ${r.attention.slice(0, 200).map((a) => `<tr><td><a href="#/p/${a.groupId}">${esc(a.group)}</a></td><td>${a.kind === 'same' ? '<span class="chip mid">продавець</span>' : '<span class="chip warn">конкурент</span>'}</td>
          <td><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)} ↗</a><div class="muted small">${esc(a.site)}</div></td>
          <td><span class="chip ${a.status === 'error' ? 'bad' : 'warn'}">${a.status === 'error' ? '✕' : '⚠'}</span> <span class="small">${a.reasons.map(esc).join('; ')}</span></td>
          <td class="nowrap">${a.status === 'check' ? `<button class="btn sm primary" data-cf="${a.groupId}" data-pid="${a.pid}">✓ Підтвердити</button> ` : ''}<a class="btn sm" href="#/p/${a.groupId}">Відкрити</a></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Усе в порядку.</p>'}</div>

    ${r.dupes.length ? `<div class="card" style="margin-top:14px"><h2>Одна сторінка привʼязана до кількох наших товарів <span class="muted small">(${r.dupes.length})</span></h2>
      <div class="tw"><table><tbody>${r.dupes.map((d) => `<tr><td><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)} ↗</a><div class="muted small">${esc(d.site)}</div></td><td>${d.groups.map((g) => `<a href="#/p/${g.groupId}">${esc(g.group)}</a>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div></div>` : ''}

    <div class="card" style="margin-top:14px"><h2>Товари без жодного звʼязку <span class="muted small">(${r.unlinkedTotal})</span></h2>
      <p class="muted" style="margin:0 0 8px">Для них нема ні ціни в продавців, ні конкурентного продукту. Клік відкриває картку, де їх можна додати.</p>
      ${r.unlinked.length ? `<div class="tw"><table><tbody>${r.unlinked.map((u) => `<tr class="click" data-go="#/p/${u.groupId}"><td><b>${esc(u.name)}</b>${u.pack ? ' <span class="muted">· ' + esc(u.pack) + '</span>' : ''}</td><td class="n">${money(u.price, 0)} ₴</td><td class="n muted">${u.stock == null ? '' : 'залишок ' + money(u.stock, 0)}</td></tr>`).join('')}</tbody></table></div>
        ${r.unlinkedTotal > r.unlinked.length ? `<p class="hint">Показано ${r.unlinked.length} з ${r.unlinkedTotal}. Повний список у «Товари» → «Не звʼязані».</p>` : ''}` : '<p class="muted">Усі товари мають звʼязки.</p>'}</div>`;

  app.querySelectorAll('[data-cf]').forEach((b) => (b.onclick = () => ask(null, async () => {
    await papi(`/v2/groups/${b.dataset.cf}/confirm`, { method: 'POST', body: { pid: b.dataset.pid } });
    toast('Підтверджено', 2000);
    v2Reconcile();
  })));
}

// ================= старі сторінки =================
function v2Old() {
  app.innerHTML = `<h1>Попередні сторінки</h1>
    <p class="muted">Вони працюють на тих самих даних. Поки лишаються для порівняння з новою структурою.</p>
    <div class="card"><ul class="plain">
      <li><a href="#/home">Головна (інсайти)</a></li>
      <li><a href="#/r">Звірка</a></li>
      <li><a href="#/c">Конкуренти (таблиця)</a></li>
      <li><a href="#/m">Зіставлення товарів з Excel окремою сторінкою</a></li>
      <li><a href="#/analogs">Продукти-конкуренти (таблиця по товарах)</a></li>
      <li><a href="#/direct">Ціна в наших продавців (матриця по сайтах)</a></li>
      <li><a href="#/gaps">Кому додати конкурентів</a></li>
      <li><a href="#/pairs">Перевірка пар</a></li>
      <li><a href="#/groups">Каталог</a></li>
      <li><a href="#/compare">Порівняти між собою</a></li>
      <li><a href="#/sites">Наші продавці</a></li>
    </ul></div>`;
}


// ================= Зіставлення: наші товари (каталог + BAS) ↔ рядки Excel «Конкурентні групи» =================
const mapS = { q: '', f: 'all' };
async function v2Mapping(root) {
  root = root || app;
  const data = await papi('/mapping');
  const c = data.counts;
  // plain-language states: what the system did and what the person has to do next
  const STATE = {
    auto: ['warn', 'Підібрано автоматично: перевірте'],
    manual: ['good', 'Підтверджено вами'],
    none: ['bad', 'Потрібно вибрати наш товар'],
    skip: ['mid', 'У нас такого препарату немає'],
  };
  const LINE_UA = { FUNGICIDES: 'Фунгіциди', INSECTICIDES: 'Інсектициди', 'SELECTIVE HERBICIDES': 'Гербіциди вибіркові', 'NON-SELECTIVE HERBICIDES': 'Гербіциди суцільні', 'SEED CARE': 'Протруйники', BIOSTIMULANTS: 'Біостимулятори' };
  const stockTxt = (o) => (o.available == null ? '<span class="muted small">немає в BAS</span>' : `<span class="small">залишок ${money(o.available, 0)} · ${o.agis} арт.</span>`);
  const draw = (d) => {
    const q = mapS.q.trim().toLowerCase();
    const shown = d.rows.filter((r) => (mapS.f === 'all' || r.status === mapS.f) && (!q || (r.name + ' ' + r.group + ' ' + r.ours.map((o) => o.name).join(' ')).toLowerCase().includes(q)));
    $('#mcount').textContent = `Показано ${shown.length} з ${d.rows.length}`;
    $('#mbody').innerHTML = shown.map((r) => `<tr data-k="${esc(r.key)}">
      <td><b>${esc(r.name)}</b> ${r.name.toLowerCase().replace(/[^a-z0-9а-я]/g, '').startsWith(r.group.toLowerCase().replace(/[^a-z0-9а-я]/g, '')) ? '' : `<span class="muted small">(група ${esc(r.group)})</span>`}${r.phaseOut ? ' <span class="chip warn" title="Виводиться з портфеля">виводиться</span>' : ''}
        <div class="muted small">${esc(LINE_UA[r.line] || r.line)} · список «${esc(r.list)}» · конкурентів: ${r.competitors}${r.managers.length ? ' · відповідальний: ' + esc(r.managers.join(', ')) : ''}</div></td>
      <td>${r.ours.map((o) => `<div><b>${esc(o.name)}</b> <span class="muted small">· ${o.groups} фас.</span> ${stockTxt(o)} <button class="ib" data-rm="${esc(o.name)}" title="Прибрати цей товар із пари">✕</button></div>`).join('') || '<span class="muted">наш товар ще не вибрано</span>'}
        <div class="bar" style="margin:6px 0 0"><select data-add><option value="">+ вибрати наш товар…</option>${d.families.map((n) => `<option>${esc(n)}</option>`).join('')}</select></div></td>
      <td><span class="chip ${STATE[r.status][0]}">${STATE[r.status][1]}</span>${r.status === 'auto' ? '<div style="margin-top:6px"><button class="btn sm primary" data-ok title="Пара правильна: зберегти як підтверджену">✓ Підтвердити</button></div>' : ''}</td>
      <td class="nowrap">${r.status === 'skip' ? '' : '<button class="btn sm" data-skip title="У нашому каталозі такого препарату немає">У нас такого немає</button>'} ${r.status === 'manual' || r.status === 'skip' ? '<button class="btn sm" data-auto title="Скасувати моє рішення й повернути автоматичний підбір">↺ Скинути</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Нічого не знайдено</td></tr>';
    const save = (key, names) => ask(null, async () => { const nd = await papi('/mapping', { method: 'POST', body: { key, names } }); cur = nd; draw(nd); head(nd); });
    const rowOf = (el) => cur.rows.find((r) => r.key === el.closest('tr').dataset.k);
    $('#mbody').querySelectorAll('[data-add]').forEach((sel) => (sel.onchange = () => { if (!sel.value) return; const r = rowOf(sel); save(r.key, [...r.ours.map((o) => o.name), sel.value]); }));
    $('#mbody').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { const r = rowOf(b); save(r.key, r.ours.map((o) => o.name).filter((n) => n !== b.dataset.rm)); }));
    $('#mbody').querySelectorAll('[data-ok]').forEach((b) => (b.onclick = () => { const r = rowOf(b); save(r.key, r.ours.map((o) => o.name)); }));
    $('#mbody').querySelectorAll('[data-skip]').forEach((b) => (b.onclick = () => save(rowOf(b).key, [])));
    $('#mbody').querySelectorAll('[data-auto]').forEach((b) => (b.onclick = () => save(rowOf(b).key, null)));
    $('#munm').innerHTML = d.unmapped.map((f) => `<tr><td>${esc(f.name)}</td><td class="n muted">${f.groups} фас.</td><td class="n">${f.available == null ? '' : money(f.available, 0)}</td></tr>`).join('') || '<tr><td class="muted">Усі наші товари зіставлені</td></tr>';
    $('#munc').textContent = d.unmapped.length;
  };
  const head = (d) => {
    const k = d.counts;
    $('#mpills').innerHTML = [['all', 'Усі рядки', k.total], ['auto', 'Підібрано автоматично', k.auto], ['manual', 'Підтверджено вами', k.manual], ['none', 'Потрібно вибрати', k.none], ['skip', 'У нас такого немає', k.skip]]
      .map(([f, t, n]) => `<button class="pill ${mapS.f === f ? 'on' : ''}" data-f="${f}">${t} <span class="muted">${n}</span></button>`).join('');
    $('#mpills').querySelectorAll('.pill').forEach((b) => (b.onclick = () => { mapS.f = b.dataset.f; head(cur); draw(cur); }));
    $('#mall').hidden = !k.auto;
    $('#mall').textContent = `✓ Підтвердити всі автоматичні (${k.auto})`;
  };
  let cur = data;
  root.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <h2>Зіставте препарати з Excel-списку з нашими товарами</h2>
      <p style="margin:0 0 8px">Список конкурентів береться з Excel <b>«Конкурентні групи для звіту GainLoss 2026»</b>. У ньому <b>колонка B — продукт Syngenta</b>, а <b>колонка D — продукт конкурента</b>: для кожного нашого препарату там перелік його конкурентів. Але в Excel препарати названі латиницею (<i>Alto Super</i>), а в нашому каталозі та BAS — українською (<i>«Альто® Супер»</i>).</p>
      <p style="margin:0 0 8px">Тут ви показуєте системі, <b>який наш товар відповідає кожному рядку Excel</b>. Коли пара є, система сама шукає ціни конкурентів з цього рядка й порівнює їх з нашою ціною.</p>
      <ol style="margin:0;padding-left:20px;line-height:1.6">
        <li>Рядки зі станом <span class="chip warn">Підібрано автоматично</span>: перевірте пару й натисніть <b>«✓ Підтвердити»</b> (або виправте товар).</li>
        <li>Рядки <span class="chip bad">Потрібно вибрати</span>: оберіть наш товар у списку праворуч. Якщо такого препарату в нас немає, натисніть «У нас такого немає».</li>
        <li>Далі перейдіть на вкладку <b>«2. Знайти ціни конкурентів»</b> угорі.</li>
      </ol>
    </div>
    <div class="grid kp"><div class="card kpi"><div class="l">Рядків у Excel</div><div class="v">${c.total}</div><div class="l">препаратів з конкурентами</div></div>
      <div class="card kpi good"><div class="l">Зіставлено з нашим товаром</div><div class="v">${c.auto + c.manual}</div><div class="l">${c.auto} автоматично · ${c.manual} підтверджено вами</div></div>
      <div class="card kpi ${c.none ? 'bad' : 'good'}"><div class="l">Потрібно вибрати вручну</div><div class="v">${c.none}</div><div class="l">пари ще немає</div></div>
      <div class="card kpi"><div class="l">Наших товарів без рядка в Excel</div><div class="v">${data.unmapped.length}</div><div class="l">конкурентів для них у списку немає</div></div></div>
    <div class="bar" style="margin-top:14px"><input class="grow" id="mq" placeholder="Пошук за назвою…" value="${esc(mapS.q)}"><div class="pills" id="mpills" style="margin:0"></div><span class="muted" id="mcount"></span><button class="btn primary" id="mall" hidden></button></div>
    <div class="card"><div class="tw"><table><thead><tr><th>Препарат з Excel</th><th>Наш товар у каталозі та BAS</th><th>Стан</th><th></th></tr></thead><tbody id="mbody"></tbody></table></div></div>
    <div class="card" style="margin-top:14px"><h2>Наші товари, яких немає в Excel <span class="muted small" id="munc"></span></h2>
      <p class="muted" style="margin:0 0 8px">Для них у списку немає конкурентів, тому порівнювати їхню ціну поки нема з чим. Якщо такий препарат є в Excel під іншою назвою, зіставте його у таблиці вище.</p>
      <div class="tw"><table><tbody id="munm"></tbody></table></div></div>`;
  $('#mq').oninput = (e) => { mapS.q = e.target.value; draw(cur); };
  $('#mall').onclick = () => {
    const todo = cur.rows.filter((r) => r.status === 'auto' && r.ours.length);
    if (!todo.length || !confirm(`Підтвердити всі ${todo.length} автоматично підібрані пари? Їх можна буде змінити пізніше.`)) return;
    ask(null, async () => {
      let nd = cur;
      for (const r of todo) nd = await papi('/mapping', { method: 'POST', body: { key: r.key, names: r.ours.map((o) => o.name) } });
      cur = nd; draw(nd); head(nd); toast(`Підтверджено: ${todo.length}`, 3000);
    });
  };
  head(data); draw(data);
}


// ================= Ціни: одна таблиця, рядок розгортається =================
const pr = { q: '', section: '', filter: 'all', sort: 'name', limit: 120, open: new Set(), rows: [] };

async function v2Prices() {
  const data = await papi('/v2/products');
  pr.rows = data.rows;
  app.innerHTML = `
    <div class="bar" style="align-items:baseline"><h1 class="grow" style="margin:0">Ціни</h1>
      <button class="btn" id="padd">+ Наш товар</button></div>
    ${about('v2pr', '<b>Як читати.</b> Один рядок — один наш товар. Праворуч видно, скільки наших продавців і конкурентів його мають, їхні ціни (за літр/кг, коли відоме фасування) і чи ми дорожчі, чи дешевші. <b>Як керувати.</b> Клікніть рядок: розкриються сторінки продавців і конкурентів із цінами; там же додаєте посилання, шукаєте на сайтах, прибираєте або підтверджуєте звʼязок. Нові сайти додаються на вкладці «Сайти», списки від відділу — в «Імпорт».')}
    <div id="paddbox"></div>
    <div class="pills" id="psec">${['', ...data.sections].map((x) => `<button class="pill ${x === pr.section ? 'on' : ''}" data-s="${esc(x)}">${esc(x || 'Усі розділи')}</button>`).join('')}</div>
    <div class="bar"><input class="grow" id="pq" placeholder="Пошук товару…" value="${esc(pr.q)}">
      <select id="pf">${[['all', 'Усі товари'], ['sdear', 'Ми дорожчі за продавців'], ['cdear', 'Ми дорожчі за конкурентів'], ['cheap', 'Ми дешевші за всіх'], ['nos', 'Без продавців'], ['noc', 'Без конкурентів'], ['chk', 'Є що перевірити']].map(([k, t]) => `<option value="${k}" ${pr.filter === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="pst"><option value="name" ${pr.sort === 'name' ? 'selected' : ''}>За назвою</option><option value="gap" ${pr.sort === 'gap' ? 'selected' : ''}>Найбільша розбіжність зверху</option></select>
      <span class="muted" id="pcount"></span></div>
    <div class="card"><div class="tw"><table class="vt pt">
      <thead><tr><th>Наш товар</th><th class="n">Наша ціна</th><th>В наших продавців</th><th>У конкурентів</th></tr></thead>
      <tbody id="pbody"></tbody></table></div><div class="bar" style="margin-top:10px"><button class="btn" id="pmore" hidden>Показати ще</button></div></div>`;
  app.querySelectorAll('#psec .pill').forEach((b) => (b.onclick = () => { pr.section = b.dataset.s; pr.limit = 120; v2Prices(); }));
  $('#pq').oninput = (e) => { pr.q = e.target.value; pr.limit = 120; prDraw(); };
  $('#pf').onchange = (e) => { pr.filter = e.target.value; pr.limit = 120; prDraw(); };
  $('#pst').onchange = (e) => { pr.sort = e.target.value; prDraw(); };
  $('#pmore').onclick = () => { pr.limit += 200; prDraw(); };
  $('#padd').onclick = () => {
    const box = $('#paddbox');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card" style="margin-bottom:14px"><h2>Додати наш товар</h2><div class="grid g2">
      <div><b>За посиланням на сторінку нашого магазину</b><div class="bar" style="margin-top:6px"><input class="grow" id="vown-url" placeholder="https://store.syngenta.ua/product/…"><button class="btn primary" id="vown-go">Додати</button></div></div>
      <div><b>Вручну</b><div class="bar" style="margin-top:6px"><input class="grow" id="vown-name" placeholder="Назва"><input id="vown-pack" placeholder="Фасування, напр. 5 л" size="14"><input id="vown-price" placeholder="Ціна, ₴" size="9"><button class="btn" id="vown-man">Додати</button></div></div></div></div>`;
    const done = (r) => { toast(r.existed ? 'Цей товар уже є' : 'Додано', 3000); pr.open.add(r.groupId); v2Prices(); };
    $('#vown-go').onclick = () => ask(null, async () => { done(await papi('/v2/own', { method: 'POST', body: { url: $('#vown-url').value.trim() } })); });
    $('#vown-man').onclick = () => ask(null, async () => { done(await papi('/v2/own', { method: 'POST', body: { name: $('#vown-name').value, pack: $('#vown-pack').value, price: $('#vown-price').value } })); });
  };
  prDraw();
}

/** "920–980 ₴/л" with a verdict against our price. */
function prCell(S, r) {
  if (!S.count) return '<span class="muted">не додано</span>';
  if (!S.priced) return `<span class="muted">${S.count} · ціну не прочитано</span>`;
  const u = esc(r.metric || '₴');
  const d = S.diffPct;
  const v = d == null ? '' : d > 2 ? `<span class="chip bad">ми дорожчі на ${money(d, 0)}%</span>` : d < -2 ? `<span class="chip good">ми дешевші на ${money(-d, 0)}%</span>` : '<span class="chip mid">≈ як у нас</span>';
  return `<b>${money(S.min, 0)}${S.max > S.min ? '–' + money(S.max, 0) : ''}</b> <span class="muted small">${u}</span> ${v}<div class="muted small">${S.count} шт. · найдешевше: ${esc(S.cheapest || '—')}${S.check + S.error ? ' · <span class="warn-t">⚠ ' + (S.check + S.error) + '</span>' : ''}</div>`;
}

function prDraw() {
  const q = pr.q.trim().toLowerCase();
  const dp = (x) => (x == null ? -999 : x);
  const gap = (r) => Math.max(dp(r.sellers.diffPct), dp(r.comps.diffPct));
  const F = {
    all: () => true, sdear: (r) => r.sellers.diffPct > 2, cdear: (r) => r.comps.diffPct > 2,
    cheap: (r) => { const v = [r.sellers.diffPct, r.comps.diffPct].filter((x) => x != null); return v.length > 0 && v.every((x) => x < -2); },
    nos: (r) => !r.sellers.count, noc: (r) => !r.comps.count, chk: (r) => r.issues > 0,
  }[pr.filter];
  let rows = pr.rows.filter((r) => F(r) && (!pr.section || r.section === pr.section) && (!q || (r.name + ' ' + (r.pack || '')).toLowerCase().includes(q)));
  rows = rows.slice().sort(pr.sort === 'gap' ? (a, b) => gap(b) - gap(a) : (a, b) => a.name.localeCompare(b.name, 'uk') || String(a.pack).localeCompare(String(b.pack), 'uk'));
  const shown = rows.slice(0, pr.limit);
  $('#pcount').textContent = `${rows.length} з ${pr.rows.length}`;
  $('#pmore').hidden = rows.length <= shown.length;
  $('#pbody').innerHTML = shown.map((r) => {
    const open = pr.open.has(r.groupId);
    return `<tr class="click prow ${open ? 'open' : ''}" data-g="${r.groupId}"><td><span class="car">${open ? '▾' : '▸'}</span> <b>${esc(r.name)}</b>${r.pack ? ' <span class="muted">· ' + esc(r.pack) + '</span>' : ''}<div class="muted small">${esc(r.section || '')}${r.stock != null ? ' · залишок ' + money(r.stock, 0) : ''}</div></td>
      <td class="n"><b>${money(r.price, 0)}</b> ₴${r.unit != null ? '<div class="muted small">' + money(r.unit, 0) + ' ' + esc(r.unitLabel || '') + '</div>' : ''}</td>
      <td>${prCell(r.sellers, r)}</td><td>${prCell(r.comps, r)}</td></tr>${open ? `<tr class="pdet" data-d="${r.groupId}"><td colspan="4"><p class="muted">Завантажую…</p></td></tr>` : ''}`;
  }).join('') || '<tr><td colspan="4" class="muted">Нічого не знайдено</td></tr>';
  $('#pbody').querySelectorAll('.prow').forEach((tr) => (tr.onclick = () => { const g = tr.dataset.g; pr.open.has(g) ? pr.open.delete(g) : pr.open.add(g); prDraw(); }));
  $('#pbody').querySelectorAll('.pdet').forEach((tr) => prDetail(tr.dataset.d, tr.firstElementChild));
}

async function prDetail(gid, cell) {
  let c;
  try { c = await papi('/v2/product/' + gid); } catch (e) { cell.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const stat = (i) => (i.status === 'ok' ? '<span class="chip good" title="Зійшлося">✓</span>' : `<span class="chip ${i.status === 'error' ? 'bad' : 'warn'}" title="${esc(i.reasons.filter((x) => x.level !== 'info').map((x) => x.t).join('\n'))}">${i.status === 'error' ? '✕' : '⚠'}</span>`);
  const diff = (d) => (d == null ? '' : d > 2 ? `<span class="warn-t">ми +${money(d, 0)}%</span>` : d < -2 ? `<span class="good-t">ми ${money(d, 0)}%</span>` : '<span class="muted">≈</span>');
  const norm = (x) => String(x || '').toLowerCase().replace(/[\s.,]/g, '');
  const packChip = (i) => {
    if (!i.pack) return '<span class="chip warn">фасування?</span>';
    const same = c.pack && norm(i.pack) === norm(c.pack);
    return same ? `<span class="chip mid">${esc(i.pack)}</span>` : `<span class="chip warn" title="Інше фасування, ніж наше (${esc(c.pack || '?')}). Порівнюємо за ціною літра/кг">${esc(i.pack)} · інша тара</span>${i.packAssumed ? ' <span class="muted">(припущено)</span>' : ''}`;
  };
  const list = (items, kind) => (items.length ? `<table><tbody>${items.map((i) => `<tr data-p="${i.pid}">
      <td>${stat(i)}</td><td><b>${esc(i.site)}</b><div class="muted small">${esc(i.brand || '')}</div></td>
      <td><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.name || i.url)} ↗</a>${availBadge(i.avail)}<div class="small">${packChip(i)}${i.manualPrice ? ' <span class="muted">· ціна вручну</span>' : ''}</div></td>
      <td class="n">${i.unit != null ? '<b>' + money(i.unit, 0) + '</b> <span class="muted small">' + esc(i.unitLabel || '') + '</span><div class="muted small">' + money(i.price) + ' ₴' + (i.pack ? ' за ' + esc(i.pack) : '') + '</div>' : '<b>' + money(i.price) + '</b> ₴'}</td><td class="n">${diff(i.diffPct)}</td>
      <td class="nowrap">${i.status === 'check' ? `<button class="ib" data-cf="${i.pid}" title="Підтвердити, що пара вірна">✓</button>` : ''}<button class="ib" data-chk="${i.pid}" title="Перечитати ціну">⟳</button><button class="ib" data-pr="${i.pid}" title="Ввести ціну вручну">₴</button><button class="ib" data-flip="${i.pid}" data-to="${kind === 'same' ? 'analog' : 'same'}" title="${kind === 'same' ? 'Це конкурент, а не наш товар' : 'Це наш товар у продавця'}">⇄</button><button class="ib" data-rm="${i.pid}" title="Прибрати">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted small" style="margin:4px 0 8px">Поки нічого.</p>');
  const block = (title, items, kind, ph) => `<div class="pblock"><h3>${title}</h3>${list(items, kind)}
    <div class="bar"><input class="grow" data-in="${kind}" placeholder="${ph}"><button class="btn sm primary" data-go="${kind}">Додати</button></div><div class="cands" data-res="${kind}"></div></div>`;
  cell.innerHTML = `<div class="pdetin">
    <div class="small muted" style="margin-bottom:6px">${c.url && !String(c.url).startsWith('manual:') ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">Наша сторінка ↗</a> · ` : ''}${c.unit != null ? 'наша ціна ' + money(c.unit, 0) + ' ' + esc(c.unitLabel || '') + (c.pack ? ' (фасування ' + esc(c.pack) + ')' : '') + ' · порівняння за ціною літра/кг, тому інша тара не заважає' : ''}</div>
    <div class="grid g2">${block('Наші продавці', c.sellers, 'same', 'Посилання на цей товар у продавця або назва для пошуку')}
    ${block('Конкуренти', c.comps, 'analog', 'Посилання на товар конкурента або назва, напр. «Фалькон»')}</div></div>`;
  cell.onclick = (e) => e.stopPropagation();
  const reload = async () => { const d = await papi('/v2/products'); pr.rows = d.rows; prDraw(); };
  const add = (url, kind, btn) => ask(null, async () => {
    if (btn) btn.disabled = true;
    try { await papi(`/groups/${gid}/members`, { method: 'POST', body: { url, kind } }); toast('Додано', 2000); await reload(); } finally { if (btn) btn.disabled = false; }
  });
  cell.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => ask(null, async () => {
    const k = b.dataset.go, v = cell.querySelector(`[data-in="${k}"]`).value.trim();
    if (!v) return;
    if (/^https?:\/\//i.test(v)) { add(v, k, b); return; }
    const box = cell.querySelector(`[data-res="${k}"]`);
    b.disabled = true; box.innerHTML = '<p class="muted small">Шукаю на сайтах і читаю ціни…</p>';
    try {
      const sr = await papi(`/groups/${gid}/search`, { method: 'POST', body: { query: v } });
      box.innerHTML = sr.results.length ? sr.results.map((r, i) => `<div class="c"><div><b>${esc(r.site)}</b> · <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)} ↗</a><div class="muted small">${esc(r.pack || 'фасування не вказане')}</div></div><div class="n"><b>${money(r.price)}</b> ₴ ${r.already ? '<span class="chip mid">вже додано</span>' : `<button class="btn sm primary" data-pick="${i}">Додати</button>`}</div></div>`).join('') : `<p class="muted small">Нічого не знайдено за «${esc(sr.query)}». Спробуйте іншу назву або вставте посилання.</p>`;
      box.querySelectorAll('[data-pick]').forEach((x) => (x.onclick = () => add(sr.results[x.dataset.pick].url, k, x)));
    } finally { b.disabled = false; }
  })));
  cell.querySelectorAll('[data-in]').forEach((inp) => (inp.onkeydown = (e) => { if (e.key === 'Enter') cell.querySelector(`[data-go="${inp.dataset.in}"]`).click(); }));
  cell.querySelectorAll('[data-cf]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/v2/groups/${gid}/confirm`, { method: 'POST', body: { pid: b.dataset.cf } }); await reload(); })));
  cell.querySelectorAll('[data-chk]').forEach((b) => (b.onclick = () => ask(null, async () => {
    b.disabled = true;
    const x = await papi(`/products/${b.dataset.chk}/check`, { method: 'POST' });
    toast(x.error ? 'Помилка: ' + x.error : x.before === x.after ? 'Ціна не змінилась: ' + money(x.after) : `Ціна: ${money(x.before)} → ${money(x.after)}`, 3500);
    await reload();
  })));
  cell.querySelectorAll('[data-pr]').forEach((b) => (b.onclick = () => { const v = prompt('Ціна на сайті, ₴:'); if (v && v.trim()) ask(null, async () => { await papi(`/products/${b.dataset.pr}/price`, { method: 'POST', body: { price: v } }); await reload(); }); }));
  cell.querySelectorAll('[data-flip]').forEach((b) => (b.onclick = () => ask(null, async () => { await papi(`/groups/${gid}/members/${b.dataset.flip}`, { method: 'PATCH', body: { kind: b.dataset.to } }); await reload(); })));
  cell.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { if (confirm('Прибрати цей звʼязок?')) ask(null, async () => { await papi(`/groups/${gid}/members/${b.dataset.rm}`, { method: 'DELETE' }); await reload(); }); }));
}

// ================= Імпорт: зіставлення з Excel-списком + пошук конкурентів =================
const impS = { tab: 'map' };
async function v2Import() {
  app.innerHTML = `<h1>Імпорт</h1>
    <div class="pills" id="itabs">${[['map', '1. Зіставити товари з Excel'], ['find', '2. Знайти ціни конкурентів']].map(([k, t]) => `<button class="pill ${impS.tab === k ? 'on' : ''}" data-k="${k}">${t}</button>`).join('')}</div>
    <div id="ibody"></div>`;
  app.querySelectorAll('#itabs .pill').forEach((b) => (b.onclick = () => { impS.tab = b.dataset.k; v2Import(); }));
  const box = $('#ibody');
  if (impS.tab === 'map') await v2Mapping(box);
  else importBox(box);
}

// ================= router hook + home strip =================
window.v2Route = async (h) => {
  let m;
  if (h === '#/' || h === '#/p') { await v2Prices(); return true; }
  if (h === '#/i') { await v2Import(); return true; }
  if ((m = h.match(/^#\/p\/(.+)$/))) { await v2Card(m[1]); return true; }
  if (h === '#/s') { await v2Sellers(); return true; }
  if (h === '#/c') { await v2Competitors(); return true; }
  if (h === '#/r') { await v2Reconcile(); return true; }
  if (h === '#/m') { await v2Mapping(); return true; }
  if (h === '#/home') { await window.homePage(); return true; }
  if (h === '#/old') { v2Old(); return true; }
  return false;
};

window.v2Strip = async () => {
  const el = document.getElementById('reconStrip');
  if (!el) return;
  try {
    const r = await papi('/v2/reconcile');
    const cls = r.verdict === 'ok' ? 'good' : r.verdict === 'empty' ? 'mid' : 'warn';
    const txt = r.verdict === 'ok' ? `✓ Усе зійшлося: усі ${r.products} товарів звʼязані, ${r.links.total} звʼязків у порядку`
      : r.verdict === 'empty' ? 'Звʼязків ще немає'
        : r.verdict === 'partial' ? `Зійшлося не все: ${r.none} з ${r.products} товарів ще без звʼязків (додані ${r.links.total} звʼязків у порядку)`
          : `⚠ Потребує уваги: ${r.problems} з ${r.links.total} звʼязків; ще ${r.none} товарів без звʼязків`;
    el.innerHTML = `<a class="strip ${cls}" href="#/r"><b>${txt}</b><span class="muted small"> · звʼязано з продавцями ${r.withSellers} із ${r.products}, з конкурентами ${r.withComps} · детально →</span></a>`;
  } catch { /* ignore */ }
};
