// All dynamic content is inserted with textContent / text nodes — never innerHTML.
// Task titles, campaign names and paths come from external systems and are untrusted.
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  return el;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// Change chip. Direction is shown as an arrow AND text; meaning (good/bad) as colour —
// so it never relies on colour alone. `good` says which direction is favourable.
function deltaChip(value, { good = 'up', kind = 'pct', title = null } = {}) {
  if (value === null || value === undefined) return h('span', { class: 'delta neutral' }, 'нове');
  const flat = kind === 'pp' ? Math.abs(value) < 0.0005 : Math.abs(value) < 0.005;
  if (flat) return h('span', { class: 'delta neutral' }, '• без змін');
  const up = value > 0;
  const favourable = good === 'neutral' ? null : (good === 'up') === up;
  const cls = favourable === null ? 'neutral' : favourable ? 'good' : 'bad';
  const text = kind === 'pp' ? fmt.pp(value) : fmt.delta(value);
  const meaning = favourable === null ? '' : favourable ? ', це добре' : ', це погано';
  return h('span', { class: `delta ${cls}`, 'aria-label': `${up ? 'зростання' : 'зменшення'} ${text} ${title ? '' : (window.CMP_WORDS || 'до попереднього періоду')}${meaning}`, title: title || window.CMP_TITLE || 'Порівняно з попереднім періодом такої ж тривалості' },
    up ? '▲ ' : '▼ ', text);
}

let sparkUid = 0;
// A smooth line with a soft shade under it and a ringed dot at the last value.
function sparkline(values, { width = 84, height = 26 } = {}) {
  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true', focusable: 'false' });
  if (!values || values.length < 2) return svg;
  const pad = 5;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), height - pad - ((v - min) / span) * (height - pad * 2)]);
  // monotone-ish smoothing: midpoints as control points keeps the curve inside the data
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = ((pts[i - 1][0] + pts[i][0]) / 2).toFixed(1);
    d += ` C${mx},${pts[i - 1][1].toFixed(1)} ${mx},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }
  const gid = `sp${++sparkUid}`;
  const defs = svgEl('defs', {});
  const gr = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
  gr.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#5f7800', 'stop-opacity': '0.28' }));
  gr.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#5f7800', 'stop-opacity': '0' }));
  defs.appendChild(gr);
  svg.appendChild(defs);
  svg.appendChild(svgEl('path', { d: `${d} L${pts[pts.length - 1][0].toFixed(1)},${height - 1} L${pts[0][0].toFixed(1)},${height - 1} Z`, fill: `url(#${gid})` }));
  svg.appendChild(svgEl('path', { d, fill: 'none', stroke: '#5f7800', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const [lx, ly] = pts[pts.length - 1];
  svg.appendChild(svgEl('circle', { cx: lx, cy: ly, r: 3.6, fill: '#5f7800', stroke: '#ffffff', 'stroke-width': 2 }));
  return svg;
}

// Stat tile: label · value · change vs previous period · trend.
function kpiTile({ label, value, delta, good, kind, spark, note, flag, title }) {
  return h('div', { class: `kpi${flag ? ' flag' : ''}`, title },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    h('div', { class: 'foot' },
      delta === undefined ? h('span', { class: 'note' }, note || '') : deltaChip(delta, { good, kind }),
      spark ? sparkline(spark) : null),
    delta !== undefined && note ? h('div', { class: 'note' }, note) : null);
}

function card({ title, sub, tools, body, cls, id }) {
  return h('section', { class: `card${cls ? ` ${cls}` : ''}`, id },
    (title || tools) ? h('div', { class: 'card-head' },
      h('div', null, title ? h('h3', null, title) : null, sub ? h('p', { class: 'sub' }, sub) : null),
      tools ? h('div', { class: 'card-tools' }, tools) : null) : null,
    body);
}

function segmented({ options, value, onChange, label, role = 'radiogroup' }) {
  const wrap = h('div', { class: 'seg', role, 'aria-label': label });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === value), onclick: () => {
      buttons.forEach((x, i) => x.setAttribute('aria-checked', String(options[i].value === o.value)));
      onChange(o.value);
    } }, o.label);
    return b;
  });
  append(wrap, buttons);
  return wrap;
}

// Generic table. Column: { label, num, render(row) }, or { bar(row) -> { parts:[{v,color}], max } }.
// When onPick is given the first cell holds a real <button>, so filtering is keyboard-reachable.
function dataTable({ cols, rows, onPick, isSelected, empty = 'Немає даних за цей період' }) {
  if (!rows.length) return h('p', { class: 'empty' }, empty);
  const thead = h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.num ? 'num' : '', scope: 'col' }, c.label || ''))));
  const tbody = h('tbody', null, rows.map((row) => {
    const selected = isSelected ? isSelected(row) : false;
    const tr = h('tr', { class: `${onPick ? 'pick' : ''}${selected ? ' selected' : ''}` });
    cols.forEach((c, i) => {
      let content;
      if (c.bar) {
        const { parts, max } = c.bar(row);
        content = h('div', { class: parts.length > 1 ? 'bar multi' : 'bar', 'aria-hidden': 'true' },
          parts.map((p) => h('i', { style: { width: `${Math.max(0, Math.min(100, max ? (p.v / max) * 100 : 0))}%`, background: p.color || '' } })));
        tr.appendChild(h('td', { class: 'bar-cell' }, content));
        return;
      }
      content = c.render ? c.render(row) : row[c.key];
      if (i === 0 && onPick) {
        content = h('button', { type: 'button', class: 'pick-btn', 'aria-pressed': String(selected), onclick: (e) => { e.stopPropagation(); onPick(row); } }, content);
      }
      tr.appendChild(h('td', { class: `${c.num ? 'num' : 'name'}` }, content));
    });
    if (onPick) tr.addEventListener('click', () => onPick(row));
    return tr;
  }));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, thead, tbody));
}

function severityLabel(s) {
  return { critical: 'Критично', warning: 'Увага', info: 'До відома', good: 'Добре' }[s] || s;
}
