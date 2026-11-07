// SytBoard «Задачі»: a three-column board (to do / in progress / done) over /api/tasks, with filters.
// A task card links back to the place it was created from. All text goes through DOM APIs.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  };

  let me;
  try { me = await apiCall('/auth/me'); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const VIEWS = [['open', 'Відкриті'], ['mine', 'Мої'], ['overdue', 'Прострочені'], ['done', 'Виконані'], ['all', 'Усі']];
  const COLUMNS = [['todo', 'До виконання'], ['doing', 'В роботі'], ['done', 'Виконано']];
  const params = new URLSearchParams(location.search);
  const state = { view: VIEWS.some(([id]) => id === params.get('view')) ? params.get('view') : 'open', q: '', area: params.get('area') || '' };

  const area = $('area');
  area.appendChild(el('option', { value: '' }, 'Усі розділи'));
  for (const [id, label] of Object.entries(TaskUI.AREA_LABEL)) area.appendChild(el('option', { value: id, selected: state.area === id }, label));

  function drawViews() {
    const box = $('views');
    while (box.firstChild) box.removeChild(box.firstChild);
    for (const [id, label] of VIEWS) {
      const b = el('button', { type: 'button', 'aria-pressed': String(state.view === id) }, label);
      b.addEventListener('click', () => { state.view = id; drawViews(); load(); });
      box.appendChild(b);
    }
  }

  function query() {
    const q = new URLSearchParams();
    if (state.view === 'mine') { q.set('assignee', 'me'); q.set('status', 'todo,doing'); }
    if (state.view === 'open') q.set('status', 'todo,doing');
    if (state.view === 'done') q.set('status', 'done');
    if (state.view === 'overdue') q.set('overdue', '1');
    if (state.area) q.set('area', state.area);
    if (state.q) q.set('q', state.q);
    return q.toString();
  }

  const deadlineEl = (t) => {
    if (!t.deadline) return el('span', { class: 'dl' }, 'без дедлайну');
    const cls = t.overdue ? 'late' : (t.status !== 'done' && t.deadline <= addDays(today, 2) ? 'soon' : '');
    return el('span', { class: `dl ${cls}`.trim() }, `до ${t.deadline}${t.overdue ? ' · прострочено' : t.deadline === today && t.status !== 'done' ? ' · сьогодні' : ''}`);
  };

  async function setStatus(t, next) {
    try { await apiCall(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); await load(); } catch (e) { status(e.message, true); }
  }

  function card(t) {
    const canEdit = me.role === 'admin' || t.createdBy === me.email;
    const acts = el('div', { class: 'acts' });
    if (t.status === 'todo') acts.appendChild(el('button', { type: 'button', onclick: () => setStatus(t, 'doing') }, 'Взяти в роботу'));
    if (t.status !== 'done') acts.appendChild(el('button', { type: 'button', class: 'ok', onclick: () => setStatus(t, 'done') }, '✓ Виконано'));
    else acts.appendChild(el('button', { type: 'button', onclick: () => setStatus(t, 'todo') }, 'Повернути'));
    if (canEdit || t.assignee === me.email) acts.appendChild(el('button', { type: 'button', onclick: () => TaskUI.open({ ...t, area: t.area }, load) }, 'Редагувати'));
    if (canEdit) acts.appendChild(el('button', { type: 'button', onclick: async () => { if (!window.confirm('Видалити задачу?')) return; try { await apiCall(`/tasks/${t.id}`, { method: 'DELETE' }); await load(); } catch (e) { status(e.message, true); } } }, 'Видалити'));
    return el('article', { class: `tk-card p-${t.priority}${t.overdue ? ' late' : ''}` },
      el('div', { class: 'tt' }, t.title),
      el('div', { class: 'meta' }, deadlineEl(t), el('span', null, t.assignee ? `виконавець: ${t.assignee}` : 'без виконавця'), t.priority === 'high' ? el('span', null, '▲ високий') : null),
      t.link || t.context ? el('div', { class: 'where' }, `${TaskUI.AREA_LABEL[t.area] || ''}${t.context ? ` · ${t.context}` : ''} `, t.link ? el('a', { href: t.link }, 'Відкрити місце ↗') : null) : null,
      t.description ? el('div', { class: 'desc' }, t.description) : null,
      el('div', { class: 'meta' }, el('span', null, `створив ${t.createdBy}, ${t.createdAt.slice(0, 10)}`)),
      acts);
  }

  async function load() {
    $('board').setAttribute('aria-busy', 'true');
    status('Завантаження…');
    try {
      const { tasks } = await apiCall(`/tasks?${query()}`);
      const board = $('board');
      while (board.firstChild) board.removeChild(board.firstChild);
      const cols = el('div', { class: 'tk-board' });
      for (const [id, label] of COLUMNS) {
        const items = tasks.filter((t) => t.status === id);
        cols.appendChild(el('section', { class: 'tk-col', 'aria-label': label },
          el('h3', null, el('span', null, label), el('span', null, String(items.length))),
          items.length ? items.map(card) : el('div', { class: 'tk-empty' }, 'Немає задач')));
      }
      board.appendChild(cols);
      board.setAttribute('aria-busy', 'false');
      status('');
    } catch (e) {
      if (e.status === 401) { window.location.href = 'login.html'; return; }
      status('Не вдалося завантажити задачі. Спробуйте оновити сторінку.', true);
    }
  }

  let timer;
  $('q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 250); });
  area.addEventListener('change', () => { state.area = area.value; load(); });
  $('new-task').addEventListener('click', () => TaskUI.open({ area: 'tasks', link: '', context: '' }, load));
  window.addEventListener('tasks:changed', load);
  drawViews();
  load();
})();
