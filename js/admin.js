// Admin page: AI provider settings (write-only key) and user management.
// All text is rendered with DOM APIs; the API key is never read back into the page.
const $a = (id) => document.getElementById(id);
const PROVIDER_HINT = { anthropic: 'sk-ant-…', openai: 'sk-…' };

function say(target, tone, text) {
  clear(target);
  if (text) target.appendChild(h('div', { class: `notice ${tone === 'error' ? 'crit' : tone === 'ok' ? 'good' : ''}`, role: tone === 'error' ? 'alert' : 'status' }, text));
}

// ---------------------------------------------------------------- AI settings
async function renderAi() {
  const body = $a('ai-body');
  let s;
  try { s = await api.adminAi(); } catch (err) { clear(body); body.appendChild(h('div', { class: 'notice crit' }, `Не вдалося завантажити налаштування: ${err.message}`)); return; }
  clear(body);

  const providers = s.providers || {};
  const current = s.configured ? s.provider : 'anthropic';
  const out = h('div', { 'aria-live': 'polite' });

  const provider = h('select', { id: 'ai-provider', 'aria-label': 'Провайдер' }, Object.entries(providers).map(([id, p]) => h('option', { value: id, selected: id === current }, p.label)));
  const model = h('input', { id: 'ai-model', type: 'text', maxlength: '80', autocomplete: 'off', value: s.configured ? s.model : '', placeholder: (providers[current] || {}).defaultModel || '' });
  const key = h('input', { id: 'ai-key', type: 'password', autocomplete: 'new-password', spellcheck: 'false', placeholder: s.configured ? `•••• ${s.keyLast4} — залиште порожнім, щоб не змінювати` : PROVIDER_HINT[current] });
  const titles = h('input', { id: 'ai-titles', type: 'checkbox', checked: !!s.includeTaskTitles });
  provider.addEventListener('change', () => {
    model.placeholder = (providers[provider.value] || {}).defaultModel || '';
    key.placeholder = PROVIDER_HINT[provider.value] || '';
  });

  const save = h('button', { type: 'button', class: 'btn btn-primary' }, 'Зберегти');
  const test = h('button', { type: 'button', class: 'btn' }, 'Перевірити зʼєднання');
  const clearBtn = h('button', { type: 'button', class: 'btn' }, 'Видалити ключ');
  clearBtn.hidden = !s.configured;
  test.hidden = !s.configured;

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api.adminAiSave({ provider: provider.value, model: model.value.trim() || undefined, apiKey: key.value.trim() || undefined, includeTaskTitles: titles.checked });
      key.value = '';
      await renderAi();
      say($a('ai-msg'), 'ok', 'Збережено. Натисніть «Перевірити зʼєднання».');
    } catch (err) { say(out, 'error', err.message); } finally { save.disabled = false; }
  });
  test.addEventListener('click', async () => {
    test.disabled = true; test.textContent = 'Перевіряю…';
    try {
      const r = await api.adminAiTest();
      say(out, 'ok', `Зʼєднання працює: ${r.provider}, модель ${r.model}, відповідь за ${(r.ms / 1000).toFixed(1)} с.`);
    } catch (err) { say(out, 'error', err.message); } finally { test.disabled = false; test.textContent = 'Перевірити зʼєднання'; }
  });
  clearBtn.addEventListener('click', async () => {
    if (!window.confirm('Видалити збережений ключ? Vira перестане відповідати, доки не буде додано новий.')) return;
    try { await api.adminAiClear(); await renderAi(); } catch (err) { say(out, 'error', err.message); }
  });

  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'l' }, label), control, hint ? h('span', { class: 'bar-note' }, hint) : null);
  body.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', null, h('h3', null, s.configured ? `Підключено: ${(providers[s.provider] || {}).label || s.provider}` : 'Ще не підключено'),
      h('p', { class: 'sub' }, s.configured ? `Модель ${s.model} · ключ …${s.keyLast4}` : 'Додайте ключ Anthropic (Claude) або OpenAI, щоб Vira почала відповідати'))),
    h('div', { class: 'form-grid' },
      field('Провайдер', provider),
      field('Модель', model, 'Порожньо — модель за замовчуванням'),
      field('API-ключ', key, 'Записується зашифрованим; після збереження повернути його неможливо')),
    h('label', { class: 'check' }, titles, h('span', null, 'Передавати назви задач Notion до ШІ (за замовчуванням вимкнено — назви можуть містити внутрішні деталі)')),
    h('p', { class: 'bar-note' }, 'До зовнішнього провайдера потрапляють лише агрегати: суми, кількості, трафік, стан задач. Даних клієнтів у системі немає. Переконайтесь, що це відповідає політиці Syngenta щодо зовнішніх ШІ-сервісів.'),
    h('div', { class: 'actions' }, save, test, clearBtn),
    h('div', { id: 'ai-msg' }), out));
}

// ---------------------------------------------------------------- Microsoft Clarity
async function renderClarity() {
  const body = $a('clarity-body');
  let s;
  try { s = await api.adminClarity(); } catch (err) { clear(body); body.appendChild(h('div', { class: 'notice crit' }, `Не вдалося завантажити налаштування: ${err.message}`)); return; }
  clear(body);
  const out = h('div', { 'aria-live': 'polite' });
  const token = h('input', { id: 'clarity-token', type: 'password', autocomplete: 'new-password', spellcheck: 'false', placeholder: s.configured ? `•••• ${s.tokenLast4} — залиште порожнім, щоб не змінювати` : 'eyJhbGci…' });
  const save = h('button', { type: 'button', class: 'btn btn-primary' }, 'Зберегти');
  const clearBtn = h('button', { type: 'button', class: 'btn' }, 'Видалити токен');
  clearBtn.hidden = !(s.configured && s.source === 'admin');
  save.addEventListener('click', async () => {
    if (!token.value.trim()) { say(out, 'error', 'Вставте токен.'); return; }
    save.disabled = true;
    try { await api.adminClaritySave(token.value.trim()); token.value = ''; await renderClarity(); } catch (err) { say(out, 'error', err.message); } finally { save.disabled = false; }
  });
  clearBtn.addEventListener('click', async () => {
    if (!window.confirm('Видалити токен Clarity? Вкладка «Поведінка» залишиться без даних Clarity.')) return;
    try { await api.adminClarityClear(); await renderClarity(); } catch (err) { say(out, 'error', err.message); }
  });
  const lf = s.lastFetch;
  const last = lf ? (lf.ok ? `Останнє отримання: ${lf.at.slice(0, 16).replace('T', ' ')} UTC, ${lf.sessions} візитів.` : `Остання спроба ${lf.at.slice(0, 16).replace('T', ' ')} UTC не вдалася: ${lf.error}`) : 'Дані ще не отримувались: це станеться під час наступного ранкового звіту.';
  body.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', null, h('h3', null, s.configured ? 'Підключено' : 'Ще не підключено'),
      h('p', { class: 'sub' }, s.configured ? `Токен …${s.tokenLast4}${s.source === 'env' ? ' (зі змінних середовища сервера)' : ''}. ${last}` : 'Clarity → Settings → Data Export → Generate new API token (потрібна роль Admin у проєкті).'))),
    h('div', { class: 'form-grid' }, h('label', { class: 'field' }, h('span', { class: 'l' }, 'API-токен'), token, h('span', { class: 'bar-note' }, 'Записується зашифрованим; після збереження повернути його неможливо'))),
    h('p', { class: 'bar-note' }, 'Clarity дозволяє 10 запитів на добу; звіт використовує 2 щоранку. Через цей API приходять лише агрегати (кліки, прокрутка, помилки за сторінками), без персональних даних.'),
    h('div', { class: 'actions' }, save, clearBtn), out));
}

// ---------------------------------------------------------------- Google Ads
async function renderGoogleAds() {
  const body = $a('gads-body');
  let s;
  try { s = await api.adminGoogleAds(); } catch (err) { clear(body); body.appendChild(h('div', { class: 'notice crit' }, `Не вдалося завантажити стан: ${err.message}`)); return; }
  clear(body);
  const out = h('div', { 'aria-live': 'polite' });
  const test = h('button', { type: 'button', class: 'btn btn-primary' }, 'Перевірити зʼєднання');
  test.hidden = !s.configured;
  test.addEventListener('click', async () => {
    test.disabled = true; test.textContent = 'Перевіряю…';
    try {
      const r = await api.adminGoogleAdsTest();
      say(out, 'ok', `Працює. Акаунт: ${r.account || '—'} (${r.currency || '—'}). За останні 7 днів на рекламу пішло ${fmt.int(r.cost)} ${r.currency === 'UAH' ? 'грн' : r.currency || ''}, кампаній з витратами: ${r.campaigns}.`);
    } catch (err) { say(out, 'error', err.message); } finally { test.disabled = false; test.textContent = 'Перевірити зʼєднання'; }
  });
  const missing = s.missing.length ? h('ul', { class: 'bar-note' }, s.missing.map((m) => h('li', null, h('code', null, m.name), ` — ${m.what}`))) : null;
  body.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', null, h('h3', null, s.configured ? 'Підключено' : 'Ще не підключено'),
      h('p', { class: 'sub' }, s.configured ? 'Усі потрібні ключі на місці. Натисніть кнопку, щоб перевірити, що Google їх приймає.' : 'У налаштуваннях сервера (файл .env) ще бракує:'))),
    missing, h('div', { class: 'actions' }, test), out));
}

// ---------------------------------------------------------------- national search demand (snapshot from a file)
// A file from the Looker Studio report or from Google's Keyword Planner is read in the browser and sent as text.
async function readExportFile(file) {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf);
  // the Keyword Planner saves UTF-16 (a byte-order mark FF FE / FE FF), Looker saves UTF-8
  const enc = b[0] === 0xff && b[1] === 0xfe ? 'utf-16le' : b[0] === 0xfe && b[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(enc).decode(buf);
}
async function renderDemand() {
  const body = $a('demand-body');
  let s;
  try { s = await api.adminDemand(); } catch (err) { clear(body); body.appendChild(h('div', { class: 'notice crit' }, `Не вдалося завантажити стан: ${err.message}`)); return; }
  clear(body);
  const out = h('div', { 'aria-live': 'polite' });
  const kind = h('select', { id: 'demand-kind', 'aria-label': 'Що в файлі' },
    h('option', { value: 'groups' }, 'Групи товарів (фунгіциди, гербіциди …) — задають період'),
    h('option', { value: 'products' }, 'Препарати (Квадріс, Актара …)'),
    h('option', { value: 'keywords' }, 'Ключові слова'));
  const file = h('input', { type: 'file', id: 'demand-file', accept: '.csv,.tsv,.txt', 'aria-label': 'Файл' });
  const go = h('button', { type: 'button', class: 'btn btn-primary' }, 'Оновити знімок попиту');
  go.addEventListener('click', async () => {
    const f = file.files && file.files[0];
    if (!f) { say(out, 'error', 'Оберіть файл.'); return; }
    if (f.size > 1500000) { say(out, 'error', 'Файл завеликий (понад 1,5 МБ).'); return; }
    go.disabled = true; go.textContent = 'Завантажую…';
    try {
      const r = await api.adminDemandImport({ kind: kind.value, csv: await readExportFile(f), fileName: f.name });
      say(out, 'ok', `Готово. У знімку ${r.months} міс. (${r.period.from} — ${r.period.to}), груп: ${r.groups}, препаратів: ${r.products}, слів: ${r.keywords}. Відкрийте звіт і натисніть Ctrl+F5.`);
      file.value = '';
      await renderDemand();
    } catch (err) { say(out, 'error', err.message); } finally { go.disabled = false; go.textContent = 'Оновити знімок попиту'; }
  });
  const field = (label, control) => h('label', { class: 'field' }, h('span', { class: 'l' }, label), control);
  const now = s.available
    ? `Зараз у знімку: ${s.period.from} — ${s.period.to} (${s.months} міс.), знято ${String(s.fetchedAt || '').slice(0, 10) || '—'}. Груп: ${s.groups}, препаратів: ${s.products}, слів: ${s.keywords}.`
    : 'Знімка ще немає: блок у звіті порожній.';
  body.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', null, h('h3', null, 'Оновити з файлу'), h('p', { class: 'sub' }, now))),
    field('Що в файлі', kind), field('Файл (CSV)', file),
    h('div', { class: 'actions' }, go), out,
    h('details', null,
      h('summary', null, 'Звідки взяти файл і який він має бути'),
      h('p', { class: 'bar-note' }, '1) Looker Studio: відкрийте звіт «Syngenta’s Products Search Dynamic», наведіть на таблицю, натисніть ⋮ → «Експортувати» → CSV.'),
      h('p', { class: 'bar-note' }, '2) Google Ads: Інструменти → Планувальник ключових слів → «Дізнатися про обсяги пошуку й прогнози» → вставте слова, оберіть Україну → «Завантажити». Це дає слова за місяцями.'),
      h('p', { class: 'bar-note' }, 'Підходять два види таблиць: «Місяць; Назва; Пошуків» (кожен місяць окремим рядком) або «Назва» і колонки-місяці (2025-09, 2025-10 …). Роздільник — кома, крапка з комою чи табуляція. Рядки «Разом» ігноруються.'),
      h('p', { class: 'bar-note' }, 'Спершу завантажте файл «Групи»: він задає період. Препарати й слова лягають на ті самі місяці.'))));
}

// ---------------------------------------------------------------- users
async function renderUsers(reveal) {
  const body = $a('users-body');
  let users;
  try { users = await api.adminUsers(); } catch (err) { clear(body); body.appendChild(h('div', { class: 'notice crit' }, err.message)); return; }
  clear(body);
  const msg = h('div', { 'aria-live': 'polite' });
  if (reveal) {
    msg.appendChild(h('div', { class: 'notice warn', role: 'status' },
      h('b', null, `${reveal.email}: тимчасовий пароль (показується один раз) — `),
      h('code', { class: 'temp-pass' }, reveal.tempPassword),
      ' Передайте його особисто; при першому вході потрібно задати власний пароль.'));
  }

  const email = h('input', { type: 'email', id: 'new-email', placeholder: 'name@syngenta.com', autocomplete: 'off', 'aria-label': 'Email' });
  const role = h('select', { id: 'new-role', 'aria-label': 'Роль' }, h('option', { value: 'viewer' }, 'Менеджер (сторінка керівництва)'), h('option', { value: 'admin' }, 'Адміністратор'));
  const add = h('button', { type: 'button', class: 'btn btn-primary' }, 'Додати користувача');
  add.addEventListener('click', async () => {
    add.disabled = true;
    try { const r = await api.adminUserCreate(email.value.trim(), role.value); await renderUsers(r); } catch (err) { say(msg, 'error', err.message); } finally { add.disabled = false; }
  });

  const rows = users.map((u) => {
    const reset = h('button', { type: 'button', class: 'btn' }, 'Скинути пароль');
    reset.addEventListener('click', async () => {
      if (!window.confirm(`Скинути пароль для ${u.email}?`)) return;
      try { await renderUsers(await api.adminUserReset(u.id)); } catch (err) { say(msg, 'error', err.message); }
    });
    const del = h('button', { type: 'button', class: 'btn' }, 'Видалити');
    del.addEventListener('click', async () => {
      if (!window.confirm(`Видалити користувача ${u.email}?`)) return;
      try { await api.adminUserDelete(u.id); await renderUsers(); } catch (err) { say(msg, 'error', err.message); }
    });
    return h('tr', null,
      h('td', null, u.email),
      h('td', null, u.role === 'admin' ? 'Адміністратор' : 'Менеджер'),
      h('td', null, u.last_login_at ? fmt.dateFull(String(u.last_login_at).slice(0, 10)) : '—'),
      h('td', null, u.must_change_password ? 'чекає зміни пароля' : 'активний'),
      h('td', { class: 'num' }, h('div', { class: 'row-actions' }, reset, del)));
  });

  body.appendChild(h('div', { class: 'card' },
    h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Email', 'Роль', 'Останній вхід', 'Стан', ''].map((t) => h('th', { scope: 'col' }, t)))), h('tbody', null, rows)),
    h('div', { class: 'add-user' }, email, role, add),
    msg));
}

async function adminInit() {
  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { window.location.href = 'day.html'; return; }
  $a('user-email').textContent = me.email;
  $a('logout-btn').addEventListener('click', async () => { await api.logout(); window.location.href = 'login.html'; });
  $a('deck').setAttribute('aria-busy', 'false');
  initPresence('admin');
  await Promise.all([renderAi(), renderClarity(), renderGoogleAds(), renderDemand(), renderUsers()]);
}

adminInit();
