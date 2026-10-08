// Точка входа: загрузка данных, состояние, связь карты, шкалы времени и панели.
import { setLang, detectLang, t, tx, getLang, apply } from './i18n.js';
import { decode } from './topo.js';
import { refDate, formatRef, todayInt } from './time.js';
import { units, unitVisible, disputeVisible, rolesFor, changedInYear, eventYears, actorSummary, controllersAt } from './roles.js';
import { createMap } from './map.js';
import { el, TYPES, actorName, renderLegend, renderTypeFilters, showTooltip, hideTooltip, controllerText,
  buildOptions, renderList, renderActorCard, renderDisputeCard } from './ui.js';

const $ = (s) => document.querySelector(s);
const MIN_YEAR = 1900;
const MAX_YEAR = Math.max(2026, Math.floor(todayInt() / 10000));

const S = {
  year: MAX_YEAR, actor: null, unitId: null, unitName: null, pinned: false, selected: null,
  filters: { types: new Set(TYPES), status: 'all', lowconf: true },
  disputes: [], actors: {}, meta: null, eraCache: new Map(), eraKey: null, events: [],
  playing: null, activeOption: null,
};
let M = null; // карта

// ---------------------------------------------------------------- URL
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { y: +p.get('y') || null, a: p.get('a'), d: p.get('d'), lang: p.get('lang') };
}
function writeHash() {
  const p = new URLSearchParams();
  p.set('y', S.year);
  if (S.pinned && S.actor) p.set('a', S.actor);
  if (S.selected) p.set('d', S.selected);
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
    S.eraCache.set(era.file, getJSON(`data/${era.file}`).then((topo) => decode(topo, 'countries')));
  }
  return S.eraCache.get(era.file);
}

function prefetchNeighbours(era) {
  const i = S.meta.eras.indexOf(era);
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 800));
  idle(() => { [S.meta.eras[i - 1], S.meta.eras[i + 1]].filter(Boolean).forEach((e) => loadEra(e)); });
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

function visibleDisputes() {
  return filteredDisputes().filter((d) => disputeVisible(d, S.year));
}

// ---------------------------------------------------------------- обновление
let eraLoading = null;
async function setYear(year, { announce = false } = {}) {
  S.year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
  $('#year').value = S.year;
  $('#year').setAttribute('aria-valuetext', t('timeline.valuetext', { year: S.year }));
  $('#year-num').textContent = S.year;
  $('#ref-label').textContent = t('timeline.ref', { date: formatRef(refDate(S.year), getLang()) });
  if (M) {
    const era = eraFor(S.year);
    if (S.eraKey !== era.file) {
      const p = loadEra(era); eraLoading = p;
      const fc = await p;
      if (eraLoading !== p) return; // устарело
      S.eraKey = era.file;
      M.setCountries(fc);
      prefetchNeighbours(era);
    }
    M.setRef(refDate(S.year));
  }
  refresh();
  if (announce) say(t('announce.year', { year: S.year, n: visibleDisputes().length }));
}

function refresh() {
  const vis = visibleDisputes();
  const areaIds = [], changed = [];
  for (const d of vis) for (const u of units(d)) if (unitVisible(u, S.year)) {
    areaIds.push(u.area_id);
    if (changedInYear(u, S.year)) changed.push(u.area_id);
  }
  if (M) {
    M.setVisible(areaIds, changed);
    M.setActor(S.actor, S.unitId, rolesFor(S.actor, S.year, vis));
    M.setSelected(S.selected && vis.some((d) => d.id === S.selected) ? S.selected : null);
  }
  $('#list-count').textContent = t('list.count', { n: vis.length });
  updateList();
  renderCard();
  writeHash();
}

function renderCard() {
  const card = $('#card');
  const vis = visibleDisputes();
  if (S.selected) {
    const d = S.disputes.find((x) => x.id === S.selected);
    if (d) {
      renderDisputeCard(card, { d, year: S.year, actors: S.actors, geometryMeta: S.meta?.geometry || {},
        onClose: closeCard, onActor: (code) => selectActor(code, null, null, true) });
      return;
    }
  }
  if (S.pinned && (S.actor || S.unitName)) {
    renderActorCard(card, { code: S.actor, unitName: S.unitName, year: S.year, disputes: vis, actors: S.actors,
      onOpenDispute: (id) => selectDispute(id, true), onClose: closeCard });
    return;
  }
  card.hidden = true; card.replaceChildren();
}

function closeCard() {
  S.selected = null; S.pinned = false; S.actor = null; S.unitId = null; S.unitName = null;
  refresh();
  $('#search').focus();
}

function selectActor(code, unitId, unitName, focusCard = false) {
  S.actor = code || null; S.unitId = code ? null : unitId; S.unitName = unitName || null; S.pinned = true; S.selected = null;
  refresh();
  const n = code ? actorSummary(code, S.year, visibleDisputes()).length : 0;
  say(t('announce.actor', { name: actorName(code, S.actors, unitName), n }));
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

function selectDispute(id, fly = false, focusCard = true) {
  S.selected = id;
  refresh();
  const d = S.disputes.find((x) => x.id === id);
  if (d) say(t('announce.dispute', { name: tx(d.name) }));
  if (fly && M) M.flyToFeatureBounds(id);
  openPanelOnMobile();
  if (focusCard) $('#card h2')?.focus();
}

function say(msg) { const live = $('#live'); live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }

// ---------------------------------------------------------------- список (combobox)
function updateList() {
  const opts = buildOptions(S.year, visibleDisputes(), S.actors, $('#search').value);
  renderList($('#listbox'), opts, S.activeOption);
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
  if (kind === 'actor') selectActor(id, null, null);
  else selectDispute(id, true, false);
}

// ---------------------------------------------------------------- карта: наведение и клик
function onHover(hit, point) {
  const tip = $('#tooltip');
  if (!hit) {
    hideTooltip(tip); M.setHoverDispute(null);
    if (!S.pinned) { S.actor = null; S.unitId = null; refreshRolesOnly(); }
    return;
  }
  if (hit.kind === 'dispute') {
    const d = S.disputes.find((x) => x.id === hit.props.dispute_id);
    const u = d && units(d).find((x) => x.area_id === hit.props.area_id);
    M.setHoverDispute(hit.props.dispute_id);
    if (d && u) showTooltip(tip, point, [el('strong', { text: tx(d.name) }),
      units(d).length > 1 ? el('div', { text: tx(u.name) }) : null,
      el('div', { text: t('tooltip.controller', { who: controllerText(u, refDate(S.year), S.actors) }) }),
      el('div', { class: 'muted small', text: t('tooltip.dispute') })].filter(Boolean));
    return;
  }
  M.setHoverDispute(null);
  const p = hit.props;
  const name = getLang() === 'ru' ? p.r : p.n;
  if (!S.pinned) {
    S.actor = p.a || null; S.unitId = p.a ? null : p.i;
    refreshRolesOnly();
  }
  const n = p.a ? actorSummary(p.a, S.year, visibleDisputes()).length : 0;
  showTooltip(tip, point, [el('strong', { text: p.a ? actorName(p.a, S.actors, name) : name }),
    p.a && n ? el('div', { text: t('tooltip.roles', { n }) }) : null,
    el('div', { class: 'muted small', text: t('tooltip.country') })].filter(Boolean));
}

function refreshRolesOnly() {
  M.setActor(S.actor, S.unitId, rolesFor(S.actor, S.year, visibleDisputes()));
}

function onClick(hit) {
  hideTooltip($('#tooltip'));
  if (!hit) { if (S.pinned || S.selected) closeCard(); return; }
  if (hit.kind === 'dispute') { selectDispute(hit.props.dispute_id, false, false); return; }
  const p = hit.props;
  selectActor(p.a || null, p.i, getLang() === 'ru' ? p.r : p.n);
}

// ---------------------------------------------------------------- панель на телефоне
function openPanelOnMobile() {
  if (window.matchMedia('(max-width: 767px)').matches) { $('#panel').classList.add('open'); $('#btn-panel').setAttribute('aria-expanded', 'true'); }
}

// ---------------------------------------------------------------- запуск
async function main() {
  const h = readHash();
  await setLang(detectLang(h.lang));
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));

  let land, dtopo;
  try {
    [S.meta, S.disputes, S.actors, land, dtopo] = await Promise.all([
      getJSON('data/meta.json'), getJSON('data/disputes.json').then((x) => x.disputes), getJSON('data/actors.json'),
      getJSON('data/land.topo.json'), getJSON('data/disputes.topo.json')]);
  } catch (e) {
    console.error(e);
    const box = $('#map-error'); box.hidden = false; box.textContent = t('error.load');
    return;
  }
  S.events = eventYears(S.disputes, MIN_YEAR, MAX_YEAR);
  $('#year').max = MAX_YEAR;

  renderLegend($('#legend'));
  renderTypeFilters($('#filter-types'), S.filters, refresh);

  try {
    M = createMap($('#map'), { onHover, onClick });
    window.__disputesMap = { map: M.map, state: S };
    await M.init(decode(land, 'land'), decode(dtopo, 'areas'), decode(dtopo, 'markers'));
  } catch (e) {
    console.error(e); M = null;
    const box = $('#map-error'); box.hidden = false; box.textContent = t('error.webgl');
  }

  // начальное состояние из URL
  if (h.d && S.disputes.some((d) => d.id === h.d)) S.selected = h.d;
  if (h.a) { S.actor = h.a; S.pinned = true; }
  await setYear(h.y || MAX_YEAR);
  if (S.selected || S.pinned) openPanelOnMobile();

  // события интерфейса
  $('#year').addEventListener('input', (e) => { stopPlay(); setYear(+e.target.value); });
  $('#year').addEventListener('change', () => say(t('announce.year', { year: S.year, n: visibleDisputes().length })));
  $('#btn-prev').addEventListener('click', () => { stopPlay(); const y = [...S.events].reverse().find((v) => v < S.year); if (y) setYear(y, { announce: true }); });
  $('#btn-next').addEventListener('click', () => { stopPlay(); const y = S.events.find((v) => v > S.year); if (y) setYear(y, { announce: true }); });
  $('#btn-play').addEventListener('click', () => (S.playing ? stopPlay() : startPlay()));

  document.querySelectorAll('input[name="status"]').forEach((r) => r.addEventListener('change', (e) => { S.filters.status = e.target.value; refresh(); }));
  $('#filter-lowconf').addEventListener('change', (e) => { S.filters.lowconf = e.target.checked; refresh(); });

  const search = $('#search');
  search.addEventListener('input', () => { S.activeOption = null; updateList(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter' && S.activeOption) { e.preventDefault(); chooseOption(S.activeOption); }
    else if (e.key === 'Escape') { search.value = ''; S.activeOption = null; updateList(); }
  });
  $('#listbox').addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]'); if (!li) return;
    S.activeOption = li.dataset.key; chooseOption(li.dataset.key);
  });

  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', async () => {
    await setLang(b.dataset.lang);
    document.querySelectorAll('.lang button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.lang === getLang())));
    renderLegend($('#legend')); renderTypeFilters($('#filter-types'), S.filters, refresh);
    setYear(S.year);
  }));

  const dlg = $('#disclaimer');
  $('#btn-disclaimer').addEventListener('click', () => dlg.showModal());
  let seen = false;
  try { seen = localStorage.getItem('dm_disclaimer_v1') === '1'; } catch { /* приватный режим */ }
  if (!seen && typeof dlg.showModal === 'function') {
    dlg.showModal();
    dlg.addEventListener('close', () => { try { localStorage.setItem('dm_disclaimer_v1', '1'); } catch { /* ignore */ } }, { once: true });
  }

  $('#btn-panel').addEventListener('click', () => {
    const open = $('#panel').classList.toggle('open');
    $('#btn-panel').setAttribute('aria-expanded', String(open));
  });
  $('#btn-panel-close').addEventListener('click', () => { $('#panel').classList.remove('open'); $('#btn-panel').setAttribute('aria-expanded', 'false'); $('#btn-panel').focus(); });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { M?.refreshTheme(); renderLegend($('#legend')); });
  window.addEventListener('hashchange', () => {
    const n = readHash();
    if (n.y && n.y !== S.year) setYear(n.y);
  });
}

function startPlay() {
  const btn = $('#btn-play');
  btn.setAttribute('aria-pressed', 'true'); btn.textContent = '⏸'; btn.setAttribute('aria-label', t('timeline.pause')); btn.title = t('timeline.pause');
  if (S.year >= MAX_YEAR) setYear(MIN_YEAR);
  S.playing = setInterval(() => {
    if (S.year >= MAX_YEAR) { stopPlay(); return; }
    setYear(S.year + 1);
  }, 600);
}
function stopPlay() {
  if (!S.playing) return;
  clearInterval(S.playing); S.playing = null;
  const btn = $('#btn-play');
  btn.setAttribute('aria-pressed', 'false'); btn.textContent = '▶'; btn.setAttribute('aria-label', t('timeline.play')); btn.title = t('timeline.play');
  say(t('announce.year', { year: S.year, n: visibleDisputes().length }));
}

main();
