// SytBoard «Редактор стратегії»: every text, number and list of the strategy page, editable. The form is built from
// the strategy itself (whatever is in it can be changed, lists can grow, shrink and be reordered), with Ukrainian
// names for the fields. Saving sends the whole strategy; the server checks its shape and keeps the previous
// version, so any save can be undone from the history below. All text goes through DOM APIs.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('Редактор стратегії доступний лише адміністраторам SytBoard.', true); return; }

  // ---- names and hints ---------------------------------------------------------------------------------------
  const LABELS = {
    source: 'Документ', title: 'Назва', version: 'Версія', updated: 'Оновлено', goal: 'Ціль', amountUsd: 'Сума, $', year: 'Рік',
    text: 'Текст', approved: 'Затверджена', essence: 'Суть одним абзацом', mainCondition: 'Головна умова', seasonStart: 'Початок сезону',
    sections: 'Розділи сторінки', id: 'Що показує', lead: 'Вступний текст', kpis: 'Показники', group: 'Група', name: 'Назва',
    value: 'Значення (вносите вручну)', format: 'Одиниця (хв, шт., % …)', target: 'Ціль — число', targetLater: 'Наступна ціль — число',
    targetText: 'Ціль — як писати на картці', start: 'На старті — число', startText: 'На старті — як писати на картці',
    lowerBetter: 'Менше — краще', note: 'Примітка під карткою', hidden: 'Сховати зі сторінки', terms: 'Терміни', term: 'Термін', meaning: 'Що означає',
    baseline: 'Цифри на старті (з документа)', period: 'Період — текстом', periodFrom: 'Період з', periodTo: 'Період по',
    selfUsd: 'Самостійні продажі, $', managerUsd: 'З менеджером, $', totalUsd: 'Разом, $', selfOrders: 'Самостійних замовлень',
    managerOrders: 'Замовлень з менеджером', groups: 'За групами товарів, $', seed: 'Насіння', zzr: 'ЗЗР', small: 'Дрібне фасування',
    legalBuyers: 'Юросіб загалом', legalSelf: 'Юросіб, що купують самі', legalManagerSeed: 'Юросіб, що беруть насіння з менеджером',
    legalRepeat: 'Юросіб із повторною покупкою', legalAvgUsd: 'Середні витрати юрособи за рік, $', privateUsd: 'Продажі фізособам, $',
    crossLegal: 'Юросіб, що беруть і насіння, і ЗЗР', newLegalPerMonth: 'Нових юросіб на місяць', searchUsersMonth: 'Пошукових відвідувачів на місяць',
    clicksMonth: 'Кліків з Google на місяць', ctr: 'CTR (0,0418 = 4,18%)', position: 'Середня позиція в Google', brandShare: 'Частка брендових запитів (0,83 = 83%)',
    ordersPer1000: 'Замовлень на 1 000 візитів', planProfile: 'Розклад цілі по місяцях', shares: 'Частка кожного місяця',
    sources: 'З чого складається ціль', label: 'Назва', clients: 'Клієнтів', what: 'Що має статися', mainDependency: 'Головна залежність',
    scale: 'Масштаб цілі', directions: 'Напрями', n: 'Номер', metric: 'Показник', stages: 'Етапи', from: 'З', to: 'По', control: 'Контроль',
    positioning: 'Що кажемо', formula: 'Головна формула', advantage: 'Головна перевага', rules: 'Цінові правила', segments: 'Типи клієнтів',
    pains: 'Біль', message: 'Меседж', cta: 'Заклик', say: 'Кажемо', dontSay: 'Не кажемо ніколи', why: 'Чому',
    promoAllowed: 'Які акції можна', promoForbidden: 'Яких акцій не робимо', competitors: 'Конкуренти', intro: 'Вступ',
    columns: 'Колонки: ми та конкуренти', rows: 'Порівняння', criterion: 'Критерій', values: 'Значення', winner: 'Хто виграє',
    conclusions: 'Висновки', investments: 'Інвестиції', item: 'Стаття', amount: 'Сума', decisions: 'Рішення від керівництва',
    risks: 'Ризики', risk: 'Ризик', action: 'Що робимо', dataGaps: 'Чого дашборд поки не бачить', viberPromoCodes: 'Промокоди Viber-воронки',
    tasks: 'Задачі в Notion', notionDatabaseId: 'Код бази «Задачі» в Notion', notionProjectId: 'Код проєкту E-com у Notion', notionUrl: 'Посилання на задачі в Notion',
    directionRules: 'Як задачі розкладаються за напрямами', match: 'Слова в назві задачі (через |)', snapshot: 'Знімок задач (коли Notion недоступний)',
    asOf: 'На дату', items: 'Задачі', status: 'Статус', due: 'Дедлайн', comment: 'Коментар', url: 'Посилання',
  };
  const HINTS = {
    kpis: 'Порядок карток — як тут. Картки з однаковою групою стоять разом. Відсотки пишіть числом у відсотках: 25 означає 25%. Щоб додати свій показник, натисніть «Додати» — він буде з ручним значенням.',
    planProfile: 'Скільки від річної цілі припадає на кожен місяць. Разом має бути 100%.',
    sections: 'Назви розділів і вступні тексти. Якщо вступ порожній, показується текст за замовчуванням.',
    directionRules: 'Задача з Notion потрапляє в перший напрям, у правилі якого є слово з її назви.',
    viberPromoCodes: 'Замовлення з цими промокодами рахуються як покупки з Viber-воронки.',
    baseline: 'Цифри з документа стратегії, з якими порівнюються живі дані.',
  };
  const MONTHS = { '01': 'Січень', '02': 'Лютий', '03': 'Березень', '04': 'Квітень', '05': 'Травень', '06': 'Червень', '07': 'Липень', '08': 'Серпень', '09': 'Вересень', 10: 'Жовтень', 11: 'Листопад', 12: 'Грудень' };
  const KPI_IDS = {
    manual: 'Свій показник — значення вносите вручну', selfUsd: 'Самостійні продажі за 12 місяців (BAS)', legalSelf: 'Юрособи, що купують самі (BAS)',
    legalRepeat: 'Повторні покупки юросіб, % (BAS)', newLegalPerMonth: 'Нові юрособи на місяць (BAS)', legalAvgUsd: 'Середні витрати юрособи, $ (BAS)',
    privateUsd: 'Продажі фізособам, $ (BAS)', privateRepeat: 'Повторні покупки фізосіб, % (BAS)', managerSeedZzr: 'Клієнти насіння з менеджером, що купили ЗЗР самі, % (BAS)',
    crossSeed: 'Покупці насіння, що беруть і ЗЗР, % (BAS)', searchUsers: 'Пошукові відвідувачі на місяць (Google Analytics)', clicks: 'Кліки з Google на місяць (Search Console)',
    ctr: 'CTR у пошуку, % (Search Console)', brandShare: 'Частка брендових запитів, % (Search Console)', nonBrandPosition: 'Позиція за продуктовими запитами (Search Console)',
    ordersPer1000: 'Замовлень на 1 000 візитів (BAS + Google Analytics)', viberOrders: 'Покупки з Viber-воронки (BAS, за промокодами)',
    parity: 'Ціновий паритет із партнерами, % (Ціни на ринку)', tasks100: 'Чекліст «100 днів», % (Notion)',
  };
  const SECTION_IDS = { goal: 'Ціль (верх сторінки)', kpi: 'Показники', path: 'Шлях до цілі', plan: 'Напрями', voice: 'Що кажемо', market: 'Конкуренти й ціни', tasks: 'Етапи й задачі', risks: 'Ризики й рішення' };
  const SELECTS = {
    winner: { us: 'Syngenta', competitors: 'Конкуренти', parity: 'Паритет' },
    status: { 'Не почато': 'Не почато', 'В роботі': 'В роботі', 'На паузі': 'На паузі', 'Зроблено': 'Зроблено' },
  };
  // A new item of these lists starts from a template, not from a copy of the first item.
  const TEMPLATES = {
    kpis: () => ({ id: 'manual', group: 'Viber, ціни, виконання', name: 'Новий показник', value: null, format: '', target: null, targetText: '', start: null, startText: '', lowerBetter: false, note: '', hidden: false }),
  };
  const FIXED = new Set(['sections']); // lists whose items cannot be added or removed (the page has exactly these)
  const LONG = new Set(['essence', 'mainCondition', 'mainDependency', 'lead', 'what', 'control', 'formula', 'advantage', 'pains', 'message', 'why', 'intro', 'action', 'comment', 'note', 'meaning', 'text']);
  const DATE = new Set(['seasonStart', 'updated', 'periodFrom', 'periodTo', 'from', 'to', 'due', 'asOf']);

  // The blocks of the left menu: which top-level keys each one edits.
  const BLOCKS = [
    ['Головне', ['goal', 'essence', 'mainCondition', 'seasonStart', 'source']],
    ['Показники', ['kpis']],
    ['Розділи сторінки', ['sections']],
    ['Цифри на старті', ['baseline']],
    ['План по місяцях', ['planProfile']],
    ['З чого складається ціль', ['sources', 'mainDependency', 'scale']],
    ['Напрями й терміни', ['directions', 'terms']],
    ['Етапи', ['stages']],
    ['Що кажемо', ['positioning']],
    ['Конкуренти', ['competitors']],
    ['Ризики й рішення', ['decisions', 'investments', 'risks', 'dataGaps']],
    ['Viber і задачі', ['viberPromoCodes', 'tasks']],
  ];

  // ---- state -------------------------------------------------------------------------------------------------
  let saved = null; // what the server has
  let draft = null; // what is on the screen
  let meta = null;
  let block = 0;
  const open = new Set(); // paths of list items shown expanded
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const dirty = () => JSON.stringify(saved) !== JSON.stringify(draft);
  const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const key = (path) => path.join('.');
  const getAt = (path) => path.reduce((o, k) => (o == null ? o : o[k]), draft);
  const setAt = (path, v) => { const parent = getAt(path.slice(0, -1)); parent[path[path.length - 1]] = v; changed(); };
  const label = (k) => LABELS[k] || k;

  function changed() {
    const d = dirty();
    $('save').disabled = !d;
    $('undo').disabled = !d;
    if (d) status('Є незбережені зміни.');
    else status(editedText());
  }
  const editedText = () => (meta && meta.edited ? `Збережено ${fmt.time(meta.edited.at)}${meta.edited.by ? ` · ${meta.edited.by}` : ''}.` : 'Зараз на сторінці — версія з документа стратегії (ще не редагувалась на сайті).');

  // A blank of the same shape: texts empty, numbers empty, lists empty, yes/no off.
  function blank(v) {
    const k = kindOf(v);
    if (k === 'string') return '';
    if (k === 'number' || k === 'null') return null;
    if (k === 'boolean') return false;
    if (k === 'array') return [];
    if (k === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, blank(x)]));
    return null;
  }

  // ---- fields ------------------------------------------------------------------------------------------------
  const autosize = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.max(38, ta.scrollHeight + 2)}px`; };
  let uid = 0;
  function field(path, k, v, labelText) {
    const id = `f${++uid}`;
    const lab = labelText === null ? null : h('label', { for: id }, labelText || label(k));
    const parentKey = path[path.length - 3];
    let input;
    if (k === 'id' && parentKey === 'kpis') {
      input = h('select', { id }, Object.entries(KPI_IDS).map(([val, t]) => h('option', { value: val, selected: val === v }, t)));
      if (!(v in KPI_IDS)) input.appendChild(h('option', { value: v, selected: true }, v));
      input.addEventListener('change', () => { setAt(path, input.value); if (input.value === 'manual') { const it = getAt(path.slice(0, -1)); if (!('value' in it)) { it.value = null; it.format = ''; } } render(); });
    } else if (k === 'id' && parentKey === 'sections') {
      input = h('div', { class: 'se-ro' }, SECTION_IDS[v] || v);
    } else if (SELECTS[k] && typeof v === 'string') {
      input = h('select', { id }, Object.entries(SELECTS[k]).map(([val, t]) => h('option', { value: val, selected: val === v }, t)));
      input.addEventListener('change', () => setAt(path, input.value));
    } else if (typeof v === 'boolean') {
      input = h('input', { id, type: 'checkbox', checked: v });
      input.addEventListener('change', () => setAt(path, input.checked));
      return h('div', { class: 'se-f se-check' }, input, lab);
    } else if (typeof v === 'number' || v === null) {
      input = h('input', { id, type: 'number', step: 'any', value: v === null ? '' : String(v), inputmode: 'decimal' });
      input.addEventListener('input', () => { const t = input.value.trim().replace(',', '.'); setAt(path, t === '' ? null : Number(t)); });
    } else if (DATE.has(k) && /^\d{4}-\d{2}-\d{2}/.test(v || '')) {
      input = h('input', { id, type: 'date', value: v.slice(0, 10) });
      input.addEventListener('input', () => setAt(path, input.value));
    } else if (LONG.has(k) || String(v).length > 70) {
      input = h('textarea', { id, rows: 2 });
      input.value = v;
      input.addEventListener('input', () => { autosize(input); setAt(path, input.value); });
      requestAnimationFrame(() => autosize(input));
    } else {
      input = h('input', { id, type: 'text', value: v });
      input.addEventListener('input', () => setAt(path, input.value));
    }
    return h('div', { class: 'se-f' }, lab, input);
  }

  // The 12 month shares as percentages with their total.
  function sharesField(path, obj) {
    const total = h('div', { class: 'se-total' });
    const upd = () => { const t = Object.values(getAt(path)).reduce((a, b) => a + (Number(b) || 0), 0); total.textContent = `Разом: ${Math.round(t * 1000) / 10}%`; total.classList.toggle('bad', Math.abs(t - 1) > 0.005); };
    const grid = h('div', { class: 'se-months' }, Object.keys(obj).sort().map((m) => {
      const id = `f${++uid}`;
      const input = h('input', { id, type: 'number', step: '0.5', min: 0, max: 100, value: String(Math.round(obj[m] * 1000) / 10) });
      input.addEventListener('input', () => { const t = input.value.trim().replace(',', '.'); getAt(path)[m] = t === '' ? 0 : Number(t) / 100; changed(); upd(); });
      return h('div', { class: 'se-f' }, h('label', { for: id }, `${MONTHS[m] || m}, %`), input);
    }));
    upd();
    return h('div', null, grid, total);
  }

  // A short name for a list item, for its collapsed header.
  function itemName(v, i) {
    if (kindOf(v) !== 'object') return String(v);
    const t = v.name || v.title || v.label || v.criterion || v.item || v.risk || v.text || v.term || (v.id && (SECTION_IDS[v.id] || KPI_IDS[v.id])) || v.n || '';
    return `${i + 1}. ${t || '(без назви)'}${v.hidden ? ' · сховано' : ''}`;
  }

  function listControls(path, i, len, fixed) {
    const arr = () => getAt(path);
    const move = (to) => { const a = arr(); const [x] = a.splice(i, 1); a.splice(to, 0, x); changed(); render(); };
    return h('span', { class: 'se-ctl' },
      h('button', { type: 'button', title: 'Вище', 'aria-label': 'Перемістити вище', disabled: i === 0, onclick: (e) => { e.preventDefault(); move(i - 1); } }, '↑'),
      h('button', { type: 'button', title: 'Нижче', 'aria-label': 'Перемістити нижче', disabled: i === len - 1, onclick: (e) => { e.preventDefault(); move(i + 1); } }, '↓'),
      fixed ? null : h('button', { type: 'button', class: 'del', title: 'Видалити', 'aria-label': 'Видалити', onclick: (e) => { e.preventDefault(); if (confirm('Видалити цей пункт?')) { arr().splice(i, 1); changed(); render(); } } }, '✕'));
  }

  function node(path, k, v) {
    const kind = kindOf(v);
    if (k === 'shares') return h('fieldset', { class: 'se-group' }, h('legend', null, label(k)), sharesField(path, v));
    if (kind === 'object') {
      return h('fieldset', { class: 'se-group' }, h('legend', null, label(k)), HINTS[k] ? h('p', { class: 'se-hint' }, HINTS[k]) : null,
        Object.entries(v).map(([kk, x]) => node([...path, kk], kk, x)));
    }
    if (kind === 'array') return listNode(path, k, v);
    return field(path, k, v);
  }

  function listNode(path, k, arr) {
    const fixed = FIXED.has(k);
    const columns = k === 'values' && path[path.length - 3] === 'rows' ? draft.competitors.columns : null;
    const items = arr.map((x, i) => {
      const p = [...path, i];
      if (kindOf(x) === 'object' || kindOf(x) === 'array') {
        const det = h('details', { class: 'se-item', open: open.has(key(p)) || null },
          h('summary', null, h('span', { class: 'se-name' }, itemName(x, i)), listControls(path, i, arr.length, fixed)),
          kindOf(x) === 'object' ? Object.entries(x).map(([kk, y]) => node([...p, kk], kk, y)) : listNode(p, '', x));
        det.addEventListener('toggle', () => { if (det.open) open.add(key(p)); else open.delete(key(p)); });
        return det;
      }
      return h('div', { class: 'se-row' }, field(p, k, x, columns ? columns[i] || `Колонка ${i + 1}` : null), listControls(path, i, arr.length, fixed));
    });
    const add = fixed ? null : h('button', { type: 'button', class: 'se-add', onclick: () => {
      const a = getAt(path);
      const item = TEMPLATES[k] ? TEMPLATES[k]() : a.length ? blank(a[0]) : '';
      a.push(item);
      if (kindOf(item) === 'object') open.add(key([...path, a.length - 1]));
      changed(); render();
    } }, '+ Додати');
    return h('fieldset', { class: 'se-group se-list' }, k ? h('legend', null, `${label(k)} (${arr.length})`) : null, HINTS[k] ? h('p', { class: 'se-hint' }, HINTS[k]) : null, items, add);
  }

  // ---- layout ------------------------------------------------------------------------------------------------
  function render() {
    const nav = clear($('blocks'));
    BLOCKS.forEach(([name], i) => nav.appendChild(h('button', { type: 'button', 'aria-current': i === block ? 'true' : null, onclick: () => { block = i; render(); window.scrollTo({ top: 0 }); } }, name)));
    const form = clear($('form'));
    const [name, keys] = BLOCKS[block];
    form.appendChild(h('h2', null, name));
    for (const k of keys) if (k in draft) form.appendChild(node([k], k, draft[k]));
    form.appendChild(historyCard());
  }

  function historyCard() {
    const list = (meta.history || []).map((x) => h('li', null,
      h('span', null, `${fmt.time(x.at)}${x.by ? ` · ${x.by}` : ''}`),
      h('button', { type: 'button', onclick: () => restore(x.id) }, 'Повернути')));
    return h('details', { class: 'se-history' }, h('summary', null, `Попередні версії (${list.length})`),
      list.length ? h('ul', null, list) : h('p', { class: 'se-hint' }, 'Тут з’являться версії після першого збереження.'),
      h('button', { type: 'button', class: 'del', onclick: resetAll, disabled: !meta.edited }, 'Повернути версію з документа стратегії'));
  }

  // ---- server ------------------------------------------------------------------------------------------------
  function apply(r) {
    meta = { edited: r.edited, history: r.history };
    if (r.content) { saved = r.content; draft = clone(saved); }
    else saved = clone(draft);
    changed();
    render();
  }
  async function load() {
    try { apply(await apiCall('/strategy/content')); $('editor').setAttribute('aria-busy', 'false'); } catch (err) { status(`Не вдалося завантажити: ${err.message}`, true); }
  }
  $('save').addEventListener('click', async () => {
    $('save').disabled = true;
    status('Зберігаємо…');
    try { apply(await apiCall('/strategy/content', { method: 'PUT', body: JSON.stringify({ content: draft }) })); status(`${editedText()} Сторінка «Стратегія» вже показує нову версію.`); } catch (err) { status(err.message, true); $('save').disabled = false; }
  });
  $('undo').addEventListener('click', () => { if (!confirm('Скасувати всі незбережені зміни?')) return; draft = clone(saved); changed(); render(); });
  async function restore(id) {
    if (dirty() && !confirm('Незбережені зміни пропадуть. Повернути цю версію?')) return;
    try { apply(await apiCall('/strategy/content/restore', { method: 'POST', body: JSON.stringify({ id }) })); status('Версію повернуто.'); } catch (err) { status(err.message, true); }
  }
  async function resetAll() {
    if (!confirm('Повернути текст і цифри з документа стратегії? Поточна версія залишиться в попередніх.')) return;
    try { apply(await apiCall('/strategy/content', { method: 'DELETE' })); status('Повернуто версію з документа стратегії.'); } catch (err) { status(err.message, true); }
  }
  window.addEventListener('beforeunload', (e) => { if (draft && dirty()) { e.preventDefault(); e.returnValue = ''; } });
  load();
})();
