// SytBoard «Комунікації»: the communication plan from Notion (always the current state of the plan there) with what each
// published activity brought to the site, and the promo codes with their results. All text goes through DOM APIs.
(async function () {
  const $ = (id) => document.getElementById(id);
  const status = (text, isErr) => { const s = $('status'); s.textContent = text || ''; s.classList.toggle('err', !!isErr); };

  let me;
  try { me = await api.me(); } catch { window.location.href = 'login.html'; return; }
  if (me.mustChangePassword) { window.location.href = 'login.html'; return; }
  const isAdmin = me.role === 'admin';

  const num = (n) => fmt.int(n);
  const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const monthTitle = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  const dayLabel = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const weekday = (iso) => WD[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const panel = (...kids) => h('div', { class: 'panel' }, kids);
  const kpi = (label, value, sub, tone, onClick) => { const el = h('div', { class: `panel kpi${tone ? ` t-${tone}` : ''}${onClick ? ' click' : ''}`, role: onClick ? 'button' : null, tabindex: onClick ? '0' : null }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), h('div', { class: 's' }, sub)); if (onClick) { el.addEventListener('click', onClick); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }); } return el; };
  const empty = (t) => h('div', { class: 'empty' }, t);
  const page = $('page');

  const params = new URLSearchParams(location.search);
  const TABS = [['plan', 'План комунікацій'], ...(isAdmin ? [['promo', 'Промокоди']] : [])];
  const state = { tab: TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'plan', filter: 'attention', channel: '', type: '', q: '', promoRange: 'all', promoKind: 'reusable', promoQ: '' };
  let plan = null;
  let promos = null;
  const open = new Set(); // opened cards stay open while the list is redrawn
  let people = [];
  apiCall('/tasks/people').then((r) => { people = r.people || []; }).catch(() => {});

  // ---- the plan ---------------------------------------------------------------------------------
  const STATUS_TEXT = { done: 'Виконано', overdue: 'Не виконано', today: 'Сьогодні', planned: 'Попереду' };
  // The rule of the plan: a publication that links to the site carries a UTM campaign.
  const MEASURABLE = ['Telegram', 'Facebook', 'Instagram', 'Viber', 'E-mail', 'SMS'];
  const inFocus = (r) => r.status === 'done' || r.status === 'overdue' || r.date <= fmt.addDays(plan.today, 14);
  const lacksUtm = (r) => inFocus(r) && !r.utm && !(r.telegram && r.telegram.campaigns.length) && r.channels.some((c) => MEASURABLE.includes(c));
  const tgWhen = (r) => { const d = new Date(r.telegram.postedAt); return `${new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' }).format(d)} ${new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)}`; };
  const tgLine = (r) => `${num(r.telegram.reach)} переглядів, ${num(r.telegram.reactions)} реакцій${r.telegram.final ? '' : ' (ще зростає)'}`;
  const FILTERS = [['attention', 'Потребують уваги'], ['planned', 'Попереду'], ['done', 'Виконані'], ['noresult', 'Без результату'], ['all', 'Усі']];
  const RATINGS = ['Успішна', 'Посередня', 'Неуспішна'];
  const RATE_CLASS = { 'Успішна': 'ok', 'Посередня': 'mid', 'Неуспішна': 'bad' };

  // what Google Analytics measured on its own (visits from the channels of the publication)
  function resultsBlock(r) {
    if (r.status === 'overdue') return h('div', { class: 'cm-res' }, h('b', null, 'Не вийшло вчасно'), h('small', null, 'У Notion немає галочки «Виконано», а дата вже минула.'));
    if (r.status === 'today') return h('div', { class: 'cm-res' }, h('small', null, 'Заплановано на сьогодні. Після публікації відмітьте «Виконано».'));
    if (r.status === 'planned') return h('div', { class: 'cm-res' }, h('small', null, 'Результат з’явиться після публікації й позначки «Виконано».'));
    const x = r.results;
    if (!x) return h('div', { class: 'cm-res' }, h('small', null, plan.visitsError ? plan.visitsError : 'Автоматичних цифр поки немає.'));
    if (x.method === 'none') return h('div', { class: 'cm-res' }, h('small', null, x.note));
    const days = x.days || 1;
    if (x.method === 'utm' && !x.sessions) return h('div', { class: 'cm-res' }, h('div', null, h('small', null, 'Google Analytics: '), h('b', null, '0'), ' візитів за міткою'), h('small', null, 'Дані приходять із затримкою до доби. Якщо через день нічого, перевірте, що в публікацію потрапили посилання з UTM.'));
    const when = x.from === x.to ? x.from : `${dayLabel(x.from)}–${dayLabel(x.to)}`;
    const lines = [h('div', null, h('small', null, 'Google Analytics: '), h('b', null, num(x.sessions)), ' візитів · ', h('b', null, num(x.carts)), ' у кошик', x.purchases ? [' · ', h('b', null, num(x.purchases)), x.purchasesPartial ? ' покупок (не всі)' : ' покупок'] : null)];
    if (x.method === 'channel') {
      const up = x.lift > 0;
      lines.push(h('div', { class: up ? 'up' : 'down' }, `${up ? '+' : '−'}${num(Math.abs(x.lift))} ${up ? 'понад' : 'менше за'} звичайне (звичайно ${num(x.usual)} за ${days} ${days === 1 ? 'день' : 'дні'})`));
      lines.push(h('small', { title: 'Рахуємо візити з каналів публікації за ці дні й порівнюємо зі звичайним рівнем каналу за 28 днів до того.' }, `за ${when}, з каналів публікації`));
    } else lines.push(h('small', null, `за ${when}, точно за міткою в посиланні`));
    return h('div', { class: 'cm-res' }, lines);
  }

  // the verdict the person entered: successful / mediocre / unsuccessful and why
  function verdictBlock(r) {
    if (r.status !== 'done') return null;
    const a = r.auto;
    // nobody entered a verdict: the system's own one, with the reasons
    if (!r.result.rating && !r.result.conclusion && a) {
      return h('div', { class: `cm-verdict ${RATE_CLASS[a.rating]}` },
        h('b', null, a.rating, h('span', { class: 'cm-auto' }, a.provisional ? 'оцінка системи, попередня' : 'оцінка системи')),
        h('p', null, a.reasons.join(' ')),
        h('small', null, 'Не згодні? Розкрийте картку й змініть оцінку.'));
    }
    if (!r.hasResult) return h('div', { class: 'cm-verdict none' }, h('b', null, 'Результат не внесено'), h('small', null, 'Розкрийте активність і внесіть результат.'));
    const x = r.result;
    const nums = [['Охоплення', x.reach], ['Переходи', x.clicks], ['Реакції', x.reactions], ['Замовлень за кодом', x.promoOrders]].filter(([, v]) => v !== null).map(([l, v]) => `${l}: ${num(v)}`).join(' · ');
    return h('div', { class: `cm-verdict ${RATE_CLASS[x.rating] || 'none'}` },
      h('b', null, x.rating || 'Без оцінки'),
      x.conclusion ? h('p', null, x.conclusion) : h('small', null, 'Чому так — не вписано.'),
      nums ? h('small', null, nums) : null,
      x.next ? h('small', null, `Далі: ${x.next}`) : null,
      a && a.rating !== x.rating ? h('small', { class: 'cm-autonote' }, `Система оцінила інакше: ${a.rating}. ${a.reasons[0] || ''}`) : null);
  }

  const field = (label, control, hint, cls) => h('label', { class: `cm-f${cls ? ` ${cls}` : ''}` }, h('span', { class: 'cm-fl' }, label), control, hint ? h('span', { class: 'cm-fh' }, hint) : null);
  const textInput = (value, attrs) => h('input', { type: 'text', value: value || '', ...attrs });
  const numInput = (value) => h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: value === null || value === undefined ? '' : value });
  const area = (value, rows) => h('textarea', { rows: rows || 3, maxlength: 600 }, value || '');

  async function refreshPlan() {
    plan = await apiCall('/comms');
    drawPlan();
  }

  // ---- links with UTM tags ------------------------------------------------------------------------------
  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ъ: '', ы: 'y', э: 'e', ё: 'e' };
  const slug = (text, max = 60) => String(text || '').toLowerCase().replace(/[а-яґєіїьъыэё]/g, (c) => TRANSLIT[c] || '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
  const DEFAULT_TAGS = { Telegram: ['telegram', 'social'], Facebook: ['facebook', 'social'], Instagram: ['instagram', 'social'], Viber: ['viber', 'social'], 'E-mail': ['email', 'email'], SMS: ['sms', 'sms'] };
  const suggestCampaign = (r) => slug(`${(r.channels[0] || 'post')}_${r.date.slice(0, 7).replace('-', '_')}_${r.title}`, 70);
  // «посилання | назва» per line → the same links with source, medium, campaign and content (the name of the link)
  function tagLinks(text, tags) {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const [url, ...rest] = line.split('|');
      let u;
      try { u = new URL(url.trim()); } catch { out.push({ error: `Не посилання: ${line.slice(0, 60)}` }); continue; }
      if (!/^https?:$/.test(u.protocol)) { out.push({ error: `Не посилання: ${line.slice(0, 60)}` }); continue; }
      const name = rest.join('|').trim() || decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'home');
      const content = slug(name) || 'link';
      u.searchParams.set('utm_source', tags.source); u.searchParams.set('utm_medium', tags.medium); u.searchParams.set('utm_campaign', tags.campaign); u.searchParams.set('utm_content', content);
      out.push({ content, url: u.toString() });
    }
    return out;
  }
  function linksTable(r) {
    const x = r.results;
    if (!x || x.method !== 'utm' || !x.links || !x.links.length) return null;
    const max = Math.max(1, ...x.links.map((l) => l.sessions));
    return h('section', { class: 'cm-block' }, h('h4', null, 'Що дали посилання'),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Посилання (utm_content)', 'Візити', 'Відвідувачі', 'У кошик'].map((t, i) => h('th', { class: i ? 'n' : '', scope: 'col' }, t)))),
        h('tbody', null, x.links.map((l) => h('tr', null, h('td', null, l.content || h('span', { class: 'muted' }, 'без utm_content')), h('td', null, h('div', { class: 'meter' }, h('div', { class: 'track' }, h('b', { style: { width: `${(l.sessions / max) * 100}%` } })), h('span', null, num(l.sessions)))), h('td', { class: 'n' }, num(l.users)), h('td', { class: 'n' }, num(l.carts))))))),
      h('p', { class: 'cm-fh' }, `За ${x.from === x.to ? x.from : `${dayLabel(x.from)}–${dayLabel(x.to)}`}, лише візити з міткою цієї кампанії.`));
  }
  // ---- editing what the activity is ---------------------------------------------------------------------------
  const CHANNEL_NAMES = ['Telegram', 'Facebook', 'Instagram', 'Viber', 'E-mail', 'SMS', 'Сайт'];
  let typesCache = null;
  const loadTypes = async () => { if (!typesCache) { try { typesCache = await apiCall('/comms/types'); } catch { typesCache = {}; } } return typesCache; };
  // a text field with quick buttons: a click adds or removes the channel in the text, the text stays as the plan has it
  function channelPicker(initial) {
    const input = textInput(initial || '', { maxlength: 200, placeholder: 'Telegram; Facebook' });
    const chips = h('div', { class: 'cm-chips', role: 'group', 'aria-label': 'Канали' });
    const parts = () => input.value.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    const draw = () => {
      clear(chips);
      for (const name of CHANNEL_NAMES) {
        const on = channelsOfText(input.value).includes(name);
        const b = h('button', { type: 'button', class: 'cm-chip', 'aria-pressed': String(on) }, name);
        b.addEventListener('click', () => {
          if (on) input.value = parts().filter((x) => !channelsOfText(x).includes(name)).join('; ');
          else input.value = [...parts(), name].join('; ');
          draw();
        });
        chips.appendChild(b);
      }
    };
    input.addEventListener('input', draw);
    draw();
    return { input, chips, el: h('div', { class: 'cm-f span4' }, h('span', { class: 'cm-fl' }, 'Канал: де виходить'), chips, input) };
  }
  const CHANNEL_RE = [['Telegram', /telegram|телеграм/i], ['Facebook', /facebook|фейсбук|\bfb\b/i], ['Instagram', /instagram|інстаграм|instagr/i], ['Viber', /viber|вайбер/i], ['E-mail', /e-?mail|емейл|імейл|пошта|лист/i], ['SMS', /sms|смс/i], ['Сайт', /сайт/i]];
  const channelsOfText = (t) => CHANNEL_RE.filter(([, re]) => re.test(t)).map(([n]) => n);

  // «✎ Редагувати» opens a form with everything the plan says about the activity
  function descEditor(r, done) {
    const f = {
      title: textInput(r.title, { maxlength: 200, 'aria-label': 'Тема' }),
      date: h('input', { type: 'date', value: r.date, min: `${r.year}-01-01`, max: `${r.year}-12-31` }),
      type: h('select'),
      format: textInput(r.format, { maxlength: 200 }),
      product: textInput(r.product, { maxlength: 300 }),
      why: area(r.why, 3), message: area(r.message, 3), plan: area(r.plan, 3),
    };
    const picker = channelPicker(r.channelRaw);
    loadTypes().then((t) => { const list = t[r.year] || []; clear(f.type); f.type.appendChild(h('option', { value: '' }, 'без типу')); for (const x of list) f.type.appendChild(h('option', { value: x, selected: x === r.type }, x)); });
    const msg = h('span', { class: 'cm-msg', role: 'status' });
    const save = h('button', { type: 'button', class: 'cm-btn primary' }, 'Зберегти опис');
    const cancel = h('button', { type: 'button', class: 'cm-btn' }, 'Скасувати');
    cancel.addEventListener('click', done);
    save.addEventListener('click', async () => {
      const now = { title: f.title.value.trim(), date: f.date.value, channel: picker.input.value.trim(), type: f.type.value, format: f.format.value.trim(), product: f.product.value.trim(), why: f.why.value.trim(), message: f.message.value.trim(), plan: f.plan.value.trim() };
      const was = { title: r.title, date: r.date, channel: r.channelRaw || '', type: r.type || '', format: r.format || '', product: r.product || '', why: r.why || '', message: r.message || '', plan: r.plan || '' };
      const patch = {};
      for (const k of Object.keys(now)) if (now[k] !== was[k]) patch[k] = now[k];
      if (!now.title) { msg.className = 'cm-msg err'; msg.textContent = 'Впишіть тему.'; return; }
      if (!Object.keys(patch).length) { done(); return; }
      save.disabled = true;
      if (await saveFields(r, patch, msg, 'Опис збережено.')) done(); else save.disabled = false;
    });
    return h('div', { class: 'cm-edit' },
      h('div', { class: 'cm-cols' }, field('Тема', f.title, null, 'span2'), field('Дата', f.date), field('Тип', f.type), picker.el,
        field('Формат', f.format, 'Наприклад: пост + фото', 'span2'), field('Продукт / фокус', f.product, null, 'span2'),
        field('Навіщо зараз', f.why, 'Чому саме зараз', 'span4'), field('Основне повідомлення', f.message, 'Що хочемо сказати людям', 'span4'), field('План дій', f.plan, 'Що треба зробити до виходу', 'span4')),
      h('div', { class: 'cm-actions' }, save, cancel, msg));
  }

  // ---- three plain steps: links -> published -> result ----------------------------------------------------------------
  const generated = new Map(); // activity id -> the link rows made in this browser, kept while the card is redrawn
  const needsTags = (r) => r.channels.some((c) => MEASURABLE.includes(c));
  const isKyivstar = (r) => r.channels.some((c) => c === 'SMS' || c === 'Viber') || /київстар|kyivstar/i.test(`${r.channelRaw} ${r.format || ''} ${r.plan || ''}`);

  async function saveFields(r, patch, msgEl, okText) {
    msgEl.className = 'cm-msg'; msgEl.textContent = 'Зберігаємо…';
    try {
      await apiCall(`/comms/activities/${r.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      await refreshPlan();
      status(okText || 'Збережено.');
      return true;
    } catch (err) { msgEl.className = 'cm-msg err'; msgEl.textContent = err.message || 'Не вдалося зберегти.'; return false; }
  }
  const stepHead = (n, title, ok, okText) => h('div', { class: 'cm-sh' }, h('span', { class: `cm-sn${ok ? ' ok' : ''}` }, ok ? '✓' : String(n)), h('b', null, title), ok ? h('span', { class: 'cm-sok' }, okText) : null);

  // step 1: a row per link: «посилання» -> [Створити з UTM] -> «готово з UTM»; «+» adds a row. The campaign is saved in the plan by itself.
  function stepLinks(r) {
    const ch = r.channels.find((c) => DEFAULT_TAGS[c]) || 'Telegram';
    const [src, med] = DEFAULT_TAGS[ch];
    const hasUtm = !!r.utm;
    const box = h('section', { class: 'cm-step' }, stepHead(1, 'Посилання з UTM', hasUtm, `кампанія: ${r.utm}`));
    if (!r.channels.length) { box.appendChild(h('p', { class: 'cm-warnbox' }, 'У активності не вказано канал (де вона виходить), тому незрозуміло, чи потрібні UTM. Натисніть «✎ Редагувати опис» ліворуч і оберіть канал: Telegram, Facebook, Viber, SMS…')); return box; }
    if (!needsTags(r)) { box.appendChild(h('p', { class: 'cm-sd' }, 'Для цього каналу (сайт) UTM-мітки в посиланнях не потрібні. Цей крок можна пропустити.')); return box; }
    if (r.telegram && r.telegram.campaigns.length && !hasUtm) {
      box.appendChild(h('div', { class: 'cm-tip ok' }, h('b', null, 'У публікації в Telegram вже є мітки: '), r.telegram.campaigns.join(', '), '. Візити за ними рахуються самі, нічого робити не треба.'));
    }
    if (r.telegram && r.telegram.withoutUtm) box.appendChild(h('p', { class: 'cm-warnbox' }, 'У пості в Telegram є посилання на сайт без UTM-мітки: візити з нього не потраплять у статистику цієї активності.'));
    if (hasUtm) {
      // what is already in the plan, and what the links look like
      const camps = r.utm.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
      const rowsOut = [];
      for (const c of camps) {
        const known = (r.telegram ? r.telegram.tagged : []).filter((t) => (t.campaign || '').toLowerCase() === c.replace(/\*$/, '').toLowerCase());
        if (known.length) for (const t of known) rowsOut.push([c, t.url, 'посилання з посту']);
        else rowsOut.push([c, `https://store.syngenta.ua/?utm_source=${src}&utm_medium=${med}&utm_campaign=${encodeURIComponent(c.replace(/\*$/, ''))}`, 'так виглядає посилання з цією міткою']);
      }
      const seenLinks = ((r.results && r.results.links) || []).filter((l) => l.content);
      box.appendChild(h('div', { class: 'cm-added' },
        h('b', null, camps.length > 1 ? 'Кампанії вже додано до плану:' : 'Кампанію вже додано до плану:'),
        rowsOut.map(([c, url, kind]) => h('div', { class: 'cm-addrow' }, h('span', { class: 'cm-tag' }, c), h('input', { type: 'text', readonly: true, value: url, 'aria-label': `Посилання кампанії ${c}` }), h('small', null, kind))),
        seenLinks.length ? h('small', null, `Аналітика бачила посилання: ${seenLinks.map((l) => l.content).join(', ')}.`) : null,
        h('small', null, 'Потрібна ще одна мітка або інше посилання? Додайте нижче: можна вставити й посилання, де UTM уже є.')));
    }
    box.appendChild(h('p', { class: 'cm-sd' }, 'Вставте звичайне посилання, натисніть «Створити з UTM» і візьміть готове посилання. Потрібно більше посилань: натисніть «+ Додати посилання».'));
    const camp = textInput('', { maxlength: 120, 'aria-label': 'Назва кампанії' });
    camp.value = ((r.utm || '').split(/[,;\n]/)[0] || '').trim().replace(/\*$/, '') || suggestCampaign(r);
    box.appendChild(h('div', { class: 'cm-camp' }, h('span', { class: 'cm-fl' }, 'Кампанія (UTM)'), camp, h('span', { class: 'cm-fh' }, 'вже підставлена, змінювати не обов’язково')));

    const rowsBox = h('div', { class: 'cm-lrows' });
    const msg = h('span', { class: 'cm-msg', role: 'status' });
    const list = generated.get(r.id) || (generated.set(r.id, [{ link: '', ready: '' }]), generated.get(r.id));
    const usedNames = () => new Set(list.map((x) => x.name).filter(Boolean));

    async function create(item, linkInput, readyInput, button) {
      // the link already carries a campaign: keep it as it is and put the campaign into the plan
      try {
        const ready = new URL(linkInput.value.trim());
        const own = ready.searchParams.get('utm_campaign');
        if (/^https?:$/.test(ready.protocol) && own) {
          item.link = linkInput.value.trim(); item.ready = ready.toString(); item.name = ready.searchParams.get('utm_content') || '';
          readyInput.value = item.ready; button.textContent = 'Перевірити ще раз';
          const have0 = (r.utm || '').split(/[,;\n]/).map((x) => x.trim().toLowerCase().replace(/\*$/, ''));
          if (have0.includes(own.toLowerCase())) { msg.className = 'cm-msg'; msg.textContent = `У посиланні вже є UTM, кампанія «${own}» уже в плані.`; return; }
          await saveFields(r, { utm: r.utm ? `${r.utm}, ${own}` : own }, msg, `У посиланні вже є UTM. Кампанію «${own}» записано в план.`);
          return;
        }
      } catch { /* not a link yet: the check below says so */ }
      const t = tagLinks(linkInput.value, { source: src, medium: med, campaign: slug(camp.value, 120) });
      if (!linkInput.value.trim()) { msg.className = 'cm-msg err'; msg.textContent = 'Вставте посилання.'; return; }
      if (!slug(camp.value, 120)) { msg.className = 'cm-msg err'; msg.textContent = 'Впишіть назву кампанії.'; return; }
      if (t[0].error) { msg.className = 'cm-msg err'; msg.textContent = `${t[0].error}. Вставте повне посилання з https://`; return; }
      // two links to the same page get different names, so they can be told apart in the report
      let content = t[0].content; let n = 2;
      while (list.some((x) => x !== item && x.name === content)) content = `${t[0].content}_${n++}`;
      const url = new URL(t[0].url); url.searchParams.set('utm_content', content);
      item.link = linkInput.value.trim(); item.ready = url.toString(); item.name = content;
      readyInput.value = item.ready;
      button.textContent = 'Створити ще раз';
      msg.className = 'cm-msg'; msg.textContent = '';
      const campaign = slug(camp.value, 120);
      const have = (r.utm || '').split(/[,;\n]/).map((x) => x.trim().toLowerCase());
      if (!have.includes(campaign)) await saveFields(r, { utm: r.utm ? `${r.utm}, ${campaign}` : campaign }, msg, 'Посилання створено, кампанію записано в план.');
    }

    function drawRows() {
      clear(rowsBox);
      list.forEach((item, i) => {
        const linkInput = textInput(item.link, { placeholder: 'Звичайне посилання на товар: https://store.syngenta.ua/…', maxlength: 500, 'aria-label': `Посилання ${i + 1}` });
        const readyInput = textInput(item.ready, { readonly: true, placeholder: 'Тут з’явиться готове посилання з UTM', 'aria-label': `Готово з UTM ${i + 1}` });
        const go = h('button', { type: 'button', class: 'cm-btn primary' }, item.ready ? 'Створити ще раз' : 'Створити з UTM');
        const copy = h('button', { type: 'button', class: 'cm-btn' }, 'Копіювати');
        const del = list.length > 1 ? h('button', { type: 'button', class: 'cm-btn small', title: 'Прибрати цей рядок', 'aria-label': 'Прибрати рядок' }, '×') : null;
        linkInput.addEventListener('input', () => { item.link = linkInput.value; });
        go.addEventListener('click', () => create(item, linkInput, readyInput, go));
        linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        copy.addEventListener('click', async () => {
          if (!readyInput.value) { msg.className = 'cm-msg err'; msg.textContent = 'Спочатку натисніть «Створити з UTM».'; return; }
          try { await navigator.clipboard.writeText(readyInput.value); msg.className = 'cm-msg'; msg.textContent = 'Скопійовано. Вставте в публікацію.'; } catch { readyInput.select(); msg.textContent = 'Виділено: натисніть Ctrl+C.'; }
        });
        if (del) del.addEventListener('click', () => { list.splice(i, 1); drawRows(); });
        rowsBox.appendChild(h('div', { class: 'cm-lrow' }, linkInput, go, readyInput, copy, del));
      });
    }
    drawRows();
    const add = h('button', { type: 'button', class: 'cm-btn' }, '+ Додати посилання');
    add.addEventListener('click', () => { list.push({ link: '', ready: '' }); drawRows(); const inputs = rowsBox.querySelectorAll('.cm-lrow input'); const last = inputs[inputs.length - 2]; if (last) last.focus(); });
    box.appendChild(rowsBox);
    box.appendChild(h('div', { class: 'cm-actions' }, add, msg));
    if (isKyivstar(r)) box.appendChild(h('p', { class: 'cm-tip' }, h('b', null, 'Розсилка через Київстар? '), 'Він скорочує посилання, але UTM не додає й не видаляє. Тому в Київстар вставляйте довге посилання «Готово з UTM»: після скорочення мітки збережуться. Надішліть пробне повідомлення собі, натисніть на посилання й перевірте, що в адресному рядку є «utm_campaign».'));
    // the links were sent but nothing came with the tag: say so plainly
    const x = r.results;
    if (r.done && hasUtm && x && x.method === 'utm' && x.sessions === 0 && r.date < plan.today) box.appendChild(h('p', { class: 'cm-warnbox' }, 'Візитів із цією міткою поки немає. Дані Google Analytics приходять із затримкою до доби. Якщо через день нічого немає, перевірте, що в публікацію потрапили посилання саме з UTM.'));
    return box;
  }

  // step 2: one button
  function stepPublished(r) {
    const box = h('section', { class: 'cm-step' }, stepHead(2, 'Публікація вийшла', r.done, 'позначено як опубліковане'));
    const msg = h('span', { class: 'cm-msg', role: 'status' });
    if (r.done) {
      const undo = h('button', { type: 'button', class: 'cm-btn small' }, 'Зняти позначку (ще не вийшло)');
      undo.addEventListener('click', () => saveFields(r, { done: false }, msg, 'Позначку знято.'));
      box.appendChild(h('div', { class: 'cm-actions' }, undo, msg));
    } else {
      if (r.telegram) {
        const ok = h('button', { type: 'button', class: 'cm-btn primary' }, 'Так, вийшла: позначити');
        ok.addEventListener('click', () => saveFields(r, { done: true, ...(r.postUrl ? {} : { postUrl: r.telegram.url }) }, msg, 'Позначено як опубліковане, посилання на пост записано.'));
        box.appendChild(h('div', { class: 'cm-tip ok' }, h('b', null, 'Схоже, публікація вже вийшла в каналі '), `${tgWhen(r)}: `, h('a', { href: r.telegram.url, target: '_blank', rel: 'noopener' }, 'відкрити пост'), '. ', ok));
      }
      box.appendChild(h('p', { class: 'cm-sd' }, 'Коли публікація або розсилка справді вийшла, натисніть кнопку.'));
      const go = h('button', { type: 'button', class: 'cm-btn primary big' }, 'Позначити: публікація вийшла');
      go.addEventListener('click', () => saveFields(r, { done: true }, msg, 'Позначено як опубліковане.'));
      box.appendChild(h('div', { class: 'cm-actions' }, go, msg));
    }
    return box;
  }

  // step 3: a verdict and one sentence why; numbers and the rest are optional
  function stepResult(r) {
    const a = r.auto;
    const box = h('section', { class: `cm-step${r.done ? '' : ' off'}` }, stepHead(3, 'Результат', r.resultKnown, r.result.rating ? `оцінка: ${r.result.rating}` : r.hasResult ? 'внесено' : `оцінка системи: ${a ? a.rating : ''}`));
    if (!r.done) { box.appendChild(h('p', { class: 'cm-sd' }, 'Результат вносять після публікації. Спочатку виконайте крок 2.')); return box; }
    box.appendChild(h('p', { class: 'cm-sd' }, a && !r.hasResult ? 'Оцінку й пояснення вже підставлено за цифрами. Якщо згодні, натисніть «Зберегти результат». Якщо ні, змініть.' : 'Через день-два після публікації оцініть, як вона спрацювала, і напишіть одне-два речення чому.'));
    let rating = r.result.rating || '';
    let autoUsed = false;
    if (a && !rating) { autoUsed = true; rating = a.rating; }
    const ratingBox = h('div', { class: 'cm-rating', role: 'group', 'aria-label': 'Оцінка' });
    const drawRating = () => {
      clear(ratingBox);
      for (const value of RATINGS) {
        const b = h('button', { type: 'button', class: `cm-rb ${RATE_CLASS[value]}`, 'aria-pressed': String(rating === value) }, value);
        b.addEventListener('click', () => { rating = value; drawRating(); });
        ratingBox.appendChild(b);
      }
    };
    drawRating();
    const why = area(r.result.conclusion || (autoUsed ? a.conclusion : ''), 3);
    // numbers nobody typed come from the sources: views and reactions of the post, visits by the tag (Google Analytics), orders by the codes (BAS)
    const pick = (own, auto) => (own !== null && own !== undefined ? own : auto);
    const fromTg = r.telegram ? { reach: r.telegram.reach, reactions: r.telegram.reactions } : {};
    const fromGa = r.results && r.results.method !== 'none' && r.results.sessions !== undefined ? r.results.sessions : null;
    const autoFilled = [r.result.reach === null && fromTg.reach !== undefined, r.result.reactions === null && fromTg.reactions !== undefined, r.result.clicks === null && fromGa !== null].some(Boolean);
    const f = { reach: numInput(pick(r.result.reach, fromTg.reach)), clicks: numInput(pick(r.result.clicks, fromGa)), reactions: numInput(pick(r.result.reactions, fromTg.reactions)), promoOrders: numInput(r.result.promoOrders !== null ? r.result.promoOrders : r.promo ? r.promo.orders : null), next: area(r.result.next, 2), postUrl: textInput(r.postUrl || (r.telegram ? r.telegram.url : ''), { placeholder: 'https://t.me/…', maxlength: 500 }), owner: textInput(r.ownerIsDefault ? '' : r.owner, { list: 'cm-people', placeholder: r.owner, maxlength: 200 }) };
    const msg = h('span', { class: 'cm-msg', role: 'status' });
    const save = h('button', { type: 'button', class: 'cm-btn primary big' }, 'Зберегти результат');
    save.addEventListener('click', async () => {
      if (!rating) { msg.className = 'cm-msg err'; msg.textContent = 'Оберіть оцінку: успішна, посередня чи неуспішна.'; return; }
      if (!why.value.trim()) { msg.className = 'cm-msg err'; msg.textContent = 'Напишіть одне-два речення: чому така оцінка.'; return; }
      if (a && rating !== a.rating && why.value.trim() === a.conclusion) { msg.className = 'cm-msg err'; msg.textContent = 'Ваша оцінка інша, ніж у системи. Змініть пояснення: чому ви так вважаєте.'; return; }
      const val = (el) => (el.value === '' ? null : Number(el.value));
      const patch = { rating, conclusion: why.value.trim() };
      for (const k of ['reach', 'clicks', 'reactions', 'promoOrders']) { const v = val(f[k]); if (v !== r.result[k]) patch[k] = v; }
      if (f.next.value.trim() !== (r.result.next || '')) patch.next = f.next.value.trim();
      if (f.postUrl.value.trim() !== (r.postUrl || '')) patch.postUrl = f.postUrl.value.trim();
      if (f.owner.value.trim() && f.owner.value.trim() !== r.owner) patch.owner = f.owner.value.trim();
      save.disabled = true;
      if (!(await saveFields(r, patch, msg, 'Результат збережено.'))) save.disabled = false;
    });
    box.appendChild(h('div', { class: 'cm-f' }, h('span', { class: 'cm-fl' }, 'Оцінка'), ratingBox));
    box.appendChild(field('Чому така оцінка', why, autoUsed ? `Підставлено системою за цифрами${a.provisional ? ' (попередньо: перегляди й візити ще набираються)' : ''}. Змініть, якщо не згодні.` : 'Наприклад: «Багато переходів, але мало замовлень» або «Не зацікавило, замало реакцій»'));
    box.appendChild(h('details', { class: 'cm-adv', open: autoFilled || r.promo ? true : undefined }, h('summary', null, 'Цифри: охоплення, переходи, реакції, замовлення; посилання, відповідальний'),
      autoFilled ? h('p', { class: 'cm-sd' }, 'Цифри підставлено самі: перегляди й реакції з Telegram, переходи з Google Analytics за міткою. Їх можна виправити. Збережуться разом із результатом.') : null,
      h('div', { class: 'cm-cols' }, field('Охоплення / перегляди', f.reach, r.result.reach === null && fromTg.reach !== undefined ? 'з Telegram' : null), field('Переходи на сайт', f.clicks, r.result.clicks === null && fromGa !== null ? 'з Google Analytics' : null), field('Реакції / відкриття', f.reactions, r.result.reactions === null && fromTg.reactions !== undefined ? 'з Telegram' : null), field('Замовлень за промокодом', f.promoOrders, r.promo ? 'підставлено з BAS за кодами цієї акції' : null),
        field('Що робити далі', f.next, null, 'span4'), field('Посилання на публікацію', f.postUrl, null, 'span2'), field('Відповідальний', f.owner, null, 'span2'))));
    box.appendChild(h('div', { class: 'cm-actions' }, save, msg));
    return box;
  }

  // the card opens in place: what it is for on the left, three steps on the right
  const editing = new Set();
  function redrawCard(r) { const old = [...page.querySelectorAll('.cm-row')].find((x) => x.dataset.id === r.id); if (old) old.replaceWith(rowCard(r)); }
  function detailPanel(r) {
    if (editing.has(r.id)) return h('div', { class: 'cm-detail one' }, h('div', { class: 'cm-form' }, h('h4', null, 'Редагування опису активності'), descEditor(r, () => { editing.delete(r.id); redrawCard(r); })));
    const info = [['Навіщо зараз', r.why], ['Основне повідомлення', r.message], ['План дій', r.plan], ['Формат', r.format], ['Продукт / фокус', r.product]].filter(([, v]) => v);
    const editBtn = h('button', { type: 'button', class: 'cm-btn small cm-editbtn' }, '✎ Редагувати опис');
    editBtn.addEventListener('click', () => { editing.add(r.id); redrawCard(r); });
    const msg = h('span', { class: 'cm-msg', role: 'status' });
    const archive = isAdmin ? h('button', { type: 'button', class: 'cm-btn danger' }, 'Прибрати з плану (лише адміністратор)') : null;
    if (archive) archive.addEventListener('click', async () => {
      if (!window.confirm(`Прибрати активність «${r.title}» із плану? Її можна буде відновити в Notion.`)) return;
      try { await apiCall(`/comms/activities/${r.id}`, { method: 'DELETE' }); open.delete(r.id); await refreshPlan(); status('Активність прибрано в архів.'); } catch (err) { msg.className = 'cm-msg err'; msg.textContent = err.message || 'Не вдалося.'; }
    });
    return h('div', { class: 'cm-detail' },
      h('div', { class: 'cm-info' },
        h('h4', null, 'Про активність'),
        info.length ? info.map(([l, v]) => h('div', { class: 'cm-ib' }, h('div', { class: 'cm-fl' }, l), h('p', null, v))) : h('p', { class: 'muted' }, 'Опис ще не заповнено. Натисніть «Редагувати опис» і додайте канал, формат, навіщо та повідомлення.'),
        editBtn,
        h('a', { class: 'cm-ext', href: r.url, target: '_blank', rel: 'noopener' }, 'Відкрити в Notion ↗'),
        r.updatedBy ? h('p', { class: 'cm-fh' }, `Востаннє змінено в SytBoard: ${r.updatedBy}${r.updatedAt ? `, ${fmt.time(r.updatedAt)}` : ''}`) : null),
      h('div', { class: 'cm-form' },
        h('p', { class: 'cm-how' }, 'Що робити з цією активністю: три кроки. Кожен зберігається сам, окремо шукати кнопку «Зберегти» не треба.'),
        stepLinks(r), stepPublished(r), stepResult(r),
        linksTable(r),
        archive ? h('div', { class: 'cm-actions' }, archive, msg) : null));
  }

  function telegramBlock(r) {
    const t = r.telegram;
    if (!t) return null;
    return h('div', { class: 'cm-tg' }, h('small', null, 'Telegram-канал: '), h('a', { href: t.url, target: '_blank', rel: 'noopener' }, `пост від ${tgWhen(r)}`), h('div', null, h('b', null, num(t.reach)), ' переглядів · ', h('b', null, num(t.reactions)), ` реакцій${t.final ? '' : ' · ще зростає'}`),
      t.campaigns.length ? h('small', null, `UTM у посиланнях: ${t.campaigns.join(', ')}`) : h('small', { class: 'cm-bad' }, 'У посиланнях поста немає UTM'));
  }
  // orders of the promo codes given to this activity (BAS)
  function promoBlock(r) {
    if (r.status !== 'done' || !r.promo) return null;
    return h('div', { class: 'cm-res' }, h('div', null, h('small', null, 'За промокодами (BAS): '), h('b', null, num(r.promo.orders)), ` ${r.promo.orders === 1 ? 'замовлення' : 'замовлень'}`, r.promo.revenue !== null && r.promo.revenue !== undefined ? [' на ', h('b', null, fmt.compact(r.promo.revenue)), ' грн без ПДВ'] : null), h('small', null, `кодів: ${num(r.promo.codes)}`));
  }
  const resultsColumn = (r) => h('div', { class: 'cm-right' }, verdictBlock(r), telegramBlock(r), resultsBlock(r), promoBlock(r));

  function rowCard(r) {
    const isOpen = open.has(r.id);
    const head = h('button', { type: 'button', class: 'cm-toggle', 'aria-expanded': String(isOpen), 'aria-label': `${r.title}: ${isOpen ? 'згорнути' : 'розкрити'}` }, h('span', { class: 'cm-chev', 'aria-hidden': 'true' }), r.title);
    const card = h('article', { class: `cm-row ${r.status}${isOpen ? ' open' : ''}`, 'data-id': r.id },
      h('div', { class: 'cm-date' }, dayLabel(r.date), h('small', null, `${weekday(r.date)}${r.dateEnd ? ` — ${dayLabel(r.dateEnd)}` : ''}`)),
      h('div', null,
        head,
        h('div', { class: 'cm-meta' },
          h('span', { class: `cm-st ${r.status}` }, r.status === 'done' ? '✓ Виконано' : r.status === 'overdue' ? '! Не виконано' : STATUS_TEXT[r.status]),
          r.type ? h('span', { class: 'cm-tag' }, r.type) : null,
          (r.channels.length ? r.channels : [r.channelRaw || 'канал не вказано']).map((c) => h('span', { class: 'cm-tag' }, c)),
          h('span', { class: 'cm-owner' }, r.owner),
          lacksUtm(r) ? h('span', { class: 'cm-miss', title: 'У плані немає значення utm_campaign. Без нього візити цієї публікації рахуються лише приблизно.' }, 'немає UTM') : null),
        r.format ? h('div', { class: 'cm-sub' }, r.format) : null,
        r.product ? h('div', { class: 'cm-prod' }, r.product) : null),
      resultsColumn(r),
      isOpen ? detailPanel(r) : null);
    head.addEventListener('click', () => {
      if (open.has(r.id)) open.delete(r.id); else open.add(r.id);
      const fresh = rowCard(r);
      card.replaceWith(fresh);
    });
    return card;
  }

  // ---- add an activity -------------------------------------------------------------------------------------
  function addPanel() {
    const box = h('div', { class: 'cm-add', hidden: true });
    const btn = h('button', { type: 'button', class: 'cm-btn primary' }, '＋ Додати активність');
    btn.addEventListener('click', async () => {
      box.hidden = !box.hidden;
      if (box.hidden || box.dataset.ready) return;
      box.dataset.ready = '1';
      let types = {};
      try { types = await apiCall('/comms/types'); } catch { /* the type list is optional */ }
      const f = {
        title: textInput('', { maxlength: 200, placeholder: 'Наприклад: Моддус Старт — пшениця та ячмінь' }),
        date: h('input', { type: 'date', value: plan.today }),
        type: h('select'), format: textInput('', { maxlength: 200 }), product: textInput('', { maxlength: 300 }),
        owner: textInput(plan.defaultOwner || '', { list: 'cm-people', maxlength: 200 }), utm: textInput('', { maxlength: 120 }),
        why: area('', 2), message: area('', 2), plan: area('', 2),
      };
      const picker = channelPicker('');
      types = await loadTypes();
      const fillTypes = () => { const list = types[f.date.value.slice(0, 4)] || []; clear(f.type); f.type.appendChild(h('option', { value: '' }, 'без типу')); for (const t of list) f.type.appendChild(h('option', { value: t }, t)); };
      f.date.addEventListener('change', fillTypes); fillTypes();
      const msg = h('span', { class: 'cm-msg', role: 'status' });
      const go = h('button', { type: 'button', class: 'cm-btn primary' }, 'Додати в план');
      go.addEventListener('click', async () => {
        const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
        body.channel = picker.input.value.trim();
        if (!body.title) { msg.className = 'cm-msg err'; msg.textContent = 'Впишіть тему.'; return; }
        if (!body.channel) { msg.className = 'cm-msg err'; msg.textContent = 'Оберіть канал: від нього залежить, чи потрібні UTM.'; return; }
        go.disabled = true; msg.className = 'cm-msg'; msg.textContent = 'Додаємо в Notion…';
        try { await apiCall('/comms/activities', { method: 'POST', body: JSON.stringify(body) }); box.hidden = true; delete box.dataset.ready; clear(box); await refreshPlan(); status('Активність додано в план.'); } catch (err) { go.disabled = false; msg.className = 'cm-msg err'; msg.textContent = err.message || 'Не вдалося додати.'; }
      });
      clear(box);
      box.appendChild(h('div', { class: 'cm-cols' }, field('Тема', f.title, null, 'span2'), field('Дата', f.date), field('Тип', f.type), picker.el, field('Формат', f.format, null, 'span2'), field('Продукт / фокус', f.product, null, 'span2'), field('Відповідальний', f.owner, null, 'span2'), field('UTM-кампанія', f.utm, null, 'span2')));
      box.appendChild(h('div', { class: 'cm-cols' }, field('Навіщо зараз', f.why, null, 'span2'), field('Основне повідомлення', f.message, null, 'span2'), field('План дій', f.plan, null, 'span4')));
      box.appendChild(h('div', { class: 'cm-actions' }, go, msg));
    });
    return h('div', null, btn, box);
  }

  function drawPlan() {
    clear(page);
    if (!plan) return;
    const t = plan.totals;
    const done = plan.rows.filter((r) => r.status === 'done' && r.results && r.results.method === 'channel');
    const lift = done.reduce((a, r) => a + (r.results.lift || 0), 0);
    if (plan.channel) {
      const c = plan.channel;
      const was = c.previous || {};
      const dv = (a, b) => (b ? ` (${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}%)` : '');
      page.appendChild(h('div', { class: 'cm-chan panel' },
        h('div', null, h('b', null, 'Telegram-канал '), h('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.channel), h('span', { class: 'cm-fh' }, ` · оновлюється кожні 3 години`)),
        h('div', { class: 'cm-chan-nums' },
          h('span', null, h('b', null, c.subscribers === null ? '—' : num(c.subscribers)), ' підписників', c.subscribersChange ? ` (${c.subscribersChange > 0 ? '+' : ''}${c.subscribersChange} за 30 днів)` : ''),
          h('span', null, h('b', null, num(c.posts)), ` постів за 30 днів${was.posts ? ` (було ${num(was.posts)})` : ''}`),
          h('span', null, h('b', null, num(c.avgViews)), ` середній перегляд${dv(c.avgViews, was.avgViews)}`),
          h('span', null, h('b', null, num(c.reactions)), ' реакцій')),
        c.best ? h('div', { class: 'cm-fh' }, 'Найкращий пост: ', h('a', { href: c.best.url, target: '_blank', rel: 'noopener' }, c.best.title || 'пост'), ` (${num(c.best.views)}). Найслабший: `, h('a', { href: c.weakest.url, target: '_blank', rel: 'noopener' }, c.weakest.title || 'пост'), ` (${num(c.weakest.views)}).`) : null));
    }
    if (plan.tracking) {
      const tk = plan.tracking;
      page.appendChild(h('div', { class: `cm-track panel ${tk.status}` }, h('b', null, 'Облік покупок на сайті: '), h('span', { class: `cm-trst ${tk.status}` }, tk.label), h('span', { class: 'cm-fh' }, ` ${tk.text}`)));
    }
    page.appendChild(h('div', { class: 'grid kpis' },
      kpi('Усього в плані', num(t.all), `2026 і 2027, оновлено ${fmt.time(plan.generatedAt)}`),
      kpi('Виконано', num(t.done), t.all ? `${fmt.pct(t.done / Math.max(1, t.done + t.overdue + t.today))} із тих, що вже мали вийти` : '', t.done ? 'good' : null),
      kpi('Виконано без результату', num(t.noResult), t.noResult ? 'вийшли в ефір, а результат не внесено. Натисніть, щоб показати' : 'у всіх виконаних є результат', t.noResult ? 'warn' : 'good', t.noResult ? () => { state.filter = 'noresult'; drawPlan(); } : null),
      t.tgToConfirm ? kpi('Знайдено в Telegram', num(t.tgToConfirm), 'пости вже вийшли, а в плані немає позначки «Виконано». Розкрийте активність і підтвердіть', 'warn') : null,
      kpi('Не виконано', num(t.overdue), t.overdue ? 'дата минула, галочки в Notion немає' : 'усе, що мало вийти, вийшло', t.overdue ? 'bad' : 'good'),
      kpi('Сьогодні', num(t.today), 'заплановано на сьогодні', t.today ? 'warn' : null),
      kpi('Попереду', num(t.planned), 'ще не настав час'),
      kpi('Без UTM-мітки', num(plan.rows.filter(lacksUtm).length), 'виконані й найближчі два тижні без «UTM-кампанія» в Notion', plan.rows.some(lacksUtm) ? 'warn' : 'good'),
      done.length ? kpi('Принесли понад звичайне', `${lift > 0 ? '+' : lift < 0 ? '−' : ''}${num(Math.abs(lift))}`, `візитів від ${done.length} виконаних публікацій`, lift > 0 ? 'good' : null) : null));

    // filters
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Які показати' });
    for (const [id, label] of FILTERS) {
      const b = h('button', { type: 'button', 'aria-pressed': String(state.filter === id) }, label);
      b.addEventListener('click', () => { state.filter = id; drawPlan(); });
      seg.appendChild(b);
    }
    const channels = [...new Set(plan.rows.flatMap((r) => r.channels))].sort();
    const types = [...new Set(plan.rows.map((r) => r.type).filter(Boolean))].sort();
    const sel = (value, options, label, onChange) => {
      const s = h('select', { 'aria-label': label }, h('option', { value: '' }, label), options.map((o) => h('option', { value: o, selected: o === value }, o)));
      s.addEventListener('change', (e) => { onChange(e.target.value); drawPlan(); });
      return s;
    };
    const q = h('input', { type: 'search', placeholder: 'Пошук за темою…', value: state.q, 'aria-label': 'Пошук' });
    q.addEventListener('input', (e) => { state.q = e.target.value; drawList(); });
    page.appendChild(h('datalist', { id: 'cm-people' }, people.map((x) => h('option', { value: x }))));
    page.appendChild(h('div', { class: 'cm-bar' }, seg, sel(state.channel, channels, 'Усі канали', (v) => { state.channel = v; }), sel(state.type, types, 'Усі типи', (v) => { state.type = v; }), q));
    page.appendChild(addPanel());
    page.appendChild(h('p', { class: 'cm-note' }, 'План береться з Notion («Комунікації 2026» і «2027») і оновлюється сам: змінили в Notion — через пару хвилин це видно тут. Натисніть на активність, щоб розкрити її: там видно навіщо вона, а внести UTM, результат і галочку «Виконано» можна просто тут, у Notion заходити не потрібно. «Виконано» — це галочка в Notion, а не дата. Візити — з Google Analytics: рахуємо візити з каналів публікації в день виходу й два наступні та порівнюємо зі звичайним рівнем цього каналу.'));
    if (plan.visitsError) page.appendChild(h('p', { class: 'cm-note' }, `${plan.visitsError}: результатів публікацій зараз не видно.`));
    const listBox = h('div', { id: 'cm-list' });
    page.appendChild(listBox);

    function drawList() {
      clear(listBox);
      const needle = state.q.trim().toLowerCase();
      let rows = plan.rows.filter((r) => (!state.channel || r.channels.includes(state.channel)) && (!state.type || r.type === state.type) && (!needle || `${r.title} ${r.product || ''}`.toLowerCase().includes(needle)));
      if (state.filter === 'attention') rows = rows.filter((r) => r.status === 'overdue' || r.status === 'today' || (r.status === 'planned' && r.date <= fmt.addDays(plan.today, 14)));
      else if (state.filter === 'planned') rows = rows.filter((r) => r.status === 'planned' || r.status === 'today');
      else if (state.filter === 'done') rows = rows.filter((r) => r.status === 'done').reverse();
      else if (state.filter === 'noresult') rows = rows.filter((r) => r.status === 'done' && !r.resultKnown).reverse();
      if (!rows.length) { listBox.appendChild(empty(state.filter === 'noresult' ? 'Усі виконані активності мають результат.' : state.filter === 'attention' ? 'Нічого термінового: прострочених немає, найближчі два тижні порожні.' : 'За цими умовами нічого не знайдено.')); return; }
      let month = '';
      let list = null;
      for (const r of rows) {
        const m = monthTitle(r.date);
        if (m !== month) { month = m; listBox.appendChild(h('h2', { class: 'cm-month' }, m)); list = h('div', { class: 'cm-list' }); listBox.appendChild(list); }
        list.appendChild(rowCard(r));
      }
    }
    drawList();
  }

  // ---- promo codes ------------------------------------------------------------------------------
  const PROMO_RANGES = [['all', 'За весь час'], ['90', 'Останні 90 днів'], ['30', 'Останні 30 днів']];
  const KINDS = [['reusable', 'Акційні (багаторазові)'], ['single', 'Одноразові'], ['manager', 'Менеджерські'], ['none', 'Без акції'], ['all', 'Усі']];
  const KIND_TEXT = { reusable: 'акційний', single: 'одноразовий', manager: 'менеджерський' };
  const selected = new Set();

  async function applyAction(action) {
    if (!selected.size) return;
    try {
      await apiCall('/comms/promos/actions', { method: 'PUT', body: JSON.stringify({ codes: [...selected], action }) });
      selected.clear();
      await loadPromos();
      status(action ? `Акцію «${action}» призначено.` : 'Акцію знято.');
    } catch (err) { status('Не вдалося зберегти. Спробуйте ще раз.', true); }
  }

  function drawPromo() {
    clear(page);
    if (!promos) return;
    const t = promos.totals;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Період' });
    for (const [id, label] of PROMO_RANGES) {
      const b = h('button', { type: 'button', 'aria-pressed': String(state.promoRange === id) }, label);
      b.addEventListener('click', async () => { state.promoRange = id; await loadPromos(); });
      seg.appendChild(b);
    }
    page.appendChild(h('div', { class: 'cm-bar' }, seg));
    page.appendChild(h('div', { class: 'grid kpis' },
      kpi('Акційні коди', `${num(t.reusable.codes)} кодів`, `${num(t.reusable.orders)} замовлень на ${fmt.compact(t.reusable.revenue)} грн`, t.reusable.codes ? 'good' : null),
      kpi('Одноразові коди', `${num(t.single.codes)} кодів`, `${num(t.single.orders)} замовлень на ${fmt.compact(t.single.revenue)} грн`),
      kpi('Менеджерські коди', `${num(t.manager.codes)} кодів`, `${num(t.manager.orders)} замовлень на ${fmt.compact(t.manager.revenue)} грн`),
      kpi('Усі замовлення за період', num(t.orders), `${fmt.compact(t.revenue)} грн без ПДВ`)));

    // what each promotion brought
    const acts = promos.byAction || [];
    page.appendChild(h('h2', { class: 'cm-month', style: { textTransform: 'none' } }, 'Результати акцій'));
    if (acts.length) {
      const maxA = Math.max(1, ...acts.map((a) => a.revenue));
      page.appendChild(panel(h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Акція', 'Кодів', 'Замовлень', 'Виручка, грн', 'Середній чек, грн', 'Частка виручки', 'Перше', 'Останнє'].map((x, i) => h('th', { class: i === 1 || i === 2 || i === 4 || i === 5 ? 'n' : '', scope: 'col' }, x)))),
        h('tbody', null, acts.map((a) => h('tr', null,
          h('td', null, h('b', null, a.action)),
          h('td', { class: 'n' }, num(a.codes)),
          h('td', { class: 'n' }, num(a.orders)),
          h('td', null, h('div', { class: 'meter' }, h('div', { class: 'track' }, h('b', { style: { width: `${(a.revenue / maxA) * 100}%` } })), h('span', null, num(a.revenue)))),
          h('td', { class: 'n' }, num(a.aov)),
          h('td', { class: 'n' }, fmt.pct(a.share, a.share < 0.1 ? 1 : 0)),
          h('td', null, a.first || '—'),
          h('td', null, a.last || '—'))))))));
    } else page.appendChild(h('p', { class: 'cm-note' }, 'Поки жодному коду не призначено акцію. Позначте коди в таблиці нижче галочками, впишіть назву акції й натисніть «Призначити». Тут з’являться загальні результати кожної акції.'));

    page.appendChild(h('h2', { class: 'cm-month', style: { textTransform: 'none' } }, 'Коди'));
    const kindSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Які коди' });
    for (const [id, label] of KINDS) {
      const b = h('button', { type: 'button', 'aria-pressed': String(state.promoKind === id) }, label);
      b.addEventListener('click', () => { state.promoKind = id; drawPromo(); });
      kindSeg.appendChild(b);
    }
    const q = h('input', { type: 'search', placeholder: 'Знайти код…', value: state.promoQ, 'aria-label': 'Пошук коду' });
    q.addEventListener('input', (e) => { state.promoQ = e.target.value; drawTable(); });
    page.appendChild(h('div', { class: 'cm-bar' }, kindSeg, q));
    page.appendChild(h('p', { class: 'cm-note' }, 'Промокод береться із замовлення в BAS. Акційний код — той, що використали більше ніж в одному замовленні. Одноразовий — код на одне замовлення, зазвичай персональний. Менеджерські — з вашого списку менеджерських кодів. Суми без ПДВ, скасовані замовлення не враховані.'));

    // pick codes, name a promotion, apply
    const list = h('datalist', { id: 'cm-actions' }, [...new Set([...(promos.suggestions || []), ...acts.map((a) => a.action)])].map((x) => h('option', { value: x })));
    const nameIn = h('input', { type: 'text', list: 'cm-actions', placeholder: 'Назва акції, наприклад: Чорна п’ятниця 2026', maxlength: 160, 'aria-label': 'Назва акції', style: { minWidth: '280px' } });
    const count = h('span', { class: 'muted' });
    const giveBtn = h('button', { type: 'button', class: 'cm-btn primary' }, 'Призначити вибраним');
    const clearBtn = h('button', { type: 'button', class: 'cm-btn' }, 'Зняти акцію');
    const allBtn = h('button', { type: 'button', class: 'cm-btn' }, 'Вибрати всі показані');
    const noneBtn = h('button', { type: 'button', class: 'cm-btn' }, 'Скинути вибір');
    giveBtn.addEventListener('click', () => { const v = nameIn.value.trim(); if (!v) { status('Впишіть назву акції.', true); return; } applyAction(v); });
    clearBtn.addEventListener('click', () => applyAction(''));
    page.appendChild(h('div', { class: 'cm-bar cm-pick' }, list, count, nameIn, giveBtn, clearBtn, allBtn, noneBtn));
    const box = h('div');
    page.appendChild(panel(box));
    const shownRows = () => {
      const needle = state.promoQ.trim().toLowerCase();
      return promos.rows.filter((r) => (state.promoKind === 'all' || (state.promoKind === 'none' ? !r.action : r.kind === state.promoKind)) && (!needle || r.code.toLowerCase().includes(needle) || (r.action || '').toLowerCase().includes(needle)));
    };
    const refreshCount = () => { count.textContent = selected.size ? `Вибрано кодів: ${selected.size}` : 'Позначте коди галочками'; giveBtn.disabled = clearBtn.disabled = noneBtn.disabled = !selected.size; };
    allBtn.addEventListener('click', () => { for (const r of shownRows().slice(0, 200)) selected.add(r.code); drawTable(); });
    noneBtn.addEventListener('click', () => { selected.clear(); drawTable(); });

    function drawTable() {
      clear(box);
      refreshCount();
      const rows = shownRows();
      if (!rows.length) { box.appendChild(empty('За цими умовами кодів немає.')); return; }
      const max = Math.max(1, ...rows.map((r) => r.revenue));
      const cols = [['', ''], ['Код', ''], ['Акція', ''], ['Тип', ''], ['Замовлень', 'n'], ['Виручка, грн', ''], ['Середній чек, грн', 'n'], ['Частка виручки', 'n'], ['Перше', ''], ['Останнє', '']];
      const shown = rows.slice(0, 200);
      box.appendChild(h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, cols.map(([x, c]) => h('th', { class: c, scope: 'col' }, x)))),
        h('tbody', null, shown.map((r) => {
          const cb = h('input', { type: 'checkbox', 'aria-label': `Вибрати код ${r.code}`, checked: selected.has(r.code) });
          cb.addEventListener('change', () => { if (cb.checked) selected.add(r.code); else selected.delete(r.code); refreshCount(); });
          return h('tr', null,
            h('td', null, cb),
            h('td', { class: 'code' }, r.code),
            h('td', null, r.action ? h('span', { class: 'cm-act' }, r.action) : h('span', { class: 'muted' }, '—')),
            h('td', null, h('span', { class: `cm-kind ${r.kind}` }, KIND_TEXT[r.kind])),
            h('td', { class: 'n' }, num(r.orders)),
            h('td', null, h('div', { class: 'meter' }, h('div', { class: 'track' }, h('b', { style: { width: `${(r.revenue / max) * 100}%` } })), h('span', null, num(r.revenue)))),
            h('td', { class: 'n' }, num(r.aov)),
            h('td', { class: 'n' }, fmt.pct(r.share, r.share < 0.1 ? 1 : 0)),
            h('td', null, r.first || '—'),
            h('td', null, r.last || '—'));
        })))));
      if (rows.length > shown.length) box.appendChild(h('p', { class: 'note' }, `Показано перші ${shown.length} із ${num(rows.length)}. Звузьте пошук, щоб побачити решту.`));
    }
    drawTable();
  }

  // ---- load -------------------------------------------------------------------------------------
  function drawTabs() {
    const nav = $('tabs');
    clear(nav);
    for (const [id, label] of TABS) {
      const b = h('button', { type: 'button', class: 'tabbtn', role: 'tab', 'aria-selected': String(id === state.tab) }, label);
      b.addEventListener('click', async () => {
        if (id === state.tab) return;
        state.tab = id;
        const u = new URL(location.href); u.searchParams.set('tab', id); history.replaceState(null, '', u);
        drawTabs();
        await show();
      });
      nav.appendChild(b);
    }
  }
  const rangeQuery = () => {
    if (state.promoRange === 'all') return '';
    const to = fmt.todayKyiv();
    return `?from=${fmt.addDays(to, -(Number(state.promoRange) - 1))}&to=${to}`;
  };
  async function loadPromos(force) {
    page.setAttribute('aria-busy', 'true');
    status('');
    try {
      const q = rangeQuery();
      promos = await apiCall(`/comms/promos${q}${force ? `${q ? '&' : '?'}refresh=1` : ''}`);
      drawPromo();
    } catch (err) { status('Не вдалося прочитати промокоди. Спробуйте ще раз за хвилину.', true); }
    page.setAttribute('aria-busy', 'false');
  }
  async function loadPlan(force) {
    page.setAttribute('aria-busy', 'true');
    status('');
    const loader = Loading.show(page, { title: 'План комунікацій завантажується…', text: 'Читаємо план із Notion і візити з Google Analytics.', sources: ['Notion — план', 'Google Analytics — візити'], skeleton: 3 });
    try {
      plan = await apiCall(`/comms${force ? '?refresh=1' : ''}`);
      loader.stop();
      drawPlan();
    } catch (err) {
      loader.stop();
      clear(page);
      if (err.status === 401) { window.location.href = 'login.html'; return; }
      status(err.message && /Notion|плану/.test(err.message) ? err.message : 'Не вдалося прочитати план. Спробуйте ще раз за хвилину.', true);
    }
    page.setAttribute('aria-busy', 'false');
  }
  async function show(force) {
    if (state.tab === 'promo') await loadPromos(force);
    else if (plan && !force) drawPlan();
    else await loadPlan(force);
  }
  $('refresh').addEventListener('click', () => show(true));
  drawTabs();
  show();
})();
