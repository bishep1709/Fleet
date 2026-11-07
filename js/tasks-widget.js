// Task creation / editing dialog shared by every page. A task remembers the place it was created from
// (a relative in-app link), so "Відкрити місце" brings you back to exactly that section or price group.
//   TaskUI.button(preset | () => preset)  → a "＋ задача" button
//   TaskUI.open(preset, onSaved)          → opens the dialog (preset.id = edit that task)
// preset: { title, description, assignee, deadline, priority, status, area, context, link, id }
(function () {
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
  const AREA_LABEL = { pulse: 'Пульс дня', report: 'Деталі', prices: 'Ціни на ринку', tasks: 'Задачі', other: 'Інше' };
  const pageName = () => (location.pathname.split('/').pop() || 'day.html');
  // The build stamp (?v=…) of the menu links is not part of a place.
  const here = () => { const q = new URLSearchParams(location.search); q.delete('v'); const s = q.toString(); return `${pageName()}${s ? `?${s}` : ''}${location.hash}`; };
  const areaHere = () => ({ 'home.html': 'pulse', 'day.html': 'pulse', 'report.html': 'report', 'prices.html': 'prices', 'tasks.html': 'tasks' }[pageName().toLowerCase()] || 'other');
  const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

  function toast(text, href, linkText) {
    let t = document.getElementById('task-toast');
    if (!t) { t = el('div', { id: 'task-toast', class: 'task-toast', role: 'status' }); document.body.appendChild(t); }
    t.textContent = `${text} `;
    if (href) t.appendChild(el('a', { href }, linkText || 'Відкрити'));
    t.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('on'), 6000);
  }

  let peopleCache = null;
  function people() {
    if (!peopleCache) peopleCache = apiCall('/tasks/people').then((r) => r.people || []).catch(() => []);
    return peopleCache;
  }

  function open(preset, onSaved) {
    const p = typeof preset === 'function' ? preset() : (preset || {});
    const editing = !!p.id;
    const link = p.link !== undefined ? p.link : here();
    const area = p.area || areaHere();
    const prev = document.activeElement;

    const title = el('input', { id: 'tk-title', type: 'text', maxlength: '200', value: p.title || '', placeholder: 'Що потрібно зробити' });
    const desc = el('textarea', { id: 'tk-desc', rows: '4', maxlength: '2000', placeholder: 'Подробиці, критерій готовності, посилання' });
    desc.value = p.description || '';
    const list = el('datalist', { id: 'tk-people' });
    const assignee = el('input', { id: 'tk-assignee', type: 'email', list: 'tk-people', value: p.assignee || '', placeholder: 'name@syngenta.com', autocomplete: 'off' });
    const deadline = el('input', { id: 'tk-deadline', type: 'text', inputmode: 'numeric', maxlength: '10', value: p.deadline || '', placeholder: 'РРРР-ММ-ДД', autocomplete: 'off' });
    const chips = el('span', { class: 'tk-chips' }, [['+3 дні', 3], ['+7', 7], ['+14', 14], ['+30', 30]].map(([label, n]) =>
      el('button', { type: 'button', class: 'tk-chip', onclick: () => { deadline.value = addDays(today(), n); } }, label)));
    const priority = el('select', { id: 'tk-priority' }, [['normal', 'Звичайний'], ['high', 'Високий'], ['low', 'Низький']].map(([v, l]) => el('option', { value: v, selected: (p.priority || 'normal') === v }, l)));
    const status = el('select', { id: 'tk-status' }, [['todo', 'До виконання'], ['doing', 'В роботі'], ['done', 'Виконано']].map(([v, l]) => el('option', { value: v, selected: (p.status || 'todo') === v }, l)));
    const err = el('div', { class: 'tk-err', role: 'alert' });
    const save = el('button', { type: 'submit', class: 'tk-primary' }, editing ? 'Зберегти' : 'Створити задачу');
    const cancel = el('button', { type: 'button', class: 'tk-cancel' }, 'Скасувати');
    const field = (label, control, hint) => el('label', { class: 'tk-field' }, el('span', { class: 'tk-l' }, label), control, hint ? el('span', { class: 'tk-h' }, hint) : null);
    const place = (p.context || link)
      ? el('div', { class: 'tk-place' }, el('span', { class: 'tk-l' }, 'Місце в системі'), el('div', null, `${AREA_LABEL[area] || ''}${p.context ? ` · ${p.context}` : ''}`), link ? el('a', { href: link, target: '_blank', rel: 'noopener' }, 'Відкрити місце ↗') : null)
      : null;

    const form = el('form', { class: 'tk-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': editing ? 'Редагування задачі' : 'Нова задача', novalidate: true },
      el('h2', null, editing ? 'Задача' : 'Нова задача'),
      field('Назва', title),
      field('Опис', desc),
      el('div', { class: 'tk-row' },
        field('Виконавець (e-mail)', assignee, 'Корпоративна адреса @syngenta.com'),
        field('Дедлайн', el('span', { class: 'tk-dl' }, deadline, chips))),
      el('div', { class: 'tk-row' }, field('Пріоритет', priority), editing ? field('Статус', status) : null),
      place, list, err, el('div', { class: 'tk-actions' }, save, cancel));
    const overlay = el('div', { class: 'tk-overlay' }, form);
    document.body.appendChild(overlay);
    document.body.classList.add('tk-lock');

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() { overlay.remove(); document.body.classList.remove('tk-lock'); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); }
    document.addEventListener('keydown', onKey);
    cancel.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    people().then((all) => { for (const email of all) list.appendChild(el('option', { value: email })); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (deadline.value.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(deadline.value.trim())) { err.textContent = 'Дедлайн: вкажіть дату як РРРР-ММ-ДД.'; return; }
      const body = { title: title.value, description: desc.value, assignee: assignee.value.trim(), deadline: deadline.value.trim(), priority: priority.value };
      if (editing) body.status = status.value;
      else Object.assign(body, { area, context: p.context || '', link: link || '' });
      save.disabled = true;
      try {
        const saved = await apiCall(editing ? `/tasks/${p.id}` : '/tasks', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
        close();
        if (pageName().toLowerCase() !== 'tasks.html') toast(editing ? 'Задачу збережено.' : 'Задачу створено.', 'tasks.html?v=20261017c', 'Усі задачі →');
        if (onSaved) onSaved(saved);
        window.dispatchEvent(new CustomEvent('tasks:changed', { detail: saved }));
      } catch (ex) { err.textContent = ex.message || 'Не вдалося зберегти'; save.disabled = false; }
    });
    title.focus();
    if (!editing) title.setSelectionRange(title.value.length, title.value.length);
  }

  function button(preset, opts = {}) {
    const b = el('button', { type: 'button', class: `taskbtn${opts.small ? ' sm' : ''}`, title: 'Створити задачу з прив’язкою до цього місця', 'aria-label': 'Створити задачу' }, opts.small ? '＋' : '＋ задача');
    b.addEventListener('click', (e) => { e.stopPropagation(); open(preset); });
    return b;
  }

  window.TaskUI = { open, button, here, areaHere, AREA_LABEL };
})();
