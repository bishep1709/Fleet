// SytBoard «Презентації»: decks about the online shop. A deck is data (slides of blocks) kept on the server
// (/api/presentations), so it can be edited here: slides and blocks added, moved, removed, every text and number changed.
// Live numbers are markers in the text — {selfNow}, {legalNow}… — filled when the deck is shown: purchases from BAS
// («без менеджера» = no manager and no manager promo code, as on «Головна»), tasks from Notion. When a source is down
// a marker shows the figure from the strategy document and the deck says so.
// Slides are 16:9 boxes sized by the container (cqw units): the same on a laptop, a projector and in PDF.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('«Презентації» доступні лише адміністраторам SytBoard.', true); return; }

  const NF0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 });
  const usd = (n) => (n === null || n === undefined ? '—' : n >= 1e6 ? `$${NF1.format(n / 1e6)} млн` : `$${n >= 1e5 ? NF0.format(n / 1e3) : NF1.format(n / 1e3)} тис.`);
  const int = (n) => (n === null || n === undefined ? '—' : NF0.format(n));
  const pct = (r) => (r === null || r === undefined || Number.isNaN(r) ? '—' : `${NF0.format(r * 100)}%`);
  const dmy = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100; const b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  const today = new Date().toISOString().slice(0, 10);

  // ---- live markers ---------------------------------------------------------------------------------------------------
  // name → [what it is, value from the board, figure from the strategy document]. The list is shown in the editor.
  function markers(d) {
    const s = d && d.sales; const o = s && s.organic; const cu = s && s.customers; const t = d && d.tasks; const c = d && d.content;
    const toSeason = Math.max(0, Math.ceil((new Date('2027-03-01T00:00:00Z') - new Date(`${today}T00:00:00Z`)) / 86400000));
    const M = {
      goal: ['ціль на 2027 рік', c && c.goal ? usd(c.goal.amountUsd) : null, '$925 тис.'],
      selfNow: ['продажі без менеджера за 12 місяців (BAS)', o ? usd(o.usd) : null, '$134,6 тис.'],
      selfOrders: ['замовлень без менеджера (BAS)', o ? int(o.orders) : null, '567'],
      selfShare: ['частка продажів без менеджера (BAS)', o && o.totalUsd ? pct(o.usd / o.totalUsd) : null, '5,9%'],
      totalUsd: ['усі продажі магазину за 12 місяців (BAS)', o ? usd(o.totalUsd) : null, '$2,28 млн'],
      totalOrders: ['усього замовлень за 12 місяців (BAS)', o ? int(o.totalOrders) : null, '869'],
      privateOrders: ['замовлень фізосіб без менеджера (BAS)', o ? int(o.privateOrders) : null, '472'],
      privateUsd: ['продажі фізособам без менеджера (BAS)', o ? usd(o.privateUsd) : null, '$52 тис.'],
      privateShare: ['частка фізосіб серед замовлень без менеджера (BAS)', o && o.orders ? pct(o.privateOrders / o.orders) : null, '83%'],
      legalBuyers: ['господарств купували за 12 місяців (BAS)', cu ? int(cu.legalBuyers) : null, '157'],
      legalNow: ['господарств купували самі (BAS)', cu ? int(cu.legalSelf) : null, '63'],
      legalManagerSeed: ['господарств брали насіння з менеджером (BAS)', cu ? int(cu.legalManagerSeed) : null, '96'],
      repeat: ['частка господарств, що купили вдруге (BAS)', cu && cu.repeatShare !== null ? pct(cu.repeatShare) : null, '22%'],
      once: ['частка господарств, що купили лише раз (BAS)', cu && cu.repeatShare !== null ? pct(1 - cu.repeatShare) : null, '78%'],
      tasksDone: ['виконано задач стратегії (Notion)', t ? int(t.done) : null, '—'],
      tasksTotal: ['усього задач стратегії (Notion)', t ? int(t.total) : null, '—'],
      toSeason: ['днів до сезону (01.03.2027)', String(toSeason), String(toSeason)],
      today: ['сьогоднішня дата', dmy(today), dmy(today)],
      asOf: ['звідки «зараз»', o ? `наживо з BAS, ${dmy(s.window.from)} — ${dmy(s.window.to)}` : null, 'з документа стратегії'],
    };
    return M;
  }
  let M = {};
  let usedDoc = false;
  const fill = (text) => String(text ?? '').replace(/\{(\w+)\}/g, (all, k) => {
    const m = M[k]; if (!m) return all;
    if (m[1] === null || m[1] === undefined) { usedDoc = true; return m[2]; }
    return m[1];
  });

  // ---- drawing a slide from data ---------------------------------------------------------------------------------------
  let live = null; // /api/strategy
  const lines = (text) => fill(text).split('\n').filter((x) => x.trim() !== '');
  function richText(text) {
    // lines starting with «- » become a list; others are paragraphs
    const ls = lines(text);
    const out = []; let ul = null;
    for (const l of ls) {
      if (/^\s*-\s+/.test(l)) { if (!ul) { ul = h('ul', { class: 'ps-list plain' }); out.push(ul); } ul.appendChild(h('li', null, l.replace(/^\s*-\s+/, ''))); } else { ul = null; out.push(h('p', null, l)); }
    }
    return out;
  }
  const BLOCK = {
    stats: (b) => h('div', { class: `ps-grid c${Math.min(4, Math.max(1, (b.items || []).length))}` }, (b.items || []).map((x) => h('div', { class: `ps-stat ${x.accent ? 'accent' : ''}` },
      h('div', { class: 'ps-stat-l' }, fill(x.label)), h('div', { class: 'ps-stat-v' }, fill(x.value)), x.sub ? h('div', { class: 'ps-stat-s' }, fill(x.sub)) : null))),
    cards: (b) => h('div', { class: `ps-grid c${Math.min(4, Math.max(1, (b.items || []).length))}` }, (b.items || []).map((x) => h('div', { class: `ps-card ${x.tone || ''}` },
      x.title ? h('div', { class: 'ps-card-h' }, fill(x.title)) : null, x.big ? h('div', { class: 'ps-big' }, fill(x.big)) : null, richText(x.text), x.kpi ? h('p', { class: 'ps-kpi' }, fill(x.kpi)) : null))),
    bars: (b) => barsOf((b.items || []).map((x) => ({ label: fill(x.label), value: Number(x.value) || 0, text: fill(x.text), tone: x.tone }))),
    liveBars: () => {
      const o = live && live.sales && live.sales.organic;
      if (!o) return h('p', { class: 'ps-lead' }, 'Розподіл за типами покажемо, коли BAS знову буде доступний.');
      const n = (k) => `${int(o.groupOrders[k])} ${plural(o.groupOrders[k], 'замовлення', 'замовлення', 'замовлень')}`;
      return barsOf([
        { label: `Насіння · ${n('seed')}`, value: o.groups.seed, text: usd(o.groups.seed), tone: 'seed' },
        { label: `ЗЗР · ${n('zzr')}`, value: o.groups.zzr, text: usd(o.groups.zzr), tone: 'zzr' },
        { label: `Маленькі упаковки й від шкідників · ${n('small')}`, value: o.groups.small, text: usd(o.groups.small), tone: 'small' },
      ]);
    },
    tasks: () => {
      const t = live && live.tasks;
      if (!t || !t.items || !t.items.length) return h('div', { class: 'ps-card' }, h('div', { class: 'ps-card-h' }, 'Що вже зроблено'), h('p', null, 'Список задач з Notion зараз недоступний.'));
      const done = t.items.filter((x) => x.status === 'Зроблено');
      const paused = t.items.filter((x) => x.status === 'На паузі');
      return h('div', { class: 'ps-card' }, h('div', { class: 'ps-card-h' }, `Що вже зроблено: ${int(t.done)} з ${int(t.total)} задач`),
        h('ul', { class: 'ps-list plain' }, done.slice(0, 5).map((x) => h('li', null, `✅ ${x.title}`)), done.length > 5 ? h('li', null, `і ще ${int(done.length - 5)}`) : null),
        paused.length ? h('p', { class: 'ps-paused' }, `На паузі: ${paused.map((x) => x.title).join('; ')}`) : null);
    },
    note: (b) => h('div', { class: 'ps-note' }, h('span', { class: 'ps-note-i', 'aria-hidden': 'true' }, '💡'), h('span', null, fill(b.text))),
    text: (b) => h('div', { class: 'ps-text' }, richText(b.text)),
    heading: (b) => h('div', { class: 'ps-sec' }, fill(b.text)),
    list: (b) => h('ul', { class: 'ps-list' }, (b.items || []).map((x) => h('li', null, fill(x)))),
    table: (b) => { const two = (b.rows || []).every((r) => r.length <= 2); return h('div', { class: 'ps-table' }, (b.rows || []).map((r) => h('div', { class: `ps-tr${two ? ' two' : ''}` }, h('b', null, fill(r[0])), h('span', null, fill(r[1])), two ? null : h('span', { class: 'ps-do' }, fill(r[2]))))); },
    funnel: (b) => h('div', { class: 'ps-funnel' }, (b.items || []).map((x) => h('div', { class: `ps-fstep${x.hot ? ' hot' : ''}` }, h('i', { style: { width: `${Math.max(4, Math.min(100, Number(x.width) || 0))}%` } }), h('b', null, fill(x.value)), h('span', null, fill(x.label))))),
    timeline: (b) => h('div', { class: 'ps-timeline', style: { gridTemplateColumns: `repeat(${Math.max(1, (b.items || []).length)},minmax(0,1fr))` } }, (b.items || []).map((x) => h('div', { class: `ps-tl ${x.tone || ''}` }, h('div', { class: 'ps-tl-w' }, fill(x.when)), h('p', null, fill(x.what)), h('div', { class: 'ps-tl-c' }, fill(x.check))))),
    decisions: (b) => h('ol', { class: 'ps-decisions' }, (b.items || []).map((x) => h('li', null, h('b', null, fill(x.title)), h('span', null, fill(x.text))))),
  };
  function barsOf(rows) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return h('div', { class: 'ps-bars' }, rows.map((r) => h('div', { class: 'ps-bar-row' },
      h('span', { class: 'ps-bar-l' }, r.label),
      h('span', { class: 'ps-bar-t' }, h('i', { class: r.tone || '', style: { width: `${Math.max(1.5, (r.value / max) * 100)}%` } })),
      h('span', { class: 'ps-bar-v' }, r.text))));
  }
  function drawSlide(sl) {
    const inner = [];
    if (sl.layout === 'title') {
      if (sl.brand) inner.push(h('div', { class: 'ps-brand' }, fill(sl.brand)));
      inner.push(h('h1', { class: 'ps-h1' }, lines(sl.title).flatMap((l, i) => (i ? [h('br'), l] : [l]))));
      if (sl.sub) inner.push(h('p', { class: 'ps-sub' }, fill(sl.sub)));
      if (sl.pill) inner.push(h('div', { class: 'ps-goal-pill' }, fill(sl.pill)));
    } else {
      if (sl.kicker || sl.num) inner.push(h('div', { class: 'ps-kicker' }, sl.num ? h('span', { class: 'ps-num' }, String(sl.num).padStart(2, '0')) : null, fill(sl.kicker)));
      if (sl.title) inner.push(h('h2', { class: 'ps-title' }, fill(sl.title)));
      if (sl.sub) inner.push(h('p', { class: 'ps-lead' }, fill(sl.sub)));
    }
    for (const b of sl.blocks || []) { const f = BLOCK[b.type]; if (f) inner.push(f(b)); }
    if (sl.source) inner.push(h('div', { class: 'ps-src' }, fill(sl.source)));
    if (sl.foot) inner.push(h('div', { class: 'ps-foot' }, fill(sl.foot)));
    const layoutCls = sl.layout === 'title' ? 'dark title' : sl.layout === 'dark' ? 'dark' : '';
    return h('section', { class: `ps-slide ${layoutCls}`, 'aria-roledescription': 'слайд' }, h('div', { class: 'ps-in' }, inner));
  }

  // ---- state ---------------------------------------------------------------------------------------------------------------
  let deckId = null;
  let deck = null;     // as saved on the server
  let draft = null;    // what the editor changes
  let meta = null;
  let at = 0;
  let editing = false;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function renderStage() {
    usedDoc = false;
    const stage = $('stage');
    clear(stage);
    const src = editing ? draft : deck;
    const slides = src.slides.map(drawSlide);
    stage.append(...slides);
    at = Math.max(0, Math.min(slides.length - 1, at));
    slides.forEach((s, k) => { s.hidden = k !== at; });
    $('ps-count').textContent = `${at + 1} / ${slides.length}`;
    $('ps-prev').disabled = at === 0;
    $('ps-next').disabled = at === slides.length - 1;
    if (!editing) status(usedDoc ? 'Частину цифр узято з документа стратегії: BAS або Notion зараз недоступні.' : '', usedDoc);
  }
  function go(i) { at = i; renderStage(); if (editing) renderEditor(); }

  async function openDeck(id) {
    deckId = id;
    const stage = $('stage');
    stage.setAttribute('aria-busy', 'true');
    $('library').hidden = true; $('viewer').hidden = false;
    clear(stage); stage.appendChild(h('div', { class: 'ps-loading' }, 'Збираємо слайди з живих даних…'));
    try {
      const [res, lv] = await Promise.all([apiCall(`/presentations/${id}`), apiCall('/strategy').catch(() => null)]);
      deck = res.deck; meta = res; live = lv; M = markers(lv);
    } catch (err) {
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      clear(stage); stage.appendChild(h('div', { class: 'ps-loading' }, 'Не вдалося відкрити презентацію. Спробуйте ще раз за хвилину.'));
      return;
    }
    at = 0; editing = false;
    $('deck-title').textContent = `${deck.title} · ${deck.who || ''}`;
    $('pe-left').hidden = true; $('pe-right').hidden = true; $('pe-bar').hidden = true; $('ps-edit').hidden = false; document.body.classList.remove('ps-editing');
    renderStage();
    stage.setAttribute('aria-busy', 'false');
    stage.focus();
  }

  async function library() {
    const box = $('library');
    clear(box);
    box.appendChild(h('div', { class: 'ps-loading' }, 'Завантажуємо презентації…'));
    let decks;
    try { decks = (await apiCall('/presentations')).decks; } catch (err) {
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      clear(box); box.appendChild(h('div', { class: 'empty' }, 'Не вдалося завантажити презентації. Спробуйте ще раз за хвилину.')); return;
    }
    clear(box);
    if (!decks.length) { box.appendChild(h('div', { class: 'empty' }, 'Презентацій ще немає.')); return; }
    box.append(...decks.map((d) => {
      const b = h('button', { type: 'button', class: 'ps-deck' },
        h('span', { class: 'ps-deck-cover' }, h('span', null, '🌱'), h('b', null, d.title)),
        h('span', { class: 'ps-deck-t' }, d.title), h('span', { class: 'ps-deck-w' }, `${d.who || ''} · ${d.slides} ${plural(d.slides, 'слайд', 'слайди', 'слайдів')}`), h('span', { class: 'ps-deck-a' }, d.about || ''));
      b.addEventListener('click', () => openDeck(d.id));
      return b;
    }));
    box.setAttribute('aria-busy', 'false');
  }

  // ---- the editor ----------------------------------------------------------------------------------------------------------
  // What each block holds: the fields of one row («items») and their labels. The form is built from this, so a new
  // block type needs a line here and a drawing function above.
  const BLOCK_TYPES = {
    stats: { label: 'Цифри', item: [['label', 'Підпис'], ['value', 'Цифра'], ['sub', 'Під цифрою'], ['accent', 'Виділити кольором', 'bool']], blank: { label: 'Підпис', value: '0', sub: '' } },
    cards: { label: 'Картки', item: [['title', 'Заголовок'], ['big', 'Велика цифра'], ['text', 'Текст (рядок з «- » — пункт списку)', 'area'], ['kpi', 'Результат (зеленим)'], ['tone', 'Колір', 'tone']], blank: { title: 'Заголовок', text: 'Текст' } },
    bars: { label: 'Смуги (порівняння сум)', item: [['label', 'Підпис'], ['value', 'Довжина (число)', 'num'], ['text', 'Що написати праворуч'], ['tone', 'Колір', 'barTone']], blank: { label: 'Підпис', value: 100, text: '100' } },
    liveBars: { label: 'Що купують без менеджера (наживо з BAS)', item: null },
    tasks: { label: 'Що вже зроблено (наживо з Notion)', item: null },
    note: { label: 'Висновок (жовта плашка)', text: true },
    text: { label: 'Текст', text: true },
    heading: { label: 'Підзаголовок', text: true },
    list: { label: 'Список', strings: true },
    table: { label: 'Таблиця', rows: true },
    funnel: { label: 'Воронка', item: [['value', 'Цифра'], ['label', 'Підпис'], ['width', 'Ширина смуги, %', 'num'], ['hot', 'Виділити', 'bool']], blank: { value: '0', label: 'Крок', width: 50 } },
    timeline: { label: 'Етапи', item: [['when', 'Коли'], ['what', 'Що робимо', 'area'], ['check', 'Як перевіряємо'], ['tone', 'Колір', 'tlTone']], blank: { when: 'Коли', what: 'Що', check: '' } },
    decisions: { label: 'Пронумеровані рішення', item: [['title', 'Що'], ['text', 'Пояснення', 'area']], blank: { title: 'Рішення', text: '' } },
  };
  const TONES = { tone: [['', 'Зелений'], ['blue', 'Синій'], ['orange', 'Помаранчевий'], ['red', 'Червоний'], ['gray', 'Сірий']], barTone: [['', 'Зелений'], ['seed', 'Жовтий'], ['small', 'Темний'], ['hot', 'Помаранчевий'], ['zzr', 'Яскраво-зелений']], tlTone: [['', 'Звичайний'], ['now', 'Зараз'], ['hot', 'Сезон']] };
  const LAYOUT = [['content', 'Звичайний (світлий)'], ['dark', 'Темний'], ['title', 'Титульний']];

  let dirty = false;
  const changed = () => { dirty = true; $('pe-save').disabled = false; $('pe-cancel').disabled = false; renderStage(); };
  window.addEventListener('beforeunload', (e) => { if (editing && dirty) { e.preventDefault(); e.returnValue = ''; } });

  // small form controls bound to an object field
  function field(obj, key, label, kind, onChange) {
    const set = (v) => { if (v === '' || v === undefined) delete obj[key]; else obj[key] = v; (onChange || changed)(); };
    let input;
    if (kind === 'area') { input = h('textarea', { rows: 3 }); input.value = obj[key] ?? ''; input.addEventListener('input', () => set(input.value)); }
    else if (kind === 'num') { input = h('input', { type: 'number', step: 'any' }); input.value = obj[key] ?? ''; input.addEventListener('input', () => set(input.value === '' ? '' : Number(input.value))); }
    else if (kind === 'bool') { input = h('input', { type: 'checkbox' }); input.checked = !!obj[key]; input.addEventListener('change', () => set(input.checked || '')); return h('label', { class: 'pe-check' }, input, label); }
    else if (TONES[kind] || kind === 'layout') { input = h('select'); for (const [v, l] of (kind === 'layout' ? LAYOUT : TONES[kind])) input.appendChild(h('option', { value: v }, l)); input.value = obj[key] || ''; input.addEventListener('change', () => { if (kind === 'layout') { obj[key] = input.value; changed(); renderEditor(); } else set(input.value); }); }
    else { input = h('input', { type: 'text' }); input.value = obj[key] ?? ''; input.addEventListener('input', () => set(input.value)); }
    return h('label', { class: 'pe-field' }, h('span', null, label), input);
  }
  // ↑ ↓ ⧉ ✕ for a row of a list
  function rowTools(arr, i, onDone, { copy = true } = {}) {
    const btn = (t, title, fn, dis) => { const b = h('button', { type: 'button', class: 'pe-mini', title, 'aria-label': title, disabled: !!dis }, t); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); changed(); onDone(); }); return b; };
    return h('span', { class: 'pe-tools' },
      btn('↑', 'Вище', () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }, i === 0),
      btn('↓', 'Нижче', () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }, i === arr.length - 1),
      copy ? btn('⧉', 'Копія', () => { arr.splice(i + 1, 0, clone(arr[i])); }) : null,
      btn('✕', 'Видалити', () => { arr.splice(i, 1); }));
  }

  function blockForm(sl, b, j) {
    const T = BLOCK_TYPES[b.type] || { label: b.type };
    const box = h('fieldset', { class: 'pe-block' }, h('legend', null, `${j + 1}. ${T.label}`, rowTools(sl.blocks, j, renderEditor)));
    if (T.text) box.appendChild(field(b, 'text', 'Текст (рядок з «- » — пункт списку)', 'area'));
    if (T.item === null) box.appendChild(h('p', { class: 'pe-hint' }, 'Цей блок заповнюється сам із живих даних.'));
    if (T.strings) {
      b.items = b.items || [];
      b.items.forEach((s, i) => {
        const inp = h('textarea', { rows: 2 }); inp.value = s; inp.addEventListener('input', () => { b.items[i] = inp.value; changed(); });
        box.appendChild(h('div', { class: 'pe-row' }, h('label', { class: 'pe-field' }, h('span', null, `Пункт ${i + 1}`), inp), rowTools(b.items, i, renderEditor)));
      });
      const add = h('button', { type: 'button', class: 'pe-add' }, '+ пункт'); add.addEventListener('click', () => { b.items.push('Новий пункт'); changed(); renderEditor(); }); box.appendChild(add);
    }
    if (T.rows) {
      b.rows = b.rows || [];
      b.rows.forEach((r, i) => {
        const cells = [0, 1, 2].map((k) => { const inp = h('input', { type: 'text', placeholder: ['Що', 'Деталі', 'Що робимо (порожньо — дві колонки)'][k] }); inp.value = r[k] || ''; inp.addEventListener('input', () => { r[k] = inp.value; while (r.length && !r[r.length - 1]) r.pop(); changed(); }); return inp; });
        box.appendChild(h('div', { class: 'pe-row' }, h('div', { class: 'pe-cells' }, cells), rowTools(b.rows, i, renderEditor)));
      });
      const add = h('button', { type: 'button', class: 'pe-add' }, '+ рядок'); add.addEventListener('click', () => { b.rows.push(['Новий рядок', '']); changed(); renderEditor(); }); box.appendChild(add);
    }
    if (T.item) {
      b.items = b.items || [];
      b.items.forEach((it, i) => {
        box.appendChild(h('div', { class: 'pe-item' }, h('div', { class: 'pe-item-h' }, `Рядок ${i + 1}`, rowTools(b.items, i, renderEditor)), T.item.map(([k, l, kind]) => field(it, k, l, kind))));
      });
      const add = h('button', { type: 'button', class: 'pe-add' }, '+ рядок'); add.addEventListener('click', () => { b.items.push(clone(T.blank)); changed(); renderEditor(); }); box.appendChild(add);
    }
    return box;
  }

  function renderEditor() {
    const left = $('pe-left'); const right = $('pe-right');
    clear(left); clear(right);
    // slide list
    const list = h('ol', { class: 'pe-slides' }, draft.slides.map((sl, i) => {
      const li = h('li', { class: i === at ? 'on' : '' }, h('button', { type: 'button', class: 'pe-slide-b' }, `${i + 1}. ${fill(sl.title).split('\n')[0] || 'Без назви'}`), rowTools(draft.slides, i, () => { if (at >= draft.slides.length) at = draft.slides.length - 1; renderStage(); renderEditor(); }));
      li.querySelector('.pe-slide-b').addEventListener('click', () => go(i));
      return li;
    }));
    const addSlide = h('button', { type: 'button', class: 'pe-add' }, '+ слайд');
    addSlide.addEventListener('click', () => { draft.slides.splice(at + 1, 0, { layout: 'content', kicker: 'Розділ', title: 'Новий слайд', blocks: [{ type: 'text', text: 'Текст слайда' }] }); at += 1; changed(); renderEditor(); });

    // the current slide
    const sl = draft.slides[at];
    const form = h('div', { class: 'pe-form' },
      h('div', { class: 'pe-h' }, `Слайд ${at + 1}`),
      field(sl, 'layout', 'Вигляд', 'layout'),
      sl.layout === 'title' ? [field(sl, 'brand', 'Над назвою'), field(sl, 'title', 'Назва (новий рядок — Enter)', 'area'), field(sl, 'sub', 'Підзаголовок', 'area'), field(sl, 'pill', 'Плашка з ціллю'), field(sl, 'foot', 'Підпис унизу')]
        : [field(sl, 'num', 'Номер розділу'), field(sl, 'kicker', 'Розділ (дрібно над заголовком)'), field(sl, 'title', 'Заголовок', 'area'), field(sl, 'sub', 'Підзаголовок', 'area'), field(sl, 'source', 'Джерело (дрібно внизу)'), field(sl, 'foot', 'Підпис унизу')],
      h('div', { class: 'pe-h' }, 'Блоки'),
      (sl.blocks = sl.blocks || []).map((b, j) => blockForm(sl, b, j)));
    const typeSel = h('select', { 'aria-label': 'Тип нового блока' }, Object.entries(BLOCK_TYPES).map(([k, T]) => h('option', { value: k }, T.label)));
    const addBlock = h('button', { type: 'button', class: 'pe-add' }, '+ блок');
    addBlock.addEventListener('click', () => {
      const k = typeSel.value; const T = BLOCK_TYPES[k];
      const b = { type: k };
      if (T.text) b.text = 'Текст';
      if (T.strings) b.items = ['Пункт'];
      if (T.rows) b.rows = [['Що', 'Деталі']];
      if (T.item) b.items = [clone(T.blank)];
      sl.blocks.push(b); changed(); renderEditor();
    });
    form.appendChild(h('div', { class: 'pe-row' }, typeSel, addBlock));

    // markers help
    const help = h('details', { class: 'pe-help' }, h('summary', null, 'Живі цифри: вставте в будь-який текст'),
      h('p', { class: 'pe-hint' }, 'Напишіть назву у фігурних дужках — на слайді з’явиться свіжа цифра. Клік по рядку копіює позначку.'),
      h('ul', null, Object.entries(M).map(([k, [what, val, doc]]) => {
        const li = h('li', null, h('code', null, `{${k}}`), ` — ${what}: `, h('b', null, val ?? `${doc} (з документа)`));
        li.addEventListener('click', () => { try { navigator.clipboard.writeText(`{${k}}`); status(`Скопійовано {${k}}`); } catch { /* no clipboard */ } });
        return li;
      })));

    const deckFields = h('details', { class: 'pe-help' }, h('summary', null, 'Назва й опис презентації'),
      field(draft, 'title', 'Назва'), field(draft, 'who', 'Для кого'), field(draft, 'about', 'Опис у списку презентацій', 'area'));

    // history
    const hist = h('details', { class: 'pe-help' }, h('summary', null, 'Історія змін'),
      meta && meta.edited ? h('p', { class: 'pe-hint' }, `Збережено ${new Date(meta.edited.at).toLocaleString('uk-UA')}${meta.edited.by ? ` · ${meta.edited.by}` : ''}`) : h('p', { class: 'pe-hint' }, 'Зараз показано початковий варіант.'),
      (meta && meta.history && meta.history.length) ? h('ul', null, meta.history.slice(0, 10).map((v) => {
        const b = h('button', { type: 'button', class: 'pe-mini wide' }, 'Повернути'); b.addEventListener('click', () => restore(v.id));
        return h('li', null, `${new Date(v.at).toLocaleString('uk-UA')}${v.by ? ` · ${v.by}` : ''} `, b);
      })) : h('p', { class: 'pe-hint' }, 'Попередніх версій ще немає.'));
    const reset = h('button', { type: 'button', class: 'pe-mini wide danger' }, 'Повернути початковий варіант');
    reset.addEventListener('click', resetDeck);
    hist.appendChild(reset);

    left.append(h('div', { class: 'pe-h' }, 'Слайди'), list, addSlide, deckFields, help, hist);
    right.append(form);
  }

  async function save() {
    $('pe-save').disabled = true;
    status('Зберігаємо…');
    try {
      const res = await apiCall(`/presentations/${deckId}`, { method: 'PUT', body: JSON.stringify({ deck: draft }) });
      deck = res.deck; meta = res; draft = clone(deck); dirty = false;
      $('pe-cancel').disabled = true;
      status('Збережено. Презентацію бачитимуть усі адміністратори.');
      renderStage(); renderEditor();
    } catch (err) { $('pe-save').disabled = false; status(err.message || 'Не вдалося зберегти. Спробуйте ще раз.', true); }
  }
  async function restore(v) {
    if (dirty && !window.confirm('Незбережені зміни пропадуть. Повернути цю версію?')) return;
    try { const res = await apiCall(`/presentations/${deckId}/restore`, { method: 'POST', body: JSON.stringify({ version: v }) }); deck = res.deck; meta = res; draft = clone(deck); dirty = false; status('Версію повернуто.'); renderStage(); renderEditor(); } catch (err) { status(err.message || 'Не вдалося повернути версію.', true); }
  }
  async function resetDeck() {
    if (!window.confirm('Повернути початковий варіант презентації? Ваша версія лишиться в історії.')) return;
    try { const res = await apiCall(`/presentations/${deckId}`, { method: 'DELETE' }); deck = res.deck; meta = res; draft = clone(deck); dirty = false; at = 0; status('Повернуто початковий варіант.'); renderStage(); renderEditor(); } catch (err) { status(err.message || 'Не вдалося.', true); }
  }
  function startEdit() {
    editing = true; draft = clone(deck); dirty = false;
    $('pe-left').hidden = false; $('pe-right').hidden = false; $('ps-edit').hidden = true; $('pe-bar').hidden = false;
    $('pe-save').disabled = true; $('pe-cancel').disabled = true;
    document.body.classList.add('ps-editing');
    status('Зміни видно на слайді одразу. Збережуться після «Зберегти».');
    renderStage(); renderEditor();
  }
  function stopEdit() {
    if (dirty && !window.confirm('Вийти без збереження? Зміни пропадуть.')) return;
    editing = false; dirty = false; draft = null;
    $('pe-left').hidden = true; $('pe-right').hidden = true; $('ps-edit').hidden = false; $('pe-bar').hidden = true;
    document.body.classList.remove('ps-editing');
    $('deck-title').textContent = `${deck.title} · ${deck.who || ''}`;
    renderStage();
  }

  // ---- controls --------------------------------------------------------------------------------------------------------
  $('ps-prev').addEventListener('click', () => go(at - 1));
  $('ps-next').addEventListener('click', () => go(at + 1));
  $('ps-back').addEventListener('click', () => { if (editing) { stopEdit(); if (editing) return; } $('viewer').hidden = true; $('library').hidden = false; status(''); library(); });
  $('ps-full').addEventListener('click', () => { const v = $('stage'); if (document.fullscreenElement) document.exitFullscreen(); else if (v.requestFullscreen) v.requestFullscreen(); });
  // PDF: the browser prints every slide on its own landscape page (see presentations.css @media print).
  $('ps-pdf').addEventListener('click', () => window.print());
  $('ps-edit').addEventListener('click', startEdit);
  $('pe-save').addEventListener('click', save);
  $('pe-cancel').addEventListener('click', () => { if (!window.confirm('Скасувати незбережені зміни?')) return; draft = clone(deck); dirty = false; $('pe-save').disabled = true; $('pe-cancel').disabled = true; renderStage(); renderEditor(); status('Зміни скасовано.'); });
  $('pe-done').addEventListener('click', stopEdit);
  document.addEventListener('keydown', (e) => {
    if ($('viewer').hidden) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return; // typing in the editor
    if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !editing)) { e.preventDefault(); go(at + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(at - 1); }
  });
  // a click on the right half of a slide goes forward, on the left half — back (like a clicker); not while editing
  $('stage').addEventListener('click', (e) => { if (editing) return; const r = $('stage').getBoundingClientRect(); go(e.clientX - r.left > r.width / 2 ? at + 1 : at - 1); });

  library();
})();
