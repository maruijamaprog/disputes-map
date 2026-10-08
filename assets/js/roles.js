// Вычисление ролей сторон в зонах споров на выбранную дату.
// A — сама страна (подложка); B — контролирует оспариваемую зону; C — претендует, не контролирует;
// D — частичный контроль; E — внешний эффективный контроль (по решению международного суда);
// R — особые права без претензии на суверенитет.
import { dStart, dEnd, activeAt, overlapsYear, refDate, yearOf } from './time.js';

export const ROLE_ORDER = ['B', 'D', 'E', 'C', 'R'];

/** Зоны спора с унаследованными от спора претендентами и контролёрами. */
export function units(d) {
  if (!d._units) {
    const base = {
      claimants: d.claimants || [],
      controllers: d.de_facto_controller || [],
      external: d.external_control || [],
    };
    d._units = (d.areas && d.areas.length ? d.areas : [{ area_id: `${d.id}--all`, name: d.name }]).map((a) => ({
      area_id: a.area_id,
      name: a.name,
      dispute: d,
      claimants: a.claimants || base.claimants,
      controllers: a.de_facto_controller && a.de_facto_controller.length ? a.de_facto_controller : base.controllers,
      external: a.external_control || base.external,
    }));
  }
  return d._units;
}

function periodOverlaps(d, year) {
  const p = d.period;
  const s = p.start ?? -Infinity, e = p.end ?? Infinity;
  return s <= year && year <= e;
}

function actorOf(x) { return x.actor || x.state; }

export function partiesInYear(u, year) {
  const set = new Set();
  for (const x of [...u.claimants, ...u.controllers, ...u.external]) if (overlapsYear(x, year)) set.add(actorOf(x));
  return set;
}

export function unitVisible(u, year) {
  return periodOverlaps(u.dispute, year) && partiesInYear(u, year).size >= 2;
}

export function disputeVisible(d, year) {
  return units(d).some((u) => unitVisible(u, year));
}

/** Контролёры зоны на дату: при нескольких полных — последний по дате начала. */
export function controllersAt(u, ref) {
  const act = u.controllers.filter((c) => activeAt(c, ref));
  const full = act.filter((c) => c.control !== 'partial');
  const partial = act.filter((c) => c.control === 'partial');
  let fullLatest = [];
  if (full.length) {
    const max = Math.max(...full.map((c) => dStart(c.from)));
    fullLatest = full.filter((c) => dStart(c.from) === max);
  }
  return { full: fullLatest, partial };
}

export function roleOf(actor, u, ref) {
  const { full, partial } = controllersAt(u, ref);
  if (full.some((c) => c.state === actor)) return 'B';
  if (partial.some((c) => c.state === actor)) return 'D';
  if (u.external.some((e) => e.state === actor && activeAt(e, ref))) return 'E';
  const cl = u.claimants.filter((c) => c.actor === actor && activeAt(c, ref));
  if (cl.some((c) => (c.claim_type || 'sovereignty') === 'sovereignty')) return 'C';
  if (cl.length) return 'R';
  return null;
}

/** Роли стороны во всех видимых зонах: Map(area_id → роль). */
export function rolesFor(actor, year, disputes) {
  const ref = refDate(year);
  const out = new Map();
  if (!actor) return out;
  for (const d of disputes) {
    for (const u of units(d)) {
      if (!unitVisible(u, year)) continue;
      const r = roleOf(actor, u, ref);
      if (r) out.set(u.area_id, r);
    }
  }
  return out;
}

/** Сводка по стороне: споры, в которых она участвует в этом году, с ролями по зонам. */
export function actorSummary(actor, year, disputes) {
  const ref = refDate(year);
  const res = [];
  for (const d of disputes) {
    const roles = [];
    for (const u of units(d)) {
      if (!unitVisible(u, year)) continue;
      const r = roleOf(actor, u, ref);
      if (r) roles.push({ unit: u, role: r });
    }
    if (roles.length) res.push({ dispute: d, roles });
  }
  return res;
}

/** Менялся ли контроль внутри года (для пунктирного контура). */
export function changedInYear(u, year) {
  const a = year * 10000 + 101, b = year * 10000 + 1231;
  return u.controllers.some((c) => {
    const s = dStart(c.from), e = dEnd(c.to);
    return (s > a && s <= b && String(c.from).length > 4) || (e >= a && e < b && String(c.to).length > 4);
  });
}

/** Все стороны, участвующие в видимых спорах года. */
export function actorsInYear(year, disputes) {
  const set = new Set();
  for (const d of disputes) for (const u of units(d)) if (unitVisible(u, year)) partiesInYear(u, year).forEach((a) => set.add(a));
  return set;
}

/** Годы событий для кнопок «предыдущее/следующее событие». */
export function eventYears(disputes, min, max) {
  const ys = new Set();
  const add = (v) => { const y = yearOf(v); if (y && y >= min && y <= max) ys.add(y); };
  for (const d of disputes) {
    add(d.period.start); add(d.period.end);
    for (const u of units(d)) for (const x of [...u.claimants, ...u.controllers, ...u.external]) { add(x.from); add(x.to); }
  }
  return [...ys].sort((a, b) => a - b);
}
