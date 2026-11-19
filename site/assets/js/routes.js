// Слой «Транспортные маршруты»: загрузка site/data/routes.json и статус маршрута на дату.
// Пунктир — объявлен, не построен; сплошная — действует (по первой реальной перевозке).

let promise = null, data = null;

export function loadRoutes() {
  if (!promise) {
    promise = fetch('data/routes.json').then((r) => { if (!r.ok) throw new Error(`routes.json: ${r.status}`); return r.json(); })
      .then((d) => { data = d; return d; });
  }
  return promise;
}
export const routesLoaded = () => data;

/** «1932», «2013-11», «2015-08-03» → ГГГГММДД (начало периода). */
export function dint(s) {
  if (s === null || s === undefined) return null;
  const p = String(s).split('-');
  return +p[0] * 10000 + (+(p[1] || 1)) * 100 + (+(p[2] || 1));
}

const segOperating = (r, seg, ref) => {
  if (seg.planned) return false;
  const o = seg.operate || r.operate;
  return !!o && ref >= dint(o);
};

/** none — ещё не объявлен; planned — объявлен, не построен; partial — действует частично; operating — действует. */
export function routeStatus(r, ref) {
  if (ref < dint(r.appear)) return 'none';
  const segs = r.branches.flatMap((b) => b.segments).filter((s) => ref >= (dint(s.appear) || dint(r.appear)));
  const n = segs.filter((s) => segOperating(r, s, ref)).length;
  if (n === 0) return 'planned';
  return n === segs.length ? 'operating' : 'partial';
}
export const segmentOperating = segOperating;

export function routesAt(ref) {
  return (data?.routes || []).filter((r) => dint(r.appear) <= ref);
}

/** Маршруты, связанные со страной: участник соглашения или ветвь проходит по её территории. */
export function routesForCountry(code, ref) {
  if (!data || !code) return [];
  return routesAt(ref).map((r) => {
    if (r.parties.includes(code)) return { r, role: 'party' };
    if ((data.through[r.id] || []).includes(code)) return { r, role: 'through' };
    return null;
  }).filter(Boolean);
}
