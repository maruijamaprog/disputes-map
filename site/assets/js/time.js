// Даты в данных: null | год (число) | 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | yyyymmdd (число > 9999).
// Внутри сравниваем целые yyyymmdd. Начало интервала включительно, конец — включительно
// (год без месяца в поле «по» означает «до конца этого года», месяц без дня — «до конца месяца»).
// Шкала времени работает по месяцам: срез — последний день месяца (для текущего месяца — сегодня).

export const MIN_YEAR = 1900;

export function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

export function dStart(v) {
  if (v === null || v === undefined) return -Infinity;
  if (typeof v === 'number' && v > 9999) return v;
  const [y, m = '01', d = '01'] = String(v).split('-');
  return +y * 10000 + +m * 100 + +d;
}

export function dEnd(v) {
  if (v === null || v === undefined) return Infinity;
  if (typeof v === 'number' && v > 9999) return v;
  const [y, m, d] = String(v).split('-');
  if (!m) return +y * 10000 + 1231;
  if (!d) return +y * 10000 + +m * 100 + lastDay(+y, +m);
  return +y * 10000 + +m * 100 + +d;
}

export function todayInt() {
  const t = new Date();
  return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
}

export function nowMonth() {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1 };
}

export const monthIndex = (y, m) => (y - MIN_YEAR) * 12 + (m - 1);
export const fromIndex = (i) => ({ y: MIN_YEAR + Math.floor(i / 12), m: (i % 12) + 1 });

/** Период «месяц»: границы и дата среза. */
export function period(y, m) {
  const from = y * 10000 + m * 100 + 1;
  const to = y * 10000 + m * 100 + lastDay(y, m);
  return { y, m, from, to, ref: Math.min(to, todayInt()), idx: monthIndex(y, m) };
}

export function activeAt(item, ref) {
  return dStart(item.from) <= ref && ref <= dEnd(item.to);
}

export function overlaps(item, T) {
  return dStart(item.from) <= T.to && dEnd(item.to) >= T.from;
}

const MONTHS = {
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  ruGen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export const monthNames = (lang) => (lang === 'ru' ? MONTHS.ru : MONTHS.en);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Октябрь 1938» / «October 1938». */
export function formatMonth(T, lang) {
  return `${cap(monthNames(lang)[T.m - 1])} ${T.y}`;
}

/** Дата из данных для людей: «18 марта 2014», «март 2014», «2014». */
export function formatDate(v, lang) {
  if (v === null || v === undefined) return lang === 'ru' ? 'н. в.' : 'present';
  let s = String(v);
  if (typeof v === 'number' && v > 9999) s = `${Math.floor(v / 10000)}-${String(Math.floor(v / 100) % 100).padStart(2, '0')}-${String(v % 100).padStart(2, '0')}`;
  const [y, m, d] = s.split('-');
  if (!m) return y;
  if (!d) return lang === 'ru' ? `${MONTHS.ru[+m - 1]} ${y}` : `${MONTHS.en[+m - 1]} ${y}`;
  return lang === 'ru' ? `${+d} ${MONTHS.ruGen[+m - 1]} ${y}` : `${+d} ${MONTHS.en[+m - 1]} ${y}`;
}

export function formatRange(a, b, lang) {
  const end = b === null || b === undefined ? (lang === 'ru' ? 'н. в.' : 'present') : formatDate(b, lang);
  return `${a === null || a === undefined ? '…' : formatDate(a, lang)} — ${end}`;
}

export function yearOf(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && v > 9999) return Math.floor(v / 10000);
  return +String(v).slice(0, 4);
}

/** Индекс месяца для даты из данных (год без месяца → январь для начала, декабрь для конца). */
export function monthOf(v, isEnd = false) {
  if (v === null || v === undefined) return null;
  const n = isEnd ? dEnd(v) : dStart(v);
  if (!Number.isFinite(n)) return null;
  return monthIndex(Math.floor(n / 10000), Math.floor(n / 100) % 100);
}
