const NF0 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 });

const fmt = {
  int: (n) => NF0.format(Math.round(n || 0)),
  dec1: (n) => NF1.format(n || 0),
  // Compact for tiles: 1 284 · 12,9 тис. · 4,2 млн
  compact(n) {
    const v = Math.abs(n || 0);
    if (v >= 1e6) return `${NF1.format(n / 1e6)} млн`;
    if (v >= 1e4) return `${NF1.format(n / 1e3)} тис.`;
    return NF0.format(Math.round(n || 0));
  },
  money: (n) => `${fmt.compact(n)} грн`,
  moneyFull: (n) => `${NF0.format(Math.round(n || 0))} грн`,
  pct: (r, d = 0) => `${(r * 100).toFixed(d).replace('.', ',')}%`,
  duration(sec) {
    const s = Math.round(sec || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  // Relative change. Huge jumps read better as a multiplier than as "+2935%".
  delta(d) {
    if (d === null || d === undefined) return 'нове';
    if (d >= 5) return `×${NF1.format(d + 1)}`;
    const p = Math.round(d * 100);
    return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
  },
  // Change of a rate, in percentage points.
  pp(d) {
    const v = Math.round(d * 1000) / 10;
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toString().replace('.', ',')} п.п.`;
  },
  dayMonth(iso) {
    const [, m, d] = iso.split('-');
    return `${d}.${m}`;
  },
  dateFull(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  },
  time(iso) {
    return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(iso));
  },
  todayKyiv: () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date()),
  addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  },
  // Google Analytics channel groups in plain Ukrainian (the English names stay only as a fallback for new ones).
  channel(name) {
    const M = { 'Organic Search': 'Пошук Google без реклами', Direct: 'Напряму (ввели адресу, закладка)', 'Paid Search': 'Реклама в пошуку', 'Cross-network': 'Реклама Google (автоматична)', 'Paid Other': 'Інша реклама', 'Paid Video': 'Реклама у відео', Display: 'Банери', 'Paid Social': 'Реклама в соцмережах', 'Organic Social': 'Соцмережі', Referral: 'Посилання з інших сайтів', Email: 'Розсилки', SMS: 'SMS', 'Organic Video': 'Відео (YouTube)', 'Organic Shopping': 'Google Покупки', 'Paid Shopping': 'Реклама в Google Покупках', Unassigned: 'Не визначено', '(other)': 'Інше', Інші: 'Інші' };
    return M[name] || name;
  },
  // A traffic source as people say it: «(direct)» means typed in or a bookmark.
  source(s) {
    if (!s || s === '(direct)') return 'напряму';
    if (s === '(not set)') return 'не визначено';
    return s;
  },
  // Axis label of a month: «лис 25» — short enough for every month of a year to get its own label.
  monthAxis(ym) {
    const M = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    return `${M[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
  },
  monthLong(ym) {
    const M = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
    return `${M[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  },
  monthShort(ym) {
    const M = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    return `${M[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  },
  // "120249630951140328" → "…0328" so numeric ad-platform ids stay scannable.
  shortId(s) {
    return /^\d{10,}$/.test(s) ? `кампанія …${s.slice(-4)}` : s;
  },
};
