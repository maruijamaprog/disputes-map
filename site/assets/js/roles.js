// Вычисление ролей сторон в зонах споров на выбранный месяц.
// A — сама страна (подложка); B — контролирует оспариваемую зону; C — претендует, не контролирует;
// D — частичный контроль; E — внешний эффективный контроль (по решению международного суда);
// R — особые права без претензии на суверенитет; T — управляет несамоуправляющейся территорией (список ООН).
// T (период) — объект из time.period(): {y, m, from, to, ref}.
import { dStart, dEnd, activeAt, overlaps, monthOf } from './time.js';

export const ROLE_ORDER = ['B', 'D', 'E', 'T', 'C', 'R'];

/** Зоны спора с унаследованными от спора претендентами и контролёрами. */
export function units(d) {
  if (!d._units) {
    const base = {
      claimants: d.claimants || [],
      controllers: d.de_facto_controller || [],
      external: d.external_control || [],
      listing: d.un_listing || [],
    };
    d._units = (d.areas && d.areas.length ? d.areas : [{ area_id: `${d.id}--all`, name: d.name }]).map((a) => ({
      area_id: a.area_id,
      name: a.name,
      dispute: d,
      claimants: a.claimants || base.claimants,
      controllers: a.de_facto_controller && a.de_facto_controller.length ? a.de_facto_controller : base.controllers,
      external: a.external_control || base.external,
      listing: a.un_listing || base.listing,
      period: a.period || null,
    }));
  }
  return d._units;
}

function periodOverlaps(d, u, T) {
  const p = u.period || d.period;
  const s = dStart(p.start_date ?? p.start), e = dEnd(p.end_date ?? p.end);
  return s <= T.to && e >= T.from;
}

function actorOf(x) { return x.actor || x.state; }

export function partiesIn(u, T) {
  const set = new Set();
  for (const x of [...u.claimants, ...u.controllers, ...u.external]) if (overlaps(x, T)) set.add(actorOf(x));
  return set;
}

/** Несамоуправляющаяся территория (список ООН) видна при одной стороне — управляющей державе. */
export function listedIn(u, T) { return u.listing.some((x) => overlaps(x, T)); }

export function unitVisible(u, T) {
  if (!periodOverlaps(u.dispute, u, T)) return false;
  return partiesIn(u, T).size >= 2 || listedIn(u, T);
}

export function disputeVisible(d, T) {
  return units(d).some((u) => unitVisible(u, T));
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
  const others = u.claimants.some((c) => c.actor !== actor && activeAt(c, ref));
  if (full.some((c) => c.state === actor)) return others || !u.listing.some((x) => activeAt(x, ref)) ? 'B' : 'T';
  if (partial.some((c) => c.state === actor)) return 'D';
  if (u.external.some((e) => e.state === actor && activeAt(e, ref))) return 'E';
  const cl = u.claimants.filter((c) => c.actor === actor && activeAt(c, ref));
  if (cl.some((c) => (c.claim_type || 'sovereignty') === 'sovereignty')) return 'C';
  if (cl.length) return 'R';
  return null;
}

/** Роли стороны во всех видимых зонах: Map(area_id → роль). */
export function rolesFor(actor, T, disputes) {
  const out = new Map();
  if (!actor) return out;
  for (const d of disputes) {
    for (const u of units(d)) {
      if (!unitVisible(u, T)) continue;
      const r = roleOf(actor, u, T.ref);
      if (r) out.set(u.area_id, r);
    }
  }
  return out;
}

/** Сводка по стороне: споры, в которых она участвует в этом месяце, с ролями по зонам. */
export function actorSummary(actor, T, disputes) {
  const res = [];
  for (const d of disputes) {
    const roles = [];
    for (const u of units(d)) {
      if (!unitVisible(u, T)) continue;
      const r = roleOf(actor, u, T.ref);
      if (r) roles.push({ unit: u, role: r });
    }
    if (roles.length) res.push({ dispute: d, roles });
  }
  return res;
}

/** Менялся ли контроль внутри месяца (для пунктирного контура). */
export function changedIn(u, T) {
  return u.controllers.some((c) => {
    const s = dStart(c.from), e = dEnd(c.to);
    return (s > T.from && s <= T.to && String(c.from).length > 7) || (e >= T.from && e < T.to && String(c.to).length > 7);
  });
}

/** Все стороны, участвующие в видимых спорах месяца. */
export function actorsIn(T, disputes) {
  const set = new Set();
  for (const d of disputes) for (const u of units(d)) if (unitVisible(u, T)) partiesIn(u, T).forEach((a) => set.add(a));
  return set;
}

/** Месяцы событий (индексы) для кнопок «предыдущее/следующее событие». */
export function eventMonths(disputes, maxIdx) {
  const ms = new Set();
  const add = (v, isEnd) => { const i = monthOf(v, isEnd); if (i !== null && i >= 0 && i <= maxIdx) ms.add(i); };
  for (const d of disputes) {
    add(d.period.start_date ?? d.period.start, false);
    if (d.period.end !== null) add(d.period.end_date ?? d.period.end, true);
    for (const h of d.history || []) add(h.date, false);
    for (const u of units(d)) for (const x of [...u.claimants, ...u.controllers, ...u.external]) { add(x.from, false); if (x.to !== null) add(x.to, true); }
  }
  return [...ms].sort((a, b) => a - b);
}
