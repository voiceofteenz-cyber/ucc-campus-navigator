// Live navigation maths: snapping the GPS fix to the route, progress, next manoeuvre,
// off-route detection and arrival. All distances come from the real route geometry;
// time estimates use the routing service's own walking pace for this route.

import { haversine, projectOnSegment } from '../../shared/geo.js';

/** Precompute cumulative distances and where each step sits along the route. */
export function prepareRoute(route) {
  const pts = route.geometry.map(([lat, lng]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + haversine(pts[i - 1], pts[i]);
  const total = cum[cum.length - 1] || 0;
  let hint = 0;
  const steps = route.steps.map((s) => {
    const loc = { lat: s.location[0], lng: s.location[1] };
    const m = locate(pts, cum, loc, hint);
    hint = m.index ?? hint;
    return { ...s, along: m.along ?? 0 };
  });
  // Seconds per metre according to the routing engine (walking pace for this route).
  const pace = route.distance > 0 ? route.duration / route.distance : null;
  return { ...route, pts, cum, total, steps, pace };
}

/** Nearest point on the polyline to p, searching segments [from, to). */
export function locate(pts, cum, p, from = 0, to = pts.length - 1) {
  if (pts.length === 1) return { dist: haversine(p, pts[0]), index: 0, along: 0 };
  let best = { dist: Infinity, index: from, along: cum[from] ?? 0 };
  const start = Math.max(0, from);
  const end = Math.min(pts.length - 1, to);
  for (let i = start; i < end; i++) {
    const { t, dist } = projectOnSegment(p, pts[i], pts[i + 1]);
    if (dist < best.dist) best = { dist, index: i, along: cum[i] + t * (cum[i + 1] - cum[i]) };
  }
  return best;
}

/**
 * Compute navigation state for a GPS fix.
 * @param prepared  result of prepareRoute
 * @param pos       { lat, lng, accuracy }
 * @param dest      { lat, lng } the actual destination (building)
 * @param prev      previous state (for continuity on looping routes)
 */
export function progressFor(prepared, pos, dest, prev) {
  const { pts, cum, total, steps, pace } = prepared;
  let m = locate(pts, cum, pos);
  if (prev && Number.isFinite(prev.index)) {
    // Prefer continuity: if a match near the previous position is almost as good, use it.
    const w = locate(pts, cum, pos, prev.index - 3, prev.index + 80);
    if (w.dist <= m.dist + 10) m = w;
  }
  const along = Math.min(total, Math.max(0, m.along));
  const remainingOnRoute = Math.max(0, total - along);
  const routeEnd = pts[pts.length - 1];
  const connector = dest ? haversine(routeEnd, dest) : 0; // last stretch with no mapped path
  const remaining = remainingOnRoute + connector;
  const toDest = dest ? haversine(pos, dest) : remainingOnRoute;

  const acc = Math.min(pos.accuracy ?? 15, 50);
  const arriveRadius = Math.max(18, acc * 0.8);
  const arrived = toDest <= arriveRadius || (remainingOnRoute < 10 && haversine(pos, routeEnd) <= arriveRadius && connector < 25);

  let nextIndex = steps.findIndex((s, i) => i > 0 && s.along > along + 4);
  if (nextIndex === -1) nextIndex = steps.length - 1;
  const next = steps[nextIndex];
  const distToNext = Math.max(0, (next?.along ?? total) - along);

  const offRouteThreshold = Math.max(30, acc * 1.2);
  return {
    index: m.index,
    along,
    offRouteBy: m.dist,
    offRoute: m.dist > offRouteThreshold,
    remaining,
    remainingSeconds: pace ? remaining * pace : null,
    progress: total > 0 ? along / total : 0,
    nextIndex,
    distToNext,
    arrived,
    toDest,
  };
}

/** Split the route at the current position into walked and remaining parts (for drawing). */
export function splitRoute(prepared, along) {
  const { pts, cum } = prepared;
  const done = [], rest = [];
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] <= along) done.push([pts[i].lat, pts[i].lng]);
    else {
      if (i > 0 && cum[i - 1] <= along) {
        const t = (along - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        const cut = [pts[i - 1].lat + t * (pts[i].lat - pts[i - 1].lat), pts[i - 1].lng + t * (pts[i].lng - pts[i - 1].lng)];
        done.push(cut); rest.push(cut);
      }
      rest.push([pts[i].lat, pts[i].lng]);
    }
  }
  return { done, rest };
}
