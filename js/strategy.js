// SytBoard «Стратегія»: the strategy 2026–2027 in short (goal, KPIs, the path to $925k, the four directions, what we
// say and never say, competitors and the price parity rule, stages and the 100-day tasks, risks) next to live
// numbers from BAS, Google Analytics, Search Console, the price module and Notion. Charts are plain SVG with a
// hover tooltip and a table view. All text goes through DOM APIs.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  if (me.role !== 'admin') { status('«Виконання стратегії» доступне лише адміністраторам SytBoard.', true); return; }

  // ---- formatting -------------------------------------------------------------------------------------------
  const NF0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 });
  const usd = (n) => {
    if (n === null || n === undefined) return '—';
    const v = Math.abs(n);
    if (v >= 1e6) return `$${NF1.format(n / 1e6)} млн`;
    if (v >= 1e4) return `$${NF1.format(n / 1e3)} тис.`;
    return `$${NF0.format(Math.round(n))}`;
  };
  const int = (n) => (n === null || n === undefined ? '—' : NF0.format(Math.round(n)));
  const pct = (r, d = 0) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(d).replace('.', ',')}%`);
  const MON = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  const MONF = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  const mLabel = (m) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
  const mFull = (m) => `${MONF[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const dmy = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '—');
  const today = fmt.todayKyiv();
  const thisMonth = today.slice(0, 7);
  const days = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
  const plural = (n, one, few, many) => { const a = Math.abs(Math.round(n)); const n10 = a % 10; const n100 = a % 100; return n10 === 1 && n100 !== 11 ? one : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? few : many; };

  // Fixed entity colours, the same as on the other SytBoard pages. Order keeps green and orange apart.
  const GROUPS = [['seed', 'Насіння', 'var(--c-seed)'], ['small', 'Дрібне фасування та побутові', 'var(--c-small)'], ['zzr', 'ЗЗР (індустріальні)', 'var(--c-zzr)']];

  // ---- tooltip ----------------------------------------------------------------------------------------------
  const tip = $('tip');
  function showTip(e, nodes) {
    clear(tip);
    append(tip, nodes);
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 14);
    const y = Math.min(window.innerHeight - tip.offsetHeight - 10, e.clientY + 14);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  const tipRow = (color, label, value) => h('div', { class: 'r' }, h('span', null, color ? h('i', { style: { background: color } }) : null, label), h('b', { style: { margin: 0 } }, value));
  function hover(el, build) {
    el.addEventListener('mousemove', (e) => showTip(e, build()));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('focus', (e) => { const r = el.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.top }, build()); });
    el.addEventListener('blur', hideTip);
  }

  // ---- chart primitives (one y-axis, recessive grid, rounded data-ends, 2px gaps) ---------------------------
  const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  function frame(W, H, pad, max, yfmt) {
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'st-chart', role: 'img' });
    const y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      svg.appendChild(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: i ? 'gl' : 'ax' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end' });
      t.textContent = yfmt(v);
      svg.appendChild(t);
    }
    return { svg, y };
  }
  const text = (svg, attrs, s) => { const t = svgEl('text', attrs); t.textContent = s; svg.appendChild(t); return t; };
  // A bar with only its top corners rounded (anchored to the baseline).
  const barPath = (x, y0, w, y1, r = 3) => { const hh = y0 - y1; if (hh <= 0) return ''; const rr = Math.min(r, hh, w / 2); return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`; };

  // Monthly stacked bars of self-service sales by group, then the goal-year plan as dashed outlines.
  function salesChart(sales, c) {
    const fact = new Map(sales.monthly.map((m) => [m.month, m]));
    const plan = new Map(sales.goalYear.plan.map((p) => [p.month, p.plan]));
    const first = sales.monthly.length ? sales.monthly[0].month : thisMonth;
    const months = [];
    for (let [y, m] = first.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= `${c.goal.year}-12`; m++) { if (m > 12) { m = 1; y++; } months.push(`${y}-${String(m).padStart(2, '0')}`); }
    const W = 1100; const H = 300; const pad = { l: 58, r: 12, t: 26, b: 34 };
    const max = niceMax(Math.max(...months.map((m) => Math.max(plan.get(m) || 0, (fact.get(m) || { self: 0 }).self))) * 1.05);
    const { svg, y } = frame(W, H, pad, max, (v) => usd(v));
    svg.setAttribute('aria-label', 'Самостійні продажі по місяцях за групами товарів і план на рік цілі');
    const step = (W - pad.l - pad.r) / months.length;
    const bw = Math.max(6, step - 6);
    months.forEach((m, i) => {
      const x = pad.l + i * step + (step - bw) / 2;
      const f = fact.get(m);
      const p = plan.get(m);
      if (p) svg.appendChild(svgEl('path', { d: barPath(x, y(0), bw, y(p)), class: 'plan' }));
      if (f && f.self > 0) {
        let base = 0;
        const parts = GROUPS.filter(([k]) => f[k] > 0);
        parts.forEach(([k, , color], j) => {
          const top = base + f[k];
          const y0 = y(base) - (base ? 1 : 0); // 2px surface gap between stacked fills
          const y1 = y(top) + (j < parts.length - 1 ? 1 : 0);
          const d = j === parts.length - 1 ? barPath(x, y0, bw, y1) : `M${x},${y0}H${x + bw}V${y1}H${x}Z`;
          if (y0 > y1) svg.appendChild(svgEl('path', { d, fill: color }));
          base = top;
        });
      }
      if (m === thisMonth) {
        svg.appendChild(svgEl('line', { x1: x + bw / 2, x2: x + bw / 2, y1: pad.t - 14, y2: y(0), class: 'today' }));
        text(svg, { x: x + bw / 2, y: pad.t - 17, 'text-anchor': 'middle', class: 'today-t' }, 'сьогодні');
      }
      if (months.length <= 18 || i % 2 === 0) text(svg, { x: x + bw / 2, y: H - pad.b + 15, 'text-anchor': 'middle' }, mLabel(m));
      const hit = svgEl('rect', { x: pad.l + i * step, y: pad.t, width: step, height: H - pad.t - pad.b, class: 'hit', tabindex: 0 });
      hover(hit, () => [h('b', null, mFull(m)), f ? GROUPS.map(([k, label, color]) => tipRow(color, label, usd(f[k]))) : null,
        f ? tipRow(null, 'Разом самостійно', usd(f.self)) : null, f && f.manager ? tipRow(null, 'З менеджером', usd(f.manager)) : null,
        p ? tipRow(null, `План ${c.goal.year}`, usd(p)) : null]);
      svg.appendChild(hit);
    });
    const legend = h('div', { class: 'st-legend' }, GROUPS.map(([, label, color]) => h('span', null, h('i', { style: { background: color } }), label)), h('span', null, h('i', { class: 'dash' }), `План ${c.goal.year} (розклад цілі $925 тис. по місяцях)`));
    const table = h('details', { class: 'st-table' }, h('summary', null, 'Показати таблицею'), h('div', { class: 'tablewrap' }, h('table', { class: 'st-t' },
      h('thead', null, h('tr', null, h('th', null, 'Місяць'), GROUPS.map(([, l]) => h('th', { class: 'n' }, l)), h('th', { class: 'n' }, 'Разом'), h('th', { class: 'n' }, 'План'))),
      h('tbody', null, months.filter((m) => fact.get(m) || plan.get(m)).map((m) => { const f = fact.get(m); return h('tr', null, h('td', null, mFull(m)), GROUPS.map(([k]) => h('td', { class: 'n' }, f ? usd(f[k]) : '—')), h('td', { class: 'n' }, f ? usd(f.self) : '—'), h('td', { class: 'n' }, plan.get(m) ? usd(plan.get(m)) : '—')); })))));
    return h('div', null, legend, svg, table);
  }

  // A monthly line with target lines (search visitors, clicks).
  function lineChart(series, { label, targets, yfmt = int, color = 'var(--brand)' }) {
    const W = 470; const H = 250; const pad = { l: 46, r: 86, t: 18, b: 30 };
    const max = niceMax(Math.max(...series.map((s) => s.v), ...targets.map((t) => t.v)) * 1.05);
    const { svg, y } = frame(W, H, pad, max, yfmt);
    svg.setAttribute('aria-label', label);
    const step = (W - pad.l - pad.r) / Math.max(1, series.length - 1);
    const x = (i) => pad.l + i * step;
    for (const t of targets) {
      svg.appendChild(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(t.v), y2: y(t.v), class: 'tgt' }));
      text(svg, { x: W - pad.r + 6, y: y(t.v) + 4, class: 'tgt-t' }, `${t.label}: ${yfmt(t.v)}`);
    }
    if (series.length > 1) svg.appendChild(svgEl('path', { d: series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    series.forEach((s, i) => {
      svg.appendChild(svgEl('circle', { cx: x(i), cy: y(s.v), r: 4, fill: s.partial ? 'var(--card)' : color, stroke: s.partial ? color : 'var(--card)', 'stroke-width': 2 }));
      if (series.length <= 8 || (series.length - 1 - i) % 2 === 0) text(svg, { x: x(i), y: H - pad.b + 15, 'text-anchor': 'middle' }, mLabel(s.month));
      const hit = svgEl('rect', { x: x(i) - step / 2, y: pad.t, width: step, height: H - pad.t - pad.b, class: 'hit', tabindex: 0 });
      hover(hit, () => [h('b', null, mFull(s.month) + (s.partial ? ' (місяць ще йде)' : '')), tipRow(color, label, yfmt(s.v)), ...(s.extra || []).map(([l, v]) => tipRow(null, l, v))]);
      svg.appendChild(hit);
    });
    return svg;
  }

  // Monthly bars against one target line (new legal entities per month).
  function barsTarget(series, { label, target, targetLabel }) {
    const W = 470; const H = 230; const pad = { l: 34, r: 86, t: 18, b: 30 };
    const max = niceMax(Math.max(target, ...series.map((s) => s.v)) * 1.1);
    const { svg, y } = frame(W, H, pad, max, int);
    svg.setAttribute('aria-label', label);
    const step = (W - pad.l - pad.r) / series.length;
    const bw = Math.max(6, step - 8);
    svg.appendChild(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(target), y2: y(target), class: 'tgt' }));
    text(svg, { x: W - pad.r + 6, y: y(target) + 4, class: 'tgt-t' }, `${targetLabel}: ${target}`);
    series.forEach((s, i) => {
      const x = pad.l + i * step + (step - bw) / 2;
      if (s.v > 0) svg.appendChild(svgEl('path', { d: barPath(x, y(0), bw, y(s.v)), fill: s.partial ? 'var(--wire)' : 'var(--c-zzr)' }));
      if (series.length <= 8 || (series.length - 1 - i) % 2 === 0) text(svg, { x: x + bw / 2, y: H - pad.b + 15, 'text-anchor': 'middle' }, mLabel(s.month));
      const hit = svgEl('rect', { x: pad.l + i * step, y: pad.t, width: step, height: H - pad.t - pad.b, class: 'hit', tabindex: 0 });
      hover(hit, () => [h('b', null, mFull(s.month) + (s.partial ? ' (місяць ще йде)' : '')), tipRow(null, label, int(s.v))]);
      svg.appendChild(hit);
    });
    return svg;
  }

  // ---- KPI tiles --------------------------------------------------------------------------------------------
  // tone: good = target reached, warn = target not reached yet, info = no target to compare with.
  function tone(value, start, target, lowerBetter) {
    if (value === null || value === undefined) return 'none';
    if (target === null || target === undefined) return 'info';
    const better = (a, b) => (lowerBetter ? a <= b : a >= b);
    return better(value, target) ? 'good' : 'warn';
  }
  const TONE_TEXT = { good: '✓ ціль досягнута', warn: '↗ ціль ще не досягнута', info: 'для довідки', none: '… немає даних' };
  function kpi({ name, value, small, start, target, targetText, startText, fmtv, lowerBetter, src, progress }) {
    const t = tone(value, start, target, lowerBetter);
    const prog = progress !== undefined ? progress : (value !== null && value !== undefined && target ? (lowerBetter ? Math.min(1, target / Math.max(value, 1e-9)) : Math.min(1, value / target)) : 0);
    return h('div', { class: `st-kpi ${t === 'none' ? '' : t}` },
      h('div', { class: 'n' }, name),
      h('div', { class: 'v' }, value === null || value === undefined ? '—' : fmtv(value), small ? h('small', null, small) : null),
      h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.round(prog * 100)}%` } })),
      targetText ? h('div', { class: 't' }, `Ціль: ${targetText}`) : null,
      h('span', { class: 'st-tag' }, TONE_TEXT[t]),
      src ? h('div', { class: 'src' }, src) : null);
  }

  // What each KPI of the strategy reads from the live data. Targets and starting values come from the strategy
  // text (editable): percentages there are written as percent (25 = 25%), so they are divided by 100 here.
  const FMT = { usd, int, dec: (v) => NF1.format(v), pct: (v) => pct(v), pct2: (v) => pct(v, 2) };
  function liveKpis(d) {
    const s = d.sales;
    const cu = s && s.customers;
    const pc = s && s.privateCustomers;
    const sm = d.search && lastFull(d.search.monthly);
    const gm = d.gsc && lastFull(d.gsc.monthly);
    const pr = d.prices;
    const t = d.tasks;
    const bas = 'BAS · 12 місяців';
    const noKeys = s && !cu ? 'у вивантаженні BAS немає коду клієнта' : null;
    return {
      selfUsd: { fmt: 'usd', value: s && s.selfUsd, src: bas },
      legalSelf: { fmt: 'int', value: cu && cu.legalSelf, small: cu ? `із ${int(cu.legalBuyers)} юросіб` : null, src: noKeys || bas },
      legalRepeat: { fmt: 'pct', value: cu && cu.repeatShare, small: cu ? `${cu.repeat} із ${cu.legalSelf}` : null, src: noKeys || `${bas} · купили самостійно 2+ рази` },
      newLegalPerMonth: { fmt: 'dec', value: cu && cu.newPerMonth, small: cu && cu.newPerMonthMonths.length ? `середнє за ${cu.newPerMonthMonths.map(mLabel).join(', ')}` : null, src: noKeys || 'BAS · перша самостійна покупка' },
      legalAvgUsd: { fmt: 'usd', value: cu && cu.avgUsd, src: noKeys || bas },
      privateUsd: { fmt: 'usd', value: s && s.privateUsd, src: bas },
      privateRepeat: { fmt: 'pct', value: pc && pc.repeatShare, small: pc ? `${int(pc.repeat)} із ${int(pc.buyers)}` : null, src: s && !pc ? 'у вивантаженні BAS немає коду клієнта' : `${bas} · фізособи, що купили самостійно 2+ рази` },
      managerSeedZzr: { fmt: 'pct', value: cu && cu.legalManagerSeed ? cu.managerSeedBoughtZzr / cu.legalManagerSeed : null, small: cu ? `${cu.managerSeedBoughtZzr} із ${cu.legalManagerSeed}` : null, src: noKeys || `${bas} · лише покупки в магазині` },
      crossSeed: { fmt: 'pct', value: cu && cu.crossShareSeed, small: cu && cu.seedSelfBuyers !== undefined ? `${cu.seedSelfWithZzr} із ${cu.seedSelfBuyers}` : null, src: noKeys || `${bas} · лише покупки в магазині` },
      searchUsers: { fmt: 'int', value: sm && sm.searchUsers, small: sm ? mFull(sm.month) : null, src: 'Google Analytics · пошукові системи без реклами' },
      clicks: { fmt: 'int', value: gm && gm.clicks, small: gm ? mFull(gm.month) : null, src: 'Search Console' },
      ctr: { fmt: 'pct2', value: gm && gm.ctr, src: 'Search Console · за місяць' },
      brandShare: { fmt: 'pct', value: d.gsc && d.gsc.recent.brandShare, src: 'Search Console · останні 90 днів, видимі запити', progress: d.gsc && d.gsc.recent.brandShare !== null ? 1 - d.gsc.recent.brandShare : 0 },
      nonBrandPosition: { fmt: 'dec', value: d.gsc && d.gsc.recent.nonBrandPosition, src: 'Search Console · 90 днів, середня' },
      ordersPer1000: { fmt: 'dec', value: d.conversion && d.conversion.per1000, small: d.conversion ? `${int(d.conversion.orders)} замовлень / ${int(d.conversion.sessions)} візитів` : null, src: 'BAS + Google Analytics · 30 днів' },
      viberOrders: { fmt: 'int', value: s && s.viber ? s.viber.orders : null, small: s && s.viber ? usd(s.viber.usd) : null, src: s && s.viber ? 'BAS · за промокодами воронки' : 'Вкажіть промокоди воронки в редакторі стратегії' },
      parity: { fmt: 'pct', value: pr && pr.checkedPartner ? pr.parityOk / pr.checkedPartner : null, small: pr && pr.checkedPartner ? `${pr.parityOk} із ${pr.checkedPartner}` : null, src: 'Ціни на ринку' },
      tasks100: { fmt: 'pct', value: t ? t.done / Math.max(1, t.total) : null, small: t ? `${t.done} із ${t.total}` : null, src: t && t.live ? 'Notion · наживо' : `Notion · знімок на ${dmy(t && t.asOf)}` },
    };
  }
  const isPct = (f) => f === 'pct' || f === 'pct2';
  const kpiCfg = (d, id) => (d.content.kpis || []).find((k) => k.id === id) || {};
  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  // A target / start written in the strategy's units, in the units of the live value.
  const inUnits = (v, f) => (num(v) === null ? null : isPct(f) ? num(v) / 100 : num(v));

  // One tile: a live KPI (its id names what it reads) or one entered by hand (id «manual», value in the editor).
  function kpiTile(d, k, live) {
    const L = k.id === 'manual' ? null : live[k.id];
    if (k.id !== 'manual' && !L) return null;
    const f = L ? L.fmt : null;
    const fmtv = f ? FMT[f] : (v) => `${NF1.format(v)}${k.format ? ` ${k.format}` : ''}`;
    const value = L ? (L.value === undefined ? null : L.value) : num(k.value);
    const later = inUnits(k.targetLater, f);
    const progress = L && L.progress !== undefined ? L.progress
      : later !== null && value !== null ? (k.lowerBetter ? Math.min(1, later / Math.max(value, 1e-9)) : Math.min(1, value / later)) : undefined;
    return kpi({ name: k.name, value, small: L ? L.small : null, start: inUnits(k.start, f), target: inUnits(k.target, f), targetText: k.targetText, startText: k.startText,
      fmtv, lowerBetter: !!k.lowerBetter, progress, src: [L ? L.src : 'Вносимо вручну в редакторі стратегії', k.note].filter(Boolean).join(' · ') });
  }

  // ---- sections ---------------------------------------------------------------------------------------------
  // Section titles and leads come from the strategy text; an empty lead falls back to the given one.
  const sectionCfg = (d, id) => (d.content.sections || []).find((x) => x.id === id) || {};
  function section(d, id, fallbackLead, ...body) {
    const cfg = sectionCfg(d, id);
    const lead = cfg.lead || fallbackLead;
    return h('section', { class: 'st-sec', id }, h('h2', null, cfg.title || id), lead ? h('p', { class: 'st-lead' }, lead) : null, ...body);
  }
  const unavailable = (what, err) => h('p', { class: 'st-note' }, `${what}: ${err || 'тимчасово недоступно'}.`);

  function heroSection(d) {
    const c = d.content;
    const s = d.sales;
    const goal = c.goal.amountUsd;
    const cur = s ? s.selfUsd : null;
    const at = (v) => Math.max(0, Math.min(100, (v / goal) * 100));
    // A label over the bar at a position: centred on it, but kept inside the bar near the ends.
    const pin = (cls, pos, ...kids) => h('div', { class: `st-pin ${cls}${pos < 14 ? ' l' : pos > 86 ? ' r' : ''}`, style: { left: `${pos}%` } }, ...kids);
    const left = cur !== null ? Math.max(0, goal - cur) : null;
    const meter = h('div', { class: 'st-meter' },
      h('div', { class: 'st-steps' },
        h('div', { class: 'now' }, h('div', { class: 'l' }, 'Зараз'), h('div', { class: 'v' }, usd(cur)), h('div', { class: 's' }, s ? `останні 12 місяців: ${dmy(s.window.from)} — ${dmy(s.window.to)}` : 'BAS недоступний')),
        h('div', { class: 'arr', 'aria-hidden': 'true' }, '→'),
        h('div', null, h('div', { class: 'l' }, `Ціль на ${c.goal.year}`), h('div', { class: 'v' }, usd(goal)), h('div', { class: 's' }, 'самостійних продажів за рік'))),
      h('div', { class: 'st-bar', role: 'img', 'aria-label': `Зараз ${usd(cur)} — ${pct(cur !== null ? cur / goal : null)} цілі ${usd(goal)}. ` },
        cur !== null ? pin('up', at(cur), h('b', null, `зараз ${usd(cur)}`), ` · ${pct(cur / goal)} цілі`) : null,
        h('div', { class: 'st-track' },
          h('div', { class: 'st-fill', style: { width: `${at(cur || 0)}%` } }),
          left !== null && left > 0 ? h('div', { class: 'st-left', style: { left: `${at(cur)}%` } }, `ще потрібно ${usd(left)}`) : null),
        null));
    const total = s ? s.selfUsd + s.managerUsd : 0;
    const selfShare = total ? s.selfUsd / total : 0;
    const toSeason = days(today, c.seasonStart);
    const facts = h('div', { class: 'st-facts' },
      h('div', { class: 'wide' }, h('div', { class: 'l' }, 'Усі продажі магазину за 12 місяців'), h('div', { class: 'v' }, s ? usd(total) : '—'),
        s ? [h('div', { class: 'st-two', role: 'img', 'aria-label': `Самі: ${usd(s.selfUsd)}, через менеджера: ${usd(s.managerUsd)}` },
          h('i', { class: 'a', style: { width: `${selfShare * 100}%` } }), h('i', { class: 'b', style: { width: `${(1 - selfShare) * 100}%` } })),
        h('div', { class: 'st-two-cap' },
          h('span', null, h('i', { class: 'a' }), `клієнти самі — ${usd(s.selfUsd)} (${pct(selfShare)})`),
          h('span', null, h('i', { class: 'b' }), `через менеджера — ${usd(s.managerUsd)} (${pct(1 - selfShare)})`)),
        h('div', { class: 's' }, '«Самі» — без менеджера і без менеджерського промокоду. ЗЗР і дрібне фасування рахуються як «самі», як у стратегії. Ціль $925 тис. — лише про «самі».')] : null),
      h('div', null, h('div', { class: 'l' }, 'Самостійних замовлень за 12 місяців'), h('div', { class: 'v' }, s ? int(s.selfOrders) : '—'), h('div', { class: 's' }, 'клієнти самі, без менеджера')),
      h('div', null, h('div', { class: 'l' }, `До початку сезону (${dmy(c.seasonStart)})`), h('div', { class: 'v' }, toSeason > 0 ? `${toSeason} ${plural(toSeason, 'день', 'дні', 'днів')}` : 'сезон триває'), h('div', { class: 's' }, '46% продажів — березень–травень')));
    const year = s && s.goalYear.started ? h('p', { class: 'st-note' }, `${c.goal.year}: продано ${usd(s.goalYear.fact)} із плану на сьогодні ${usd(s.goalYear.planToDate)} (${pct(s.goalYear.planToDate ? s.goalYear.fact / s.goalYear.planToDate : null)}).`) : null;
    return h('section', { class: 'st-sec', id: 'goal' },
      h('div', { class: 'st-hero' },
        h('div', { class: 'st-card st-goal' },
          h('div', { class: 'st-k' }, `Ціль на ${c.goal.year} рік${c.goal.approved ? ' · затверджена' : ''}`),
          h('div', { class: 'st-big' }, `${usd(goal)}+`, h('small', null, 'самостійних продажів на рік')),
          h('p', null, c.essence),
          meter, year,
          h('div', { class: 'st-src' }, `BAS, суми з ПДВ у доларах за курсом НБУ на дату замовлення${d.usd && !d.usd.nbu ? ' (НБУ недоступний — орієнтовний курс)' : ''}.`)),
        h('div', { class: 'st-card' }, facts)),
      h('div', { class: 'st-cond' }, h('b', null, 'Головна умова'), c.mainCondition));
  }

  function lastFull(rows) { return rows.filter((r) => r.month < thisMonth).slice(-1)[0] || null; }

  function kpiSection(d) {
    const live = liveKpis(d);
    const blocks = [];
    let group = null; let grid = null;
    for (const k of (d.content.kpis || []).filter((x) => !x.hidden)) {
      const tile = kpiTile(d, k, live);
      if (!tile) continue;
      if (k.group !== group || !grid) { group = k.group; grid = h('div', { class: 'st-kpis' }); blocks.push(group ? h('div', { class: 'st-kgroup' }, group) : null, grid); }
      grid.appendChild(tile);
    }
    return section(d, 'kpi', null, blocks);
  }

  // The target lines of a monthly chart: the near target and the later one, from the KPI's settings.
  const chartTargets = (k) => [[k.target, 'ціль'], [k.targetLater, 'далі']].filter(([v]) => num(v) !== null).map(([v, label]) => ({ v: num(v), label }));

  function pathSection(d) {
    const c = d.content;
    const s = d.sales;
    const cu = s && s.customers;
    const total = c.sources.reduce((t, x) => t + x.amountUsd, 0);
    const COL = ['var(--s3)', 'var(--s6)', 'var(--s5)', 'var(--s2)', 'var(--s1)'];
    const live = {
      private: s ? `${usd(s.privateUsd)} за 12 міс.` : '—',
      returning: cu ? `${cu.repeat} юросіб купили повторно (${pct(cu.repeatShare)})` : '—',
      managerSeed: cu ? `${cu.managerSeedBoughtZzr} із ${cu.legalManagerSeed} уже купили ЗЗР самі` : '—',
      viber: s && s.viber ? `${s.viber.orders} покупок, ${usd(s.viber.usd)}` : 'промокоди воронки ще не вказані',
      newLegal: cu && cu.newPerMonth !== null ? `${NF1.format(cu.newPerMonth)} нових юросіб на місяць` : '—',
    };
    const split = h('div', null,
      h('div', { class: 'st-split', role: 'img', 'aria-label': 'Розклад цілі $925 тис. за джерелами' },
        c.sources.map((x, i) => { const el = h('i', { style: { width: `${(x.amountUsd / total) * 100}%`, background: COL[i] }, tabindex: 0 }, x.amountUsd / total > 0.09 ? usd(x.amountUsd) : ''); hover(el, () => [h('b', null, x.label), tipRow(COL[i], 'План', usd(x.amountUsd)), x.clients ? tipRow(null, 'Клієнтів', `≈${x.clients}`) : null]); return el; })),
      h('div', { class: 'st-split-cap' }, c.sources.map((x, i) => h('span', null, h('i', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: COL[i], marginRight: '5px' } }), `${x.label.split(':')[0].split('(')[0].trim()} — ${usd(x.amountUsd)}`))));
    const table = h('div', { class: 'tablewrap' }, h('table', { class: 'st-t' },
      h('thead', null, h('tr', null, h('th', null, 'Джерело'), h('th', { class: 'n' }, 'Клієнтів'), h('th', { class: 'n' }, 'Сума'), h('th', null, 'Що має статися'), h('th', null, 'Зараз (наживо)'))),
      h('tbody', null, c.sources.map((x) => h('tr', null, h('td', null, x.label), h('td', { class: 'n' }, x.clients ? `≈${x.clients}` : '—'), h('td', { class: 'n' }, usd(x.amountUsd)), h('td', null, x.what), h('td', null, live[x.id]))),
        h('tr', { class: 'tot' }, h('td', null, 'Разом'), h('td', { class: 'n' }, `≈${c.sources.reduce((t, x) => t + (Number(x.clients) || 0), 0)}`), h('td', { class: 'n' }, usd(total)), h('td', null, ''), h('td', null, s ? `${usd(s.selfUsd)} за 12 міс.` : '')))));
    const chartCard = s ? h('div', { class: 'st-card' }, h('h3', null, 'Самостійні продажі по місяцях і план на 2027'), salesChart(s, c),
      h('div', { class: 'st-src' }, `${c.planProfile.note} Наведіть на стовпчик, щоб побачити суми.`)) : h('div', { class: 'st-card' }, unavailable('Продажі (BAS)', d.sources.bas && d.sources.bas.error));

    // New legal entities per month and search visitors per month: the two things the $690k depends on.
    const cards = [];
    if (cu) {
      const series = cu.newByMonth.map((m) => ({ month: m.month, v: m.count, partial: m.month === thisMonth }));
      cards.push(h('div', { class: 'st-card' }, h('h3', null, 'Нові юрособи, що купили самостійно, по місяцях'), barsTarget(series, { label: 'Нових юросіб', target: num(kpiCfg(d, 'newLegalPerMonth').target) || 0, targetLabel: 'потрібно' }), h('div', { class: 'st-src' }, 'BAS · місяць першої самостійної покупки юрособи. Поточний місяць — сірим.')));
    }
    if (d.search) {
      const series = d.search.monthly.map((r) => ({ month: r.month, v: r.searchUsers, partial: r.month === thisMonth, extra: [['Усі відвідувачі', int(r.users)], ['Усі візити', int(r.sessions)]] }));
      cards.push(h('div', { class: 'st-card' }, h('h3', null, 'Пошукові відвідувачі на місяць'), lineChart(series, { label: 'Пошукові відвідувачі', targets: chartTargets(kpiCfg(d, 'searchUsers')) }), h('div', { class: 'st-src' }, 'Google Analytics · канал Organic Search, лише пошукові системи. Порожня точка — місяць ще йде.')));
    } else cards.push(h('div', { class: 'st-card' }, unavailable('Google Analytics', d.sources.ga4 && d.sources.ga4.error)));
    if (d.gsc) {
      const series = d.gsc.monthly.map((r) => ({ month: r.month, v: r.clicks, partial: r.month === thisMonth, extra: [['Покази', int(r.impressions)], ['CTR', pct(r.ctr, 2)], ['Середня позиція', r.position ? NF1.format(r.position) : '—']] }));
      cards.push(h('div', { class: 'st-card' }, h('h3', null, 'Кліки з Google на місяць'), lineChart(series, { label: 'Кліки', targets: chartTargets(kpiCfg(d, 'clicks')), color: 'var(--s6)' }), h('div', { class: 'st-src' }, `Search Console. Брендові запити за 90 днів: ${pct(d.gsc.recent.brandShare)} видимих кліків.`)));
    }

    return section(d, 'path', null,
      h('div', { class: 'st-grid' }, chartCard,
        h('div', { class: 'st-card' }, h('h3', null, 'З чого складається ціль'), split, h('div', { style: { height: '10px' } }), table,
          h('div', { class: 'st-cond', style: { marginTop: '12px' } }, h('b', null, 'Головна залежність'), c.mainDependency)),
        h('div', { class: 'st-grid st-g3' }, cards),
        h('div', { class: 'st-card' }, h('h3', null, 'Масштаб цілі'), h('ul', { class: 'st-dec' }, c.scale.map((x) => h('li', null, x))))));
  }

  function planSection(d) {
    const c = d.content;
    const t = d.tasks;
    const byDir = (n) => (t ? t.items.filter((x) => x.direction === n) : []);
    return section(d, 'plan', c.essence,
      h('div', { class: 'st-grid st-g3' }, c.directions.map((dir) => {
        const items = byDir(dir.n);
        const done = items.filter((x) => x.status === 'Зроблено').length;
        return h('div', { class: 'st-card st-dir' },
          h('h3', null, h('span', { class: 'num' }, dir.n), dir.title),
          h('ul', null, dir.what.map((w) => h('li', null, w))),
          h('div', { class: 'm' }, `Показник: ${dir.metric}`),
          items.length ? h('div', { class: 'prog' }, `Задачі «100 днів»: зроблено ${done} із ${items.length}`) : null);
      })),
      h('div', { class: 'st-card', style: { marginTop: '12px' } }, h('h3', null, 'Терміни'), h('div', { class: 'st-seg' }, h('dl', null, c.terms.map((x) => [h('dt', null, x.term), h('dd', null, x.meaning)])))));
  }

  function voiceSection(d) {
    const p = d.content.positioning;
    return section(d, 'voice', p.advantage,
      h('div', { class: 'st-card', style: { marginBottom: '12px' } }, h('h3', null, 'Головна формула'), h('p', { class: 'st-formula' }, p.formula)),
      h('div', { class: 'st-grid st-g2' },
        h('div', { class: 'st-card st-say' }, h('h3', null, 'Кажемо'), h('ul', null, p.say.map((x) => h('li', null, x)))),
        h('div', { class: 'st-card st-dont' }, h('h3', null, 'Не кажемо ніколи'), h('ul', null, p.dontSay.map((x) => h('li', null, x.text, h('small', null, x.why)))))),
      h('div', { class: 'st-grid st-g2', style: { marginTop: '12px' } }, p.segments.map((sg) => h('div', { class: 'st-card st-seg' }, h('h3', null, sg.name),
        h('dl', null, h('dt', null, 'Біль'), h('dd', null, sg.pains), h('dt', null, 'Меседж'), h('dd', null, sg.message), h('dt', null, 'Заклик'), h('dd', null, sg.cta))))),
      h('div', { class: 'st-grid st-g3', style: { marginTop: '12px' } },
        h('div', { class: 'st-card' }, h('h3', null, 'Цінові правила'), h('ul', { class: 'st-dec' }, p.rules.map((x) => h('li', null, x)))),
        h('div', { class: 'st-card st-say' }, h('h3', null, 'Які акції можна'), h('ul', null, p.promoAllowed.map((x) => h('li', null, x)))),
        h('div', { class: 'st-card st-dont' }, h('h3', null, 'Яких акцій не робимо'), h('ul', null, p.promoForbidden.map((x) => h('li', null, x))))));
  }

  function marketSection(d) {
    const cm = d.content.competitors;
    const pr = d.prices;
    const WIN = { us: 'Syngenta', competitors: 'Конкуренти', parity: 'Паритет' };
    const table = h('div', { class: 'tablewrap' }, h('table', { class: 'st-t' },
      h('thead', null, h('tr', null, h('th', null, 'Критерій'), cm.columns.map((x) => h('th', null, x)), h('th', null, 'Хто виграє'))),
      h('tbody', null, cm.rows.map((r) => h('tr', null, h('td', null, h('b', null, r.criterion)), r.values.map((v, i) => h('td', { class: i === 0 ? 'us' : '' }, v)), h('td', null, h('span', { class: `st-win ${r.winner}` }, WIN[r.winner])))))));
    let priceCard;
    if (pr) {
      const watched = Object.entries(pr.watched).map(([k, n]) => `${k} — ${n}`).join(', ');
      priceCard = h('div', { class: 'st-card' }, h('h3', null, 'Ціни наживо: модуль «Ціни на ринку»'),
        h('div', { class: 'st-tiles' },
          h('div', { class: 'st-tile' }, h('div', { class: 'l' }, 'Наших товарів у моніторингу'), h('div', { class: 'v' }, int(pr.ourProducts))),
          h('div', { class: `st-tile ${pr.belowPartner ? 'bad' : 'good'}` }, h('div', { class: 'l' }, 'Дешевше за партнерів (порушує паритет)'), h('div', { class: 'v' }, int(pr.belowPartner)), h('div', { class: 'l' }, `із ${int(pr.checkedPartner)} перевірених`)),
          h('div', { class: 'st-tile' }, h('div', { class: 'l' }, 'Дорожчі за конкурентів понад 10%'), h('div', { class: 'v' }, int(pr.dearerThanMarket))),
          h('div', { class: 'st-tile' }, h('div', { class: 'l' }, 'На рівні ринку (±2%)'), h('div', { class: 'v' }, int(pr.parityMarket)))),
        pr.belowTop.length ? [h('h3', null, 'Де ми дешевші за партнерів — перевірити'), h('ul', { class: 'st-list' }, pr.belowTop.map((x) => h('li', null, h('span', null, `${x.name}${x.pack ? ` · ${x.pack}` : ''} — ${x.site}`), h('span', null, `${String(x.diffPct).replace('.', ',')}%`))))] : null,
        pr.pricierTop.length ? [h('h3', { style: { marginTop: '10px' } }, 'Де ми найдорожчі за конкурентів'), h('ul', { class: 'st-list' }, pr.pricierTop.map((x) => h('li', null, h('span', null, `${x.name}${x.pack ? ` · ${x.pack}` : ''} — ${x.site || ''}`), h('span', null, `+${String(x.diffPct).replace('.', ',')}%`))))] : null,
        h('p', { class: 'st-note' }, 'Правило стратегії: ціни не нижчі, ніж у дистриб’юторів. Бути дорожчими за конкурентів — нормально, якщо ми виграємо офіційністю й сервісом.'),
        h('div', { class: 'st-src' }, `Оновлено: ${pr.lastRefresh ? dmy(pr.lastRefresh) : '—'}. Під наглядом: ${watched}.`),
        h('a', { class: 'st-more', href: 'prices.html' }, 'Відкрити «Ціни на ринку» →'));
    } else priceCard = h('div', { class: 'st-card' }, unavailable('Ціни на ринку', d.sources.prices && d.sources.prices.error));
    return section(d, 'market', cm.intro,
      h('div', { class: 'st-card' }, table),
      h('div', { class: 'st-grid st-g2', style: { marginTop: '12px' } }, priceCard,
        h('div', { class: 'st-card' }, h('h3', null, 'Висновки'), h('ul', { class: 'st-dec' }, cm.conclusions.map((x) => h('li', null, x))))));
  }

  const ST = { 'Зроблено': 's-done', 'В роботі': 's-work', 'На паузі': 's-pause', 'Не почато': 's-todo' };
  const ST_COL = { 'Зроблено': 'var(--good)', 'В роботі': 'var(--s6)', 'На паузі': 'var(--warn)', 'Не почато': 'var(--chip)' };
  function tasksSection(d) {
    const c = d.content;
    const t = d.tasks;
    const stages = h('div', { class: 'st-stages' }, c.stages.map((sg) => {
      const now = today >= sg.from && today <= sg.to;
      const past = today > sg.to;
      return h('div', { class: `st-stage${now ? ' now' : ''}${past ? ' past' : ''}` },
        h('div', { class: 'h' }, h('b', null, sg.label), now ? h('span', null, '● зараз') : past ? h('span', { class: 'st-muted' }, 'минуло') : null),
        h('p', null, sg.what), h('div', { class: 'c' }, `Контроль: ${sg.control}`));
    }));
    const toSeason = days(today, c.seasonStart);
    const count = h('div', { class: 'st-count' },
      h('div', null, h('b', null, toSeason > 0 ? int(toSeason) : '0'), 'днів до сезону'),
      t ? h('div', null, h('b', null, `${t.done} / ${t.total}`), 'задач «100 днів» зроблено') : null,
      t ? h('div', null, h('b', null, int(t.inWork)), 'в роботі') : null,
      t ? h('div', null, h('b', { style: { color: t.overdue ? 'var(--bad)' : '' } }, int(t.overdue)), 'прострочено') : null,
      t && t.paused ? h('div', null, h('b', { style: { color: 'var(--warn)' } }, int(t.paused)), 'на паузі') : null);
    let tasksCard = null;
    if (t) {
      const statuses = ['Зроблено', 'В роботі', 'На паузі', 'Не почато'];
      const dirBars = c.directions.map((dir) => {
        const items = t.items.filter((x) => x.direction === dir.n);
        if (!items.length) return null;
        return h('div', { class: 'st-dirbar' }, h('span', null, `${dir.n}. ${dir.title}`),
          h('div', { class: 'bar', role: 'img', 'aria-label': statuses.map((s) => `${s}: ${items.filter((x) => x.status === s).length}`).join(', ') },
            statuses.map((s) => { const n = items.filter((x) => x.status === s).length; if (!n) return null; const el = h('i', { style: { width: `${(n / items.length) * 100}%`, background: ST_COL[s] } }); hover(el, () => [h('b', null, dir.title), tipRow(ST_COL[s], s, String(n))]); return el; })),
          h('span', { class: 'st-muted' }, `${items.filter((x) => x.status === 'Зроблено').length}/${items.length}`));
      });
      const rows = t.items.map((x) => h('tr', null,
        h('td', null, x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit' } }, x.title) : x.title, x.comment ? h('div', { class: 'st-muted', style: { fontSize: '12px' } }, x.comment) : null),
        h('td', null, x.direction),
        h('td', null, h('span', { class: `st-st ${ST[x.status] || 's-todo'}` }, x.status)),
        h('td', { class: 'n' }, dmy(x.due), x.overdue ? h('div', { class: 'st-late' }, 'прострочено') : null)));
      tasksCard = h('div', { class: 'st-card', style: { marginTop: '12px' } },
        h('h3', null, 'Чекліст «100 днів» за напрямами'),
        h('div', { class: 'st-legend' }, statuses.map((s) => h('span', null, h('i', { style: { background: ST_COL[s], border: s === 'Не почато' ? '1px solid var(--line)' : '' } }), s))),
        dirBars,
        h('details', { class: 'st-table', open: true }, h('summary', null, `Усі задачі (${t.total})`), h('div', { class: 'tablewrap' }, h('table', { class: 'st-t' },
          h('thead', null, h('tr', null, h('th', null, 'Задача'), h('th', null, 'Напрям'), h('th', null, 'Статус'), h('th', { class: 'n' }, 'Дедлайн'))), h('tbody', null, rows)))),
        h('div', { class: 'st-src' }, t.live ? `Notion «Задачі», проєкт E-com, задачі з ⭐ — наживо (усього в проєкті ${t.allProjectTasks.total}, зроблено ${t.allProjectTasks.done}).` : `Знімок задач на ${dmy(t.asOf)}. Живе читання з Notion: ${t.error || 'недоступне'} — потрібно дати інтеграції SytBoard доступ до бази «Задачі».`,
          ' ', h('a', { href: t.notionUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Відкрити в Notion')));
    }
    return section(d, 'tasks', null, count, stages, tasksCard);
  }

  function risksSection(d) {
    const c = d.content;
    return section(d, 'risks', null,
      h('div', { class: 'st-grid st-g2' },
        h('div', { class: 'st-card' }, h('h3', null, 'Рішення, які потрібні від керівництва'), h('ol', { class: 'st-dec' }, c.decisions.map((x) => h('li', null, x)))),
        h('div', { class: 'st-card' }, h('h3', null, 'Інвестиції'), h('table', { class: 'st-t' }, h('tbody', null, c.investments.map((x) => h('tr', null, h('td', null, h('b', null, x.item), h('div', { class: 'st-muted', style: { fontSize: '12px' } }, x.why)), h('td', { class: 'n' }, x.amount))))))),
      h('div', { class: 'st-card', style: { marginTop: '12px' } }, h('h3', null, 'Головні ризики'), h('div', { class: 'tablewrap' }, h('table', { class: 'st-t' },
        h('thead', null, h('tr', null, h('th', null, 'Ризик'), h('th', null, 'Що робимо'))), h('tbody', null, c.risks.map((r) => h('tr', null, h('td', null, h('b', null, r.risk)), h('td', null, r.action))))))),
      h('div', { class: 'st-card', style: { marginTop: '12px' } }, h('h3', null, 'Чого дашборд поки не бачить'), h('ul', { class: 'st-dec' }, c.dataGaps.map((x) => h('li', null, x)))),
      h('p', { class: 'st-src' }, `Джерело: ${c.source.title}, ${c.source.version}, оновлено ${dmy(c.source.updated)}.`));
  }

  // ---- load & render ----------------------------------------------------------------------------------------
  const main = $('strategy');
  async function load(force) {
    const stop = Loading.show(main, { title: 'Збираємо цифри стратегії…', text: 'Продажі з BAS, пошук із Google Analytics і Search Console, ціни й задачі з Notion.', skeleton: 6 });
    status('');
    try {
      const d = await apiCall(`/strategy${force ? '?refresh=1' : ''}`);
      clear(main);
      const jump = document.querySelector('.st-jump');
      clear(jump);
      append(jump, (d.content.sections || []).map((x) => h('a', { href: `#${x.id}` }, x.title)));
      append(main, [heroSection(d), kpiSection(d), pathSection(d), planSection(d), voiceSection(d), marketSection(d), tasksSection(d), risksSection(d)]);
      const down = Object.entries(d.sources || {}).filter(([k, v]) => !v.ok && k !== 'notion').map(([k, v]) => `${{ bas: 'BAS', ga4: 'Google Analytics', gsc: 'Search Console', prices: 'Ціни' }[k] || k}: ${v.error}`);
      status(`Оновлено ${fmt.time(d.generatedAt)}${d.basFetchedAt ? ` · продажі з BAS на ${fmt.time(d.basFetchedAt)}` : ''}${down.length ? ` · недоступно — ${down.join('; ')}` : ''}`);
      main.setAttribute('aria-busy', 'false');
    } catch (err) {
      status(`Не вдалося завантажити: ${err.message}`, true);
    } finally { stop.stop(); }
  }
  $('refresh').addEventListener('click', () => load(true));
  const presentBtn = $('present');
  const setPresent = (on) => { document.body.classList.toggle('present', on); presentBtn.setAttribute('aria-pressed', String(on)); try { localStorage.setItem('st-present', on ? '1' : ''); } catch { /* private window */ } };
  presentBtn.addEventListener('click', () => setPresent(!document.body.classList.contains('present')));
  try { if (localStorage.getItem('st-present') === '1') setPresent(true); } catch { /* private window */ }
  load(false);
})();
