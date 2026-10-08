// Минимальный декодер TopoJSON → GeoJSON (Polygon, MultiPolygon, Point; квантование и дельта-кодирование дуг).

export function decode(topology, objectName) {
  const { scale = [1, 1], translate = [0, 0] } = topology.transform || {};
  const arcs = topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  const ring = (ids) => {
    const pts = [];
    ids.forEach((i, k) => {
      const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
      for (let j = k === 0 ? 0 : 1; j < a.length; j++) pts.push(a[j]);
    });
    if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push(pts[0]);
    return pts;
  };
  const obj = topology.objects[objectName];
  const features = obj.geometries.map((g, idx) => {
    let geometry;
    if (g.type === 'Point') {
      geometry = { type: 'Point', coordinates: [g.coordinates[0] * scale[0] + translate[0], g.coordinates[1] * scale[1] + translate[1]] };
    } else if (g.type === 'Polygon') {
      geometry = { type: 'Polygon', coordinates: g.arcs.map(ring) };
    } else {
      geometry = { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) };
    }
    return { type: 'Feature', id: g.id ?? idx, properties: g.properties || {}, geometry };
  });
  return { type: 'FeatureCollection', features };
}
