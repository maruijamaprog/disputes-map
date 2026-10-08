// Карта MapLibre: подложка, единицы CShapes по годам, зоны споров с ролевыми узорами.
/* global maplibregl */

const NONE = '__none__';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function hexToRgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Узоры для ролей: рисуются на canvas, чтобы не зависеть от спрайтов. */
function makePattern(kind, colors) {
  const s = 24; // 12 css px при pixelRatio 2
  const c = document.createElement('canvas'); c.width = s; c.height = s;
  const g = c.getContext('2d');
  // непрозрачная основа: перекрывающиеся полигоны одной зоны не дают более тёмных пятен
  g.fillStyle = colors.unit; g.fillRect(0, 0, s, s);
  const diag = (color, w, offset = 0) => {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'square';
    for (let k = -s; k <= s * 2; k += 12) { g.beginPath(); g.moveTo(k + offset, s); g.lineTo(k + s + offset, 0); g.stroke(); }
  };
  switch (kind) {
    case 'N': g.fillStyle = colors.neutralBg; g.fillRect(0, 0, s, s); diag(colors.neutral, 2); break;
    case 'B': g.fillStyle = colors.b; g.fillRect(0, 0, s, s); break;
    case 'C': g.fillStyle = hexToRgba(colors.c, 0.45); g.fillRect(0, 0, s, s); diag(colors.c, 4); break;
    case 'D': g.fillStyle = colors.b; g.fillRect(0, 0, s, s); diag(colors.c, 6); break;
    case 'E': g.fillStyle = hexToRgba(colors.e, 0.35); g.fillRect(0, 0, s, s); diag(colors.e, 3);
      g.save(); g.translate(s, 0); g.scale(-1, 1); diag(colors.e, 3); g.restore(); break;
    case 'R': g.fillStyle = hexToRgba(colors.r, 0.4); g.fillRect(0, 0, s, s); g.fillStyle = colors.r;
      for (const [x, y] of [[6, 6], [18, 18]]) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); } break;
    default: break;
  }
  const img = g.getImageData(0, 0, s, s);
  return { width: s, height: s, data: img.data };
}

export function themeColors() {
  return {
    ocean: css('--ocean'), land: css('--land'), unit: css('--unit'), unitBorder: css('--unit-border'),
    neutral: css('--neutral'), neutralBg: css('--neutral-bg'), select: css('--select'),
    a: css('--role-a'), b: css('--role-b'), c: css('--role-c'), e: css('--role-e'), r: css('--role-r'),
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
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': col.ocean } }],
    },
    center: [30, 30],
    zoom: 1.4,
    minZoom: 0.6,
    maxZoom: 9,
    renderWorldCopies: false,
    attributionControl: { compact: true, customAttribution: 'CShapes 2.0 (ETH Zürich, CC BY-NC 4.0) · Natural Earth' },
    dragRotate: false,
    pitchWithRotate: false,
    cooperativeGestures: false,
  });
  map.touchZoomRotate.disableRotation();
  map.once('load', () => map.fitBounds([[-168, -57], [180, 78]], { padding: 10, duration: 0 }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  const state = { visible: [], changed: [], roles: new Map(), actor: null, unitId: null, selected: null, hoverDispute: null };
  const ready = new Promise((resolve) => map.on('load', resolve));

  function addPatterns() {
    const colors = themeColors();
    for (const k of ['N', 'B', 'C', 'D', 'E', 'R']) {
      const name = `pat-${k}`;
      const img = makePattern(k, colors);
      if (map.hasImage(name)) map.updateImage(name, img); else map.addImage(name, img, { pixelRatio: 2 });
    }
  }

  function roleMatch(kind) {
    // kind: 'pattern' (fill-pattern) | 'color' (circle-color)
    const groups = { B: [], C: [], D: [], E: [], R: [] };
    for (const [id, r] of state.roles) groups[r]?.push(id);
    const c = themeColors();
    const expr = ['match', ['get', 'area_id']];
    let any = false;
    for (const r of ['B', 'D', 'E', 'C', 'R']) {
      if (!groups[r].length) continue;
      any = true;
      expr.push(groups[r], kind === 'pattern' ? `pat-${r}` : ({ B: c.b, C: c.c, D: c.b, E: c.e, R: c.r })[r]);
    }
    const def = kind === 'pattern' ? 'pat-N' : c.neutral;
    if (!any) return def;
    expr.push(def);
    return expr;
  }

  async function init(land, disputes, markers) {
    await ready;
    state.disputesFC = disputes;
    addPatterns();
    const c = themeColors();
    map.addSource('land', { type: 'geojson', data: land });
    map.addSource('countries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'i' });
    map.addSource('disputes', { type: 'geojson', data: disputes });
    map.addSource('markers', { type: 'geojson', data: markers });
    map.addLayer({ id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': c.land } });
    map.addLayer({ id: 'countries-fill', type: 'fill', source: 'countries', paint: { 'fill-color': c.unit } });
    map.addLayer({ id: 'countries-hl', type: 'fill', source: 'countries', filter: ['==', ['get', 'a'], NONE], paint: { 'fill-color': c.a, 'fill-opacity': 0.55 } });
    map.addLayer({ id: 'countries-line', type: 'line', source: 'countries', paint: { 'line-color': c.unitBorder, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2] } });
    map.addLayer({ id: 'countries-hl-line', type: 'line', source: 'countries', filter: ['==', ['get', 'a'], NONE], paint: { 'line-color': c.a, 'line-width': 1.6 } });
    map.addLayer({ id: 'disputes-fill', type: 'fill', source: 'disputes', filter: ['in', ['get', 'area_id'], ['literal', []]], paint: { 'fill-pattern': 'pat-N' } });
    map.addLayer({ id: 'disputes-line', type: 'line', source: 'disputes', filter: ['all', ['==', ['get', 'ol'], 1], ['in', ['get', 'area_id'], ['literal', []]]], paint: { 'line-color': c.neutral, 'line-width': 0.8 } });
    map.addLayer({ id: 'disputes-changed', type: 'line', source: 'disputes', filter: ['in', ['get', 'area_id'], ['literal', []]], paint: { 'line-color': c.select, 'line-width': 1.6, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'disputes-hover', type: 'line', source: 'disputes', filter: ['==', ['get', 'dispute_id'], NONE], paint: { 'line-color': c.select, 'line-width': 1.6 } });
    map.addLayer({ id: 'disputes-selected', type: 'line', source: 'disputes', filter: ['==', ['get', 'dispute_id'], NONE], paint: { 'line-color': c.select, 'line-width': 3 } });
    map.addLayer({ id: 'markers', type: 'circle', source: 'markers', filter: ['in', ['get', 'area_id'], ['literal', []]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 9], 'circle-color': c.neutral, 'circle-stroke-color': c.select, 'circle-stroke-width': 1.2, 'circle-opacity': 0.9 } });
    bindEvents();
  }

  function setCountries(fc) { map.getSource('countries')?.setData(fc); }

  function setDate(ref) {
    const f = ['all', ['<=', ['get', 's'], ref], ['>=', ['get', 'e'], ref]];
    map.setFilter('countries-fill', f);
    map.setFilter('countries-line', f);
    applyActor();
  }
  let currentRef = 0;
  function setRef(ref) { currentRef = ref; setDate(ref); }

  function setVisible(areaIds, changedIds) {
    state.visible = areaIds; state.changed = changedIds;
    const inVis = ['in', ['get', 'area_id'], ['literal', areaIds]];
    map.setFilter('disputes-fill', inVis);
    map.setFilter('disputes-line', ['all', ['==', ['get', 'ol'], 1], inVis]);
    map.setFilter('markers', inVis);
    map.setFilter('disputes-changed', ['in', ['get', 'area_id'], ['literal', changedIds]]);
  }

  function applyActor() {
    const dateF = ['all', ['<=', ['get', 's'], currentRef], ['>=', ['get', 'e'], currentRef]];
    let f;
    if (state.actor) f = ['all', ['==', ['get', 'a'], state.actor], dateF];
    else if (state.unitId !== null) f = ['all', ['==', ['get', 'i'], state.unitId], dateF];
    else f = ['==', ['get', 'a'], NONE];
    map.setFilter('countries-hl', f);
    map.setFilter('countries-hl-line', f);
    map.setPaintProperty('disputes-fill', 'fill-pattern', roleMatch('pattern'));
    map.setPaintProperty('markers', 'circle-color', roleMatch('color'));
  }

  function setActor(actor, unitId, roles) {
    state.actor = actor || null; state.unitId = actor ? null : (unitId ?? null); state.roles = roles || new Map();
    if (map.getLayer('countries-hl')) applyActor();
  }

  function setSelected(disputeId) {
    state.selected = disputeId;
    map.setFilter('disputes-selected', ['==', ['get', 'dispute_id'], disputeId || NONE]);
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
    map.setPaintProperty('countries-fill', 'fill-color', c.unit);
    map.setPaintProperty('countries-line', 'line-color', c.unitBorder);
    map.setPaintProperty('countries-hl', 'fill-color', c.a);
    map.setPaintProperty('countries-hl-line', 'line-color', c.a);
    for (const id of ['disputes-changed', 'disputes-hover', 'disputes-selected']) map.setPaintProperty(id, 'line-color', c.select);
    map.setPaintProperty('disputes-line', 'line-color', c.neutral);
    map.setPaintProperty('markers', 'circle-stroke-color', c.select);
    applyActor();
  }

  function pick(point) {
    const fs = map.queryRenderedFeatures(point, { layers: ['markers', 'disputes-fill', 'countries-fill'] });
    const d = fs.find((f) => f.layer.id === 'markers' || f.layer.id === 'disputes-fill');
    if (d) return { kind: 'dispute', props: d.properties };
    const c = fs.find((f) => f.layer.id === 'countries-fill');
    if (c) return { kind: 'country', props: c.properties };
    return null;
  }

  function bindEvents() {
    map.on('mousemove', (e) => {
      const hit = pick(e.point);
      map.getCanvas().style.cursor = hit ? 'pointer' : '';
      handlers.onHover?.(hit, e.point);
    });
    map.getCanvas().addEventListener('mouseleave', () => handlers.onHover?.(null));
    map.on('click', (e) => handlers.onClick?.(pick(e.point), e.point));
  }

  function flyToFeatureBounds(disputeId) {
    const feats = (state.disputesFC?.features || []).filter((f) => f.properties.dispute_id === disputeId);
    if (!feats.length) return;
    let minx = 180, miny = 90, maxx = -180, maxy = -90;
    const walk = (c) => { if (typeof c[0] === 'number') { minx = Math.min(minx, c[0]); maxx = Math.max(maxx, c[0]); miny = Math.min(miny, c[1]); maxy = Math.max(maxy, c[1]); } else c.forEach(walk); };
    feats.forEach((f) => walk(f.geometry.coordinates));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 60, maxZoom: 6, duration: reduce ? 0 : 900 });
  }

  return { map, init, setCountries, setRef, setVisible, setActor, setSelected, setHoverDispute, refreshTheme, flyToFeatureBounds };
}
