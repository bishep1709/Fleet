// Vira — the SytBoard mascot and AI analyst. A round button in the corner opens a chat: she answers from the live data of
// the shop (through the server, which decides what each role may see) and can prepare a new communication by asking
// questions until everything needed is known; the person confirms the ready card with a button. Self-contained (own tiny
// element helper) so it also works on pages that do not load dom.js. All text goes in via text nodes, never innerHTML.
(function () {
  if (document.getElementById('vz-root')) return;
  const API = window.API_BASE || window.SYTBOARD_API || '/api';
  const el = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  };
  const call = async (path, options = {}) => {
    const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { window.location.href = 'login.html'; throw new Error('Потрібно увійти'); }
    if (!res.ok) { const e = new Error(data.error || `Помилка ${res.status}`); e.status = res.status; throw e; }
    return data;
  };
  const store = {
    get() { try { return JSON.parse(sessionStorage.getItem('vira.chat') || '[]'); } catch { return []; } },
    set(v) { try { sessionStorage.setItem('vira.chat', JSON.stringify(v.slice(-30))); } catch { /* not remembered */ } },
  };
  const seen = (set) => { try { if (set) sessionStorage.setItem('vira.hello', '1'); return sessionStorage.getItem('vira.hello') === '1'; } catch { return true; } };
  const pageName = () => (document.title || '').replace(/^SytBoard\s*[—-]\s*/, '').slice(0, 60);

  // ---- a little formatting: **bold**, bullets and paragraphs, all as text nodes -------------------------
  function inline(text) {
    const out = [];
    text.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) out.push(el('strong', null, part.slice(2, -2)));
      else if (part) out.push(part);
    });
    return out;
  }
  function renderText(text) {
    const box = el('div', { class: 'vz-text' });
    let list = null;
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      const bullet = /^([•\-*]|\d+[.)])\s+(.*)$/.exec(line);
      if (bullet) { if (!list) { list = el('ul'); box.appendChild(list); } list.appendChild(el('li', null, inline(bullet[2]))); continue; }
      list = null;
      if (line) box.appendChild(el('p', null, inline(line)));
    }
    return box;
  }

  // ---- panel ------------------------------------------------------------------------------------------------------------
  const fab = el('button', { type: 'button', class: 'vz-fab', 'aria-label': 'Vira — AI-аналітик', 'aria-expanded': 'false', 'aria-controls': 'vz-panel' },
    el('img', { src: 'img/vira-avatar.webp', alt: '', width: '60', height: '60' }));
  const hello = el('div', { class: 'vz-hello', role: 'status' }, 'Привіт! Я Vira.');
  hello.hidden = true;
  const close = el('button', { type: 'button', class: 'vz-x', 'aria-label': 'Закрити' }, '×');
  const fresh = el('button', { type: 'button', class: 'vz-link', title: 'Почати нову розмову' }, 'Нова розмова');
  const log = el('div', { class: 'vz-log', role: 'log', 'aria-live': 'polite' });
  const chips = el('div', { class: 'vz-chips' });
  const input = el('textarea', { class: 'vz-input', rows: '1', maxlength: '2000', placeholder: 'Запитайте про продажі, сайт, рекламу… або «створи комунікацію»', 'aria-label': 'Повідомлення для Vira' });
  const send = el('button', { type: 'button', class: 'vz-send', 'aria-label': 'Надіслати' }, '➤');
  const panel = el('section', { id: 'vz-panel', class: 'vz-panel', role: 'dialog', 'aria-label': 'Vira, AI-аналітик від Syngenta' },
    el('div', { class: 'vz-head' },
      el('img', { src: 'img/vira-avatar.webp', alt: '', width: '34', height: '34', class: 'vz-mini' }),
      el('div', { class: 'vz-title' }, el('b', null, 'Vira'), el('span', null, 'AI-аналітик від Syngenta')), fresh, close),
    log, chips,
    el('div', { class: 'vz-foot' }, input, send),
    el('p', { class: 'vz-tag' }, 'Відповідає за живими даними SytBoard. Перевіряйте важливі рішення.'));
  panel.hidden = true;
  const root = el('div', { id: 'vz-root', class: 'vz-root' }, hello, panel, fab);

  let history = store.get(); // [{role, content}]
  let status = null;
  let busy = false;

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function bubble(role, text) {
    const b = el('div', { class: `vz-msg ${role}` }, role === 'assistant' ? renderText(text) : el('p', null, text));
    log.appendChild(b);
    scroll();
    return b;
  }
  function note(text, cls) { const n = el('div', { class: `vz-note ${cls || ''}` }, text); log.appendChild(n); scroll(); return n; }

  function suggestions() {
    clear(chips);
    if (history.length) return;
    const items = status && status.isAdmin
      ? ['Що головне за останні 7 днів?', 'Де ми втрачаємо покупців?', 'Як спрацювали останні публікації?', 'Створи комунікацію']
      : ['Що в плані комунікацій на найближчі тижні?', 'Що не заповнено в плані?', 'Створи комунікацію'];
    for (const t of items) chips.appendChild(el('button', { type: 'button', class: 'vz-chip', onclick: () => ask(t) }, t));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function welcome() {
    if (!status) return;
    if (!status.configured) { note('Vira ще не підключена до ШІ. Адміністратор може додати ключ у «Налаштуваннях».', 'err'); return; }
    if (!history.length) bubble('assistant', 'Привіт! Я Vira, аналітик магазину.\n• Відповідаю за живими даними: продажі, сайт, реклама, пошук, ціни, комунікації.\n• Можу створити нову комунікацію: розпитаю все потрібне й підготую картку.\nЩо вас цікавить?');
  }
  function redraw() {
    clear(log);
    welcome();
    for (const m of history) bubble(m.role, m.content);
    suggestions();
  }

  // ---- the card of a prepared communication: the person confirms it ----------------------------------------------
  function draftCard(d) {
    const rows = [['Тема', d.title], ['Дата', d.date], ['Канал', d.channel], ['Тип', d.type], ['Формат', d.format], ['Продукт / фокус', d.product], ['Навіщо зараз', d.why], ['Основне повідомлення', d.message], ['План дій', d.plan], ['Відповідальний', d.owner]].filter(([, v]) => v);
    const msg = el('span', { class: 'vz-msg-line' });
    const go = el('button', { type: 'button', class: 'vz-btn primary' }, 'Створити в плані');
    const edit = el('button', { type: 'button', class: 'vz-btn' }, 'Змінити');
    const card = el('div', { class: 'vz-draft' }, el('b', null, 'Картка активності'),
      el('dl', null, rows.map(([k, v]) => [el('dt', null, k), el('dd', null, v)])),
      el('div', { class: 'vz-actions' }, go, edit, msg));
    go.addEventListener('click', async () => {
      go.disabled = edit.disabled = true; msg.textContent = 'Створюю в Notion…';
      try {
        const body = { title: d.title, date: d.date, channel: d.channel, type: d.type, format: d.format || '', product: d.product, why: d.why, message: d.message, plan: d.plan || '', owner: d.owner || '' };
        await call('/comms/activities', { method: 'POST', body: JSON.stringify(body) });
        card.replaceWith(el('div', { class: 'vz-note ok' }, `Створено в плані: «${d.title}», ${d.date}. `, el('a', { href: 'comms.html' }, 'Відкрити «Комунікації»'), '. Там у картці створіть посилання з UTM.'));
        history.push({ role: 'assistant', content: `✅ Картку «${d.title}» (${d.date}) створено в плані. Якщо людина просить ще одну, починай збір з нуля.` });
        store.set(history);
      } catch (err) { go.disabled = edit.disabled = false; msg.textContent = err.message || 'Не вдалося створити.'; }
    });
    edit.addEventListener('click', () => { card.remove(); input.value = 'Хочу змінити: '; input.focus(); });
    log.appendChild(card);
    scroll();
  }

  async function ask(text) {
    const q = String(text || '').trim();
    if (!q || busy) return;
    if (!status || !status.configured) { note('Vira ще не підключена до ШІ.', 'err'); return; }
    busy = true; send.disabled = true; input.value = ''; autoSize();
    clear(chips);
    history.push({ role: 'user', content: q });
    store.set(history);
    bubble('user', q);
    const wait = el('div', { class: 'vz-wait' }, el('span', { class: 'vz-dots' }, el('i'), el('i'), el('i')), ' Аналізую дані… це може тривати до хвилини');
    log.appendChild(wait); scroll();
    try {
      const res = await call('/vira/chat', { method: 'POST', body: JSON.stringify({ messages: history, page: pageName() }) });
      wait.remove();
      history.push({ role: 'assistant', content: res.reply });
      store.set(history);
      bubble('assistant', res.reply);
      if (res.truncated) note('Відповідь обірвалася: напишіть «продовжуй», щоб побачити решту.');
      if (res.draft) draftCard(res.draft);
    } catch (err) {
      wait.remove();
      history.pop(); // the unanswered question is not kept, so it can be asked again
      store.set(history);
      note(err.message || 'Не вдалося отримати відповідь. Спробуйте ще раз.', 'err');
      input.value = q;
    } finally {
      busy = false; send.disabled = false; input.focus();
    }
  }

  function autoSize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; }
  input.addEventListener('input', autoSize);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); } });
  send.addEventListener('click', () => ask(input.value));
  fresh.addEventListener('click', () => { if (busy) return; history = []; store.set(history); redraw(); input.focus(); });

  async function open() {
    hello.hidden = true;
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (!status) {
      try { status = await call('/vira/status'); } catch { status = { configured: false, isAdmin: false }; }
      redraw();
    }
    input.focus();
    scroll();
  }
  function shut() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  fab.addEventListener('click', () => (panel.hidden ? open() : shut()));
  close.addEventListener('click', shut);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !panel.hidden) shut(); });

  document.body.appendChild(root);
  if (!seen(false)) {
    seen(true);
    setTimeout(() => { if (panel.hidden) { hello.hidden = false; setTimeout(() => { hello.hidden = true; }, 6000); } }, 1200);
  }
})();
