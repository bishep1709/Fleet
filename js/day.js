// SytBoard «Пульс дня»: the admin landing page. Loads a stored daily report as a day model
// (/api/daily/tree) and mounts the shared mind map (daymap-core.js). ?date=YYYY-MM-DD opens a past day.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('day-status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('«Пульс дня» доступний лише адміністраторам SytBoard.', true); return; }

  let days = [];
  const select = $('day-select');
  const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const label = (d) => `${d} · ${WD[new Date(`${d}T00:00:00Z`).getUTCDay()]}`;

  function navState(day) {
    const i = days.indexOf(day);
    $('prev-day').disabled = i < 0 || i >= days.length - 1;
    $('next-day').disabled = i <= 0;
    $('report-link').href = `report.html?view=day&date=${encodeURIComponent(day)}`;
  }

  async function load(day) {
    status('Завантаження…');
    try {
      const res = await apiCall(`/daily/tree${day ? `?date=${encodeURIComponent(day)}` : ''}`);
      if (!days.length) {
        days = res.days;
        select.textContent = '';
        for (const d of days) { const o = document.createElement('option'); o.value = d; o.textContent = label(d); select.appendChild(o); }
      }
      select.value = res.tree.day;
      navState(res.tree.day);
      const url = new URL(window.location.href);
      url.searchParams.set('date', res.tree.day);
      history.replaceState(null, '', url);
      DayMap.mount(res.tree);
      status(res.tree.generatedAt ? `Звіт сформовано ${new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(res.tree.generatedAt))}. Якщо відтоді були нові замовлення, натисніть «Оновити дані». Вдень звіт за вчора оновлюється сам.` : '');
    } catch (err) {
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      status(err.status === 404 ? 'Звітів ще немає: перший з’явиться після 07:00.' : 'Не вдалося завантажити карту дня. Спробуйте оновити сторінку.', true);
    }
  }

  // ↻ Оновити дані: the server rebuilds yesterday from every source (1–2 min); poll until it is done.
  const btn = $('refresh-btn');
  const NAMES = { bas: 'BAS', ga4: 'Google Analytics', gsc: 'Search Console', psi: 'швидкість сайту', crux: 'конкуренти', clarity: 'Clarity', gads: 'Google Ads' };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function refresh() {
    btn.disabled = true;
    let st;
    try {
      st = await apiCall('/daily/refresh', { method: 'POST' });
    } catch (err) {
      btn.disabled = false;
      status(err.data && err.data.error ? err.data.error : 'Не вдалося запустити оновлення.', true);
      return;
    }
    const t0 = Date.now();
    while (st.running) {
      status(`Оновлюю звіт за ${st.day}: збираю дані з BAS, Google Analytics, Google Ads, Search Console, швидкості сайту й Clarity. Це 1–2 хвилини: ${Math.round((Date.now() - t0) / 1000)} с`);
      await wait(4000);
      try { st = await apiCall('/daily/refresh'); } catch { /* keep polling */ }
    }
    btn.disabled = false;
    if (st.error) { status(st.error, true); return; }
    days = [];
    await load(st.day);
    const failed = Object.entries(st.sources || {}).filter(([, ok]) => !ok).map(([k]) => NAMES[k] || k);
    status(failed.length ? `Оновлено. Без даних: ${failed.join(', ')}.` : 'Оновлено: усі джерела на місці.', failed.length > 0);
  }
  btn.addEventListener('click', refresh);

  select.addEventListener('change', () => load(select.value));
  $('prev-day').addEventListener('click', () => { const i = days.indexOf(select.value); if (i < days.length - 1) load(days[i + 1]); });
  $('next-day').addEventListener('click', () => { const i = days.indexOf(select.value); if (i > 0) load(days[i - 1]); });

  const asked = new URLSearchParams(window.location.search).get('date');
  load(/^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : null);
})();
