// Карта MapLibre: подложка, единицы CShapes по эпохам, подписи стран, зоны споров с ролевыми узорами
// и слой режима «Военные конфликты». Цвета берутся из CSS-переменных активной темы.
// Суша без единицы CShapes на дату (Гренландия, Антарктида, микрогосударства) не закрашивается, но отвечает на наведение справкой.
/* global maplibregl */

const NONE = '__none__';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function hexToRgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Узоры для ролей рисуются на canvas, чтобы не зависеть от спрайтов. */
function makePattern(kind, colors) {
  const s = 24; // 12 css px при pixelRatio 2
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const g = c.getContext('2d');
  // непрозрачная основа: перекрывающиеся полигоны одной зоны не дают более тёмных пятен
  g.fillStyle = colors.patternBase; g.fillRect(0, 0, s, s);
  const diag = (color, w, offset = 0) => {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'square';
    for (let k = -s; k <= s * 2; k += 12) { g.beginPath(); g.moveTo(k + offset, s); g.lineTo(k + s + offset, 0); g.stroke(); }
  };
  const dots = (color, r) => { g.fillStyle = color; for (const [x, y] of [[6, 6], [18, 18]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } };
  switch (kind) {
    case 'N': g.fillStyle = colors.neutralBg; g.fillRect(0, 0, s, s); diag(colors.neutral, 2); break;
    case 'B': g.fillStyle = colors.b; g.fillRect(0, 0, s, s); break;
    case 'C': g.fillStyle = hexToRgba(colors.c, 0.45); g.fillRect(0, 0, s, s); diag(colors.c, 4); break;
    case 'D': g.fillStyle = colors.b; g.fillRect(0, 0, s, s); diag(colors.c, 6); break;
    case 'E': g.fillStyle = hexToRgba(colors.e, 0.35); g.fillRect(0, 0, s, s); diag(colors.e, 3);
      g.save(); g.translate(s, 0); g.scale(-1, 1); diag(colors.e, 3); g.restore(); break;
    case 'R': g.fillStyle = hexToRgba(colors.r, 0.4); g.fillRect(0, 0, s, s); dots(colors.r, 3.5); break;
    case 'T': g.fillStyle = hexToRgba(colors.b, 0.35); g.fillRect(0, 0, s, s); dots(colors.b, 4); break;
    // режим войн
    case 'WM': g.fillStyle = colors.warMajor; g.fillRect(0, 0, s, s); break;
    case 'Wm': g.fillStyle = colors.warMinor; g.fillRect(0, 0, s, s); break;
    case 'WS': g.fillStyle = hexToRgba(colors.warMinor, 0.35); g.fillRect(0, 0, s, s); diag(colors.warMajor, 3); break;
    case 'WP': g.fillStyle = hexToRgba(colors.warMinor, 0.25); g.fillRect(0, 0, s, s); dots(colors.warMajor, 2.5); break;
    case 'WF': g.fillStyle = colors.warMajor; g.fillRect(0, 0, s, s); break;
    case 'WL': g.fillStyle = colors.r; g.fillRect(0, 0, s, s); break;
    case 'WX': g.fillStyle = colors.a; g.fillRect(0, 0, s, s); break;
    case 'WO': g.fillStyle = hexToRgba(colors.warMinor, 0.18); g.fillRect(0, 0, s, s); break;
    case 'WU': g.fillStyle = hexToRgba(colors.warMinor, 0.3); g.fillRect(0, 0, s, s); dots(colors.warMajor, 3); break;
    default: break;
  }
  const img = g.getImageData(0, 0, s, s);
  return { width: s, height: s, data: img.data };
}

export const DISPUTE_PATTERNS = ['N', 'B', 'C', 'D', 'E', 'R', 'T'];
export const WAR_PATTERNS = ['WM', 'Wm', 'WS', 'WU', 'WP', 'WF', 'WL', 'WX', 'WO'];

export function themeColors() {
  const pol = [0, 1, 2, 3, 4, 5].map((i) => css(`--pol-${i}`));
  return {
    ocean: css('--ocean'), land: css('--land'), unit: css('--unit'), unitBorder: css('--unit-border'),
    neutral: css('--neutral'), neutralBg: css('--neutral-bg'), select: css('--select'), patternBase: css('--pattern-base') || css('--unit'),
    a: css('--role-a'), b: css('--role-b'), c: css('--role-c'), e: css('--role-e'), r: css('--role-r'),
    warMajor: css('--war-major'), warMinor: css('--war-minor'),
    label: css('--label'), labelHalo: css('--label-halo'), political: css('--political') === '1', pol,
  };
}

export function patternDataURL(kind) {
  const p = makePattern(kind, themeColors());
  const c = document.createElement('canvas'); c.width = p.width; c.height = p.height;
  c.getContext('2d').putImageData(new ImageData(p.data, p.width, p.height), 0, 0);
  return c.toDataURL();
}

export function createMap(container, handlers) {
  const col = themeColors();
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      glyphs: `${new URL('.', document.baseURI).href}assets/glyphs/{fontstack}/{range}.pbf`,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': col.ocean } }],
    },
    center: [30, 30],
    zoom: 1.4,
    minZoom: -1,   // узкая карта (планшет, панель справа) должна вмещать весь мир
    maxZoom: 9,
    renderWorldCopies: false,
    attributionControl: { compact: true, customAttribution: 'CShapes 2.0 (ETH Zürich, CC BY-NC 4.0) · Natural Earth · UCDP/PRIO · Correlates of War' },
    dragRotate: false,
    pitchWithRotate: false,
    cooperativeGestures: false,
  });
  map.touchZoomRotate.disableRotation();
  // панель и шапка не перекрывают карту, поэтому отступы нужны только под шкалу времени
  map.once('load', () => map.fitBounds([[-168, -57], [180, 78]], { padding: { top: 16, bottom: 110, left: 10, right: 10 }, duration: 0 }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  const state = { mode: 'disputes', visible: [], changed: [], roles: new Map(), warRoles: new Map(), actor: null, unitId: null, warGw: null,
    selected: null, hoverDispute: null, labels: true, lang: 'ru', ref: 0, landHover: null, landSelected: null,
    routes: false, routeHover: null, routeSelected: null };
  const ready = new Promise((resolve) => map.on('load', resolve));

  function addPatterns() {
    const colors = themeColors();
    for (const k of [...DISPUTE_PATTERNS, ...WAR_PATTERNS]) {
      const name = `pat-${k}`;
      const img = makePattern(k, colors);
      if (map.hasImage(name)) map.updateImage(name, img); else map.addImage(name, img, { pixelRatio: 2 });
    }
  }

  function unitFill(c) {
    if (!c.political) return c.unit;
    return ['match', ['get', 'c'], 0, c.pol[0], 1, c.pol[1], 2, c.pol[2], 3, c.pol[3], 4, c.pol[4], 5, c.pol[5], c.unit];
  }

  function roleMatch(kind) {
    // kind: 'pattern' (fill-pattern) | 'color' (circle-color)
    const groups = { B: [], C: [], D: [], E: [], R: [], T: [] };
    for (const [id, r] of state.roles) groups[r]?.push(id);
    const c = themeColors();
    const expr = ['match', ['get', 'area_id']];
    let any = false;
    for (const r of ['B', 'D', 'E', 'T', 'C', 'R']) {
      if (!groups[r].length) continue;
      any = true;
      expr.push(groups[r], kind === 'pattern' ? `pat-${r}` : ({ B: c.b, C: c.c, D: c.b, E: c.e, R: c.r, T: c.b })[r]);
    }
    const def = kind === 'pattern' ? 'pat-N' : c.neutral;
    if (!any) return def;
    expr.push(def);
    return expr;
  }

  function warMatch() {
    const groups = {};
    for (const [gw, r] of state.warRoles) (groups[r] ||= []).push(gw);
    const expr = ['match', ['get', 'g']];
    let any = false;
    for (const r of WAR_PATTERNS) {
      if (!groups[r]?.length) continue;
      any = true; expr.push(groups[r], `pat-${r}`);
    }
    if (!any) return 'pat-WO';
    expr.push('pat-WO');
    return expr;
  }

  const dateFilter = () => ['all', ['<=', ['get', 's'], state.ref], ['>=', ['get', 'e'], state.ref]];

  async function init(land, disputes) {
    await ready;
    state.disputesFC = disputes;
    addPatterns();
    const c = themeColors();
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource('land', { type: 'geojson', data: land });
    map.addSource('countries', { type: 'geojson', data: empty, promoteId: 'i' });
    map.addSource('labels', { type: 'geojson', data: empty });
    map.addSource('disputes', { type: 'geojson', data: disputes });
    map.addLayer({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': c.land } });
    map.addLayer({ id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': unitFill(c) } });
    map.addLayer({ id: 'countries-war', type: 'fill', source: 'countries', layout: { visibility: 'none' }, filter: ['==', ['get', 'g'], -1], paint: { 'fill-pattern': 'pat-WO' } });
    map.addLayer({ id: 'countries-hl', type: 'fill', source: 'countries', filter: ['==', ['get', 'a'], NONE], paint: { 'fill-color': c.a, 'fill-opacity': 0.55 } });
    map.addLayer({ id: 'countries-line', type: 'line', source: 'countries', paint: { 'line-color': c.unitBorder, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2] } });
    map.addLayer({ id: 'countries-hl-line', type: 'line', source: 'countries', filter: ['==', ['get', 'a'], NONE], paint: { 'line-color': c.a, 'line-width': 1.8 } });
    map.addLayer({ id: 'land-hl', type: 'line', source: 'land', filter: ['==', ['get', 'k'], -1], paint: { 'line-color': c.select, 'line-width': 1.4, 'line-dasharray': [2, 1.5] } });
    map.addLayer({ id: 'disputes-fill', type: 'fill', source: 'disputes', filter: ['in', ['get', 'area_id'], ['literal', []]], paint: { 'fill-pattern': 'pat-N' } });
    map.addLayer({ id: 'disputes-line', type: 'line', source: 'disputes', filter: ['all', ['==', ['get', 'ol'], 1], ['in', ['get', 'area_id'], ['literal', []]]], paint: { 'line-color': c.neutral, 'line-width': 0.8 } });
    map.addLayer({ id: 'disputes-changed', type: 'line', source: 'disputes', filter: ['in', ['get', 'area_id'], ['literal', []]], paint: { 'line-color': c.select, 'line-width': 1.6, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'disputes-hover', type: 'line', source: 'disputes', filter: ['==', ['get', 'dispute_id'], NONE], paint: { 'line-color': c.select, 'line-width': 1.6 } });
    map.addLayer({ id: 'disputes-selected', type: 'line', source: 'disputes', filter: ['==', ['get', 'dispute_id'], NONE], paint: { 'line-color': c.select, 'line-width': 3 } });
    // транспортные маршруты: подложка-обводка, пунктир (объявлен), сплошная (действует), подсветка, невидимая зона наведения
    map.addSource('routes', { type: 'geojson', data: empty });
    const off = ['match', ['get', 'r'], 'traceca', -2.2, 'middle', 2.2, 0];
    const vis = { visibility: 'none' };
    map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { ...vis, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.labelHalo, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.6, 6, 6], 'line-opacity': 0.85, 'line-offset': off } });
    map.addLayer({ id: 'routes-sel', type: 'line', source: 'routes', layout: { ...vis, 'line-cap': 'round', 'line-join': 'round' }, filter: ['==', ['get', 'r'], NONE],
      paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 7, 6, 11], 'line-opacity': 0.28, 'line-offset': off } });
    map.addLayer({ id: 'routes-planned', type: 'line', source: 'routes', layout: { ...vis, 'line-join': 'round' },
      paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 6, 3], 'line-dasharray': [2.2, 1.6], 'line-offset': off } });
    map.addLayer({ id: 'routes-operating', type: 'line', source: 'routes', layout: { ...vis, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.2, 6, 3.6], 'line-offset': off } });
    map.addLayer({ id: 'routes-hit', type: 'line', source: 'routes', layout: vis,
      paint: { 'line-color': '#000', 'line-width': 14, 'line-opacity': 0, 'line-offset': off } });
    map.addLayer({
      id: 'labels', type: 'symbol', source: 'labels',
      filter: ['==', ['get', 'k'], -1],
      layout: {
        'text-field': ['get', 'r'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
          1, ['match', ['get', 'k'], 1, 12, 2, 10.5, 3, 9.5, 9],
          4, ['match', ['get', 'k'], 1, 17, 2, 15, 3, 13.5, 4, 12.5, 5, 11.5, 11],
          7, ['match', ['get', 'k'], 1, 20, 2, 18, 3, 16, 4, 15, 5, 14, 13]],
        'text-transform': ['case', ['<=', ['get', 'k'], 2], 'uppercase', 'none'],
        'text-letter-spacing': ['case', ['<=', ['get', 'k'], 2], 0.08, 0.02],
        'text-max-width': 7,
        'text-padding': 3,
        'symbol-sort-key': ['get', 'k'],
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.4 },
    });
    applyLabelFilter();
    bindEvents();
  }

  function setCountries(fc, labelsFC) {
    map.getSource('countries')?.setData(fc);
    map.getSource('labels')?.setData(labelsFC || { type: 'FeatureCollection', features: [] });
  }

  function applyLabelFilter() {
    if (!map.getLayer('labels')) return;
    // мелкие страны подписываются только при приближении
    const zoomOk = ['any', ['<=', ['get', 'k'], 3], ['all', ['==', ['get', 'k'], 4], ['>=', ['zoom'], 2.2]], ['all', ['==', ['get', 'k'], 5], ['>=', ['zoom'], 3.2]], ['>=', ['zoom'], 4.2]];
    map.setFilter('labels', state.labels ? ['all', ...dateFilter().slice(1), zoomOk] : ['==', ['get', 'k'], -1]);
    map.setLayoutProperty('labels', 'text-field', ['get', state.lang === 'en' ? 'n' : 'r']);
  }

  function setRef(ref) {
    state.ref = ref;
    if (!map.getLayer('countries-fill')) return;
    const f = dateFilter();
    map.setFilter('countries-fill', f);
    map.setFilter('countries-line', f);
    map.setFilter('countries-war', f);
    applyLabelFilter();
    applyActor();
    applyRoutes();
  }

  // ---------------------------------------------------------------- маршруты
  function setRoutesData(geo) { state.routesGeo = geo; map.getSource('routes')?.setData(geo); applyRoutes(); }
  function setRoutesVisible(on) { state.routes = !!on; applyRoutes(); }
  function applyRoutes() {
    if (!map.getLayer('routes-hit')) return;
    const v = state.routes ? 'visible' : 'none';
    const ref = state.ref;
    const shown = ['<=', ['get', 's'], ref];
    for (const id of ['routes-casing', 'routes-sel', 'routes-planned', 'routes-operating', 'routes-hit']) map.setLayoutProperty(id, 'visibility', v);
    map.setFilter('routes-casing', shown);
    map.setFilter('routes-hit', shown);
    map.setFilter('routes-planned', ['all', shown, ['>', ['get', 'o'], ref]]);
    map.setFilter('routes-operating', ['all', shown, ['<=', ['get', 'o'], ref]]);
    const ids = [state.routeHover, state.routeSelected].filter(Boolean);
    map.setFilter('routes-sel', ids.length ? ['all', shown, ['in', ['get', 'r'], ['literal', ids]]] : ['==', ['get', 'r'], NONE]);
  }
  function setRouteHover(id) { if (state.routeHover !== id) { state.routeHover = id || null; applyRoutes(); } }
  function setRouteSelected(id) { state.routeSelected = id || null; applyRoutes(); }
  function flyToRoute(id) {
    const fs = (state.routesGeo?.features || []).filter((f) => f.properties.r === id);
    if (!fs.length) return;
    let pts = fs.flatMap((f) => f.geometry.coordinates);
    // маршрут через 180-й меридиан (СМП): рамку строим по восточному полушарию
    if (pts.some((p) => p[0] > 150) && pts.some((p) => p[0] < -150)) pts = pts.filter((p) => p[0] > 0);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: fitPadding(), maxZoom: 6, duration: reduce ? 0 : 900 });
  }

  function setLabels(on, lang) { state.labels = on; state.lang = lang || state.lang; applyLabelFilter(); }

  function setMode(mode) {
    state.mode = mode;
    if (!map.getLayer('countries-war')) return;
    const war = mode === 'wars';
    map.setLayoutProperty('countries-war', 'visibility', war ? 'visible' : 'none');
    for (const id of ['disputes-fill', 'disputes-line', 'disputes-changed', 'disputes-hover', 'disputes-selected']) {
      map.setLayoutProperty(id, 'visibility', war ? 'none' : 'visible');
    }
    applyActor();
  }

  function setVisible(areaIds, changedIds) {
    state.visible = areaIds; state.changed = changedIds;
    const inVis = ['in', ['get', 'area_id'], ['literal', areaIds]];
    map.setFilter('disputes-fill', inVis);
    map.setFilter('disputes-line', ['all', ['==', ['get', 'ol'], 1], inVis]);
    map.setFilter('disputes-changed', ['in', ['get', 'area_id'], ['literal', changedIds]]);
  }

  function applyActor() {
    if (!map.getLayer('countries-hl')) return;
    const dateF = dateFilter();
    let f = ['==', ['get', 'a'], NONE];
    if (state.mode === 'disputes') {
      if (state.actor) f = ['all', ['==', ['get', 'a'], state.actor], dateF];
      else if (state.unitId !== null) f = ['all', ['==', ['get', 'i'], state.unitId], dateF];
    }
    map.setFilter('countries-hl', f);
    map.setFilter('countries-hl-line', state.mode === 'wars' && state.warGw !== null ? ['all', ['==', ['get', 'g'], state.warGw], dateF] : f);
    map.setPaintProperty('disputes-fill', 'fill-pattern', roleMatch('pattern'));
    const warGws = [...state.warRoles.keys()];
    map.setFilter('countries-war', ['all', ...dateF.slice(1), ['in', ['get', 'g'], ['literal', warGws]]]);
    map.setPaintProperty('countries-war', 'fill-pattern', warMatch());
  }

  function setActor(actor, unitId, roles) {
    state.actor = actor || null; state.unitId = actor ? null : (unitId ?? null); state.roles = roles || new Map();
    applyActor();
  }

  function setWarRoles(roles, selectedGw) {
    state.warRoles = roles || new Map(); state.warGw = selectedGw ?? null;
    applyActor();
  }

  function setSelected(disputeId) {
    state.selected = disputeId;
    if (map.getLayer('disputes-selected')) map.setFilter('disputes-selected', ['==', ['get', 'dispute_id'], disputeId || NONE]);
  }

  function setHoverDispute(disputeId) {
    if (state.hoverDispute === disputeId) return;
    state.hoverDispute = disputeId;
    map.setFilter('disputes-hover', ['==', ['get', 'dispute_id'], disputeId || NONE]);
  }

  function refreshTheme() {
    if (!map.getLayer('land')) return;
    const c = themeColors();
    addPatterns();
    map.setPaintProperty('background', 'background-color', c.ocean);
    map.setPaintProperty('land', 'fill-color', c.land);
    map.setPaintProperty('countries-fill', 'fill-color', unitFill(c));
    map.setPaintProperty('countries-line', 'line-color', c.unitBorder);
    map.setPaintProperty('countries-hl', 'fill-color', c.a);
    map.setPaintProperty('countries-hl-line', 'line-color', c.a);
    for (const id of ['disputes-changed', 'disputes-hover', 'disputes-selected']) map.setPaintProperty(id, 'line-color', c.select);
    map.setPaintProperty('disputes-line', 'line-color', c.neutral);
    map.setPaintProperty('land-hl', 'line-color', c.select);
    map.setPaintProperty('routes-casing', 'line-color', c.labelHalo);
    map.setPaintProperty('labels', 'text-color', c.label);
    map.setPaintProperty('labels', 'text-halo-color', c.labelHalo);
    applyActor();
  }

  /** Суша без единицы CShapes на текущую дату: интервалы «ГГГГММДД-ГГГГММДД» через запятую в свойстве u. */
  function landUncovered(p) {
    if (!p?.u) return false;
    return String(p.u).split(',').some((iv) => { const [s, e] = iv.split('-').map(Number); return s <= state.ref && state.ref <= e; });
  }

  function pick(point) {
    if (state.routes && map.getLayer('routes-hit')) {
      const r = map.queryRenderedFeatures(point, { layers: ['routes-hit'] });
      if (r.length) return { kind: 'route', props: r[0].properties };
    }
    const layers = state.mode === 'wars' ? ['countries-fill', 'land'] : ['disputes-fill', 'countries-fill', 'land'];
    const fs = map.queryRenderedFeatures(point, { layers });
    const d = fs.find((f) => f.layer.id === 'disputes-fill');
    if (d) return { kind: 'dispute', props: d.properties };
    const c = fs.find((f) => f.layer.id === 'countries-fill');
    if (c) return { kind: 'country', props: c.properties };
    const l = fs.find((f) => f.layer.id === 'land' && landUncovered(f.properties));
    if (l) return { kind: 'ref', props: l.properties };
    return null;
  }

  function applyLandHl() {
    if (!map.getLayer('land-hl')) return;
    const ks = [state.landHover, state.landSelected].filter((k) => k !== null && k !== undefined);
    map.setFilter('land-hl', ks.length ? ['in', ['get', 'k'], ['literal', ks]] : ['==', ['get', 'k'], -1]);
  }
  function setLandHover(k) { if (state.landHover !== k) { state.landHover = k; applyLandHl(); } }
  function setLandSelected(k) { state.landSelected = k; applyLandHl(); }

  function bindEvents() {
    map.on('mousemove', (e) => {
      const hit = pick(e.point);
      map.getCanvas().style.cursor = hit ? 'pointer' : '';
      handlers.onHover?.(hit, e.point);
    });
    map.getCanvas().addEventListener('mouseleave', () => handlers.onHover?.(null));
    map.on('click', (e) => handlers.onClick?.(pick(e.point), e.point));
  }

  function fitPadding() {
    return { top: 40, bottom: 140, left: 40, right: 40 };
  }

  function flyToFeatureBounds(disputeId) {
    const feats = (state.disputesFC?.features || []).filter((f) => f.properties.dispute_id === disputeId);
    if (!feats.length) return;
    let minx = 180, miny = 90, maxx = -180, maxy = -90;
    const walk = (c) => { if (typeof c[0] === 'number') { minx = Math.min(minx, c[0]); maxx = Math.max(maxx, c[0]); miny = Math.min(miny, c[1]); maxy = Math.max(maxy, c[1]); } else c.forEach(walk); };
    feats.forEach((f) => walk(f.geometry.coordinates));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds([[minx, miny], [maxx, maxy]], { padding: fitPadding(), maxZoom: 6, duration: reduce ? 0 : 900 });
  }

  return { map, init, setCountries, setRef, setVisible, setActor, setWarRoles, setSelected, setHoverDispute, refreshTheme, flyToFeatureBounds, setMode, setLabels,
    setLandHover, setLandSelected, landUncovered, setRoutesData, setRoutesVisible, setRouteHover, setRouteSelected, flyToRoute };
}
