// «Нормально чи ні?» — rules of thumb for digital metrics, shown as a small tag next to a number. They are general
// industry guides, NOT numbers measured for Ukrainian agro retail: they say whether a figure looks ordinary,
// low or good, never that it is right or wrong. Every rule is also listed in plain words under the report
// (Bench.NORMS), so nobody has to trust a tag blindly. No numbers are guessed when the input is missing.
(function () {
  const LEVEL = { low: { tone: 'bad', text: 'Низько' }, ok: { tone: '', text: 'Нормально' }, good: { tone: 'good', text: 'Добре' }, high: { tone: 'bad', text: 'Високо' }, note: { tone: 'warn', text: 'Помітно' } };
  const mk = (level, hint) => ({ ...LEVEL[level], level, hint });
  const NOT = (v) => v === null || v === undefined || Number.isNaN(v);

  const BRAND_RE = /бренд|brand/i;
  const SEARCH_ONLY = (channels) => channels.length > 0 && channels.every((c) => c === 'SEARCH');

  // Share of people who clicked, by what kind of campaign it is.
  function ctr(value, channel, name) {
    if (NOT(value)) return null;
    if (channel === 'SEARCH' && BRAND_RE.test(name || '')) {
      return mk(value < 0.08 ? 'low' : value >= 0.25 ? 'good' : 'ok', 'Брендова реклама в пошуку (люди й так шукають препарат): зазвичай 8–25% і більше.');
    }
    if (channel === 'SEARCH') {
      return mk(value < 0.02 ? 'low' : value >= 0.05 ? 'good' : 'ok', 'Реклама в пошуку Google: зазвичай 2–5%, понад 5% — добре.');
    }
    if (channel) {
      return mk(value < 0.003 ? 'low' : value >= 0.01 ? 'good' : 'ok', 'Реклама не в пошуку (автоматична, відео, банери): зазвичай 0,3–1%, понад 1% — добре.');
    }
    return null;
  }

  // Whole-account CTR only means something when every campaign is of one kind.
  function ctrTotal(value, channels) {
    return SEARCH_ONLY(channels) ? ctr(value, 'SEARCH', '') : null;
  }

  // «Не пішли одразу» (GA4 engagement rate).
  function engaged(value) {
    if (NOT(value)) return null;
    return mk(value < 0.4 ? 'low' : value >= 0.6 ? 'good' : 'ok', 'Для інтернет-магазинів зазвичай 50–60% візитів. Нижче 40% — багато людей одразу йдуть.');
  }

  // Orders per 1000 visits.
  function ordersPer1000(value) {
    if (NOT(value)) return null;
    return mk(value < 5 ? 'low' : value >= 10 ? 'good' : 'ok', 'Звичайні інтернет-магазини отримують 10–30 замовлень на 1000 візитів (1–3%). У вас частина продажів іде через менеджерів, тому цифра занижена.');
  }

  // Average position in Google search (Search Console): 1 = the very top.
  function position(value) {
    if (NOT(value) || !value) return null;
    return mk(value <= 10 ? 'good' : value <= 20 ? 'ok' : 'low', 'До 10 — перша сторінка Google, 10–20 — друга, далі людей майже не буває.');
  }

  // Google Ads: share of clicks that became a goal (purchase or request, as Google counts it).
  function goalRate(value, clicks) {
    if (NOT(value) || !clicks || clicks < 100) return null; // too few clicks to judge
    return mk(value < 0.01 ? 'low' : value >= 0.05 ? 'good' : 'ok', 'Зазвичай 1–5% кліків закінчуються ціллю. Цілі рахує Google, тож це орієнтир.');
  }

  // Ad spend as a share of BAS revenue.
  function adShare(value) {
    if (NOT(value)) return null;
    return mk(value <= 0.1 ? 'ok' : value <= 0.25 ? 'note' : 'high', 'Для магазину на рекламу зазвичай іде 5–15% виручки. Це лише орієнтир: BAS не знає, звідки замовлення.');
  }

  // The same rules in words, for the «Що вважати нормальним» block under the page.
  const NORMS = [
    ['Частка кліків у пошуку Google', 'Зазвичай 2–5%, понад 5% — добре. Брендова реклама (за назвою препарату): 8–25% і більше.'],
    ['Частка кліків не в пошуку', 'Автоматичні кампанії, відео, банери: зазвичай 0,3–1%, понад 1% — добре.'],
    ['Не пішли одразу', 'Інтернет-магазини: 50–60% візитів. Нижче 40% — мало.'],
    ['Замовлень на 1000 візитів', 'Звичайний магазин: 10–30. У нас частина продажів іде через менеджерів, тому менше.'],
    ['Позиція в пошуку Google', 'До 10 — перша сторінка, 10–20 — друга, понад 20 — майже ніхто не дійде.'],
    ['Скільки кліків дали ціль', '1–5% кліків. Рахуємо лише від 100 кліків.'],
    ['Реклама від виручки BAS', '5–15% — звично. 10–25% — помітно. Понад 25% — високо.'],
  ];

  window.Bench = { ctr, ctrTotal, engaged, ordersPer1000, position, goalRate, adShare, NORMS };
})();
