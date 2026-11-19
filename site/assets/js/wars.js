// Режим «Военные конфликты»: данные site/data/wars.json (UCDP/PRIO 1946–2025, COW 1900–1945,
// ручные записи 2026 г. с источниками). Участие стороны — интервалы [gw, сторона, роль, с, по, интенсивность, имя].
//   сторона: 0 — A, 1 — B; роль: 1 — основная сторона, 2 — участвует войсками на стороне основной;
//   интенсивность: 2 — война (≥1000 погибших в бою за год), 1 — вооружённый конфликт (25–999).
//   gw = 0 — негосударственная сторона (имя в 7-м поле).

let data = null;
let loading = null;

export function loadWars() {
  if (data) return Promise.resolve(data);
  if (!loading) {
    loading = fetch('data/wars.json').then((r) => {
      if (!r.ok) throw new Error(`wars.json: ${r.status}`);
      return r.json();
    }).then((j) => {
      for (const c of j.conflicts) c.parts = c.parts.map(([g, side, role, from, to, int, name, flag]) => ({ g, side, role, from, to, int, name: name || null, unverified: flag === 'u' }));
      data = j; return j;
    });
  }
  return loading;
}
export const warsLoaded = () => data;

const overlapsT = (p, T) => p.from <= T.to && p.to >= T.from;

/** Конфликты, активные в месяце T: [{c, parts}]. */
export function conflictsAt(T) {
  if (!data) return [];
  const out = [];
  for (const c of data.conflicts) {
    const parts = c.parts.filter((p) => overlapsT(p, T));
    if (parts.length) out.push({ c, parts });
  }
  return out;
}

function intensityOf(parts) { return Math.max(0, ...parts.map((p) => p.int || 0)); }

/** Участие государства (код GW) в конфликтах месяца T. */
export function involvement(gw, T) {
  const res = [];
  for (const { c, parts } of conflictsAt(T)) {
    const mine = parts.filter((p) => p.g === gw);
    if (!mine.length) continue;
    const side = mine[0].side;
    const role = Math.min(...mine.map((p) => p.role));
    const allies = parts.filter((p) => p.side === side && p.g !== gw);
    const foes = parts.filter((p) => p.side !== side);
    res.push({ c, side, role, allies, foes, int: intensityOf(parts), unverified: mine.every((p) => p.unverified) });
  }
  return res.sort((a, b) => b.int - a.int || a.role - b.role);
}

/** Коды узоров для карты: Map(gw → WM|Wm|WS|WX|WF|WL|WP). */
export function warRoleMap(T, selectedGw) {
  const out = new Map();
  const act = conflictsAt(T);
  const rank = { WM: 4, Wm: 3, WS: 2, WU: 1 };
  for (const { parts } of act) {
    const int = intensityOf(parts);
    for (const p of parts) {
      if (!p.g) continue;
      const code = p.unverified ? 'WU' : p.role === 2 ? 'WS' : (int >= 2 ? 'WM' : 'Wm');
      if (!out.has(p.g) || rank[code] > rank[out.get(p.g)]) out.set(p.g, code);
    }
  }
  if (selectedGw === null || selectedGw === undefined) return out;
  const sel = new Map();
  for (const g of out.keys()) sel.set(g, 'WP');
  for (const inv of involvement(selectedGw, T)) {
    for (const p of inv.allies) if (p.g) sel.set(p.g, sel.get(p.g) === 'WF' ? 'WF' : 'WL');
    for (const p of inv.foes) if (p.g) sel.set(p.g, 'WF');
  }
  if (out.has(selectedGw)) sel.set(selectedGw, 'WX');
  return sel;
}

/** Годы с интенсивностью (для мини-диаграммы в карточке). */
export function yearsOf(c) {
  const m = new Map();
  for (const p of c.parts) {
    for (let y = Math.floor(p.from / 10000); y <= Math.floor(p.to / 10000); y++) m.set(y, Math.max(m.get(y) || 0, p.int || 1));
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

/** Месяцы начала и конца интервалов участия — для кнопок «предыдущее/следующее событие». */
export function warEventDates() {
  if (!data) return [];
  const s = new Set();
  for (const c of data.conflicts) {
    s.add(c.start); if (c.end) s.add(c.end);
  }
  return [...s];
}
