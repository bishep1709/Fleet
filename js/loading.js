// A visible "data is loading" state for pages that gather numbers from several sources (they can take
// 10–20 seconds on a cold start). While loading, the old content (if any) is dimmed and a card with a
// spinner, an explanation, an elapsed-time counter and page-shaped placeholders is shown on top.
//   const stop = Loading.show(container, { title, text, sources, skeleton })  → call stop() when done
//   Loading.note('…') changes the small note under the counter (e.g. while retrying).
(function () {
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v === null || v === undefined || v === false) continue; n.setAttribute(k, v === true ? '' : String(v)); }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  };
  const SHOW_AFTER_MS = 250; // quick reloads (switching a filter) never flash the card
  let current = null;

  function show(container, opts = {}) {
    if (current) current.stop();
    const t0 = Date.now();
    const counter = el('p', { class: 'ld-time' }, 'Минуло 0 с');
    const note = el('p', { class: 'ld-note' });
    const card = el('div', { class: 'ld', role: 'status', 'aria-live': 'polite' },
      el('div', { class: 'ld-spin', 'aria-hidden': 'true' }),
      el('h2', null, opts.title || 'Дані завантажуються…'),
      opts.text ? el('p', { class: 'ld-text' }, opts.text) : null,
      opts.sources && opts.sources.length ? el('ul', { class: 'ld-src' }, opts.sources.map((s) => el('li', null, s))) : null,
      el('div', { class: 'ld-bar', 'aria-hidden': 'true' }, el('i')),
      counter, note);
    const skeleton = opts.skeleton === false ? null : el('div', { class: 'ld-skel', 'aria-hidden': 'true' },
      Array.from({ length: opts.skeleton || 8 }, () => el('div', { class: 'ld-card' }, el('i'), el('i'), el('i'))));

    container.classList.add('is-loading');
    let shown = false;
    const showTimer = setTimeout(() => { shown = true; container.insertBefore(card, container.firstChild); if (skeleton && !container.querySelector(':scope > :not(.ld):not(.ld-skel)')) container.appendChild(skeleton); }, SHOW_AFTER_MS);
    const tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      counter.textContent = `Минуло ${s} с`;
      if (s >= 25 && !note.dataset.custom) note.textContent = 'Це довше, ніж зазвичай. Ще чекаємо відповідь від джерел даних — сторінку не закривайте.';
    }, 1000);

    const handle = {
      note(text) { note.dataset.custom = text ? '1' : ''; note.textContent = text || ''; },
      stop() {
        if (handle.stopped) return;
        handle.stopped = true;
        clearTimeout(showTimer);
        clearInterval(tick);
        container.classList.remove('is-loading');
        if (shown) { card.remove(); if (skeleton) skeleton.remove(); }
        if (current === handle) current = null;
      },
    };
    current = handle;
    return handle;
  }

  window.Loading = { show, note: (t) => { if (current) current.note(t); } };
})();
