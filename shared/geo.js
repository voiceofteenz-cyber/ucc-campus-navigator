// Small geodesy helpers shared by server and client. Points are { lat, lng }.

const R = 6371008.8; // mean Earth radius (m)
export const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing a→b in degrees (0 = north). */
export function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassWord(deg) {
  const words = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return words[Math.round(deg / 45) % 8];
}

// Local flat projection (accurate to well under a metre at campus scale).
function local(p, ref) {
  return {
    x: toRad(p.lng - ref.lng) * Math.cos(toRad(ref.lat)) * R,
    y: toRad(p.lat - ref.lat) * R,
  };
}

/** Project p onto segment a-b. Returns t ∈ [0,1] and perpendicular distance (m). */
export function projectOnSegment(p, a, b) {
  const P = local(p, a);
  const B = local(b, a);
  const len2 = B.x * B.x + B.y * B.y;
  let t = len2 ? (P.x * B.x + P.y * B.y) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { t, dist: Math.hypot(P.x - t * B.x, P.y - t * B.y) };
}

/** Ray-casting point-in-polygon. ring: array of {lat,lng}. */
export function pointInPolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) &&
        p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

/** Polygon area (m²) and area-weighted centroid. ring: array of {lat,lng}. */
export function polygonStats(ring) {
  if (!ring || ring.length < 3) return { area: 0, centroid: ring?.[0] ?? null };
  const ref = ring[0];
  const pts = ring.map((p) => local(p, ref));
  let A = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    A += f; cx += (pts[j].x + pts[i].x) * f; cy += (pts[j].y + pts[i].y) * f;
  }
  A /= 2;
  if (Math.abs(A) < 1e-6) {
    const lat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
    const lng = ring.reduce((s, p) => s + p.lng, 0) / ring.length;
    return { area: 0, centroid: { lat, lng } };
  }
  cx /= 6 * A; cy /= 6 * A;
  const lat = ref.lat + toDeg(cy / R);
  const lng = ref.lng + toDeg(cx / (R * Math.cos(toRad(ref.lat))));
  return { area: Math.abs(A), centroid: { lat, lng } };
}
