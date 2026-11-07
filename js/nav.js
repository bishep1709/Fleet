// Shared top bar: the four places of SytBoard + settings + sign out, with a badge of the tasks that need
// attention. Self-contained (plain DOM), so any page can include it with <div id="appnav"></div>.
(function () {
  const host = document.getElementById('appnav');
  if (!host) return;
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; n.setAttribute(k, v === true ? '' : String(v)); }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  };
  // The owner's order (2026-11-01). «Пульс дня» and «Задачі» are not in the menu any more; their pages stay and are
  // linked from «Головна».
  const PAGES = [
    ['home.html', 'Головна', 'Вчора, тиждень і місяць: продажі, рух до цілі, поведінка клієнтів, ціни'],
    ['report.html', 'Деталі', 'Усі цифри за будь-який період: продажі, сайт, реклама, пошук'],
    ['prices.html', 'Ціни на ринку', 'Наші ціни проти цін конкурентів і партнерів'],
    ['strategy.html', 'Виконання стратегії', 'Як виконується стратегія 2026–2027: ціль, показники, етапи, задачі'],
    ['comms.html', 'Комунікації', 'План комунікацій з Notion, що кожна публікація дала, і промокоди'],
    ['presentations.html', 'Презентації', 'Презентації про інтернет-магазин із живих даних'],
  ];
  // Menu links carry a build stamp: a browser that cached an older copy of a page fetches the new one instead.
  // Sections still being finished carry a small «Beta» above their name.
  const BETA = new Set(['prices.html', 'strategy.html', 'comms.html']);
  const BUILD = '20261101t';
  const current = (location.pathname.split('/').pop() || 'home.html').toLowerCase();

  const links = el('nav', { class: 'links', 'aria-label': 'Розділи SytBoard' });
  const badges = {};
  for (const [href, label, hint] of PAGES) {
    const a = el('a', { class: `nav${BETA.has(href) ? ' beta' : ''}`, href: `${href}?v=${BUILD}`, title: BETA.has(href) ? `${hint}. Розділ ще доробляється (Beta).` : hint, 'aria-current': current === href ? 'page' : null },
      BETA.has(href) ? el('span', { class: 'nl' }, el('small', { class: 'bt' }, 'Beta'), label) : label);
    if (href === 'tasks.html') { badges.tasks = el('span', { class: 'nb', hidden: true }); a.appendChild(badges.tasks); }
    links.appendChild(a);
  }
  const who = el('span', { class: 'who' });
  const settings = el('a', { class: 'nav', href: `admin.html?v=${BUILD}`, hidden: true, 'aria-current': current === 'admin.html' ? 'page' : null }, 'Налаштування');
  const out = el('button', { type: 'button', class: 'out' }, 'Вийти');
  out.addEventListener('click', async () => { try { await apiCall('/auth/logout', { method: 'POST' }); } finally { window.location.href = 'login.html'; } });
  host.className = 'appnav';
  host.appendChild(el('div', { class: 'in' }, el('a', { class: 'brand', href: `home.html?v=${BUILD}` }, 'SytBoard'), links, el('span', { class: 'sp' }), who, settings, out));

  apiCall('/auth/me').then((me) => { who.textContent = me.email || ''; settings.hidden = me.role !== 'admin'; }).catch(() => {});
  // The badge of open tasks only when «Задачі» is in the menu.
  if (badges.tasks) apiCall('/tasks/summary').then((s) => {
    const n = s.mineOverdue || s.mine || 0;
    if (!n) return;
    badges.tasks.hidden = false;
    badges.tasks.textContent = String(n);
    badges.tasks.classList.toggle('hot', s.mineOverdue > 0);
    badges.tasks.title = s.mineOverdue ? `Ваших прострочених: ${s.mineOverdue}` : `Ваших відкритих: ${s.mine}`;
  }).catch(() => {});
})();
