// SytBoard «Деталі»: one dense page — sales by category, products, site traffic, search and
// customer problems for any period. Opens on the whole life of the store. Every chart is interactive
// (hover, pinned numbers, switchable series) and labelled with its numbers; chart axes use ISO 8601
// dates (YYYY-MM-DD, YYYY-Www, YYYY-MM). All text goes through DOM APIs.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };
  const today = fmt.todayKyiv();

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('«Деталі» доступні лише адміністраторам SytBoard.', true); return; }

  const COLORS = { 'ЗЗР': 'var(--c-zzr)', 'Насіння': 'var(--c-seed)', 'Дрібне фасування ЗЗР': 'var(--c-small)', 'Outcast (побутові шкідники)': 'var(--c-outcast)', 'Розпилювачі': 'var(--c-spray)' };
  const SHORT = { 'Дрібне фасування ЗЗР': 'Дрібне фасування', 'Outcast (побутові шкідники)': 'Outcast' };
  const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];
  const colorOf = (name) => COLORS[name] || 'var(--c-other)';
  const short = (name) => SHORT[name] || name;
  const DEVICE = { mobile: 'Телефон', desktop: 'Комп’ютер', tablet: 'Планшет', 'smart tv': 'Smart TV' };
  const CATEGORY_SWITCH = [['all', 'Загальний'], ['zzr', 'ЗЗР'], ['seed', 'Насіння'], ['small', 'Дрібне фасування та засоби захисту'], ['spray', 'Розпилювачі']];
  const MODE_SWITCH = [['all', 'Усі продажі'], ['organic', 'Самі оформили (органіка)'], ['manual', 'Через менеджера']];
  const COMPARE_SWITCH = [['prev', 'Попереднім періодом'], ['yoy', 'Тим самим періодом торік']];
  // The seven parts of the report, in the order of the shop's Looker report. Every section belongs to one of them.
  const TABS = [['overview', 'Огляд'], ['ads', 'Реклама Google'], ['behaviour', 'Поведінка'], ['audience', 'Аудиторія'], ['orders', 'Замовлення'], ['products', 'Товари'], ['retention', 'Чи повертаються']];
  const TAB_OF = { 'sec-sales': 'overview', 'sec-dynamics': 'overview', 'sec-traffic': 'overview', 'sec-telegram': 'overview', 'sec-ads': 'ads', 'sec-behaviour': 'behaviour', 'sec-site': 'behaviour', 'sec-pages': 'behaviour', 'sec-interest': 'behaviour', 'sec-search': 'behaviour', 'sec-problems': 'behaviour', 'sec-audience': 'audience', 'sec-orders': 'orders', 'sec-cats': 'products', 'sec-products': 'products', 'sec-items': 'products', 'sec-retention': 'retention' };

  // ---- state --------------------------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const pick = (name, list) => (list.some(([id]) => id === params.get(name)) ? params.get(name) : 'all');
  const state = {
    from: null, to: null, preset: 'all', grain: params.get('g') || null,
    grainUser: ['day', 'week', 'month'].includes(params.get('g')),
    category: pick('cat', CATEGORY_SWITCH), mode: pick('mode', MODE_SWITCH), compare: params.get('cmp') === 'yoy' ? 'yoy' : 'prev', data: null,
    view: params.get('view') === 'day' ? 'day' : 'period',
    tab: TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'overview',
    day: /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : null, days: [],
  };
  const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

  const monthStart = (iso) => `${iso.slice(0, 8)}01`;
  const prevMonth = () => {
    const [y, m] = today.split('-').map(Number);
    return { from: new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10) };
  };
  const PRESETS = [
    { id: 'all', label: 'Весь час', range: () => ({}) },
    { id: '90', label: 'Останні 90 днів', range: () => ({ from: fmt.addDays(today, -89), to: today }) },
    { id: '30', label: 'Останні 30 днів', range: () => ({ from: fmt.addDays(today, -29), to: today }) },
    { id: '7', label: 'Останні 7 днів', range: () => ({ from: fmt.addDays(today, -6), to: today }) },
    { id: 'month', label: 'Цей місяць', range: () => ({ from: monthStart(today), to: today }) },
    { id: 'prev', label: 'Минулий місяць', range: prevMonth },
  ];

  // ---- ISO 8601 labels and grouping ---------------------------------------------------------
  const mondayOf = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  function isoWeek(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // the Thursday of this ISO week
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
    const week = 1 + Math.round((d - week1Monday - 3 * 86400000) / (7 * 86400000));
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const keyOf = (iso, g) => (g === 'month' ? iso.slice(0, 7) : g === 'week' ? mondayOf(iso) : iso);
  // Labels people read: a day as 31.10, a week by its days, a month by its name. The ISO week code (2026-W44) stays
  // inside: it is only a key.
  const labelOf = (key, g) => (g === 'week' ? `${fmt.dayMonth(key)}–${fmt.dayMonth(fmt.addDays(key, 6))}` : g === 'month' ? fmt.monthAxis(key) : fmt.dayMonth(key));
  const longLabel = (key, g) => (g === 'week' ? `тиждень ${fmt.dateFull(key)} — ${fmt.dateFull(fmt.addDays(key, 6))}` : g === 'month' ? fmt.monthLong(key) : fmt.dateFull(key));
  const autoGrain = (days) => (days > 120 ? 'month' : days > 35 ? 'week' : 'day');

  function bucket(rows, g) {
    const m = new Map();
    for (const r of rows) {
      const k = keyOf(r.date, g);
      const b = m.get(k) || { key: k, revenue: 0, orders: 0, organic: 0, sessions: 0, users: 0, views: 0, adCost: 0, byCat: {} };
      b.revenue += r.revenue; b.orders += r.orders; b.organic += r.organicRevenue; b.sessions += r.sessions || 0; b.users += r.users || 0; b.views += r.views || 0; b.adCost += r.adCost || 0;
      for (const c of Object.keys(r.byCat)) b.byCat[c] = (b.byCat[c] || 0) + r.byCat[c];
      m.set(k, b);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
  function bucketSimple(rows, g, fields) {
    const m = new Map();
    for (const r of rows) {
      const k = keyOf(r.date, g);
      const b = m.get(k) || { key: k, ...Object.fromEntries(fields.map((f) => [f, 0])) };
      for (const f of fields) b[f] += r[f] || 0;
      m.set(k, b);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  // ---- comparison period on the charts ------------------------------------------------------
  const cmpLabel = () => (state.data && state.data.compare && state.data.compare.mode === 'yoy' ? 'Ті самі дати торік' : 'Попередній період');
  // The comparison period day by day, laid on the current days (day 1 ↔ day 1) and cut into the same weeks / months.
  function prevBuckets(curDays, prevDays, fields) {
    if (!prevDays || !prevDays.length) return null;
    const aligned = curDays.map((date, i) => ({ date, ...Object.fromEntries(fields.map((f) => [f, prevDays[i] ? prevDays[i][f] || 0 : 0])) }));
    return new Map(bucketSimple(aligned, state.grain, fields).map((b) => [b.key, b]));
  }

  // ---- trend line ---------------------------------------------------------------------------
  // The average of the last few bars: it smooths the jumps, so one can see at a glance whether sales go up or down.
  const TREND_WINDOW = { day: [7, '7 днів'], week: [4, '4 тижні'], month: [3, '3 місяці'] };
  const trendWindow = () => TREND_WINDOW[state.grain] || TREND_WINDOW.day;
  function movingAvg(values, w) {
    return values.map((_, i) => { const from = Math.max(0, i - w + 1); const part = values.slice(from, i + 1); return part.reduce((t, v) => t + v, 0) / part.length; });
  }
  // Overlay definitions + the values of every bar. `values` is the number the trend follows; ads are optional.
  function overlaysFor(bucketRows, values, trendName, hasAds, prevValues = null) {
    const [w, wText] = trendWindow();
    const trend = movingAvg(values, w);
    const defs = [{ name: 'Тренд', label: `${trendName} (середнє за ${wText})`, color: 'var(--c-small)', axis: 'left', unit: '' }];
    if (prevValues) defs.push({ name: 'Порівняння', label: cmpLabel(), color: 'var(--ink2)', axis: 'left', dash: '6 4', noArea: true, unit: '' });
    if (hasAds) defs.push({ name: 'Реклама', label: 'Реклама Google, грн (шкала праворуч)', color: 'var(--c-spray)', axis: 'right', unit: ' грн' });
    const perRow = bucketRows.map((r, i) => ({ 'Тренд': trend[i], ...(prevValues && prevValues[i] !== null && prevValues[i] !== undefined ? { 'Порівняння': prevValues[i] } : {}), ...(hasAds ? { 'Реклама': r.adCost || 0 } : {}) }));
    return { defs, perRow };
  }

  // ---- interactive chart --------------------------------------------------------------------
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  // A smooth curve through the points that never swings past them (monotone cubic), so a line over bars does not dip below zero.
  function smoothPath(pts) {
    const n = pts.length;
    if (n < 2) return '';
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const x1 = pts[i][0] + dx[i] / 3, y1 = pts[i][1] + (t[i] * dx[i]) / 3;
      const x2 = pts[i + 1][0] - dx[i] / 3, y2 = pts[i + 1][1] - (t[i + 1] * dx[i]) / 3;
      d += ` C${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }
  // A bar with a rounded top (and square bottom): the top segment of a stack.
  function barPath(x, y, w, hgt, r, roundTop) {
    const rr = roundTop ? Math.min(r, w / 2, hgt) : 0;
    if (!rr) return `M${x},${y}h${w}v${hgt}h${-w}Z`;
    return `M${x},${y + hgt}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hgt}Z`;
  }
  let chartUid = 0;

  // rows: [{label, long?, values: {seriesName: number}}]; series: [{name, color, label?}].
  // Stacked bars. Hover shows a tooltip, a click pins the numbers under the chart, legend items hide a
  // series, ←/→ + Enter work from the keyboard. Numbers are printed on the bars.
  // overlays: lines drawn over the bars — [{name, label, color, axis: 'left' | 'right', unit}] with the values in
  // rows[i].overlay[name]. «left» shares the bars' scale (a trend), «right» has its own scale (e.g. ad spend).
  function chart({ rows, series, overlays = [], height = 240, unit = '', title, valueFmt }) {
    const fmtShort = valueFmt || ((n) => fmt.compact(n));
    const fmtFull = (n) => `${fmt.int(n)}${unit}`;
    const hidden = new Set();
    let pinned = -1;
    const hasRight = overlays.some((o) => o.axis === 'right');
    const W = 1000, H = height, ml = 54, mr = hasRight ? 60 : 10, mt = 20, mb = 26;
    const hint = 'Наведіть на стовпчик або натисніть, щоб закріпити цифри';
    const box = h('div', { class: 'chartbox' });
    const legendEl = h('div', { class: 'legend' });
    const host = h('div', { class: 'svghost' });
    const tip = h('div', { class: 'tip', role: 'status' });
    tip.style.display = 'none';
    const pin = h('div', { class: 'pin' }, hint);
    box.append(legendEl, host, tip, pin);

    const visible = () => series.filter((s) => !hidden.has(s.name));
    const rowTotals = () => rows.map((r) => visible().reduce((t, s) => t + (r.values[s.name] || 0), 0));
    const lines = (i) => {
      const r = rows[i];
      const parts = visible().map((s) => ({ name: s.label || s.name, color: s.color, value: r.values[s.name] || 0 }));
      const total = parts.reduce((t, p) => t + p.value, 0);
      const prevTotal = i > 0 ? visible().reduce((t, s) => t + (rows[i - 1].values[s.name] || 0), 0) : null;
      const extra = overlays.filter((o) => !hidden.has(o.name)).map((o) => ({ name: o.label || o.name, color: o.color, unit: o.unit || unit, value: r.overlay ? r.overlay[o.name] : null })).filter((x) => x.value !== null && x.value !== undefined);
      return { title: r.long || r.label, parts, total, prevTotal, extra };
    };
    // «▲ +12% до попереднього»: growth or fall against the bar before
    const changeText = (d) => {
      if (d.prevTotal === null || d.prevTotal === undefined) return null;
      if (!d.prevTotal) return d.total ? 'до попереднього: було 0' : null;
      const c = (d.total - d.prevTotal) / d.prevTotal;
      return Math.abs(c) < 0.005 ? 'до попереднього: без змін' : `${c > 0 ? '▲ +' : '▼ −'}${Math.abs(Math.round(c * 100))}% до попереднього`;
    };
    const detailText = (i) => {
      const d = lines(i);
      const ch = changeText(d);
      const ex = d.extra.map((x) => `${x.name} ${fmt.int(x.value)}${x.unit}`).join(' · ');
      return `${d.title}: ${d.parts.length > 1 ? `${d.parts.filter((p) => p.value > 0).map((p) => `${p.name} ${fmtFull(p.value)}`).join(' · ')} · разом ${fmtFull(d.total)}` : fmtFull(d.total)}${ch ? ` · ${ch}` : ''}${ex ? ` · ${ex}` : ''}`;
    };

    function showTip(i, ratioX) {
      const d = lines(i);
      clear(tip);
      tip.appendChild(h('div', { class: 'tt' }, d.title));
      for (const p of d.parts) tip.appendChild(h('div', { class: 'tr' }, h('i', { style: { background: p.color } }), h('span', null, p.name), h('b', null, fmtFull(p.value))));
      if (d.parts.length > 1) tip.appendChild(h('div', { class: 'tr tot' }, h('span', null, 'Разом'), h('b', null, fmtFull(d.total))));
      const ch = changeText(d);
      if (ch) tip.appendChild(h('div', { class: 'tr' }, h('span', null, ch)));
      for (const x of d.extra) tip.appendChild(h('div', { class: 'tr' }, h('i', { style: { background: x.color } }), h('span', null, x.name), h('b', null, `${fmt.int(x.value)}${x.unit}`)));
      tip.style.display = 'block';
      const w = host.clientWidth || 1;
      tip.style.left = `${Math.min(Math.max(ratioX * w, 95), w - 95)}px`;
    }

    function draw() {
      clear(host);
      clear(legendEl);
      for (const s of series) {
        const total = rows.reduce((t, r) => t + (r.values[s.name] || 0), 0);
        const b = h('button', { type: 'button', class: hidden.has(s.name) ? 'off' : '', 'aria-pressed': String(!hidden.has(s.name)), title: series.length > 1 ? 'Показати / сховати' : null },
          h('i', { style: { background: s.color } }), s.label || s.name, ` · ${fmtShort(total)}`);
        if (series.length > 1) b.addEventListener('click', () => { if (hidden.has(s.name)) hidden.delete(s.name); else if (visible().length > 1) hidden.add(s.name); draw(); });
        else b.disabled = true;
        legendEl.appendChild(b);
      }

      for (const o of overlays) {
        const total = rows.reduce((t, r) => t + ((r.overlay && r.overlay[o.name]) || 0), 0);
        const b = h('button', { type: 'button', class: hidden.has(o.name) ? 'off' : '', 'aria-pressed': String(!hidden.has(o.name)), title: 'Показати / сховати лінію' },
          h('i', { style: { background: o.color, height: '4px', borderRadius: '2px', width: '14px', alignSelf: 'center' } }), o.label || o.name, o.axis === 'right' ? ` · ${fmtShort(total)}` : '');
        b.addEventListener('click', () => { if (hidden.has(o.name)) hidden.delete(o.name); else hidden.add(o.name); draw(); });
        legendEl.appendChild(b);
      }

      const totals = rowTotals();
      const leftLine = overlays.filter((o) => o.axis !== 'right' && !hidden.has(o.name)).flatMap((o) => rows.map((r) => (r.overlay && r.overlay[o.name]) || 0));
      const max = niceMax(Math.max(...totals, ...leftLine, 0));
      const y = (v) => mt + (H - mt - mb) * (1 - v / max);
      const n = rows.length || 1;
      const slot = (W - ml - mr) / n;
      const bw = Math.max(1.5, Math.min(60, slot * 0.74));
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': title || 'Діаграма', tabindex: '0' });

      for (let i = 0; i <= 4; i++) {
        const v = (max / 4) * i;
        svg.appendChild(svgEl('line', { class: 'g', x1: ml, x2: W - mr, y1: y(v), y2: y(v) }));
        const t = svgEl('text', { x: ml - 6, y: y(v) + 4, 'text-anchor': 'end' });
        t.textContent = fmtShort(v);
        svg.appendChild(t);
      }
      const band = svgEl('rect', { class: 'band', x: 0, y: mt, width: slot, height: H - mt - mb, opacity: 0 });
      svg.appendChild(band);

      // Print the totals on the bars: every `step`-th bar (so labels never overlap), and always the peak.
      const widest = Math.max(...totals.map((t) => fmtShort(t).length), 1);
      const step = Math.max(1, Math.ceil((widest * 6.4 + 8) / slot));
      const peak = totals.indexOf(Math.max(...totals));
      // soft vertical shade of every series colour: the bars look lit from above, in light and dark theme alike
      const uid = ++chartUid;
      const defs = svgEl('defs', {});
      series.forEach((s, k) => {
        const gr = svgEl('linearGradient', { id: `bg${uid}-${k}`, x1: 0, y1: 0, x2: 0, y2: 1 });
        gr.appendChild(svgEl('stop', { offset: '0%', style: `stop-color:${s.color};stop-opacity:1` }));
        gr.appendChild(svgEl('stop', { offset: '100%', style: `stop-color:${s.color};stop-opacity:.68` }));
        defs.appendChild(gr);
      });
      svg.appendChild(defs);
      const barGroups = [];
      // labels never sit on top of each other: the ad-line labels are placed first, the bar totals take what is left
      const boxes = [];
      const pendingVals = [];
      const placeText = (cls, x, y, text) => {
        const w = String(text).length * 6.3 + 6;
        for (const dy of [0, -13, -26]) {
          if (boxes.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.y - (y + dy)) < 12)) continue;
          boxes.push({ x, y: y + dy, w });
          const t = svgEl('text', { class: cls, x: Number(x).toFixed(1), y: (y + dy).toFixed(1), 'text-anchor': 'middle' });
          t.textContent = text;
          svg.appendChild(t);
          return true;
        }
        return false;
      };
      const vis = visible();
      const radius = bw >= 14 ? 5 : bw >= 6 ? 3 : 1.5;
      rows.forEach((r, i) => {
        const x = ml + slot * i + (slot - bw) / 2;
        const grp = svgEl('g', { class: 'bar' });
        barGroups.push(grp);
        svg.appendChild(grp);
        const withValue = vis.filter((s) => (r.values[s.name] || 0) > 0);
        let acc = 0;
        for (const s of withValue) {
          const v = r.values[s.name] || 0;
          const top = y(acc + v), bottom = y(acc);
          const isTop = s === withValue[withValue.length - 1];
          grp.appendChild(svgEl('path', { d: barPath(x, top, bw, Math.max(0.6, bottom - top), radius, isTop), fill: `url(#bg${uid}-${series.indexOf(s)})` }));
          if (vis.length > 1 && bw >= 44 && bottom - top >= 15 && !overlays.some((o) => !hidden.has(o.name))) { // the lines would run over these numbers; the tooltip has them
            const t = svgEl('text', { class: 'seg-label', x: x + bw / 2, y: (top + bottom) / 2 + 3.5, 'text-anchor': 'middle' });
            t.textContent = fmtShort(v);
            grp.appendChild(t);
          }
          acc += v;
        }
        if (totals[i] > 0 && (i % step === 0 || i === peak)) {
          pendingVals.push({ x: x + bw / 2, y: y(totals[i]) - 5, text: fmtShort(totals[i]), peak: i === peak });
        }
      });
      // lines over the bars: the trend on the bars' scale, ad spend on its own scale at the right edge
      const rightLine = overlays.filter((o) => o.axis === 'right' && !hidden.has(o.name)).flatMap((o) => rows.map((r) => (r.overlay && r.overlay[o.name]) || 0));
      const max2 = niceMax(Math.max(...rightLine, 0));
      const y2 = (v) => mt + (H - mt - mb) * (1 - v / max2);
      const rightOverlay = overlays.find((o) => o.axis === 'right' && !hidden.has(o.name));
      if (rightOverlay) {
        for (let i = 0; i <= 4; i++) {
          const t = svgEl('text', { x: W - mr + 6, y: y2((max2 / 4) * i) + 4, 'text-anchor': 'start', fill: rightOverlay.color });
          t.textContent = fmtShort((max2 / 4) * i);
          svg.appendChild(t);
        }
      }
      // lines: a smooth curve; the trend (bars' scale) also gets a soft shade under it. Only the peak and the last value
      // carry a labelled dot, the dot of the bar under the cursor appears on hover.
      const dots = [];
      overlays.forEach((o, k) => {
        if (hidden.has(o.name)) return;
        const sc = o.axis === 'right' ? y2 : y;
        const idx = [];
        const pts = [];
        rows.forEach((r, i) => { const v = r.overlay ? r.overlay[o.name] : null; if (v !== null && v !== undefined) { idx.push(i); pts.push([ml + slot * i + slot / 2, sc(v)]); } });
        if (pts.length < 2) return;
        const d = smoothPath(pts);
        if (o.axis !== 'right' && !o.noArea) {
          const gid = `ag${uid}-${k}`;
          const gr = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
          gr.appendChild(svgEl('stop', { offset: '0%', style: `stop-color:${o.color};stop-opacity:.22` }));
          gr.appendChild(svgEl('stop', { offset: '100%', style: `stop-color:${o.color};stop-opacity:0` }));
          defs.appendChild(gr);
          svg.appendChild(svgEl('path', { class: 'area', d: `${d} L${pts[pts.length - 1][0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z`, fill: `url(#${gid})` }));
        }
        svg.appendChild(svgEl('path', { class: 'ln', d, fill: 'none', stroke: o.color, 'stroke-width': 2.6, 'stroke-linecap': 'round', ...(o.dash ? { 'stroke-dasharray': o.dash } : {}) }));
        const vals = idx.map((i) => rows[i].overlay[o.name]);
        const labelled = o.axis === 'right'; // the bars already carry their own numbers; only the ad line is labelled
        const showAt = new Set(labelled ? [vals.indexOf(Math.max(...vals)), vals.length - 1] : [vals.length - 1]);
        for (const j of showAt) {
          svg.appendChild(svgEl('circle', { class: 'mk-dot', cx: pts[j][0].toFixed(1), cy: pts[j][1].toFixed(1), r: 4.5, fill: o.color }));
          if (!labelled) continue;
          placeText('mk', Math.min(Math.max(pts[j][0], ml + 14), W - mr - 14), pts[j][1] - 10, fmtShort(vals[j]));
        }
        const circle = svgEl('circle', { class: 'mk-dot hov', r: 5.5, fill: o.color, opacity: 0 });
        svg.appendChild(circle);
        dots.push({ o, sc, circle });
      });
      // bar totals go in after the line labels, the busiest bar first
      pendingVals.sort((a, b) => (b.peak ? 1 : 0) - (a.peak ? 1 : 0)).forEach((v) => placeText('val', v.x, v.y, v.text));
      // axis labels (ISO 8601: 2026-10-18, 2026-W42, 2026-10), counted back from the last bar so the last one is always shown and none touch
      const labW = Math.max(...rows.map((r) => String(r.label).length), 1) * 6.4 + 14;
      const stride = Math.max(1, Math.ceil(labW / slot));
      for (let i = n - 1; i >= 0; i -= stride) {
        const cx = ml + slot * i + slot / 2;
        const t = svgEl('text', { x: Math.min(Math.max(cx, ml + labW / 2 - 7), W - mr - labW / 2 + 7).toFixed(1), y: H - 7, 'text-anchor': 'middle' });
        t.textContent = rows[i].label;
        svg.appendChild(t);
      }
      const pinMark = svgEl('rect', { class: 'pinmark', x: 0, y: mt, width: slot, height: H - mt - mb, opacity: 0 });
      svg.appendChild(pinMark);

      const indexAt = (ev) => {
        const r = svg.getBoundingClientRect();
        if (!r.width) return -1;
        const x = ((ev.clientX - r.left) / r.width) * W;
        return Math.max(0, Math.min(n - 1, Math.floor((x - ml) / slot)));
      };
      // the bar under the cursor stays bright, the others fade; the lines get a dot there
      const unfocus = () => {
        band.setAttribute('opacity', 0); tip.style.display = 'none'; svg.classList.remove('hov');
        barGroups.forEach((g) => g.classList.remove('on'));
        dots.forEach((dd) => dd.circle.setAttribute('opacity', 0));
      };
      const focus = (i) => {
        band.setAttribute('x', ml + slot * i);
        band.setAttribute('opacity', 0.55);
        svg.classList.add('hov');
        barGroups.forEach((g, k) => g.classList.toggle('on', k === i));
        for (const dd of dots) {
          const v = rows[i].overlay ? rows[i].overlay[dd.o.name] : null;
          if (v === null || v === undefined) { dd.circle.setAttribute('opacity', 0); continue; }
          dd.circle.setAttribute('cx', (ml + slot * i + slot / 2).toFixed(1));
          dd.circle.setAttribute('cy', dd.sc(v).toFixed(1));
          dd.circle.setAttribute('opacity', 1);
        }
        showTip(i, (ml + slot * (i + 0.5)) / W);
      };
      const mark = () => {
        if (pinned < 0) { pinMark.setAttribute('opacity', 0); pin.textContent = hint; return; }
        pinMark.setAttribute('x', ml + slot * pinned);
        pinMark.setAttribute('opacity', 1);
        pin.textContent = detailText(pinned);
      };
      svg.addEventListener('pointermove', (ev) => { const i = rows.length ? indexAt(ev) : -1; if (i >= 0) focus(i); });
      svg.addEventListener('pointerdown', (ev) => { const i = rows.length ? indexAt(ev) : -1; if (i >= 0) focus(i); });
      svg.addEventListener('pointerleave', unfocus);
      svg.addEventListener('click', (ev) => { if (!rows.length) return; const i = indexAt(ev); if (i < 0) return; pinned = pinned === i ? -1 : i; mark(); });
      let kb = -1;
      svg.addEventListener('keydown', (ev) => {
        if (!rows.length) return;
        if (ev.key === 'ArrowRight') kb = Math.min(n - 1, kb + 1);
        else if (ev.key === 'ArrowLeft') kb = Math.max(0, kb < 0 ? n - 1 : kb - 1);
        else if (ev.key === 'Enter' || ev.key === ' ') { if (kb >= 0) { pinned = pinned === kb ? -1 : kb; mark(); } ev.preventDefault(); return; }
        else return;
        ev.preventDefault();
        focus(kb);
      });
      svg.addEventListener('blur', unfocus);
      host.appendChild(svg);
      if (pinned >= n) pinned = -1;
      mark();
    }
    draw();
    return box;
  }

  // Segmented switch; options: [[id, label]].
  function switcher(options, current, onChange, label) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label || 'Показник' });
    for (const [id, text] of options) {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === current) }, text);
      b.addEventListener('click', () => {
        for (const x of seg.children) x.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        onChange(id);
      });
      seg.appendChild(b);
    }
    return seg;
  }

  // ---- building blocks ----------------------------------------------------------------------
  const ratio = (a, b) => (b ? a / b : 0);
  const panel = (...kids) => h('div', { class: 'panel' }, kids);
  const empty = (text) => h('div', { class: 'empty' }, text);
  const meter = (share, text) => h('div', { class: 'meter' }, h('div', { class: 'track' }, h('b', { style: { width: `${Math.max(0, Math.min(1, share)) * 100}%` } })), h('span', null, text === undefined ? fmt.pct(share, share < 0.1 ? 1 : 0) : text));
  // Ring chart. parts: [{value, color}] — a whole ring split by value; big/small = the text in the middle.
  function donut(parts, { size = 108, thick = 15, big, small, label } = {}) {
    const r = (size - thick) / 2, c = 2 * Math.PI * r, cx = size / 2;
    const sum = parts.reduce((t, x) => t + Math.max(0, x.value), 0);
    const svg = svgEl('svg', { class: 'dn', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label || big || 'Діаграма-кільце' });
    svg.appendChild(svgEl('circle', { class: 'ring', cx, cy: cx, r, 'stroke-width': thick }));
    let acc = 0;
    if (sum > 0) {
      const gap = parts.filter((x) => x.value > 0).length > 1 ? Math.min(3, thick / 4) : 0;
      for (const x of parts) {
        if (x.value <= 0) continue;
        const len = (x.value / sum) * c;
        svg.appendChild(svgEl('circle', { class: 'arc', cx, cy: cx, r, 'stroke-width': thick, stroke: x.color, 'stroke-dasharray': `${Math.max(0.5, len - gap).toFixed(2)} ${(c - Math.max(0.5, len - gap)).toFixed(2)}`, 'stroke-dashoffset': (-acc).toFixed(2), transform: `rotate(-90 ${cx} ${cx})` }));
        acc += len;
      }
    }
    const t = svgEl('text', { class: 'big', x: cx, y: small ? cx - 5 : cx, 'font-size': size * (String(big || '').length > 5 ? 0.14 : 0.2) });
    t.textContent = big || '';
    svg.appendChild(t);
    if (small) { const t2 = svgEl('text', { class: 'small', x: cx, y: cx + size * 0.16 }); t2.textContent = small; svg.appendChild(t2); }
    return svg;
  }
  const num = (n) => fmt.int(n);
  const money = (n) => fmt.int(n);
  const dash = '—';
  // A small «Нормально / Низько / Добре» tag; the hint says what the rule is (see Bench in js/benchmarks.js).
  const chip = (j) => (j ? h('span', { class: `tag ${j.tone}`, title: j.hint }, j.text) : null);
  // Section heading; with a section id it also carries «＋ задача», which remembers this exact place.
  const head = (title, control, sectionId) => h('div', { class: 'sechead' }, h('h2', null, title),
    h('span', { class: 'sechead-tools' }, control || null, sectionId ? TaskUI.button(() => sectionTask(title, sectionId)) : null));

  // Where we are, as a relative link and a readable label — what a task created here points back to.
  function linkParams() {
    const q = new URLSearchParams();
    if (state.preset !== 'all' && state.from) { q.set('from', state.from); q.set('to', state.to); }
    if (state.grainUser && state.grain) q.set('g', state.grain);
    if (state.category !== 'all') q.set('cat', state.category);
    if (state.mode !== 'all') q.set('mode', state.mode);
    if (state.compare === 'yoy') q.set('cmp', 'yoy');
    if (state.tab !== 'overview') q.set('tab', state.tab);
    return q.toString();
  }
  // «v» is a build stamp: a link from a task fetches the current page even if an old copy is cached.
  const stateUrl = (hash) => `report.html?${linkParams() ? `${linkParams()}&` : ''}v=20261018a${hash ? `#${hash}` : ''}`;
  function placeContext(what) {
    const d = state.data;
    const catLabel = (CATEGORY_SWITCH.find(([id]) => id === state.category) || [])[1];
    const modeLabel = (MODE_SWITCH.find(([id]) => id === state.mode) || [])[1];
    return [what, d ? `${d.range.from} — ${d.range.to}` : '', state.category !== 'all' ? catLabel : '', state.mode !== 'all' ? modeLabel : ''].filter(Boolean).join(' · ');
  }
  const sectionTask = (title, sectionId) => ({ context: placeContext(title), link: stateUrl(sectionId), area: 'report' });
  const rowTask = (title, what, sectionId) => ({ title, context: placeContext(what), link: stateUrl(sectionId), area: 'report' });

  // task: row → task preset; adds a trailing «＋» button per row that creates a task about that row.
  function table(cols, rows, { total, task } = {}) {
    const headRow = h('tr', null, cols.map((c) => h('th', { class: c.n ? 'n' : '', scope: 'col' }, c.t)), task ? h('th', { class: 'n', scope: 'col' }, h('span', { class: 'sr-only' }, 'Задача')) : null);
    const body = rows.map((row) => h('tr', null, cols.map((c) => h('td', { class: c.n ? 'n' : '' }, c.r(row))), task ? h('td', { class: 'n' }, TaskUI.button(() => task(row), { small: true })) : null));
    if (total) body.push(h('tr', { class: 'total' }, cols.map((c) => h('td', { class: c.n ? 'n' : '' }, c.r(total))), task ? h('td') : null));
    return h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, headRow), h('tbody', null, body)));
  }

  // KPI whose main figure is a share: a ring with the percent inside, the money and the details beside it.
  function kpiRing(label, value, share, sub, color) {
    return h('div', { class: 'panel kpi has-donut' }, donut([{ value: share, color }, { value: Math.max(0, 1 - share), color: 'transparent' }], { size: 84, thick: 11, big: fmt.pct(share, share < 0.1 ? 1 : 0), label: `${label}: ${fmt.pct(share, 1)}` }),
      h('div', { class: 'txt' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), h('div', { class: 's' }, sub)));
  }
  function kpi(label, value, sub, { tone, spark } = {}) {
    return h('div', { class: `panel kpi${tone ? ` t-${tone}` : ''}` }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), h('div', { class: 's' }, sub, spark ? sparkline(spark, { width: 72, height: 22 }) : null));
  }
  const dChip = (cur, prev, opts) => (prev === null || prev === undefined ? null : deltaChip(prev ? (cur - prev) / prev : (cur ? null : 0), opts));
  const seriesFor = (names) => names.map((n) => ({ name: n, label: short(n), color: colorOf(n) }));
  const S = PeriodStruct({ h, clear, kpi, panel, table, chart, donut, meter, empty, head, num, dChip, state, keyOf, labelOf, longLabel });

  // ---- sections -----------------------------------------------------------------------------
  function scopeNote(d) {
    const parts = [];
    if (d.scope.category !== 'all') parts.push(`Показуємо категорію «${d.scope.label}». Для сайту й пошуку це сторінки цієї категорії, а візити — заходи на ці сторінки`);
    if (d.scope.mode !== 'all') parts.push(`Показуємо лише продажі «${d.scope.modeLabel}». Такий поділ є тільки в BAS. Сайт і пошук від нього не залежать`);
    return parts.length ? h('p', { class: 'scope-note' }, `${parts.join('. ')}.`) : null;
  }

  function renderSummary(d, rows) {
    const s = d.sales, site = d.site;
    const cards = [];
    const siteCards = [];
    if (s) {
      const k = s.kpis;
      cards.push(kpi('Виручка без ПДВ, грн', fmt.compact(k.revenue), [dChip(k.revenue, k.prev && k.prev.revenue), h('span', null, k.prev ? `було ${fmt.compact(k.prev.revenue)}` : fmt.moneyFull(k.revenue))], { spark: rows.map((r) => r.revenue) }));
      cards.push(kpi('Замовлень', num(k.orders), [dChip(k.orders, k.prev && k.prev.orders), k.prev ? h('span', null, `було ${num(k.prev.orders)}`) : null], { spark: rows.map((r) => r.orders) }));
      cards.push(kpi('Середній чек, грн', fmt.compact(k.aov), [dChip(k.aov, k.prev && k.prev.aov), k.top10Share ? h('span', null, `10 найбільших замовлень дають ${fmt.pct(k.top10Share)}`) : null]));
      if (d.scope.mode === 'all') {
        cards.push(kpiRing('Самі оформили (органіка), грн', fmt.compact(k.organicRevenue), k.organicShare || 0, [h('span', null, `виручки · ${num(k.organicOrders)} замовлень`), dChip(k.organicRevenue, k.prev && k.prev.organicRevenue)], 'var(--brand)'));
        cards.push(kpiRing('Через менеджера, грн', fmt.compact(k.revenue - k.organicRevenue), k.revenue ? 1 - (k.organicShare || 0) : 0, h('span', null, `виручки · ${num(k.orders - k.organicOrders)} замовлень`), 'var(--c-seed)'));
      }
    }
    if (site) {
      const t = site.totals;
      siteCards.push(kpi(site.scoped ? 'Візити на сторінки категорії' : 'Візитів', num(t.sessions), dChip(t.sessions, t.prev && t.prev.sessions), { spark: rows.map((r) => r.sessions) }));
      if (!site.scoped) siteCards.push(kpi('Відвідувачів', num(t.users), [dChip(t.users, t.prev && t.prev.users), h('span', null, `нових ${fmt.pct(t.users ? t.newUsers / t.users : 0)}`)]));
      else siteCards.push(kpi('Перегляди сторінок категорії', num(t.views), null));
      if (!site.scoped) {
        siteCards.push(kpi('Середній час на сайті', t.avgSec ? fmt.duration(t.avgSec) : dash, [t.prev && t.prev.avgSec ? dChip(t.avgSec, t.prev.avgSec) : null, t.prev && t.prev.avgSec ? h('span', null, `було ${fmt.duration(t.prev.avgSec)}`) : null]));
        const gShare = t.sessions && t.googleSessions !== null && t.googleSessions !== undefined ? t.googleSessions / t.sessions : null;
        const gPrev = t.prev && t.prev.sessions && t.prev.googleSessions !== null && t.prev.googleSessions !== undefined ? t.prev.googleSessions / t.prev.sessions : null;
        siteCards.push(kpi('Візитів із Google', gShare === null ? dash : fmt.pct(gShare, 1), [h('span', null, gShare === null ? 'немає даних' : `${num(t.googleSessions)} із ${num(t.sessions)} візитів, пошук і реклама`), gPrev !== null ? h('span', null, `було ${fmt.pct(gPrev, 1)}`) : null]));
      }
      siteCards.push(kpi('Не пішли одразу', fmt.pct(t.engagementRate, 1), [t.prev ? h('span', null, `було ${fmt.pct(t.prev.engagementRate, 1)}`) : null, chip(Bench.engaged(t.engagementRate))]));
    }
    if (d.search) {
      const t = d.search.totals;
      siteCards.push(kpi('Прийшли з пошуку Google', num(t.clicks), [dChip(t.clicks, t.prev && t.prev.clicks), h('span', null, `середня позиція ${fmt.dec1(t.position)}`), chip(Bench.position(t.position))]));
    }
    if (s && site) {
      siteCards.push(kpi(site.scoped ? 'Замовлень на 1000 візитів' : 'Замовлень на 1000 візитів', fmt.dec1((s.conversion || 0) * 1000), [s.prevConversion !== null && s.prevConversion !== undefined ? dChip(s.conversion, s.prevConversion) : null, chip(Bench.ordersPer1000((s.conversion || 0) * 1000))]));
    }
    return h('section', { id: 'sec-sales' }, head('Підсумок', null, 'sec-sales'), scopeNote(d), (cards.length || siteCards.length)
      ? h('div', { class: 'kpi-groups' }, [['Продажі', cards], ['Сайт і пошук', siteCards]].filter(([, list]) => list.length).map(([title, list]) => h('div', { class: 'kpi-group' }, h('h3', { class: 'kpi-group-title' }, title), h('div', { class: 'grid kpis' }, list))))
      : empty('Немає даних'));
  }

  function renderSalesChart(d, rows) {
    const s = d.sales;
    if (!s) return h('section', { id: 'sec-dynamics' }, head('Динаміка продажів'), empty('BAS тимчасово недоступний.'));
    const cats = d.categoriesOrder;
    const body = h('div');
    const g = state.grain;
    const hasAds = !!(d.ads && rows.some((r) => r.adCost > 0));
    const draw = (mode) => {
      clear(body);
      let chartRows, series, unit, valueFmt;
      if (mode === 'orders') {
        chartRows = rows.map((r) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: { 'Замовлень': r.orders } }));
        series = [{ name: 'Замовлень', color: 'var(--c-zzr)' }];
        unit = ' замовл.';
        valueFmt = (n) => fmt.int(n);
      } else if (mode === 'type') {
        chartRows = rows.map((r) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: { 'Самі оформили': r.organic, 'Через менеджера': Math.max(0, r.revenue - r.organic) } }));
        series = [{ name: 'Самі оформили', color: 'var(--c-zzr)' }, { name: 'Через менеджера', color: 'var(--c-small)' }];
        unit = ' грн';
      } else {
        chartRows = rows.map((r) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: Object.fromEntries(cats.map((c) => [c, r.byCat[c] || 0])) }));
        series = seriesFor(cats);
        unit = ' грн';
      }
      const pm = prevBuckets(s.daily.map((r) => r.date), s.prevDaily, ['revenue', 'orders']);
      const pv = pm ? rows.map((r) => { const b = pm.get(r.key); return b ? (mode === 'orders' ? b.orders : b.revenue) : null; }) : null;
      const ov = overlaysFor(rows, rows.map((r) => (mode === 'orders' ? r.orders : r.revenue)), mode === 'orders' ? 'Тренд замовлень' : 'Тренд виручки', hasAds, pv);
      chartRows.forEach((r, i) => { r.overlay = ov.perRow[i]; });
      body.appendChild(chart({ rows: chartRows, series, overlays: ov.defs, unit, valueFmt, title: 'Продажі за період' }));
      body.appendChild(h('p', { class: 'note' }, 'Лінія «Тренд» згладжує стрибки: йде вгору — продажі ростуть, вниз — падають. ', hasAds ? 'Фіолетова лінія — витрати на рекламу Google, у неї своя шкала праворуч, тому її видно поруч із мільйонами продажів.' : ''));
    };
    draw('revenue');
    return h('section', { id: 'sec-dynamics' }, head('Динаміка продажів, грн без ПДВ', switcher([['revenue', 'Виручка за категоріями'], ['type', 'Самі / через менеджера'], ['orders', 'Замовлення']], 'revenue', draw), 'sec-dynamics'), panel(body));
  }

  function renderCategories(d) {
    const s = d.sales;
    if (!s) return null;
    const site = d.site;
    const siteBy = new Map(site ? site.categories.map((c) => [c.name, c]) : []);
    const total = s.categories.reduce((t, c) => ({ ...t, revenue: t.revenue + c.revenue, qty: t.qty + c.qty, organicRevenue: t.organicRevenue + c.organicRevenue }), { revenue: 0, orders: s.kpis.orders, qty: 0, organicRevenue: 0 });
    const hasPrev = !!s.kpis.prev;
    const isTotal = (c) => c.name === 'Разом';
    const cols = [
      { t: 'Категорія', r: (c) => (isTotal(c) ? 'Разом' : h('span', null, h('i', { class: 'sw', style: { background: colorOf(c.name) } }), c.name)) },
      { t: 'Виручка, грн', n: true, r: (c) => money(c.revenue) },
      { t: 'Частка', r: (c) => (isTotal(c) ? '' : meter(c.share)) },
      { t: 'Замовлень', n: true, r: (c) => num(c.orders) },
      { t: 'Штук', n: true, r: (c) => num(c.qty) },
      { t: 'Середній чек', n: true, r: (c) => (c.orders ? money(c.revenue / c.orders) : dash) },
      { t: 'Самі оформили', n: true, r: (c) => (c.revenue ? fmt.pct(c.organicRevenue / c.revenue, 1) : dash) },
    ];
    if (hasPrev) cols.push({ t: 'Зміна', n: true, r: (c) => (c.delta === undefined || c.delta === null ? dash : deltaChip(c.delta)) });
    if (site) {
      cols.push({ t: 'Перегляди', n: true, r: (c) => (isTotal(c) ? '' : num((siteBy.get(c.name) || {}).views || 0)) });
      cols.push({ t: 'Візити', n: true, r: (c) => (isTotal(c) ? '' : num((siteBy.get(c.name) || {}).entrances || 0)) });
      cols.push({ t: 'Замовлень на 1000 візитів', n: true, r: (c) => { const e = (siteBy.get(c.name) || {}).entrances; return isTotal(c) || !e ? dash : fmt.dec1((c.orders / e) * 1000); } });
    }
    if (hasPrev) cols.splice(2, 0, { t: 'Було, грн', n: true, r: (c) => (c.prevRevenue === null || c.prevRevenue === undefined ? dash : money(c.prevRevenue)) });
    const outside = site ? site.categories.filter((c) => !d.categoriesOrder.includes(c.name) && c.views > 0) : [];
    const ringParts = s.categories.filter((c) => !isTotal(c) && c.revenue > 0).map((c) => ({ value: c.revenue, color: colorOf(c.name), name: c.name, share: c.share }));
    // the ring stands to the left of the table (a column: ring, then the legend); on a narrow screen it goes above
    const ring = ringParts.length > 1 ? h('div', { class: 'panel donut-col' },
      donut(ringParts, { size: 150, thick: 14, big: fmt.compact(total.revenue), small: 'грн без ПДВ', label: 'Виручка за категоріями' }),
      h('div', { class: 'donut-legend' }, ringParts.map((x) => h('div', { class: 'row' }, h('i', { style: { background: x.color } }), h('span', null, short(x.name)), h('b', null, fmt.pct(x.share, x.share < 0.1 ? 1 : 0)))))) : null;
    return h('section', { id: 'sec-cats' }, head('Продажі за категоріями', null, 'sec-cats'),
      h('div', { class: ring ? 'cat-layout' : '' }, ring,
      panel(table(cols, s.categories, { total: { name: 'Разом', ...total, prevRevenue: hasPrev ? s.kpis.prev.revenue : null }, task: (c) => rowTask(`Категорія «${short(c.name)}»: `, `Категорія ${short(c.name)}`, 'sec-cats') }))),
      h('p', { class: 'note' }, 'Перегляди й візити — це сторінки сайту, розкладені за категоріями.',
        outside.length && d.scope.all ? ` Поза категоріями: ${outside.map((c) => `${c.name} ${num(c.views)}`).join(' · ')}.` : '',
        ' Розпилювачі в BAS ще не продавали. Вони зʼявляться тут самі, щойно в назві товару буде слово «розпилювач» або «обприскувач».'));
  }

  // «Замовлення і статус»: BAS statuses of the orders behind a product, and the order numbers (the biggest first) that open into a list.
  const ORDER_TONE = { 'Виконано': 'good', 'В роботі': 'warn' };
  function ordersCell(p) {
    if (!p.orderList || !p.orderList.length) return dash;
    const tags = h('div', { class: 'ord-tags' }, Object.entries(p.orderStatus || {}).map(([st, n]) => h('span', { class: `tag ${ORDER_TONE[st] || ''}` }, `${st}: ${n}`)));
    const first = p.orderList.slice(0, 3).map((o) => `№ ${o.order}`).join(', ');
    const rest = p.orders - Math.min(3, p.orderList.length);
    const det = h('details', { class: 'ords' }, h('summary', null, first, rest > 0 ? ` · ще ${rest}` : ''),
      h('ul', { class: 'ord-list' }, p.orderList.map((o) => h('li', null, h('b', null, `№ ${o.order}`), ` · ${o.date} · `,
        h('span', { class: `tag ${ORDER_TONE[o.status] || ''}` }, o.status + (o.sap && o.status === 'В роботі' ? ' (SAP)' : '')),
        o.paid ? ' · оплачено' : ' · не оплачено', o.shipped ? ' · відвантажено' : '', ` · ${money(o.amount)} грн`))),
      p.orders > p.orderList.length ? h('p', { class: 'note' }, `Показано ${p.orderList.length} найбільших із ${p.orders}.`) : null);
    return h('div', null, tags, det);
  }

  function renderProducts(d) {
    const s = d.sales;
    if (!s) return null;
    const max = Math.max(...s.products.map((p) => p.revenue), 1);
    const small = (title, rows) => panel(h('h3', null, title), table([{ t: 'Назва', r: (r) => r.name }, { t: 'Виручка, грн', n: true, r: (r) => money(r.revenue) }, { t: 'Частка', r: (r) => meter(r.share) }, { t: 'Замовл.', n: true, r: (r) => num(r.orders) }], rows));
    return h('section', { id: 'sec-products' }, head('Товари: топ-25 за виручкою', null, 'sec-products'),
      panel(s.products.length ? table([
          { t: '#', n: true, r: (p) => p.i },
          { t: 'Товар', r: (p) => h('div', { class: 'nm', title: p.name }, p.name) },
          { t: 'Категорія', r: (p) => h('span', { class: 'tag' }, short(p.category)) },
          { t: 'Виручка, грн', n: true, r: (p) => money(p.revenue) },
          { t: '', r: (p) => meter(p.revenue / max, fmt.pct(p.share, p.share < 0.1 ? 1 : 0)) },
          { t: 'Штук', n: true, r: (p) => num(p.qty) },
          { t: 'Замовлень', n: true, r: (p) => num(p.orders) },
          { t: 'Замовлення і статус у BAS', r: (p) => ordersCell(p) },
        ], s.products.map((p, i) => ({ ...p, i: i + 1 })), { task: (p) => rowTask(`Товар: ${p.name}`, 'Товар', 'sec-products') }) : empty('У цьому зрізі немає продажів.')),
      h('div', { class: 'grid two', style: { marginTop: '10px' } }, small('Тип клієнта', s.customerType), small('Спосіб оплати', s.payment)));
  }

  function renderSite(d, rows) {
    const site = d.site;
    if (!site) return h('section', { id: 'sec-site' }, head('Сайт (Google Analytics)'), empty('Google Analytics зараз недоступний.'));
    const g = state.grain;
    const body = h('div');
    const metrics = site.scoped ? [['sessions', 'Візити'], ['views', 'Перегляди']] : [['sessions', 'Візити'], ['users', 'Відвідувачі'], ['views', 'Перегляди']];
    const draw = (m) => {
      clear(body);
      const name = metrics.find(([id]) => id === m)[1];
      const pm = !site.scoped ? prevBuckets(site.series.map((r) => r.date), site.prevSeries, ['sessions', 'users', 'views']) : null;
      const pv = pm ? rows.map((r) => { const b = pm.get(r.key); return b ? b[m] : null; }) : null;
      const ov = overlaysFor(rows, rows.map((r) => r[m] || 0), `Тренд: ${name.charAt(0).toLowerCase()}${name.slice(1)}`, !!(d.ads && rows.some((r) => r.adCost > 0)), pv);
      body.appendChild(chart({ rows: rows.map((r, i) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: { [name]: r[m] || 0 }, overlay: ov.perRow[i] })), series: [{ name, color: 'var(--c-small)' }], overlays: ov.defs, title: name }));
    };
    draw('sessions');
    const first = site.series.length ? site.series[0].date : null;
    return h('section', { id: 'sec-site' }, head('Сайт (Google Analytics)', switcher(metrics, 'sessions', draw), 'sec-site'),
      panel(body, first && first > d.range.from ? h('p', { class: 'note' }, `Google Analytics має дані з ${fmt.dateFull(first)}.`) : null,
        h('p', { class: 'note' }, 'Якщо скласти візити по днях, вийде трохи менше (близько 2%), ніж загальна цифра в плитці. Так рахує сам Google Analytics: за день і за весь період він збирає дані по-різному.'),
        !site.scoped ? h('p', { class: 'note' }, 'Одна людина може прийти в різні дні, тому відвідувачів по днях і тижнях не можна просто складати. Точне число за весь період — у плитці «Відвідувачів».') : null),
      h('div', { class: 'grid two', style: { marginTop: '10px' } },
        panel(h('h3', null, site.scoped ? 'Звідки прийшли (візити на сторінки категорії)' : 'Звідки прийшли (канали)'), table([
          { t: 'Канал', r: (c) => c.name },
          { t: 'Візити', n: true, r: (c) => num(c.sessions) },
          { t: 'Частка', r: (c) => meter(c.share) },
          ...(site.scoped ? [] : [{ t: 'Відвідувачів', n: true, r: (c) => num(c.users) }]),
          { t: 'Не пішли одразу', n: true, r: (c) => fmt.pct(c.engagementRate) },
          ...(site.totals.prev ? [{ t: 'Зміна', n: true, r: (c) => (c.delta === null ? dash : deltaChip(c.delta)) }] : []),
        ], site.channels)),
        h('div', { class: 'grid' },
          panel(h('h3', null, 'Пристрої'), table([{ t: 'Пристрій', r: (x) => DEVICE[x.name] || x.name }, { t: 'Візити', n: true, r: (x) => num(x.sessions) }, { t: 'Частка', r: (x) => meter(x.share) }, { t: 'Не пішли одразу', n: true, r: (x) => fmt.pct(x.engagementRate) }], site.devices)),
          panel(h('h3', null, 'Найпопулярніші сторінки'), table([
            { t: 'Сторінка', r: (p) => h('div', { class: 'nm', title: p.path }, p.path) },
            { t: 'Розділ', r: (p) => h('span', { class: 'tag' }, short(p.category)) },
            { t: 'Перегляди', n: true, r: (p) => num(p.views) },
            { t: 'Відвідувачів', n: true, r: (p) => num(p.users) },
          ], site.topPages, { task: (p) => rowTask(`Сторінка сайту: ${p.path}`, 'Сторінка сайту', 'sec-site') })))));
  }

  // Interest by category: views of the pages, visits that began on them and Google-organic visits, by day / week / month,
  // for every category and for the crops and product kinds the page address shows. The change compares the last COMPLETE
  // bucket with the one before it (a week that is still going on would always look like a fall).
  const interestView = { metric: 'views' };
  const INTEREST_METRICS = [['views', 'Перегляди сторінок'], ['visits', 'Візити, що почалися зі сторінок'], ['organic', 'Прийшли з пошуку Google']];
  function renderInterest(d) {
    const it = d.site && d.site.interest;
    if (!it || !it.days.length) return null;
    const g = state.grain;
    const keys = [...new Set(it.days.map((day) => keyOf(day, g)))];
    const keyAt = it.days.map((day) => keys.indexOf(keyOf(day, g)));
    const endOf = (k) => (g === 'month' ? new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0)).toISOString().slice(0, 10) : g === 'week' ? fmt.addDays(k, 6) : k);
    const startOf = (k) => (g === 'month' ? `${k}-01` : k);
    const complete = keys.map((k) => startOf(k) >= d.range.from && endOf(k) <= d.range.to);
    let last = -1;
    for (let i = keys.length - 1; i >= 0; i--) if (complete[i]) { last = i; break; }
    const hasCmp = last >= 1 && complete[last - 1];
    const unit = g === 'month' ? 'місяць' : g === 'week' ? 'тиждень' : 'день';
    const body = h('div');
    // pages that belong to no product category go last and stay out of the chart: they would dwarf the categories
    const SERVICE = new Set(['Загальні сторінки', 'Не визначено']);
    const bucketed = (item, metric) => { const out = new Array(keys.length).fill(0); item[metric].forEach((v, i) => { out[keyAt[i]] += v; }); return out; };
    const draw2 = () => {
      clear(body);
      const m = interestView.metric;
      const rowsOf = (list) => list.map((x) => { const b = bucketed(x, m); return { item: x, b, total: b.reduce((t, v) => t + v, 0), now: last >= 0 ? b[last] : null, before: hasCmp ? b[last - 1] : null }; }).filter((r) => r.total > 0).sort((a, c) => (SERVICE.has(a.item.name) - SERVICE.has(c.item.name)) || c.total - a.total);
      const cats = rowsOf(it.categories);
      const groups = rowsOf(it.groups);
      if (!cats.length) { body.appendChild(empty(m === 'organic' ? 'Немає візитів з пошуку за цей період.' : 'Немає даних за цей період.')); return; }
      const sumAll = cats.reduce((t, r) => t + r.total, 0);
      const charted = cats.filter((r) => !SERVICE.has(r.item.name));
      const chartRows = keys.map((k, i) => ({ label: labelOf(k, g), long: longLabel(k, g), values: Object.fromEntries(charted.map((r) => [r.item.name, r.b[i]])) }));
      body.appendChild(chart({ rows: chartRows, series: charted.map((r) => ({ name: r.item.name, label: short(r.item.name), color: colorOf(r.item.name) })), unit: '', title: 'Інтерес за категоріями' }));
      const cols = () => [
        { t: 'Категорія', r: (r) => h('span', null, h('i', { class: 'sw', style: { background: colorOf(r.item.category) } }), short(r.item.name)) },
        { t: 'Разом', n: true, r: (r) => num(r.total) },
        { t: 'Частка', r: (r) => meter(ratio(r.total, sumAll)) },
        { t: last >= 0 ? `Останній ${unit}` : '', n: true, r: (r) => (r.now === null ? dash : num(r.now)) },
        { t: 'Зміна до попереднього', n: true, r: (r) => (hasCmp ? (dChip(r.now, r.before, { title: `Останній ${unit} проти попереднього` }) || dash) : dash) },
        { t: 'Динаміка', r: (r) => sparkline(r.b, { width: 84, height: 24 }) },
      ];
      const catTable = table(cols(), cats);
      body.appendChild(catTable);
      // «Сторінки» buttons: open the page list below already filtered to the category
      catTable.querySelectorAll('tbody tr').forEach((tr, i) => {
        const td = h('td', { class: 'n' });
        const b = h('button', { type: 'button', title: 'Показати сторінки цієї категорії у списку нижче' }, 'Сторінки ↓');
        b.addEventListener('click', () => { pageView.cat = cats[i].item.category; pageView.limit = 25; draw(state.data); const t = document.getElementById('sec-pages'); if (t) t.scrollIntoView({ block: 'start' }); });
        td.appendChild(b); tr.appendChild(td);
      });
      if (groups.length) {
        body.appendChild(h('h3', { class: 'sub' }, 'Культури й види препаратів'));
        body.appendChild(table(cols().map((c, i) => (i === 0 ? { ...c, t: 'Група' } : c)), groups));
        body.appendChild(h('p', { class: 'note' }, 'Ці групи видно за адресою сторінки (наприклад, /sonyashnuk). Сторінки, чия адреса культуру не показує, рахуються тільки в категорії.'));
      }
      body.appendChild(h('p', { class: 'note' }, hasCmp
        ? `Зміна — це останній повний ${unit} (${labelOf(keys[last], g)}) проти попереднього. ${last < keys.length - 1 ? `Поточний ${unit}, що ще триває, у порівняння не береться.` : ''}`
        : `Для порівняння потрібні два повні ${g === 'month' ? 'місяці' : g === 'week' ? 'тижні' : 'дні'} у вибраному періоді. Оберіть довший період.`));
    };
    draw2();
    return h('section', { id: 'sec-interest' }, head('Інтерес за категоріями', switcher(INTEREST_METRICS, interestView.metric, (id) => { interestView.metric = id; draw2(); }, 'Показник інтересу'), 'sec-interest'),
      panel(body));
  }

  // Visits to the pages of the shop: every page with views, change against the period before, time on the page, the visits
  // that began on it and a small daily line. Search, section filter, sorting, «show more» and a CSV file.
  const STORE_URL = 'https://store.syngenta.ua';
  const pageView = { q: '', cat: '', sort: 'views', limit: 25 };
  const PAGE_SORTS = [['views', 'Найбільше переглядів'], ['up', 'Найбільше зросли'], ['down', 'Найбільше впали'], ['time', 'Довше за все читають'], ['entr', 'Найчастіше з них заходять']];
  function renderPages(d) {
    const ps = d.site && d.site.pageStats;
    if (!ps) return null;
    const all = ps.rows;
    const body = h('div');
    const sortFns = {
      views: (a, b) => b.views - a.views,
      up: (a, b) => (b.views - (b.prevViews || 0)) - (a.views - (a.prevViews || 0)),
      down: (a, b) => (a.views - (a.prevViews || 0)) - (b.views - (b.prevViews || 0)),
      time: (a, b) => (b.avgSec || 0) - (a.avgSec || 0),
      entr: (a, b) => b.entrances - a.entrances,
    };
    const filtered = () => {
      const q = pageView.q.trim().toLowerCase();
      let list = all.filter((r) => (!q || r.path.toLowerCase().includes(q)) && (!pageView.cat || r.category === pageView.cat));
      // a page with a couple of views would top the «grew / fell» lists on noise alone
      if (pageView.sort === 'time') list = list.filter((r) => r.views >= 20);
      if ((pageView.sort === 'up' || pageView.sort === 'down') && ps.hasPrev) list = list.filter((r) => r.views >= 10 || (r.prevViews || 0) >= 10);
      return list.sort(sortFns[pageView.sort] || sortFns.views);
    };
    function csv(list) {
      const cell = (v) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
      const lines = [['Сторінка', 'Розділ', 'Перегляди', 'Було до цього', 'Відвідувачів', 'Секунд на сторінці', 'Входи'].map(cell).join(';')]
        .concat(list.map((r) => [`${STORE_URL}${r.path}`, r.category, r.views, r.prevViews, r.users, r.avgSec === null ? '' : Math.round(r.avgSec), r.entrances].map(cell).join(';')));
      const a = h('a', { href: URL.createObjectURL(new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })), download: `сторінки-магазину-${d.range.from}-${d.range.to}.csv` });
      document.body.appendChild(a); a.click(); a.remove();
    }
    const draw = () => {
      clear(body);
      const list = filtered();
      const shown = list.slice(0, pageView.limit);
      const maxViews = Math.max(1, ...shown.map((r) => r.views));
      const cols = [
        { t: 'Сторінка', r: (r) => h('a', { class: 'nm', href: `${STORE_URL}${r.path}`, target: '_blank', rel: 'noopener', title: `${r.path} (відкриється в магазині)` }, r.path) },
        { t: 'Розділ', r: (r) => h('span', { class: 'tag' }, short(r.category)) },
        { t: 'Перегляди', r: (r) => meter(r.views / maxViews, num(r.views)) },
        ...(ps.hasPrev ? [{ t: 'Було', n: true, r: (r) => num(r.prevViews) }] : []),
        { t: 'Зміна', n: true, r: (r) => (ps.hasPrev ? (dChip(r.views, r.prevViews) || dash) : dash) },
        { t: 'Відвідувачів', n: true, r: (r) => num(r.users) },
        { t: 'Час на сторінці', n: true, r: (r) => (r.avgSec ? fmt.duration(r.avgSec) : dash) },
        { t: 'Почали з неї', n: true, r: (r) => num(r.entrances) },
        { t: 'Динаміка', r: (r) => (r.spark && r.spark.length > 1 ? sparkline(r.spark, { width: 84, height: 24 }) : '') },
      ];
      body.appendChild(table(cols, shown, { task: (r) => rowTask(`Сторінка магазину: ${r.path}`, 'Сторінка магазину', 'sec-pages') }));
      if (!shown.length) body.appendChild(empty('Немає сторінок за цими умовами.'));
      const foot = h('div', { class: 'ctl', style: { marginTop: '8px' } }, h('span', { class: 'note', style: { margin: 0 } }, `Показано ${shown.length} з ${list.length}`));
      if (list.length > shown.length) {
        const more = h('button', { type: 'button' }, 'Показати ще 25');
        more.addEventListener('click', () => { pageView.limit += 25; draw(); });
        foot.appendChild(more);
      }
      const dl = h('button', { type: 'button' }, '↓ Завантажити в Excel (CSV)');
      dl.addEventListener('click', () => csv(list));
      foot.appendChild(dl);
      body.appendChild(foot);
    };
    const q = h('input', { type: 'text', placeholder: 'Пошук за адресою сторінки…', value: pageView.q, 'aria-label': 'Пошук сторінки', style: { width: '260px' } });
    q.addEventListener('input', () => { pageView.q = q.value; pageView.limit = 25; draw(); });
    const catNames = [...new Set(all.map((r) => r.category))];
    const cat = h('select', { 'aria-label': 'Розділ' }, h('option', { value: '' }, 'Усі розділи'), catNames.map((c) => h('option', { value: c, selected: c === pageView.cat }, short(c))));
    cat.addEventListener('change', () => { pageView.cat = cat.value; pageView.limit = 25; draw(); });
    const sort = h('select', { 'aria-label': 'Порядок' }, PAGE_SORTS.map(([v, t]) => h('option', { value: v, selected: v === pageView.sort }, t)));
    sort.addEventListener('change', () => { pageView.sort = sort.value; pageView.limit = 25; draw(); });
    draw();
    return h('section', { id: 'sec-pages' }, head('Відвідування сторінок магазину', null, 'sec-pages'),
      panel(h('div', { class: 'ctl', style: { marginBottom: '8px' } }, q, cat, sort), body,
        h('p', { class: 'note' }, `Показано найпопулярніші сторінки магазину: ${num(all.length)} із ${num(ps.total)}. «Перегляди» — це кожне відкриття сторінки. «Входи» — візити, які почалися саме з цієї сторінки. «Зміна» — проти попереднього періоду такої ж довжини. «Час на сторінці» — у середньому на одного відвідувача.`)));
  }

  // Google Ads (API): spend against BAS sales, campaigns, search terms. Whole-shop view only.
  const CHANNEL = { SEARCH: 'Пошук', PERFORMANCE_MAX: 'Автоматична (усі місця Google)', DEMAND_GEN: 'Банери й відео (Demand Gen)', VIDEO: 'Відео', SHOPPING: 'Shopping', DISPLAY: 'Банери', DISCOVERY: 'Discovery', SMART: 'Smart' };
  function renderAds(d, rows) {
    const src = d.sources.gads;
    // «Самі оформили» / «Через менеджера»: Google does not know who placed the order, so the ads are those of the whole shop
    const wholeShop = d.scope.mode !== 'all';
    const modeNote = wholeShop ? h('p', { class: 'scope-note' }, `Реклама тут — на весь магазин. Google не знає, хто оформив замовлення, тому її не можна розділити на «Самі оформили» і «Через менеджера». Для чесності ми не ділимо витрати на виручку вибраного типу продажів.`) : null;
    const sec = (...kids) => h('section', { id: 'sec-ads' }, head('Реклама (Google Ads)', null, 'sec-ads'), modeNote, ...kids);
    if (!src) return sec(empty('Google Ads ще не підключено.'));
    if (!src.ok) {
      return sec(empty(src.error === 'не підключено'
        ? 'Google Ads ще не підключено. Коли ключі доступу будуть у налаштуваннях сервера, тут зʼявляться витрати, кампанії й пошукові запити.'
        : 'Google Ads зараз недоступний.'));
    }
    const a = d.ads;
    if (!a.totals.cost && !a.totals.impressions && !a.totals.clicks) {
      // nothing to show: say which filter hides the data
      if (d.scope.category !== 'all') {
        const lost = a.placement && a.placement.unplacedCost > 0 ? ` Ще ${money(a.placement.unplacedCost)} грн витрат — у кампаніях без категорії в назві, їх видно лише в загальному вигляді.` : '';
        return sec(h('p', { class: 'scope-note' }, `Для категорії «${d.scope.label}» у Google Ads немає даних: кампанії розпізнаються за словами в назві. Щоб побачити рекламу, у фільтрі «Категорія товарів» оберіть «Загальний».${lost}`));
      }
      return sec(h('p', { class: 'scope-note' }, 'За цей період у Google Ads немає витрат. Оберіть у фільтрі «Період» інший проміжок.'));
    }
    const t = a.totals, p = a.prev;
    const cur = a.currency === 'UAH' ? 'грн' : (a.currency || '');
    const MARK = { warn: ['⚠', 'Увага'], good: ['✔', 'Добре'], info: ['ℹ', 'До відома'] };
    const insights = a.insights && a.insights.length
      ? panel(h('h3', null, 'Що помітно'), h('ul', { class: 'insights' }, a.insights.map((i) => h('li', { class: `ins ${i.tone}` },
        h('span', { class: 'ins-mark', 'aria-hidden': 'true' }, MARK[i.tone][0]), h('span', { class: 'sr-only' }, `${MARK[i.tone][1]}: `), h('span', null, i.text)))))
      : null;
    const kpis = h('div', { class: 'grid kpis' },
      kpi(`Витрати, ${cur}`, fmt.compact(t.cost), [dChip(t.cost, p && p.cost, { good: 'neutral' }), h('span', null, `${fmt.int(t.cost)} ${cur}`)], { spark: rows.map((r) => r.adCost) }),
      kpi('Кліки', num(t.clicks), dChip(t.clicks, p && p.clicks)),
      kpi('Покази', num(t.impressions), dChip(t.impressions, p && p.impressions)),
      kpi('Частка кліків', fmt.pct(t.ctr, 2), [p ? h('span', null, `було ${fmt.pct(p.ctr, 2)}`) : h('span', null, 'скільки людей зі ста клікнули'), chip(Bench.ctrTotal(t.ctr, a.campaigns.filter((c) => c.cost > 0).map((c) => c.channel)))]),
      kpi(`Ціна кліка, ${cur}`, fmt.dec1(t.cpc), p ? [dChip(t.cpc, p.cpc, { good: 'down' }), h('span', null, `було ${fmt.dec1(p.cpc)}`)] : null),
      kpi('Цілі за Google', num(t.conversions), h('span', null, 'покупки чи заявки за налаштуваннями Google')),
      kpi(`Ціна цілі, ${cur}`, t.costPerConv === null ? dash : fmt.compact(t.costPerConv), h('span', null, 'витрати, поділені на цілі')),
      kpi('Кліків, що дали ціль', fmt.pct(t.convRate, 2), [h('span', null, 'скільки кліків закінчились ціллю'), chip(Bench.goalRate(t.convRate, t.clicks))]),
      kpi('Цінність на 1 грн реклами (за Google)', t.roas === null ? dash : `×${fmt.dec1(t.roas)}`, h('span', null, 'скільки гривень покупок і заявок Google нарахував на кожну гривню реклами')),
      a.comparable ? kpi('Реклама від виручки BAS', t.costShare === null ? dash : fmt.pct(t.costShare, 1), [h('span', null, 'рахуємо від усіх продажів магазину'), chip(Bench.adShare(t.costShare))]) : null,
      a.comparable ? kpi('Реклами на 1 замовлення, грн', t.costPerOrder === null ? dash : fmt.compact(t.costPerOrder), h('span', null, `${num(t.orders)} замовлень у BAS`)) : null);

    const g = state.grain;
    const rowsOf = (name, key, color) => {
      const ov = overlaysFor(rows, rows.map((r) => r[key] || 0), `Тренд: ${name.charAt(0).toLowerCase()}${name.slice(1)}`, false);
      return {
        rows: rows.map((r, i) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: { [name]: r[key] || 0 }, overlay: ov.perRow[i] })),
        series: [{ name, color }],
        overlays: ov.defs,
      };
    };
    const spend = rowsOf('Витрати', 'adCost', 'var(--c-spray)');
    const sales = rowsOf('Виручка BAS', 'revenue', 'var(--c-zzr)');
    const charts = d.sales
      ? panel(h('h3', null, `Витрати на рекламу, ${cur}`), chart({ ...spend, unit: ` ${cur}`, title: 'Витрати на рекламу' }),
        h('h3', { class: 'sub' }, wholeShop ? `Виручка BAS без ПДВ, грн — лише «${d.scope.modeLabel}»` : 'Виручка BAS без ПДВ, грн'), chart({ ...sales, unit: ' грн', title: 'Виручка BAS' }),
        h('p', { class: 'note' }, 'Обидва графіки мають однакову вісь днів, тому піки витрат і піки виручки видно один під одним.'))
      : panel(chart({ ...spend, unit: ` ${cur}`, title: 'Витрати на рекламу' }), h('p', { class: 'note' }, 'BAS тимчасово недоступний — виручки для порівняння немає.'));

    const totalRow = { name: 'Разом', ...t, prevCost: p ? p.cost : null };
    const isTotal = (c) => c.name === 'Разом';
    const campCols = [
      { t: 'Кампанія', r: (c) => (isTotal(c) ? 'Разом' : h('div', { class: 'nm', title: c.name }, c.name, ' ', h('span', { class: 'tag' }, CHANNEL[c.channel] || c.channel || ''), c.status && c.status !== 'ENABLED' ? [' ', h('span', { class: 'tag' }, c.status === 'PAUSED' ? 'на паузі' : 'вимкнена')] : null)) },
      { t: `Витрати, ${cur}`, n: true, r: (c) => money(c.cost) },
      { t: 'Частка', r: (c) => (isTotal(c) ? '' : meter(ratio(c.cost, t.cost))) },
      { t: 'Кліки', n: true, r: (c) => num(c.clicks) },
      { t: 'Покази', n: true, r: (c) => num(c.impressions) },
      { t: 'Частка кліків', n: true, r: (c) => [fmt.pct(c.ctr, 2), ' ', chip(Bench.ctr(c.ctr, c.channel, c.name))] },
      { t: 'Ціна кліка', n: true, r: (c) => (c.clicks ? fmt.dec1(c.cpc) : dash) },
      { t: 'Цілі', n: true, r: (c) => num(c.conversions) },
    ];
    if (p) campCols.push({ t: 'Зміна витрат', n: true, r: (c) => (c.prevCost === null || c.prevCost === undefined ? dash : dChip(c.cost, c.prevCost, { good: 'neutral' })) || dash });

    const VERDICT = { good: ['Ефективніша за середню', 'good'], ok: ['У межах середнього', ''], bad: ['Дорожча за середню', 'bad'], 'no-conv': ['Витрати без цілей', 'bad'], 'low-data': ['Мало даних', ''], 'no-data': ['Конверсій немає', ''] };
    const effCols = [
      { t: 'Кампанія', r: (c) => (isTotal(c) ? 'Разом' : h('div', { class: 'nm', title: c.name }, c.name)) },
      { t: `Витрати, ${cur}`, n: true, r: (c) => money(c.cost) },
      { t: 'Частка кліків', n: true, r: (c) => fmt.pct(c.ctr, 2) },
      { t: 'Ціна кліка', n: true, r: (c) => (c.clicks ? fmt.dec1(c.cpc) : dash) },
      { t: 'Цілі', n: true, r: (c) => num(c.conversions) },
      { t: 'Ціна цілі', n: true, r: (c) => (c.costPerConv === null || c.costPerConv === undefined ? dash : money(c.costPerConv)) },
      { t: 'Кліків, що дали ціль', n: true, r: (c) => fmt.pct(c.convRate, 2) },
      { t: 'Цінність на 1 грн', n: true, r: (c) => (c.roas === null || c.roas === undefined ? dash : `×${fmt.dec1(c.roas)}`) },
      { t: 'Оцінка', r: (c) => (isTotal(c) || !VERDICT[c.verdict] ? '' : h('span', { class: `tag ${VERDICT[c.verdict][1]}` }, VERDICT[c.verdict][0])) },
    ];
    const pl = a.placement;
    const placeNote = pl
      ? h('p', { class: 'scope-note' }, `Показуємо лише кампанії, які за назвою належать до категорії «${d.scope.label}». Google не ділить витрати за нашими категоріями, тому ми дивимось на назву кампанії: слово-препарат («Амістар», «Скор») і позначки «(Пром)» та «(Прив)». «(Пром)» — професійні клієнти й великі упаковки, «(Прив)» — приватні клієнти й дрібне фасування.`,
        pl.unplacedCost > 0 ? ` Не вдалося віднести до жодної категорії ${fmt.int(pl.unplacedCost)} ${cur} (${pl.unplaced.map((u) => `«${u.name}» ${fmt.int(u.cost)}`).join('; ')}): у цьому зрізі їх немає, лише в загальному вигляді.` : '')
      : null;
    const kids = [placeNote, insights, kpis, charts,
      h('h3', { class: 'sub' }, 'Кампанії за витратами'),
      panel(a.campaigns.length ? table(campCols, a.campaigns, { total: totalRow, task: (c) => rowTask(`Кампанія Google Ads: ${c.name}`, 'Кампанія Google Ads', 'sec-ads') }) : empty('У цьому періоді витрат на рекламу не було.'))];
    if (a.campaigns.length) {
      kids.push(h('h3', { class: 'sub' }, 'Ефективність кампаній'));
      kids.push(panel(table(effCols, a.campaigns, { total: totalRow }),
        h('p', { class: 'note' }, 'Ми порівнюємо ціну цілі кампанії із середньою ціною по всьому акаунту. «Ефективніша» — не дорожче 70% від середньої. «Дорожча» — від 150% від середньої. Кампанії, на які пішло менше 3% бюджету або менше 20 кліків, не оцінюємо: даних мало. Цілі рахує Google, тому це підказка, а не вирок.')));
    }
    if (a.searchTerms && a.searchTerms.length) {
      kids.push(h('h3', { class: 'sub' }, 'За якими запитами показували рекламу (найдорожчі)'));
      kids.push(panel(table([
        { t: 'Запит', r: (x) => h('div', { class: 'nm', title: x.term }, x.term) },
        { t: `Витрати, ${cur}`, n: true, r: (x) => money(x.cost) },
        { t: 'Кліки', n: true, r: (x) => num(x.clicks) },
        { t: 'Покази', n: true, r: (x) => num(x.impressions) },
        { t: 'Частка кліків', n: true, r: (x) => fmt.pct(x.ctr, 2) },
        { t: 'Цілі', n: true, r: (x) => num(x.conversions) },
      ], a.searchTerms, { task: (x) => rowTask(`Пошуковий запит реклами: ${x.term}`, 'Запит Google Ads', 'sec-ads') })));
    }
    kids.push(h('p', { class: 'note' },
      `Рекламний кабінет: ${a.accountName || '—'}, суми в ${a.currency === 'UAH' ? 'гривнях' : (a.currency || '—')}.`,
      ' «Цілі» — це те, що Google вважає успіхом: покупка чи заявка. Поки покупки на сайті відстежуються ненадійно, довіряйте виручці BAS. ',
      'BAS не знає, звідки прийшло замовлення. Тому «реклама від виручки» і «реклами на замовлення» — лише орієнтир.',
      a.comparable ? '' : ' Валюта акаунта не гривня, тому порівняння з виручкою BAS не рахуємо.'));
    return sec(...kids);
  }

  function renderSearch(d) {
    const kids = [head('Пошук і ключові слова', null, 'sec-search')];
    const sr = d.search;
    if (sr) {
      const t = sr.totals;
      kids.push(h('h3', { class: 'sub' }, `Пошук Google → наш сайт (${sr.site}): за якими запитами приходять люди`));
      kids.push(h('div', { class: 'grid kpis' },
        kpi('Прийшли з пошуку', num(t.clicks), dChip(t.clicks, t.prev && t.prev.clicks)),
        kpi('Покази в пошуку', num(t.impressions), dChip(t.impressions, t.prev && t.prev.impressions)),
        kpi('Частка кліків', fmt.pct(t.ctr, 2), t.prev ? h('span', null, `було ${fmt.pct(t.prev.ctr, 2)}`) : null),
        kpi('Середня позиція', fmt.dec1(t.position), [t.prev ? h('span', null, `було ${fmt.dec1(t.prev.position)}`) : null, chip(Bench.position(t.position))]),
        kpi('Шукали саме нас (за назвою компанії)', fmt.pct(ratio(sr.brand.clicks, sr.brand.clicks + sr.nonBrand.clicks), 0), h('span', null, `${num(sr.brand.clicks)} за назвою · ${num(sr.nonBrand.clicks)} за іншими словами`))));
      const body = h('div');
      const g = state.grain;
      const rowsS = bucketSimple(sr.series, g, ['clicks', 'impressions']);
      const drawS = (m) => {
        clear(body);
        const name = m === 'clicks' ? 'Переходи' : 'Покази';
        body.appendChild(chart({ rows: rowsS.map((r) => ({ label: labelOf(r.key, g), long: longLabel(r.key, g), values: { [name]: r[m] } })), series: [{ name, color: 'var(--c-zzr)' }], title: name }));
      };
      drawS('clicks');
      kids.push(h('div', { class: 'sechead sub-head' }, h('span'), switcher([['clicks', 'Переходи'], ['impressions', 'Покази']], 'clicks', drawS)));
      kids.push(panel(body, h('p', { class: 'note' }, 'Search Console запізнюється на 1–3 дні, тому останні дні можуть бути неповними.')));
      const maxClicks = Math.max(...sr.queries.map((q) => q.clicks), 1);
      kids.push(h('div', { class: 'grid two', style: { marginTop: '10px' } },
        panel(h('h3', null, 'Що шукають люди, які потім приходять до нас'), sr.queries.length ? table([
          { t: 'Запит', r: (q) => h('div', { class: 'nm', title: q.query }, q.query) },
          { t: 'Тип', r: (q) => h('span', { class: 'tag' }, q.brand ? 'назва компанії' : 'інший запит') },
          { t: 'Переходи', n: true, r: (q) => num(q.clicks) },
          { t: '', r: (q) => meter(q.clicks / maxClicks, '') },
          { t: 'Покази', n: true, r: (q) => num(q.impressions) },
          { t: 'Частка кліків', n: true, r: (q) => fmt.pct(q.ctr, 1) },
          { t: 'Позиція', n: true, r: (q) => fmt.dec1(q.position) },
        ], sr.queries.slice(0, 40), { task: (q) => rowTask(`Запит у Google «${q.query}»: `, 'Пошук Google', 'sec-search') }) : empty('Немає запитів за цей період і категорію.'),
          h('p', { class: 'note' }, `Запити в таблиці дають ${num(sr.brand.clicks + sr.nonBrand.clicks)} із ${num(t.clicks)} переходів. Решту (рідкісні запити) Google приховує.`)),
        panel(h('h3', null, 'Сторінки, на які переходять з пошуку'), sr.pages.length ? table([
          { t: 'Сторінка', r: (p) => h('div', { class: 'nm', title: p.path }, p.path) },
          { t: 'Розділ', r: (p) => h('span', { class: 'tag' }, short(p.category)) },
          { t: 'Переходи', n: true, r: (p) => num(p.clicks) },
          { t: 'Покази', n: true, r: (p) => num(p.impressions) },
          { t: 'Частка кліків', n: true, r: (p) => fmt.pct(p.ctr, 1) },
          { t: 'Позиція', n: true, r: (p) => fmt.dec1(p.position) },
        ], sr.pages, { task: (p) => rowTask(`Сторінка в пошуку Google: ${p.path}`, 'Пошук Google', 'sec-search') }) : empty('Немає сторінок за цей період і категорію.'))));
    } else kids.push(empty('Search Console зараз недоступний.'));

    const ss = d.siteSearch;
    if (ss) {
      kids.push(h('h3', { class: 'sub' }, 'Що люди шукають усередині нашого магазину'));
      const maxS = Math.max(...ss.terms.map((t) => t.searches), 1);
      kids.push(panel(ss.terms.length ? table([
        { t: 'Запит', r: (t) => t.term },
        { t: 'Розділ', r: (t) => h('span', { class: 'tag' }, t.category === 'Не визначено' ? 'без розділу' : short(t.category)) },
        { t: 'Пошуків', n: true, r: (t) => num(t.searches) },
        { t: '', r: (t) => meter(t.searches / maxS, fmt.pct(t.share, 1)) },
        { t: 'Людей', n: true, r: (t) => num(t.users) },
      ], ss.terms, { task: (t) => rowTask(`Пошук на сайті «${t.term}»: `, 'Пошук на сайті', 'sec-search') }) : empty('Немає пошукових запитів на сайті за цей період і категорію.'),
      h('p', { class: 'note' }, `Усього пошуків: ${num(ss.total)}. Різних запитів: ${num(ss.distinct)}. Великі й малі літери не розрізняємо.`)));
    }

    if (d.demand) kids.push(renderDemand(d.demand));
    return h('section', { id: 'sec-search' }, kids);
  }

  // National Google demand for Syngenta product names: a hand-taken Looker Studio snapshot (monthly).
  function renderDemand(dm) {
    const top = dm.groups.items.slice(0, 6);
    const rest = dm.groups.items.slice(6);
    const rows = dm.months.map((m, i) => {
      const values = Object.fromEntries(top.map((g) => [g.name, g.monthly[i] || 0]));
      if (rest.length) values['Інші групи'] = rest.reduce((t, g) => t + (g.monthly[i] || 0), 0);
      return { label: m, long: m, values };
    });
    const series = [...top.map((g, i) => ({ name: g.name, color: PALETTE[i] })), ...(rest.length ? [{ name: 'Інші групи', color: 'var(--c-other)' }] : [])];
    const maxG = Math.max(...dm.groups.items.map((g) => g.total), 1);
    const maxK = Math.max(...dm.topKeywords.items.map((g) => g.total), 1);
    const fetched = dm.fetchedAt ? dm.fetchedAt.slice(0, 10) : '';
    return h('div', null,
      h('h3', { class: 'sub' }, `Скільки шукають у Google по Україні (знімок із Looker Studio за ${dm.period.from} — ${dm.period.to}, знято ${fetched})`),
      h('div', { class: 'grid kpis' },
        kpi('Пошуків за період', num(dm.totalSearches), dm.deltaVsPrevPeriod === undefined ? null : deltaChip(dm.deltaVsPrevPeriod, { title: 'Порівняно з попереднім періодом у звіті Looker (знімок від 24.09.2026)' })),
        kpi('У середньому на місяць', num(dm.avgPerMonth), null)),
      panel(chart({ rows, series, title: 'Пошуковий попит за місяцями', unit: ' пошуків' })),
      h('div', { class: 'grid two', style: { marginTop: '10px' } },
        panel(h('h3', null, 'Групи товарів'), table([
          { t: 'Група', r: (g) => g.name },
          { t: 'Пошуків', n: true, r: (g) => num(g.total) },
          { t: '', r: (g) => meter(g.total / maxG, '') },
          { t: 'Динаміка', r: (g) => sparkline(g.monthly, { width: 84, height: 24 }) },
        ], dm.groups.items)),
        panel(h('h3', null, 'Ключові слова'), table([
          { t: 'Слово', r: (g) => g.name },
          { t: 'Пошуків', n: true, r: (g) => num(g.total) },
          { t: '', r: (g) => meter(g.total / maxK, '') },
          { t: 'Динаміка', r: (g) => sparkline(g.monthly, { width: 84, height: 24 }) },
        ], dm.topKeywords.items), h('p', { class: 'note' }, dm.topKeywords.note || ''))),
      h('p', { class: 'note' }, 'Цей блок не залежить від перемикачів і періоду. Це знімок звіту Looker Studio, його оновлюють вручну.'));
  }

  function renderProblems(d) {
    const s = d.sales, b = d.behaviour;
    const kids = [head('Проблеми клієнтів', null, 'sec-problems')];
    if (s) {
      const p = s.problems;
      const tile = (label, value, sub, tone) => kpi(label, value, sub, { tone });
      kids.push(h('div', { class: 'grid kpis' },
        tile('Не оплачені', num(p.unpaid.orders), p.unpaid.stale ? `${num(p.unpaid.stale)} старше 3 днів · ${fmt.compact(p.unpaid.staleAmount)} грн` : 'усі свіжі', p.unpaid.stale ? 'bad' : null),
        tile('Повернення', num(p.returns.orders), `${fmt.compact(p.returns.amount)} грн · ${fmt.pct(p.returns.share, 1)} замовлень`, p.returns.orders ? 'warn' : null),
        tile('Застрягли в роботі', num(p.inProgress.stuck), `у роботі всього ${num(p.inProgress.orders)} · старше 7 днів`, p.inProgress.stuck ? 'bad' : null),
        tile('Потребують звірки', num(p.toCheck.orders), `${fmt.compact(p.toCheck.amount)} грн · у замовленні різні статуси`, p.toCheck.orders ? 'warn' : null),
        tile('Днів до оплати', p.avgDaysToPay === null ? dash : fmt.dec1(p.avgDaysToPay), p.prevAvgDaysToPay === null ? 'середнє' : `було ${fmt.dec1(p.prevAvgDaysToPay)}`),
        tile('Днів до відвантаження', p.avgDaysToShip === null ? dash : fmt.dec1(p.avgDaysToShip), p.prevAvgDaysToShip === null ? 'середнє' : `було ${fmt.dec1(p.prevAvgDaysToShip)}`)));
      if (p.toCheck.list.length) {
        kids.push(panel(h('h3', null, 'Замовлення на звірку в BAS'), table([
          { t: '№', r: (o) => o.order }, { t: 'Дата', r: (o) => (o.date ? fmt.dateFull(o.date) : dash) },
          { t: 'Оплата', r: (o) => (o.paidDate || 'немає') },
          { t: 'Передано в облік (SAP)', r: (o) => (o.sap ? 'так' : 'ні') },
          { t: 'Сума, грн', n: true, r: (o) => money(o.amount) },
          { t: 'Причина', r: (o) => (o.reasons || []).join('; ') },
        ], p.toCheck.list, { task: (o) => rowTask(`Звірити замовлення №${o.order} у BAS`, 'Звірка замовлень', 'sec-problems') })));
      }
    } else kids.push(empty('Замовлення: BAS тимчасово недоступний.'));

    if (b) {
      const r = b.rates;
      kids.push(h('h3', { class: 'sub' }, `Поведінка на сайті (Clarity): ${b.from} — ${b.to}, ${b.days} дн. збережених звітів`));
      kids.push(h('div', { class: 'grid kpis' },
        kpi('Візитів', num(b.sessions), ''),
        kpi('Кліки в нікуди', fmt.pct(r.dead, 1), `${num(b.issues.dead.events)} кліків`, { tone: r.dead > 0.1 ? 'warn' : null }),
        kpi('Нервові кліки', fmt.pct(r.rage, 1), `${num(b.issues.rage.events)} кліків`, { tone: r.rage > 0.03 ? 'bad' : null }),
        kpi('Одразу назад', fmt.pct(r.quickback, 1), `${num(b.issues.quickback.events)} разів`),
        kpi('Візити з помилкою на сторінці', fmt.pct(r.scriptError, 1), `${num(b.issues.scriptError.sessions)} візитів`, { tone: r.scriptError > 0.1 ? 'bad' : null }),
        kpi('Кліки, що дали помилку', fmt.pct(r.errorClick, 2), `${num(b.issues.errorClick.events)} кліків`)));
      kids.push(h('div', { class: 'grid two', style: { marginTop: '10px' } },
        panel(h('h3', null, 'Сторінки з проблемами'), table([
          { t: 'Сторінка', r: (p) => h('div', { class: 'nm', title: p.name }, p.name) },
          { t: 'Візитів', n: true, r: (p) => num(p.sessions) },
          { t: 'Нервові', n: true, r: (p) => num(p.rage) },
          { t: 'У нікуди', n: true, r: (p) => num(p.dead) },
          { t: 'Помилки', n: true, r: (p) => num(p.scriptError) },
          { t: 'Одразу назад', n: true, r: (p) => num(p.quickback) },
        ], b.pages, { task: (p) => rowTask(`Виправити проблеми на сторінці ${p.name}`, 'Поведінка на сайті (Clarity)', 'sec-problems') })),
        panel(h('h3', null, 'Куди клікають і нічого не відбувається'), b.clicks.length ? table([
          { t: 'Сторінка', r: (c) => c.page },
          { t: 'Елемент', r: (c) => c.text || 'без підпису' },
          { t: 'Тип', r: (c) => (c.type === 'rage' ? 'нервові' : 'у нікуди') },
          { t: 'Разів', n: true, r: (c) => num(c.count) },
        ], b.clicks) : empty('Немає даних'))));
      kids.push(h('p', { class: 'note' }, 'Clarity не зберігає історію. Тому тут лише дні, для яких уже є щоденний звіт. За категоріями поведінку не ділимо.'));
    } else kids.push(empty('Поведінка на сайті (Clarity): за вибраний період немає збережених щоденних звітів.'));
    return h('section', { id: 'sec-problems' }, kids);
  }

  // ---- accordion ----------------------------------------------------------------------------
  // Every section with an id folds under its heading. Only «Підсумок» is open by default; what the person
  // opens or closes is remembered in this browser. A jump link, a task link or a #hash opens its section.
  const ACC_KEY = 'sytboard.report.open2';
  const ACC_DEFAULT_OPEN = ['sec-sales', 'sec-dynamics', 'sec-traffic', 'sec-telegram', 'sec-ads', 'sec-behaviour', 'sec-audience', 'sec-orders', 'sec-cats', 'sec-items', 'sec-retention'];
  const accRead = () => { try { return JSON.parse(localStorage.getItem(ACC_KEY)) || {}; } catch { return {}; } };
  const accWrite = (v) => { try { localStorage.setItem(ACC_KEY, JSON.stringify(v)); } catch { /* private mode: not remembered */ } };

  function accordion(root, openId) {
    const saved = accRead();
    const parts = new Map();
    const setOpen = (id, open) => {
      const p = parts.get(id);
      if (!p) return;
      p.body.hidden = !open;
      p.btn.setAttribute('aria-expanded', String(open));
      p.sec.classList.toggle('open', open);
    };
    for (const sec of [...root.children].filter((n) => n.tagName === 'SECTION' && n.id)) {
      const headEl = sec.querySelector(':scope > .sechead');
      const title = headEl && headEl.querySelector('h2');
      if (!title) continue;
      const body = h('div', { class: 'accbody', id: `${sec.id}-body` });
      while (headEl.nextSibling) body.appendChild(headEl.nextSibling);
      sec.appendChild(body);
      const btn = h('button', { type: 'button', class: 'acc-toggle', 'aria-controls': body.id, 'aria-expanded': 'false' }, h('span', { class: 'acc-chev', 'aria-hidden': 'true' }), title.textContent);
      title.textContent = '';
      title.appendChild(btn);
      sec.classList.add('accsec');
      parts.set(sec.id, { sec, body, btn });
      setOpen(sec.id, sec.id === openId || (sec.id in saved ? !!saved[sec.id] : ACC_DEFAULT_OPEN.includes(sec.id)));
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        setOpen(sec.id, open);
        accWrite({ ...accRead(), [sec.id]: open });
      });
    }
    const all = (open) => { const next = { ...accRead() }; for (const id of parts.keys()) { setOpen(id, open); next[id] = open; } accWrite(next); };
    const tools = h('div', { class: 'acc-tools' }, h('button', { type: 'button' }, 'Розгорнути всі'), h('button', { type: 'button' }, 'Згорнути всі'));
    tools.children[0].addEventListener('click', () => all(true));
    tools.children[1].addEventListener('click', () => all(false));
    root.insertBefore(tools, root.firstChild);
    return { open: (id) => setOpen(id, true) };
  }

  // ---- load & draw --------------------------------------------------------------------------
  function drawControls() {
    const fill = (id, options, current, onPick) => {
      const el = $(id);
      clear(el);
      for (const [key, label] of options) {
        const b = h('button', { type: 'button', 'aria-pressed': String(current === key) }, label);
        b.addEventListener('click', () => onPick(key));
        el.appendChild(b);
      }
    };
    fill('views', [['period', 'За період'], ['day', 'За день']], state.view, (id) => { if (id === state.view) return; state.view = id; applyView(); });
    for (const id of ['periodctl', 'scopectl', 'jump']) $(id).hidden = state.view === 'day';
    $('dayctl').hidden = state.view !== 'day';
    $('refresh').hidden = state.view === 'day';
    $('scope-hint').hidden = state.view === 'day';
    syncSelects();
    fill('grain',[['day', 'Дні'], ['week', 'Тижні'], ['month', 'Місяці']], state.grain, (id) => { state.grain = id; state.grainUser = true; syncUrl(); drawControls(); if (state.data) draw(state.data); });
  }

  // Period, category and sales type are drop-downs (built once, then kept in step with the state), each with a
  // visible label, so the bar reads as a short form instead of a row of identical buttons.
  const MODE_HINT = {
    all: 'Усі замовлення: і ті, що клієнти оформили самі, і ті, де був менеджер.',
    organic: 'Самі оформили — замовлення, які клієнт оформив сам: без менеджера і без його промокоду.',
    manual: 'Через менеджера — замовлення, де був менеджер або його промокод.',
  };
  const CATEGORY_HINT = { small: 'Дрібне фасування ЗЗР разом із засобами захисту від побутових шкідників (Outcast).', spray: 'Розпилювачі в BAS ще не продавали, тож продажів тут нема. Сайт і пошук показуємо.' };
  let picker = null;
  function initSelects() {
    const fillSelect = (id, options) => { const el = $(id); for (const [value, label] of options) el.appendChild(h('option', { value }, label)); return el; };
    // The period: one button with a calendar (ready periods + two months). The report loads only after «Показати»,
    // and the picked period goes through the same load() as before, so the URL, the charts and Vira all follow it.
    picker = RangePicker.attach($('range-btn'), {
      presets: PRESETS, max: today,
      value: () => ({ preset: state.preset, from: state.from, to: state.to }),
      onPick: (preset, from, to) => { state.preset = preset; load(preset === 'all' ? null : from, preset === 'all' ? null : to); },
    });
    fillSelect('cat-select', CATEGORY_SWITCH).addEventListener('change', (e) => { state.category = e.target.value; reload(); });
    fillSelect('mode-select', MODE_SWITCH).addEventListener('change', (e) => { state.mode = e.target.value; reload(); });
    fillSelect('cmp-select', COMPARE_SWITCH).addEventListener('change', (e) => { state.compare = e.target.value; reload(); });
  }
  function syncSelects() {
    if (picker) picker.refresh();
    $('cat-select').value = state.category;
    $('mode-select').value = state.mode;
    $('cmp-select').value = state.compare;
    $('scope-hint').textContent = [CATEGORY_HINT[state.category], MODE_HINT[state.mode]].filter(Boolean).join(' ');
  }

  function syncUrl() {
    const u = new URL(window.location.href);
    u.search = '';
    if (state.view === 'day') {
      u.searchParams.set('view', 'day');
      if (state.day) u.searchParams.set('date', state.day);
      history.replaceState(null, '', u);
      return;
    }
    if (state.preset !== 'all' && state.from) { u.searchParams.set('from', state.from); u.searchParams.set('to', state.to); }
    if (state.grainUser && state.grain) u.searchParams.set('g', state.grain);
    if (state.category !== 'all') u.searchParams.set('cat', state.category);
    if (state.mode !== 'all') u.searchParams.set('mode', state.mode);
    if (state.compare === 'yoy') u.searchParams.set('cmp', 'yoy');
    if (state.tab !== 'overview') u.searchParams.set('tab', state.tab);
    history.replaceState(null, '', u);
  }

  function draw(d) {
    const root = $('report');
    clear(root);
    const rows = bucket(d.sales ? d.sales.daily : (d.site ? d.site.series.map((r) => ({ date: r.date, revenue: 0, orders: 0, organicRevenue: 0, byCat: {}, sessions: r.sessions, users: r.users, views: r.views })) : []), state.grain);

    // What the arrows compare with: the period before, or the same dates a year earlier (when last year has data).
    const yoy = d.compare && d.compare.mode === 'yoy';
    const hasSalesPrev = !!(d.sales && d.sales.kpis.prev);
    const hasSitePrev = !!(d.site && d.site.totals && d.site.totals.prev);
    window.CMP_TITLE = yoy ? `Порівняно з тими самими датами торік (${fmt.dateFull(d.compare.prevRange.from)} — ${fmt.dateFull(d.compare.prevRange.to)})` : null;
    window.CMP_WORDS = yoy ? 'до того самого періоду торік' : null;
    let cmpText;
    if (yoy) {
      const miss = [!hasSalesPrev ? 'BAS (облік з 15.10.2025)' : null, d.site && !hasSitePrev ? 'Google Analytics (дані з 10.12.2025)' : null].filter(Boolean);
      cmpText = miss.length
        ? `Порівнюємо з тими самими датами торік (${fmt.dateFull(d.compare.prevRange.from)} — ${fmt.dateFull(d.compare.prevRange.to)}). За ці дати торік немає даних: ${miss.join(', ')}. Для цих джерел стрілок зміни не буде. Оберіть пізніший період або поверніть порівняння з попереднім періодом.`
        : `Стрілки показують зміну проти тих самих дат торік (${fmt.dateFull(d.compare.prevRange.from)} — ${fmt.dateFull(d.compare.prevRange.to)}).`;
    } else cmpText = hasSalesPrev ? 'Стрілки показують зміну проти попереднього періоду такої самої довжини. Для одного дня це попередній день.' : 'Порівнювати нема з чим: це вся історія магазину.';
    $('range-note').textContent = `Показано ${fmt.dateFull(d.range.from)} — ${fmt.dateFull(d.range.to)} (${d.days} ${d.days % 10 === 1 && d.days % 100 !== 11 ? 'день' : [2, 3, 4].includes(d.days % 10) && ![12, 13, 14].includes(d.days % 100) ? 'дні' : 'днів'}). ${cmpText}`;
    const chips = $('sources');
    clear(chips);
    // What each source gives, in words; the product name stays in brackets so it can be found in «Налаштуваннях».
    const names = { bas: 'Продажі (BAS)', ga4: 'Сайт (Google Analytics)', gsc: 'Пошук Google (Search Console)', clarity: 'Поведінка на сайті (Clarity)', gads: 'Реклама Google' };
    for (const [k, v] of Object.entries(d.sources)) {
      const ok = v && v.ok;
      chips.appendChild(h('span', { class: `chip ${ok ? 'ok' : 'bad'}` }, h('i'), names[k] || k, ok ? (k === 'clarity' ? ` · ${v.days} дн.` : '') : ` — ${v.error || 'недоступно'}`));
    }

    // A task or a shared link points at a section: show the tab it lives on.
    if (draw.pendingHash && TAB_OF[draw.pendingHash]) state.tab = TAB_OF[draw.pendingHash];
    for (const node of [
      renderSummary(d, rows), renderSalesChart(d, rows), S.renderTraffic(d, rows), S.renderTelegram(d),
      renderAds(d, rows),
      S.renderBehaviour(d), renderSite(d, rows), renderPages(d), renderInterest(d), renderSearch(d), renderProblems(d),
      S.renderAudience(d),
      S.renderOrders(d),
      renderCategories(d), renderProducts(d), S.renderItems(d),
      S.renderRetention(d),
    ]) if (node) root.appendChild(node);
    Glossary.mountNorms(root);
    Glossary.mount(root, ['bas', 'vat', 'self', 'manager', 'aov', 'trend', 'visit', 'visitor', 'engaged', 'ga', 'gsc', 'impression', 'click', 'ctr', 'cpc', 'goal', 'minus', 'position', 'deadclick', 'rage', 'quickback', 'delta']);
    const acc = accordion(root, draw.pendingHash);
    draw.openSection = acc.open;
    drawTabs();
    showTab();
    root.setAttribute('aria-busy', 'false');
    // Arriving from a task (or a shared link): scroll to the section it points at, once.
    if (draw.pendingHash) {
      const target = document.getElementById(draw.pendingHash);
      draw.pendingHash = null;
      if (target) target.scrollIntoView();
    }
  }
  draw.pendingHash = location.hash ? location.hash.slice(1) : null;
  // The tabs under the filters: one part of the report at a time (Огляд, Реклама Google, Поведінка, …).
  function showTab() {
    for (const sec of $('report').children) if (sec.id) sec.hidden = (TAB_OF[sec.id] || 'overview') !== state.tab;
  }
  function drawTabs() {
    const nav = $('jump');
    clear(nav);
    nav.setAttribute('role', 'tablist');
    for (const [id, label] of TABS) {
      const b = h('button', { type: 'button', class: 'tabbtn', role: 'tab', 'aria-selected': String(id === state.tab) }, label);
      b.addEventListener('click', () => {
        if (id === state.tab) return;
        state.tab = id;
        syncUrl();
        drawTabs();
        showTab();
      });
      nav.appendChild(b);
    }
  }

  // ---- «За день»: the stored daily report, shown inside this page ---------------------------
  // The daily story is rendered on the server with its own stylesheet; it is mounted in a shadow root so
  // its styles and this page's styles never touch each other.
  function mountDay(d) {
    const root = $('report');
    clear(root);
    const host = h('div', { class: 'dayhost' });
    root.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = d.css;
    shadow.appendChild(style);
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${d.body}</body></html>`, 'text/html');
    for (const node of [...doc.body.childNodes]) shadow.appendChild(document.importNode(node, true));
    // In-report links (#s-sales …) scroll inside the shadow root instead of changing the page address.
    shadow.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) return;
      const target = shadow.querySelector(`#${CSS.escape(a.getAttribute('href').slice(1))}`);
      if (target) { ev.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
    root.setAttribute('aria-busy', 'false');
  }

  function drawDayControls() {
    const sel = $('day-select');
    clear(sel);
    for (const d of state.days) sel.appendChild(h('option', { value: d, selected: d === state.day }, d));
    const i = state.days.indexOf(state.day);
    $('day-prev').disabled = i < 0 || i >= state.days.length - 1;
    $('day-next').disabled = i <= 0;
  }

  async function loadDay(date) {
    const seq = ++loadSeq;
    $('report').setAttribute('aria-busy', 'true');
    status('');
    const loader = Loading.show($('report'), { title: 'Звіт за день завантажується…', text: 'Відкриваємо збережений щоденний звіт.', sources: [], skeleton: 4 });
    try {
      const d = await apiCall(`/daily/fragment${date ? `?date=${encodeURIComponent(date)}` : ''}`);
      if (seq !== loadSeq) return;
      state.day = d.day;
      state.days = d.days;
      $('range-note').textContent = `Щоденний звіт за ${d.day}. Його щоранку готує система сама. Інший день можна вибрати зі списку вище.`;
      clear($('sources'));
      syncUrl();
      drawControls();
      drawDayControls();
      mountDay(d);
      status('');
    } catch (err) {
      if (seq !== loadSeq) return;
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      clear($('report'));
      status(err.status === 404 ? 'За цей день звіту ще немає.' : 'Не вдалося завантажити звіт за день. Спробуйте ще раз за хвилину.', true);
    } finally {
      loader.stop();
    }
  }

  function applyView() {
    syncUrl();
    drawControls();
    if (state.view === 'day') loadDay(state.day);
    else load(state.preset === 'all' ? null : state.from, state.preset === 'all' ? null : state.to);
  }

  let loadSeq = 0;
  function reload() { load(state.preset === 'all' ? null : state.from, state.preset === 'all' ? null : state.to); }
  async function load(from, to, force) {
    const seq = ++loadSeq;
    $('report').setAttribute('aria-busy', 'true');
    drawControls();
    status('');
    const loader = Loading.show($('report'), {
      title: 'Звіт завантажується…',
      text: 'Збираємо свіжі дані з кількох джерел. Перший раз це до 20 секунд, далі швидше.',
      sources: ['BAS — продажі', 'Google Analytics — сайт', 'Search Console — пошук', 'Clarity — поведінка', 'Google Ads — реклама'],
    });
    try {
      const q = [];
      if (from && to) q.push(`from=${encodeURIComponent(from)}`, `to=${encodeURIComponent(to)}`);
      if (state.category !== 'all') q.push(`category=${state.category}`);
      if (state.mode !== 'all') q.push(`mode=${state.mode}`);
      if (state.compare === 'yoy') q.push('compare=yoy');
      if (force) q.push('refresh=1');
      let d;
      for (let attempt = 0; ; attempt++) {
        try { d = await apiCall(`/period${q.length ? `?${q.join('&')}` : ''}`); break; } catch (err) {
          const transient = !err.status || err.status >= 500;
          if (!transient || attempt >= 2) throw err;
          loader.note('Сервер на мить недоступний (можливо, оновлюється). Повторюємо спробу…');
          await new Promise((r) => setTimeout(r, 4000));
          if (seq !== loadSeq) return;
          loader.note('');
        }
      }
      if (seq !== loadSeq) return;
      state.data = d;
      state.from = d.range.from;
      state.to = d.range.to;
      if (!state.grainUser || !['day', 'week', 'month'].includes(state.grain)) state.grain = autoGrain(d.days);
      if (picker) picker.refresh();
      syncUrl();
      drawControls();
      draw(d);
      status('');
    } catch (err) {
      if (seq !== loadSeq) return;
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      status(err.status === 400 ? (err.message || 'Невірний період') : `Не вдалося зібрати звіт (${err.status ? `помилка ${err.status}` : 'немає звʼязку із сервером'}). Спробуйте ще раз за хвилину.`, true);
    } finally {
      loader.stop();
    }
  }

  $('refresh').addEventListener('click', () => load(state.preset === 'all' ? null : state.from, state.preset === 'all' ? null : state.to, true));

  $('day-select').addEventListener('change', (e) => loadDay(e.target.value));
  $('day-prev').addEventListener('click', () => { const i = state.days.indexOf(state.day); if (i < state.days.length - 1) loadDay(state.days[i + 1]); });
  $('day-next').addEventListener('click', () => { const i = state.days.indexOf(state.day); if (i > 0) loadDay(state.days[i - 1]); });

  const qf = params.get('from'), qt = params.get('to');
  if (isIso(qf) && isIso(qt) && qf <= qt) { state.preset = 'custom'; state.from = qf; state.to = qt; }
  initSelects();
  drawControls();
  if (state.view === 'day') loadDay(state.day);
  else load(state.preset === 'custom' ? qf : null, state.preset === 'custom' ? qt : null);
})();
