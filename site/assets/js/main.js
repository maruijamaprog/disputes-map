// Точка входа: загрузка данных, состояние, связь карты, шкалы времени и панели.
import { setLang, detectLang, t, tx, getLang } from './i18n.js';
import { decode } from './topo.js';
import { period, nowMonth, monthIndex, fromIndex, formatMonth, monthNames, MIN_YEAR, dStart, monthOf } from './time.js';
import { units, unitVisible, disputeVisible, rolesFor, changedIn, eventMonths, actorSummary } from './roles.js';
import { createMap } from './map.js';
import { loadWars, warsLoaded, conflictsAt, involvement, warRoleMap } from './wars.js';
import { loadRoutes, routesLoaded, routesAt, routesForCountry, routeStatus } from './routes.js';
import { el, icon, iconHTML, TYPES, actorName, renderLegend, renderTypeFilters, showTooltip, hideTooltip, controllerText,
  buildOptions, renderList, renderCountryCard, renderDisputeCard, renderConflictCard, renderRefCard, renderRouteCard, conflictTitle } from './ui.js';

const $ = (s) => document.querySelector(s);
const NOW = nowMonth();
const MAX_IDX = monthIndex(NOW.y, NOW.m);
const THEMES = ['auto', 'light', 'dark', 'political', 'atlas', 'contrast'];

const S = {
  T: period(NOW.y, NOW.m), mode: 'disputes',
  actor: null, unitId: null, unitName: null, unitGw: null, unitIso: null, pinned: false,
  selected: null, conflict: null, land: null, route: null,
  filters: { types: new Set(TYPES), status: 'all', lowconf: true },
  disputes: [], actors: {}, meta: null, units: [], eraCache: new Map(), eraKey: null, events: [], warEvents: [],
  playing: null, activeOption: null, diplo: null, diploLoading: null, warsState: 'idle',
  prefs: { theme: 'auto', labels: true, land: null, routes: true },
};
let M = null; // карта

// ---------------------------------------------------------------- настройки (только удобство, без них всё работает)
function loadPrefs() {
  try { Object.assign(S.prefs, JSON.parse(localStorage.getItem('dm_prefs_v2') || '{}')); } catch { /* приватный режим */ }
  if (!THEMES.includes(S.prefs.theme)) S.prefs.theme = 'auto';
}
function savePrefs() { try { localStorage.setItem('dm_prefs_v2', JSON.stringify(S.prefs)); } catch { /* ignore */ } }

function resolvedTheme() {
  if (S.prefs.theme !== 'auto') return S.prefs.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  const custom = S.prefs.land && resolvedTheme() !== 'political';
  if (custom) { root.style.setProperty('--unit', S.prefs.land); root.style.setProperty('--pattern-base', S.prefs.land); }
  else { root.style.removeProperty('--unit'); root.style.removeProperty('--pattern-base'); }
  document.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === S.prefs.theme)));
  const inp = $('#land-color');
  if (inp) { inp.disabled = resolvedTheme() === 'political'; if (S.prefs.land) inp.value = S.prefs.land; }
  $('#chk-labels') && ($('#chk-labels').checked = S.prefs.labels);
  $('#chk-routes') && ($('#chk-routes').checked = S.prefs.routes !== false);
  M?.refreshTheme();
  renderLegendNow();
}

// ---------------------------------------------------------------- URL
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  let ym = null;
  const tt = p.get('t');
  if (tt && /^\d{4}-\d{2}$/.test(tt)) ym = { y: +tt.slice(0, 4), m: +tt.slice(5, 7) };
  else if (p.get('y')) ym = { y: +p.get('y'), m: 12 };
  return { ym, a: p.get('a'), g: p.get('g') ? +p.get('g') : null, d: p.get('d'), c: p.get('c'), r: p.get('r'), mode: p.get('mode'), lang: p.get('lang') };
}
function writeHash() {
  const p = new URLSearchParams();
  p.set('t', `${S.T.y}-${String(S.T.m).padStart(2, '0')}`);
  if (S.mode === 'wars') p.set('mode', 'wars');
  if (S.pinned && S.actor) p.set('a', S.actor);
  if (S.pinned && S.unitGw !== null && !S.actor) p.set('g', S.unitGw);
  if (S.selected) p.set('d', S.selected);
  if (S.conflict) p.set('c', S.conflict);
  if (S.route) p.set('r', S.route);
  p.set('lang', getLang());
  history.replaceState(null, '', `#${p.toString()}`);
  $('#link-methodology').href = `methodology.html#lang=${getLang()}`;
}

// ---------------------------------------------------------------- данные
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

function eraFor(year) {
  return S.meta.eras.find((e) => year >= e.from && year <= e.to) || S.meta.eras[S.meta.eras.length - 1];
}

async function loadEra(era) {
  if (!S.eraCache.has(era.file)) {
    S.eraCache.set(era.file, getJSON(`data/${era.file}`).then((topo) => ({ countries: decode(topo, 'countries'), labels: topo.objects.labels ? decode(topo, 'labels') : null })));
  }
  return S.eraCache.get(era.file);
}

function prefetchNeighbours(era) {
  const i = S.meta.eras.indexOf(era);
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 800));
  idle(() => { [S.meta.eras[i - 1], S.meta.eras[i + 1]].filter(Boolean).forEach((e) => loadEra(e)); });
}

/** Название государства по коду GW на текущую дату (из справочника единиц CShapes). */
const gwCache = new Map();
function gwName(gw) {
  const key = `${gw}|${S.T.ref}|${getLang()}`;
  if (gwCache.has(key)) return gwCache.get(key);
  const cand = S.units.filter((u) => u.gw === gw);
  let u = cand.find((x) => x.start <= S.T.ref && S.T.ref <= x.end);
  if (!u && cand.length) u = cand.reduce((best, x) => (Math.abs(x.start - S.T.ref) < Math.abs(best.start - S.T.ref) ? x : best));
  const w = warsLoaded();
  const name = u ? (getLang() === 'ru' ? u.name_ru : u.name_en).split(' (')[0]
    : (w?.gw?.[gw] ? tx(w.gw[gw]) : `GW ${gw}`);
  gwCache.set(key, name);
  return name;
}
function unitForActor(code) {
  return S.units.find((u) => u.actor === code && u.start <= S.T.ref && S.T.ref <= u.end) || S.units.find((u) => u.actor === code) || null;
}
function unitForGw(gw) {
  return S.units.find((u) => u.gw === gw && u.start <= S.T.ref && S.T.ref <= u.end) || null;
}

// ---------------------------------------------------------------- фильтры и видимость
function filteredDisputes() {
  return S.disputes.filter((d) => {
    if (!S.filters.types.has(d.type)) return false;
    if (!S.filters.lowconf && d.confidence === 'low') return false;
    if (S.filters.status === 'active' && d.period.end !== null) return false;
    if (S.filters.status === 'resolved' && d.period.end === null) return false;
    return true;
  });
}
function visibleDisputes() { return filteredDisputes().filter((d) => disputeVisible(d, S.T)); }

// ---------------------------------------------------------------- шкала времени
function renderTimeline() {
  const lang = getLang();
  const r = $('#tl-range');
  r.max = MAX_IDX; r.value = S.T.idx;
  r.setAttribute('aria-valuetext', formatMonth(S.T, lang));
  $('#tl-label').textContent = formatMonth(S.T, lang);
  $('#tl-sub').textContent = S.T.idx === MAX_IDX ? t('timeline.now') : t('timeline.endof');
  const sel = $('#tl-month');
  if (sel.options.length !== 12 || sel.dataset.lang !== lang) {
    sel.replaceChildren(...monthNames(lang).map((n, i) => el('option', { value: String(i + 1), text: n })));
    sel.dataset.lang = lang;
  }
  sel.value = String(S.T.m);
  $('#tl-year').value = S.T.y;
  const pct = (S.T.idx / MAX_IDX) * 100;
  $('#tl-fill').style.width = `${pct}%`;
}

function renderTicks() {
  const box = $('#tl-ticks'); box.replaceChildren();
  for (let y = 1900; y <= NOW.y; y += 10) {
    const i = monthIndex(y, 1);
    box.append(el('span', { class: 'tick', style: `left:${(i / MAX_IDX) * 100}%`, text: String(y) }));
  }
  const ev = $('#tl-events'); ev.replaceChildren();
  const list = S.mode === 'wars' ? S.warEvents : S.events;
  for (const i of list) ev.append(el('span', { class: 'ev', style: `left:${(i / MAX_IDX) * 100}%` }));
}

let eraLoading = null;
async function setMonth(idx, { announce = false } = {}) {
  idx = Math.min(MAX_IDX, Math.max(0, idx));
  const { y, m } = fromIndex(idx);
  S.T = period(y, m);
  gwCache.clear();
  renderTimeline();
  if (M) {
    const era = eraFor(y);
    if (S.eraKey !== era.file) {
      const p = loadEra(era); eraLoading = p;
      const fc = await p;
      if (eraLoading !== p) return; // устарело
      S.eraKey = era.file;
      M.setCountries(fc.countries, fc.labels);
      prefetchNeighbours(era);
    }
    M.setRef(S.T.ref);
  }
  refresh();
  if (announce) announceDate();
}

function announceDate() {
  if (S.mode === 'wars') say(t('announce.wars', { date: formatMonth(S.T, getLang()), n: conflictsAt(S.T).length }));
  else say(t('announce.month', { date: formatMonth(S.T, getLang()), n: visibleDisputes().length }));
}

// ---------------------------------------------------------------- обновление
function refresh() {
  const vis = visibleDisputes();
  if (M) {
    const areaIds = [], changed = [];
    for (const d of vis) for (const u of units(d)) if (unitVisible(u, S.T)) {
      areaIds.push(u.area_id);
      if (changedIn(u, S.T)) changed.push(u.area_id);
    }
    M.setVisible(areaIds, changed);
    M.setActor(S.actor, S.unitId, rolesFor(S.actor, S.T, vis));
    M.setSelected(S.selected && vis.some((d) => d.id === S.selected) ? S.selected : null);
    if (S.mode === 'wars') M.setWarRoles(warRoleMap(S.T, S.unitGw), S.unitGw);
  }
  $('#list-count').textContent = S.mode === 'wars'
    ? t('list.count.wars', { n: conflictsAt(S.T).length })
    : t('list.count', { n: vis.length });
  updateList();
  renderCard();
  writeHash();
}

function renderLegendNow() {
  renderLegend($('#legend'), S.mode, { selected: S.mode === 'wars' && S.unitGw !== null && S.pinned, routes: S.prefs.routes !== false && !!routesLoaded() });
}

function renderCard() {
  const card = $('#card');
  const browse = $('#browse');
  const show = (on) => { card.hidden = !on; browse.hidden = on; $('#panel').classList.toggle('has-card', on); };
  if (S.selected && S.mode === 'disputes') {
    const d = S.disputes.find((x) => x.id === S.selected);
    if (d) {
      renderDisputeCard(card, { d, T: S.T, actors: S.actors, geometryMeta: S.meta?.geometry || {}, onClose: closeCard,
        onActor: (code) => selectActor(code, true) });
      show(true); return;
    }
  }
  if (S.conflict && S.mode === 'wars' && warsLoaded()) {
    const c = warsLoaded().conflicts.find((x) => x.id === S.conflict);
    if (c) {
      renderConflictCard(card, { c, T: S.T, gwName, onCountry: (gw) => selectGw(gw, true), onClose: closeCard });
      show(true); return;
    }
  }
  if (S.land) {
    renderRefCard(card, { p: S.land, T: S.T, onClose: closeCard });
    show(true); return;
  }
  const RD = routesLoaded();
  if (S.route && RD) {
    const r = RD.routes.find((x) => x.id === S.route);
    if (r) {
      renderRouteCard(card, { r, T: S.T, actors: S.actors, nodes: RD.nodes, through: RD.through[r.id], onClose: closeCard, onActor: (code) => selectActor(code, true) });
      show(true); return;
    }
  }
  if (S.pinned && (S.actor || S.unitId !== null || S.unitGw !== null)) {
    const title = S.actor ? actorName(S.actor, S.actors, S.unitName) : (S.unitGw !== null && !S.unitName ? gwName(S.unitGw) : S.unitName);
    const w = warsLoaded();
    if (!w && S.warsState === 'idle') ensureWars();
    renderCountryCard(card, {
      title, unitName: S.unitName, T: S.T, mode: S.mode,
      summary: S.actor ? actorSummary(S.actor, S.T, visibleDisputes()) : [],
      wars: w && S.unitGw !== null ? involvement(S.unitGw, S.T) : [],
      warsState: w ? 'ready' : S.warsState === 'error' ? 'error' : 'loading',
      diplo: diploFor(S.unitIso), actors: S.actors, gwName, isoName,
      routes: routesForCountry(S.actor || S.unitIso, S.T.ref), onOpenRoute: (id) => selectRoute(id, true),
      onOpenDispute: (id) => { setMode('disputes'); selectDispute(id, true); },
      onOpenConflict: (id) => { setMode('wars'); selectConflict(id); },
      onClose: closeCard,
    });
    show(true); return;
  }
  card.replaceChildren(); show(false);
}

function clearLand() { S.land = null; M?.setLandSelected(null); S.route = null; M?.setRouteSelected(null); }

function closeCard() {
  S.selected = null; S.conflict = null; S.pinned = false; S.actor = null; S.unitId = null; S.unitName = null; S.unitGw = null; S.unitIso = null;
  clearLand();
  refresh(); renderLegendNow();
  $('#search').focus();
}

function setUnit(u) {
  S.unitId = u ? u.i : null; S.unitGw = u ? u.gw : null; S.unitIso = u ? u.iso || null : null;
  S.unitName = u ? (getLang() === 'ru' ? u.name_ru : u.name_en) : null;
}

function selectActor(code, focusCard = false) {
  clearLand();
  const u = unitForActor(code);
  S.actor = code || null; setUnit(u); S.pinned = true; S.selected = null; S.conflict = null;
  if (!u && code && /^[A-Z]{3}$/.test(code)) S.unitIso = code;
  refresh(); renderLegendNow();
  const n = code ? actorSummary(code, S.T, visibleDisputes()).length : 0;
  say(t('announce.actor', { name: actorName(code, S.actors, S.unitName), n }));
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

function selectGw(gw, focusCard = false) {
  clearLand();
  const u = unitForGw(gw);
  S.actor = u?.actor || null; setUnit(u); if (!u) { S.unitGw = gw; S.unitName = gwName(gw); }
  S.pinned = true; S.selected = null; S.conflict = null;
  refresh(); renderLegendNow();
  say(t('announce.country', { name: S.actor ? actorName(S.actor, S.actors) : S.unitName }));
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

function selectUnitProps(p) {
  clearLand();
  const u = S.units.find((x) => x.i === p.i) || null;
  S.actor = p.a || null; setUnit(u);
  if (!u) { S.unitId = p.i; S.unitGw = p.g; S.unitIso = p.iso || null; S.unitName = getLang() === 'ru' ? p.r : p.n; }
  S.pinned = true; S.selected = null; S.conflict = null;
  refresh(); renderLegendNow();
  say(t('announce.country', { name: S.actor ? actorName(S.actor, S.actors) : S.unitName }));
  openPanelOnMobile();
}

function selectDispute(id, fly = false, focusCard = true) {
  clearLand();
  S.selected = id; S.conflict = null;
  refresh();
  const d = S.disputes.find((x) => x.id === id);
  if (d) say(t('announce.dispute', { name: tx(d.name) }));
  if (fly && M) M.flyToFeatureBounds(id);
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

function selectConflict(id, focusCard = true) {
  clearLand();
  S.conflict = id; S.selected = null; S.pinned = false; S.actor = null; S.unitId = null; S.unitGw = null; S.unitIso = null;
  refresh(); renderLegendNow();
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

/** Транспортный маршрут: справка в панели. */
function selectRoute(id, fly = false, focusCard = true) {
  const RD = routesLoaded();
  const r = RD?.routes.find((x) => x.id === id);
  if (!r) return;
  clearLand();
  S.selected = null; S.conflict = null; S.pinned = false; S.actor = null; S.unitId = null; S.unitName = null; S.unitGw = null; S.unitIso = null;
  S.route = id; M?.setRouteSelected(id);
  if (S.prefs.routes === false) { S.prefs.routes = true; savePrefs(); M?.setRoutesVisible(true); $('#chk-routes').checked = true; }
  refresh(); renderLegendNow();
  say(t('announce.route', { name: tx(r.name) }));
  if (fly && M) M.flyToRoute(id);
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

/** Территория без единицы CShapes: справка в панели. */
function selectLand(p) {
  S.route = null; M?.setRouteSelected(null);
  S.selected = null; S.conflict = null; S.pinned = false; S.actor = null; S.unitId = null; S.unitName = null; S.unitGw = null; S.unitIso = null;
  S.land = p; M?.setLandSelected(p.k);
  refresh(); renderLegendNow();
  say(t('announce.ref', { name: getLang() === 'ru' ? p.r : p.n }));
  openPanelOnMobile();
  $('#card h2')?.focus();
}

function say(msg) { const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }

// ---------------------------------------------------------------- войны и дипотношения (ленивая загрузка)
function ensureWars() {
  if (warsLoaded() || S.warsState === 'loading') return;
  S.warsState = 'loading';
  loadWars().then((w) => {
    S.warsState = 'ready';
    const ms = new Set();
    for (const c of w.conflicts) {
      const a = monthOf(c.start); if (a !== null && a <= MAX_IDX) ms.add(a);
      if (c.end) { const b = monthOf(c.end, true); if (b !== null && b <= MAX_IDX) ms.add(b); }
    }
    S.warEvents = [...ms].sort((x, y) => x - y);
    if (S.mode === 'wars') renderTicks();
    refresh();
  }).catch((e) => { console.error(e); S.warsState = 'error'; refresh(); });
}

function ensureDiplo() {
  if (S.diplo || S.diploLoading) return;
  S.diploLoading = getJSON('data/diplomacy.json').then((d) => { S.diplo = d; refresh(); }).catch(() => { S.diplo = { error: true }; });
}

function isoName(iso) {
  const n = S.diplo?.names?.[iso];
  return n ? tx(n) : iso;
}

function diploFor(iso) {
  if (!iso) return null;
  if (!S.diplo) { ensureDiplo(); return null; }
  if (S.diplo.error) return null;
  const D = S.diplo;
  const src = (ids) => (ids || []).map((id) => D.sources.find((s) => s.id === id)).filter(Boolean);
  const facts = (D.facts[iso] || []).map((f) => ({ text: f.text, sources: src(f.src), confirmed: f.confirmed, review: !!f.review }));
  const none = (D.none || []).filter((x) => x.a === iso || x.b === iso).map((x) => ({
    other: x.a === iso ? x.b : x.a, status: x.status, since: x.since, note: x.note, sources: src(x.src),
    confirmed: x.confirmed, review: !!x.review,
  })).sort((a, b) => isoName(a.other).localeCompare(isoName(b.other), getLang()));
  return { facts, none, asOf: D.as_of_label?.[getLang()] || D.as_of };
}

// ---------------------------------------------------------------- список (combobox)
function updateList() {
  const q = $('#search').value;
  let groups;
  if (S.mode === 'wars') {
    const w = warsLoaded();
    if (!w) { renderList($('#listbox'), [], null); $('#listbox').replaceChildren(el('li', { class: 'group', role: 'presentation', text: S.warsState === 'error' ? t('war.unavailable') : t('war.loading') })); return; }
    const qq = q.trim().toLowerCase();
    const act = conflictsAt(S.T);
    const conf = act.map(({ c, parts }) => {
      const int = Math.max(0, ...parts.map((p) => p.int || 0));
      return { kind: 'conflict', id: c.id, label: conflictTitle(c, gwName), meta: t(`war.int.short.${int}`), dot: `i${int}`, int };
    }).filter((o) => !qq || o.label.toLowerCase().includes(qq)).sort((a, b) => b.int - a.int || a.label.localeCompare(b.label, getLang()));
    const states = new Map();
    for (const { parts } of act) for (const p of parts) if (p.g) states.set(p.g, (states.get(p.g) || 0) + 1);
    const st = [...states.entries()].map(([g, n]) => ({ kind: 'gw', id: String(g), label: gwName(g), meta: String(n) }))
      .filter((o) => !qq || o.label.toLowerCase().includes(qq)).sort((a, b) => a.label.localeCompare(b.label, getLang()));
    groups = [{ title: t('list.conflicts'), opts: conf }, { title: t('list.states'), opts: st }];
  } else {
    groups = buildOptions(S.T, visibleDisputes(), S.actors, q);
  }
  if (routesLoaded() && S.prefs.routes !== false) {
    const qq = q.trim().toLowerCase().replaceAll('ё', 'е');
    const opts = routesAt(S.T.ref).map((r) => ({ kind: 'route', id: r.id, label: tx(r.name), meta: t(`route.status.short.${routeStatus(r, S.T.ref)}`),
      alt: `${r.name.ru} ${r.name.en}` }))
      .filter((o) => !qq || o.alt.toLowerCase().replaceAll('ё', 'е').includes(qq)).sort((a, b) => a.label.localeCompare(b.label, getLang()));
    groups.push({ title: t('list.routes'), opts });
  }
  renderList($('#listbox'), groups, S.activeOption);
}

function optionEls() { return [...$('#listbox').querySelectorAll('[role="option"]')]; }

function moveActive(delta) {
  const els = optionEls(); if (!els.length) return;
  let i = els.findIndex((e) => e.dataset.key === S.activeOption);
  i = i < 0 ? (delta > 0 ? 0 : els.length - 1) : Math.min(els.length - 1, Math.max(0, i + delta));
  S.activeOption = els[i].dataset.key;
  els.forEach((e) => e.setAttribute('aria-selected', e.dataset.key === S.activeOption ? 'true' : 'false'));
  $('#search').setAttribute('aria-activedescendant', els[i].id);
  els[i].scrollIntoView({ block: 'nearest' });
}

function chooseOption(key) {
  const [kind, id] = key.split(':');
  if (kind === 'actor') selectActor(id);
  else if (kind === 'gw') selectGw(+id);
  else if (kind === 'conflict') selectConflict(id, false);
  else if (kind === 'route') selectRoute(id, true, false);
  else selectDispute(id, true, false);
}

// ---------------------------------------------------------------- карта: наведение и клик
/** Точка события карты → координаты внутри .app (карта начинается под шапкой). */
function toApp(point) {
  if (!point) return point;
  const mr = $('#map').getBoundingClientRect(), ar = $('.app').getBoundingClientRect();
  return { x: point.x + mr.left - ar.left, y: point.y + mr.top - ar.top };
}

function onHover(hit, point) {
  const tip = $('#tooltip');
  point = toApp(point);
  M.setLandHover(hit?.kind === 'ref' ? hit.props.k : null);
  M.setRouteHover(hit?.kind === 'route' ? hit.props.r : null);
  if (hit?.kind === 'route') {
    const r = routesLoaded()?.routes.find((x) => x.id === hit.props.r);
    M.setHoverDispute(null);
    if (r) {
      const st = routeStatus(r, S.T.ref);
      const segPlanned = st === 'partial' && hit.props.o > S.T.ref;
      showTooltip(tip, point, [el('strong', { text: tx(r.name) }), el('div', { text: t(`route.status.${st}`) }),
        segPlanned ? el('div', { class: 'small', text: t('route.tip.seg.planned') }) : null,
        el('div', { class: 'tip-hint', text: t('route.tip.hint') })].filter(Boolean));
    }
    return;
  }
  if (hit?.kind === 'ref') {
    M.setHoverDispute(null);
    if (!S.pinned && S.mode === 'disputes' && (S.actor || S.unitId !== null)) { S.actor = null; S.unitId = null; refreshRolesOnly(); }
    showTooltip(tip, point, [el('strong', { text: getLang() === 'ru' ? hit.props.r : hit.props.n }),
      el('div', { text: t('ref.tip') }), el('div', { class: 'tip-hint', text: t('ref.tip.hint') })]);
    return;
  }
  if (!hit) {
    hideTooltip(tip); M.setHoverDispute(null);
    if (!S.pinned && S.mode === 'disputes') { S.actor = null; S.unitId = null; refreshRolesOnly(); }
    return;
  }
  if (hit.kind === 'dispute') {
    const d = S.disputes.find((x) => x.id === hit.props.dispute_id);
    const u = d && units(d).find((x) => x.area_id === hit.props.area_id);
    M.setHoverDispute(hit.props.dispute_id);
    if (d && u) showTooltip(tip, point, [el('strong', { text: tx(d.name) }),
      units(d).length > 1 ? el('div', { text: tx(u.name) }) : null,
      el('div', { text: t('tooltip.controller', { who: controllerText(u, S.T.ref, S.actors) }) }),
      el('div', { class: 'tip-hint', text: t('tooltip.dispute') })].filter(Boolean));
    return;
  }
  M.setHoverDispute(null);
  const p = hit.props;
  const name = p.a ? actorName(p.a, S.actors, getLang() === 'ru' ? p.r : p.n) : (getLang() === 'ru' ? p.r : p.n);
  if (S.mode === 'wars') {
    const inv = warsLoaded() ? involvement(p.g, S.T) : [];
    const foes = [...new Set(inv.flatMap((x) => x.foes.map((f) => (f.g ? gwName(f.g) : f.name))))].filter(Boolean);
    showTooltip(tip, point, [el('strong', { text: name }),
      el('div', { text: inv.length ? t('tooltip.wars', { n: inv.length }) : t('tooltip.nowar') }),
      foes.length ? el('div', { class: 'small', text: `${t('war.against')}: ${foes.slice(0, 4).join(', ')}${foes.length > 4 ? '…' : ''}` }) : null,
      el('div', { class: 'tip-hint', text: t('tooltip.country') })].filter(Boolean));
    return;
  }
  if (!S.pinned) { S.actor = p.a || null; S.unitId = p.a ? null : p.i; refreshRolesOnly(); }
  const n = p.a ? actorSummary(p.a, S.T, visibleDisputes()).length : 0;
  showTooltip(tip, point, [el('strong', { text: name }),
    p.a && n ? el('div', { text: t('tooltip.roles', { n }) }) : null,
    el('div', { class: 'tip-hint', text: t('tooltip.country') })].filter(Boolean));
}

function refreshRolesOnly() { M.setActor(S.actor, S.unitId, rolesFor(S.actor, S.T, visibleDisputes())); }

function onClick(hit) {
  hideTooltip($('#tooltip'));
  if (!hit) { if (S.pinned || S.selected || S.conflict) closeCard(); return; }
  if (hit.kind === 'dispute') { selectDispute(hit.props.dispute_id, false, false); return; }
  if (hit.kind === 'ref') { selectLand(hit.props); return; }
  if (hit.kind === 'route') { selectRoute(hit.props.r, false, false); return; }
  selectUnitProps(hit.props);
}

// ---------------------------------------------------------------- режимы
function setMode(mode) {
  if (mode === S.mode) return;
  S.mode = mode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  if (mode === 'wars') ensureWars();
  if (mode === 'disputes') { S.conflict = null; }
  else { S.selected = null; }
  S.activeOption = null;
  M?.setMode(mode);
  if (mode === 'disputes') M?.setWarRoles(new Map(), null);
  renderLegendNow(); renderTicks();
  $('#h-list').textContent = mode === 'wars' ? t('list.title.wars') : t('list.title');
  $('#filters-disputes').hidden = mode === 'wars';
  refresh();
  say(mode === 'wars' ? t('announce.mode.wars') : t('announce.mode.disputes'));
}

// ---------------------------------------------------------------- панель на телефоне, всплывающие окна
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
function openPanelOnMobile() {
  if (isMobile()) { $('#panel').classList.add('open'); $('#btn-panel').setAttribute('aria-expanded', 'true'); }
}

function bindPopover(btnSel, popSel) {
  const btn = $(btnSel), pop = $(popSel);
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pop.hidden;
    document.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
    document.querySelectorAll('[aria-haspopup="dialog"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('button, input, select')?.focus();
  });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn.focus(); } });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) close(); });
}

// ---------------------------------------------------------------- запуск
async function main() {
  loadPrefs();
  const h = readHash();
  await setLang(detectLang(h.lang));
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  // иконки в разметке
  document.querySelectorAll('[data-icon]').forEach((n) => { n.insertAdjacentHTML('afterbegin', iconHTML(n.dataset.icon)); });

  let land, dtopo;
  try {
    [S.meta, S.disputes, S.actors, S.units, land, dtopo] = await Promise.all([
      getJSON('data/meta.json'), getJSON('data/disputes.json').then((x) => x.disputes), getJSON('data/actors.json'),
      getJSON('data/units.json'), getJSON('data/land.topo.json'), getJSON('data/disputes.topo.json')]);
  } catch (e) {
    console.error(e);
    const box = $('#map-error'); box.hidden = false; box.textContent = t('error.load');
    return;
  }
  S.events = eventMonths(S.disputes, MAX_IDX);
  $('#tl-year').max = NOW.y; $('#tl-year').min = MIN_YEAR;
  $('#footer-version').textContent = t('footer.version', { n: S.disputes.length });

  applyTheme();
  renderTypeFilters($('#filter-types'), S.filters, refresh);
  renderTicks();

  try {
    M = createMap($('#map'), { onHover, onClick });
    window.__disputesMap = { map: M.map, state: S };
    await M.init(decode(land, 'land'), decode(dtopo, 'areas'));
    M.setLabels(S.prefs.labels, getLang());
  } catch (e) {
    console.error(e); M = null;
    const box = $('#map-error'); box.hidden = false; box.textContent = t('error.webgl');
  }

  // начальное состояние из URL
  if (h.mode === 'wars') setMode('wars');
  const startIdx = h.ym ? monthIndex(h.ym.y, h.ym.m) : MAX_IDX;
  if (h.d && S.disputes.some((d) => d.id === h.d)) S.selected = h.d;
  if (h.c) S.conflict = h.c;
  await setMonth(startIdx);
  if (h.a) selectActor(h.a); else if (h.g !== null) selectGw(h.g);
  if (S.selected || S.pinned || S.conflict) openPanelOnMobile();
  if (S.selected && M) M.flyToFeatureBounds(S.selected);

  // транспортные маршруты (слой в «Виде карты»); без них карта работает
  loadRoutes().then((rd) => {
    M?.setRoutesData(rd.geo);
    M?.setRoutesVisible(S.prefs.routes !== false);
    renderLegendNow();
    if (h.r && rd.routes.some((r) => r.id === h.r)) selectRoute(h.r, true, false); else refresh();
  }).catch((e) => console.error(e));

  // шкала времени
  const range = $('#tl-range');
  range.addEventListener('input', (e) => { stopPlay(); setMonth(+e.target.value); });
  range.addEventListener('change', () => announceDate());
  range.addEventListener('keydown', (e) => {
    // PageUp/PageDown — на год; стрелки — на месяц (по умолчанию у range)
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); stopPlay(); setMonth(S.T.idx + (e.key === 'PageUp' ? 12 : -12), { announce: true }); }
  });
  const jump = () => {
    const y = Math.min(NOW.y, Math.max(MIN_YEAR, parseInt($('#tl-year').value, 10) || S.T.y));
    const m = +$('#tl-month').value || 1;
    stopPlay(); setMonth(monthIndex(y, m), { announce: true });
  };
  $('#tl-month').addEventListener('change', jump);
  $('#tl-year').addEventListener('change', jump);
  $('#tl-year').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
  const events = () => (S.mode === 'wars' ? S.warEvents : S.events);
  $('#btn-prev').addEventListener('click', () => { stopPlay(); const i = [...events()].reverse().find((v) => v < S.T.idx); if (i !== undefined) setMonth(i, { announce: true }); });
  $('#btn-next').addEventListener('click', () => { stopPlay(); const i = events().find((v) => v > S.T.idx); if (i !== undefined) setMonth(i, { announce: true }); });
  $('#btn-play').addEventListener('click', () => (S.playing ? stopPlay() : startPlay()));
  $('#btn-speed').addEventListener('click', () => {
    const b = $('#btn-speed'); const yearly = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(yearly)); b.textContent = yearly ? t('timeline.speed.year') : t('timeline.speed.month');
  });

  // режимы
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelector('.mode-switch').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const m = S.mode === 'wars' ? 'disputes' : 'wars'; setMode(m); $(`[data-mode="${m}"]`).focus(); }
  });

  // фильтры
  document.querySelectorAll('input[name="status"]').forEach((r) => r.addEventListener('change', (e) => { S.filters.status = e.target.value; refresh(); }));
  $('#filter-lowconf').addEventListener('change', (e) => { S.filters.lowconf = e.target.checked; refresh(); });

  // вид карты
  document.querySelectorAll('[data-theme-choice]').forEach((b) => b.addEventListener('click', () => { S.prefs.theme = b.dataset.themeChoice; savePrefs(); applyTheme(); }));
  $('#land-color').addEventListener('input', (e) => { S.prefs.land = e.target.value; savePrefs(); applyTheme(); });
  $('#land-reset').addEventListener('click', () => { S.prefs.land = null; savePrefs(); applyTheme(); });
  $('#chk-labels').addEventListener('change', (e) => { S.prefs.labels = e.target.checked; savePrefs(); M?.setLabels(S.prefs.labels, getLang()); });
  $('#chk-routes').addEventListener('change', (e) => {
    S.prefs.routes = e.target.checked; savePrefs(); M?.setRoutesVisible(S.prefs.routes);
    if (!S.prefs.routes && S.route) closeCard(); else refresh();
    renderLegendNow();
  });
  bindPopover('#btn-view', '#pop-view');
  bindPopover('#btn-filters', '#pop-filters');

  // поиск
  const search = $('#search');
  search.addEventListener('input', () => { S.activeOption = null; updateList(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter' && S.activeOption) { e.preventDefault(); chooseOption(S.activeOption); }
    else if (e.key === 'Escape') { search.value = ''; S.activeOption = null; updateList(); }
  });
  search.addEventListener('focus', () => { if (S.selected || S.pinned || S.conflict) { /* оставить карточку */ } });
  $('#listbox').addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]'); if (!li) return;
    S.activeOption = li.dataset.key; chooseOption(li.dataset.key);
  });

  // язык
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', async () => {
    await setLang(b.dataset.lang);
    document.querySelectorAll('.lang button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.lang === getLang())));
    renderTypeFilters($('#filter-types'), S.filters, refresh);
    $('#footer-version').textContent = t('footer.version', { n: S.disputes.length });
    $('#h-list').textContent = S.mode === 'wars' ? t('list.title.wars') : t('list.title');
    $('#btn-speed').textContent = $('#btn-speed').getAttribute('aria-pressed') === 'true' ? t('timeline.speed.year') : t('timeline.speed.month');
    if (S.unitId !== null) setUnit(S.units.find((u) => u.i === S.unitId) || null);
    M?.setLabels(S.prefs.labels, getLang());
    renderLegendNow();
    setMonth(S.T.idx);
  }));

  // дисклеймер
  const dlg = $('#disclaimer');
  $('#btn-disclaimer').addEventListener('click', () => dlg.showModal());
  let seen = false;
  try { seen = localStorage.getItem('dm_disclaimer_v1') === '1'; } catch { /* приватный режим */ }
  if (!seen && typeof dlg.showModal === 'function') {
    dlg.showModal();
    dlg.addEventListener('close', () => { try { localStorage.setItem('dm_disclaimer_v1', '1'); } catch { /* ignore */ } }, { once: true });
  }

  // панель на телефоне, легенда
  $('#btn-panel').addEventListener('click', () => {
    const open = $('#panel').classList.toggle('open');
    $('#btn-panel').setAttribute('aria-expanded', String(open));
  });
  $('#btn-panel-close').addEventListener('click', () => { $('#panel').classList.remove('open'); $('#btn-panel').setAttribute('aria-expanded', 'false'); $('#btn-panel').focus(); });
  // легенда: круглая кнопка «i»; на телефоне закрыта по умолчанию и закрывается касанием вне её
  const legendBox = $('#legend-box'), legendBtn = $('#btn-legend');
  const setLegend = (open) => { legendBox.classList.toggle('collapsed', !open); legendBtn.setAttribute('aria-expanded', String(open)); };
  legendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = legendBox.classList.contains('collapsed');
    setLegend(open);
    if (!isMobile()) { S.prefs.legend = open; savePrefs(); }
  });
  legendBox.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !legendBox.classList.contains('collapsed')) { setLegend(false); legendBtn.focus(); } });
  document.addEventListener('click', (e) => { if (isMobile() && !legendBox.classList.contains('collapsed') && !legendBox.contains(e.target)) setLegend(false); });
  M?.map.on('mousedown', () => { if (isMobile()) setLegend(false); });
  M?.map.on('touchstart', () => { if (isMobile()) setLegend(false); });
  // открыта по умолчанию только на просторном экране; на ноутбуке и телефоне — одна кнопка «i»
  const roomy = window.innerWidth >= 1280 && window.innerHeight >= 760;
  setLegend(!isMobile() && (typeof S.prefs.legend === 'boolean' ? S.prefs.legend : roomy));

  // высота шапки → CSS-переменная (карта, панель и всплывающие окна начинаются под шапкой)
  const header = $('.appbar');
  const syncHeader = () => { document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`); M?.map.resize(); };
  syncHeader();
  if ('ResizeObserver' in window) new ResizeObserver(syncHeader).observe(header);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.prefs.theme === 'auto') applyTheme(); });
  // ссылка, изменённая вручную или по якорю на той же странице: язык, режим, дата и выбранный объект
  window.addEventListener('hashchange', async () => {
    const n = readHash();
    if (n.lang && n.lang !== getLang() && ['ru', 'en'].includes(n.lang)) document.querySelector(`.lang button[data-lang="${n.lang}"]`)?.click();
    const mode = n.mode === 'wars' ? 'wars' : 'disputes';
    if (mode !== S.mode) setMode(mode);
    if (n.ym && monthIndex(n.ym.y, n.ym.m) !== S.T.idx) await setMonth(monthIndex(n.ym.y, n.ym.m));
    if (n.r && n.r !== S.route && routesLoaded()) selectRoute(n.r, true, false);
    else if (n.d && n.d !== S.selected && S.disputes.some((d) => d.id === n.d)) selectDispute(n.d, true, false);
    else if (n.c && n.c !== S.conflict) selectConflict(n.c, false);
    else if (n.a && n.a !== S.actor) selectActor(n.a);
    else if (n.g !== null && n.g !== S.unitGw) selectGw(n.g);
    else if (!n.r && !n.d && !n.c && !n.a && n.g === null && (S.selected || S.conflict || S.pinned || S.route)) closeCard();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('.popover:not([hidden])') && !dlg.open && (S.selected || S.pinned || S.conflict) && !e.target.closest('input')) closeCard();
  });
}

function startPlay() {
  const btn = $('#btn-play');
  btn.setAttribute('aria-pressed', 'true'); btn.innerHTML = iconHTML('pause'); btn.setAttribute('aria-label', t('timeline.pause')); btn.title = t('timeline.pause');
  if (S.T.idx >= MAX_IDX) setMonth(0);
  const step = () => ($('#btn-speed').getAttribute('aria-pressed') === 'true' ? 12 : 1);
  S.playing = setInterval(() => {
    if (S.T.idx >= MAX_IDX) { stopPlay(); return; }
    setMonth(S.T.idx + step());
  }, 160);
}
function stopPlay() {
  if (!S.playing) return;
  clearInterval(S.playing); S.playing = null;
  const btn = $('#btn-play');
  btn.setAttribute('aria-pressed', 'false'); btn.innerHTML = iconHTML('play'); btn.setAttribute('aria-label', t('timeline.play')); btn.title = t('timeline.play');
  announceDate();
}

main();
