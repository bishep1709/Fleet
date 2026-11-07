// "Who is looking at the dashboard right now": a heartbeat every 30 s while the tab is visible.
// Managers see only a count; admins can open the list (email, page, how long ago).
const presence = { data: null, chip: null, page: 'exec' };
const PRESENCE_PAGES = { ops: 'Операційний дашборд', exec: 'Для керівництва', admin: 'Налаштування' };

function presenceRender() {
  const chip = presence.chip;
  if (!chip || !presence.data) return;
  chip.hidden = false;
  clear(chip);
  chip.appendChild(h('span', { class: 'live-dot presence', 'aria-hidden': 'true' }));
  chip.appendChild(h('b', null, `У дашборді ${fmt.int(presence.data.count)}`));
  chip.title = presence.data.users ? 'Хто зараз відкрив дашборд. Натисніть, щоб побачити список' : 'Скільки людей зараз відкрили дашборд';
  chip.disabled = !presence.data.users;
}

async function presencePing(force) {
  if (document.hidden && !force) return;
  try {
    presence.data = await api.presence(presence.page);
    presenceRender();
  } catch (err) {
    if (err.status === 401) window.location.href = 'login.html';
  }
}

function presenceOpen() {
  const d = presence.data;
  if (!d || !d.users) return;
  const body = drillShell('Хто зараз у дашборді', `Активні за останні 90 секунд: ${fmt.int(d.count)}`);
  clear(body);
  body.appendChild(dTable(d.users, [
    { label: 'Користувач', render: (r) => r.email },
    { label: 'Сторінка', render: (r) => PRESENCE_PAGES[r.page] || r.page },
    { label: 'Востаннє', num: true, render: (r) => (r.secondsAgo < 10 ? 'щойно' : `${r.secondsAgo} с тому`) },
  ]));
  body.appendChild(h('p', { class: 'bar-note' }, 'Одна людина з кількома вкладками рахується один раз. Менеджери бачать лише кількість.'));
}

function initPresence(page) {
  presence.page = page;
  presence.chip = document.getElementById('presence-chip');
  if (presence.chip) presence.chip.addEventListener('click', presenceOpen);
  presencePing(true);
  window.setInterval(presencePing, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) presencePing(); });
}
