// Routing for three travel modes, each with its own dedicated router (never mixed):
//   foot → OSRM foot profile, car → OSRM car profile, bike → OSRM bicycle profile
// (FOSSGIS servers at routing.openstreetmap.de — the routers used on openstreetmap.org).
// Optional fallback: OpenRouteService (foot-walking / driving-car / cycling-regular) when ORS_API_KEY is set.

import { compassWord } from '../shared/geo.js';

const USER_AGENT = process.env.USER_AGENT || 'UCC-Campus-Navigator/1.0 (university student project)';
export const MODES = {
  foot: { osrm: process.env.OSRM_FOOT_URL || 'https://routing.openstreetmap.de/routed-foot', ors: 'foot-walking', label: 'foot' },
  car: { osrm: process.env.OSRM_CAR_URL || 'https://routing.openstreetmap.de/routed-car', ors: 'driving-car', label: 'car' },
  bike: { osrm: process.env.OSRM_BIKE_URL || 'https://routing.openstreetmap.de/routed-bike', ors: 'cycling-regular', label: 'bicycle' },
};
const ORS_API_KEY = process.env.ORS_API_KEY || '';

export class RoutingError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

// ---------- OSRM (foot) ----------

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const MOD_TEXT = {
  left: 'Turn left', right: 'Turn right', 'sharp left': 'Turn sharp left', 'sharp right': 'Turn sharp right',
  'slight left': 'Bear slightly left', 'slight right': 'Bear slightly right', straight: 'Continue straight', uturn: 'Turn around',
};
const kindOf = (modifier) => ({
  left: 'left', right: 'right', 'sharp left': 'sharp-left', 'sharp right': 'sharp-right',
  'slight left': 'slight-left', 'slight right': 'slight-right', straight: 'straight', uturn: 'uturn',
}[modifier] || 'straight');

function osrmInstruction(step) {
  const { type, modifier, bearing_after: bearingAfter, exit } = step.maneuver;
  const on = step.name ? ` onto ${step.name}` : '';
  const along = step.name ? ` along ${step.name}` : '';
  switch (type) {
    case 'depart': return { text: `Head ${compassWord(bearingAfter ?? 0)}${along}`, kind: 'depart' };
    case 'arrive': return { text: 'Arrive at your destination', kind: 'arrive' };
    case 'roundabout': case 'rotary': case 'roundabout turn':
      return { text: `At the roundabout, take the ${ORD[(exit || 1) - 1] || `${exit}th`} exit${on}`, kind: 'roundabout' };
    case 'exit roundabout': case 'exit rotary': return { text: `Exit the roundabout${on}`, kind: 'roundabout' };
    case 'fork': return { text: `Keep ${modifier?.includes('left') ? 'left' : modifier?.includes('right') ? 'right' : 'straight'} at the fork${on}`, kind: kindOf(modifier) };
    case 'merge': return { text: `Merge ${modifier?.includes('left') ? 'left' : 'right'}${on}`, kind: kindOf(modifier) };
    case 'new name': case 'continue':
      if (modifier && modifier !== 'straight') return { text: `${MOD_TEXT[modifier] || 'Continue'}${step.name ? ` to stay on ${step.name}` : ''}`, kind: kindOf(modifier) };
      return { text: `Continue straight${along}`, kind: 'straight' };
    case 'end of road': return { text: `At the end of the path, ${(MOD_TEXT[modifier] || 'turn').toLowerCase()}${on}`, kind: kindOf(modifier) };
    default: // turn, on ramp, notification, etc.
      return { text: `${MOD_TEXT[modifier] || 'Continue'}${on}`, kind: kindOf(modifier) };
  }
}

async function osrmRoute(from, to, mode) {
  // Each FOSSGIS instance serves one profile; the profile segment in the URL is a placeholder.
  const url = `${MODES[mode].osrm}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new RoutingError(`Route service responded HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) {
    throw new RoutingError(json.code === 'NoRoute' ? 'No route found between these points for this travel mode.' : `Routing failed: ${json.message || json.code}`, 422);
  }
  const r = json.routes[0];
  const steps = r.legs.flatMap((leg) => leg.steps).map((s) => {
    const { text, kind } = osrmInstruction(s);
    return {
      instruction: text, kind, name: s.name || '',
      distance: s.distance, duration: s.duration,
      location: [s.maneuver.location[1], s.maneuver.location[0]],
    };
  });
  return {
    provider: `OSRM ${MODES[mode].label} profile (FOSSGIS / OpenStreetMap)`,
    mode,
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps,
    snap: {
      start: json.waypoints?.[0]?.distance ?? null,
      end: json.waypoints?.[1]?.distance ?? null,
    },
  };
}

// ---------- OpenRouteService (foot-walking), optional ----------

const ORS_KIND = { 0: 'left', 1: 'right', 2: 'sharp-left', 3: 'sharp-right', 4: 'slight-left', 5: 'slight-right', 6: 'straight', 7: 'roundabout', 8: 'roundabout', 9: 'uturn', 10: 'arrive', 11: 'depart', 12: 'slight-left', 13: 'slight-right' };

async function orsRoute(from, to, mode) {
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${MODES[mode].ors}/geojson`, {
    method: 'POST',
    headers: { Authorization: ORS_API_KEY, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]], instructions: true, units: 'm' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new RoutingError(`OpenRouteService responded HTTP ${res.status}`);
  const json = await res.json();
  const f = json.features?.[0];
  if (!f) throw new RoutingError('No route found between these points for this travel mode.', 422);
  const coords = f.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const steps = f.properties.segments.flatMap((seg) => seg.steps).map((s) => ({
    instruction: s.instruction, kind: ORS_KIND[s.type] || 'straight', name: s.name && s.name !== '-' ? s.name : '',
    distance: s.distance, duration: s.duration, location: coords[s.way_points[0]],
  }));
  return {
    provider: `OpenRouteService ${MODES[mode].ors} (OpenStreetMap)`,
    mode,
    distance: f.properties.summary.distance,
    duration: f.properties.summary.duration,
    geometry: coords,
    steps,
    snap: { start: null, end: null },
  };
}

export async function route(from, to, mode = 'foot') {
  if (!MODES[mode]) throw new RoutingError('Unknown travel mode.', 400);
  try {
    return await osrmRoute(from, to, mode);
  } catch (err) {
    if (err instanceof RoutingError && err.status === 422) throw err; // a real "no route" answer
    if (ORS_API_KEY) {
      console.warn(`[route] OSRM ${mode} failed, trying OpenRouteService:`, err.message);
      return await orsRoute(from, to, mode);
    }
    throw err instanceof RoutingError ? err
      : new RoutingError('The route service is unreachable right now. Please try again shortly.', 503);
  }
}

export const _internal = { osrmInstruction };
