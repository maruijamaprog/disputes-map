// Даты в данных: null | год (число) | 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'.
// Внутри сравниваем целые yyyymmdd. Начало интервала включительно, конец — включительно
// (год без даты в поле «по» означает «в течение этого года»).

export function dStart(v) {
  if (v === null || v === undefined) return -Infinity;
  const s = String(v);
  const [y, m = '01', d = '01'] = s.split('-');
  return +y * 10000 + +m * 100 + +d;
}

export function dEnd(v) {
  if (v === null || v === undefined) return Infinity;
  const s = String(v);
  const [y, m, d] = s.split('-');
  if (!m) return +y * 10000 + 1231;
  if (!d) return +y * 10000 + +m * 100 + 31;
  return +y * 10000 + +m * 100 + +d;
}

export function todayInt() {
  const t = new Date();
  return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
}

/** Дата среза для года: 31 декабря, для текущего года — сегодня. */
export function refDate(year) {
  const today = todayInt();
  return Math.min(year * 10000 + 1231, today);
}

export function activeAt(item, ref) {
  return dStart(item.from) <= ref && ref <= dEnd(item.to);
}

export function overlapsYear(item, year) {
  return dStart(item.from) <= year * 10000 + 1231 && dEnd(item.to) >= year * 10000 + 101;
}

export function formatRef(ref, lang) {
  const y = Math.floor(ref / 10000), m = Math.floor(ref / 100) % 100, d = ref % 100;
  return lang === 'ru' ? `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}` : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatDate(v, lang) {
  if (v === null || v === undefined) return lang === 'ru' ? 'н. в.' : 'present';
  const s = String(v);
  const [y, m, d] = s.split('-');
  if (!m) return y;
  if (!d) return lang === 'ru' ? `${m}.${y}` : `${y}-${m}`;
  return lang === 'ru' ? `${d}.${m}.${y}` : s;
}

export function yearOf(v) {
  if (v === null || v === undefined) return null;
  return +String(v).slice(0, 4);
}
