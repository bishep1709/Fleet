// Period picker with a calendar: one button shows the chosen period; it opens a panel with ready periods on the left and a
// two-month calendar on the right. The first click on a day is the start, the second — the end (clicking an earlier day
// starts again). Nothing is loaded until «Показати», so a half-picked period never reaches the report.
// Dates are ISO strings (РРРР-ММ-ДД) everywhere, like the rest of SytBoard; only the screen shows ДД.ММ.РРРР.
// Usage: RangePicker.attach(button, { presets, max, min, value: () => ({ preset, from, to }), onPick: (preset, from, to) => {} })
(function () {
  const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const dmy = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '');
  const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const weekdayMon = (y, m, d) => (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
  const shift = (y, m, n) => { const t = y * 12 + m + n; return [Math.floor(t / 12), ((t % 12) + 12) % 12]; };

  // The button text: a ready period by its name, a picked one by its dates.
  function label(v, presets) {
    const p = presets.find((x) => x.id === v.preset);
    if (p && v.preset !== 'custom') return v.from && v.to && v.preset !== 'all' ? `${p.label}: ${dmy(v.from)} — ${dmy(v.to)}` : p.label;
    return v.from && v.to ? (v.from === v.to ? dmy(v.from) : `${dmy(v.from)} — ${dmy(v.to)}`) : 'Оберіть період';
  }

  function attach(button, opt) {
    const presets = opt.presets;
    let panel = null;
    // What is picked inside the open panel, before «Показати».
    let pick = null; // { preset, from, to }
    let view = null; // [year, month] of the left month

    const refresh = () => { button.replaceChildren(h('span', { class: 'rp-ico', 'aria-hidden': 'true' }, '📅'), label(opt.value(), presets)); };

    function close(focusBack) {
      if (!panel) return;
      panel.remove(); panel = null;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
      if (focusBack) button.focus();
    }
    const outside = (e) => { if (panel && !panel.contains(e.target) && e.target !== button && !button.contains(e.target)) close(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };

    function month(y, m) {
      const cells = [];
      for (let i = 0; i < weekdayMon(y, m, 1); i++) cells.push(h('span', { class: 'rp-pad' }));
      for (let d = 1; d <= daysIn(y, m); d++) {
        const day = iso(y, m, d);
        const off = (opt.max && day > opt.max) || (opt.min && day < opt.min);
        const a = pick.from; const b = pick.to;
        const inside = a && b && day > a && day < b;
        const cls = ['rp-day', inside ? 'in' : '', day === a ? 'start' : '', day === (b || a) ? 'end' : '', day === opt.max ? 'today' : ''].filter(Boolean).join(' ');
        const btn = h('button', { type: 'button', class: cls, disabled: off, 'aria-label': `${d} ${MONTHS[m].toLowerCase()} ${y}`, 'aria-pressed': String(day === a || day === b || !!inside) }, String(d));
        btn.addEventListener('click', () => {
          // First click (or a click before the start) begins a new period; the second closes it.
          if (!pick.from || pick.to || day < pick.from) pick = { preset: 'custom', from: day, to: null };
          else pick = { preset: 'custom', from: pick.from, to: day };
          draw();
        });
        cells.push(btn);
      }
      return h('div', { class: 'rp-month' },
        h('div', { class: 'rp-mname' }, `${MONTHS[m]} ${y}`),
        h('div', { class: 'rp-grid', role: 'group', 'aria-label': `${MONTHS[m]} ${y}` }, WEEK.map((w) => h('span', { class: 'rp-wd' }, w)), cells));
    }

    function draw() {
      const [y1, m1] = view;
      const [y2, m2] = shift(y1, m1, 1);
      const ready = pick.preset !== 'custom' || (pick.from && pick.to);
      const hint = pick.preset !== 'custom' ? label(pick, presets)
        : !pick.from ? 'Клацніть першу дату періоду' : !pick.to ? `Від ${dmy(pick.from)} — тепер клацніть останню дату` : `${dmy(pick.from)} — ${dmy(pick.to)}`;
      const prev = h('button', { type: 'button', class: 'rp-nav', 'aria-label': 'Попередній місяць' }, '‹');
      const next = h('button', { type: 'button', class: 'rp-nav', 'aria-label': 'Наступний місяць', disabled: !!opt.max && iso(y2, m2, 1) >= opt.max.slice(0, 8) + '01' }, '›');
      prev.addEventListener('click', () => { view = shift(y1, m1, -1); draw(); });
      next.addEventListener('click', () => { view = shift(y1, m1, 1); draw(); });
      const ok = h('button', { type: 'button', class: 'primary', disabled: !ready }, 'Показати');
      ok.addEventListener('click', () => { const p = pick; close(true); opt.onPick(p.preset, p.from || null, p.to || null); });
      const cancel = h('button', { type: 'button' }, 'Скасувати');
      cancel.addEventListener('click', () => close(true));
      panel.replaceChildren(
        h('div', { class: 'rp-presets', role: 'group', 'aria-label': 'Готові періоди' }, presets.map((p) => {
          const b = h('button', { type: 'button', 'aria-pressed': String(pick.preset === p.id) }, p.label);
          b.addEventListener('click', () => {
            const r = p.range();
            pick = { preset: p.id, from: r.from || null, to: r.to || null };
            if (r.to) view = shift(Number(r.to.slice(0, 4)), Number(r.to.slice(5, 7)) - 1, -1);
            draw();
          });
          return b;
        })),
        h('div', { class: 'rp-cal' },
          h('div', { class: 'rp-head' }, prev, h('span', { class: 'rp-hint', role: 'status' }, hint), next),
          h('div', { class: 'rp-months' }, month(y1, m1), month(y2, m2)),
          h('div', { class: 'rp-foot' }, cancel, ok)));
    }

    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      if (panel) { close(false); return; }
      const v = opt.value();
      pick = { preset: v.preset, from: v.from || null, to: v.to || null };
      // Show the month of the period's end on the right, so the picked days are in view.
      const end = pick.to || opt.max;
      view = shift(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, -1);
      panel = h('div', { class: 'rp-panel', role: 'dialog', 'aria-label': 'Вибір періоду' });
      button.parentNode.style.position = 'relative';
      button.parentNode.appendChild(panel);
      button.setAttribute('aria-expanded', 'true');
      draw();
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', onKey, true);
      const first = panel.querySelector('.rp-presets button[aria-pressed="true"]') || panel.querySelector('button');
      if (first) first.focus();
    });
    refresh();
    return { refresh, close };
  }

  window.RangePicker = { attach };
})();
