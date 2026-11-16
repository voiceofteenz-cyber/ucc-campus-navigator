// Unit tests: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { categorize } from '../shared/categories.js';
import { haversine, pointInPolygon, polygonStats } from '../shared/geo.js';
import { prepareRoute, progressFor, splitRoute } from '../src/lib/nav.js';
import { _internal as osm } from '../server/osm.js';
import { _internal as routing } from '../server/routing.js';

test('categorize maps OSM tags and names to categories', () => {
  assert.equal(categorize({ name: 'Sam Jonah Library', building: 'university' }), 'library');
  assert.equal(categorize({ amenity: 'atm', name: 'GCB ATM' }), 'bank');
  assert.equal(categorize({ name: 'Large Lecture Theatre' }), 'lecture');
  assert.equal(categorize({ name: 'Atlantic Hall', building: 'dormitory' }), 'hostel');
  assert.equal(categorize({ amenity: 'hospital', name: 'University Hospital' }), 'health');
  assert.equal(categorize({ amenity: 'parking' }), 'parking');
  assert.equal(categorize({ leisure: 'pitch', sport: 'soccer' }), 'sports');
  assert.equal(categorize({ name: 'Department of Physics' }), 'department');
  assert.equal(categorize({ amenity: 'university', name: 'University of Cape Coast' }, { areaM2: 2e6 }), 'campus');
});

test('geo helpers', () => {
  const d = haversine({ lat: 5.1, lng: -1.29 }, { lat: 5.101, lng: -1.29 });
  assert.ok(Math.abs(d - 111.2) < 0.5, `got ${d}`);
  const sq = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 }];
  assert.equal(pointInPolygon({ lat: 0.5, lng: 0.5 }, sq), true);
  assert.equal(pointInPolygon({ lat: 1.5, lng: 0.5 }, sq), false);
  const s = polygonStats(sq);
  assert.ok(Math.abs(s.centroid.lat - 0.5) < 1e-3 && Math.abs(s.centroid.lng - 0.5) < 1e-3);
});

// An L-shaped 300 m route: 200 m north then 100 m east.
const dLat = 200 / 111195, dLng = 100 / (111195 * Math.cos(5.1 * Math.PI / 180));
const A = [5.1, -1.29], B = [5.1 + dLat, -1.29], C = [5.1 + dLat, -1.29 + dLng];
const rawRoute = {
  distance: 300, duration: 216,
  geometry: [A, B, C],
  steps: [
    { instruction: 'Head north', kind: 'depart', location: A, distance: 200, duration: 144 },
    { instruction: 'Turn right', kind: 'right', location: B, distance: 100, duration: 72 },
    { instruction: 'Arrive', kind: 'arrive', location: C, distance: 0, duration: 0 },
  ],
};

test('navigation progress, next step and ETA', () => {
  const r = prepareRoute(rawRoute);
  assert.ok(Math.abs(r.total - 300) < 1);
  assert.ok(Math.abs(r.steps[1].along - 200) < 1);
  const pos = { lat: 5.1 + dLat / 2, lng: -1.29, accuracy: 5 }; // halfway up the first leg
  const p = progressFor(r, pos, { lat: C[0], lng: C[1] });
  assert.ok(Math.abs(p.along - 100) < 1);
  assert.ok(Math.abs(p.remaining - 200) < 1);
  assert.equal(p.nextIndex, 1);
  assert.ok(Math.abs(p.distToNext - 100) < 1);
  assert.ok(Math.abs(p.remainingSeconds - 144) < 1); // uses routing engine pace (0.72 s/m)
  assert.equal(p.offRoute, false);
  assert.equal(p.arrived, false);
  const split = splitRoute(r, p.along);
  assert.equal(split.done.length, 2);
});

test('off-route and arrival detection', () => {
  const r = prepareRoute(rawRoute);
  const far = progressFor(r, { lat: 5.1 + dLat / 2, lng: -1.29 + 80 / 110900, accuracy: 5 }, null);
  assert.equal(far.offRoute, true);
  const end = progressFor(r, { lat: C[0], lng: C[1] - 0.00005, accuracy: 5 }, { lat: C[0], lng: C[1] });
  assert.equal(end.arrived, true);
});

test('OSM multipolygon rings are joined', () => {
  const w1 = { type: 'way', role: 'outer', geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }] };
  const w2 = { type: 'way', role: 'outer', geometry: [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 1, lon: 1 }] };
  const rings = osm.ringsOf({ type: 'relation', members: [w1, w2] });
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 5);
});

test('facilities inside a building are linked', () => {
  const places = osm.linkPlaces([
    { id: 'way/1', name: 'Science Block', lat: 0.5, lng: 0.5, area: 5000, polygon: [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]] },
    { id: 'node/2', name: 'Physics Lab', lat: 0.4, lng: 0.4 },
    { id: 'node/3', name: 'Elsewhere', lat: 2, lng: 2 },
  ]);
  assert.deepEqual(places[0].contains, ['node/2']);
  assert.equal(places[1].within, 'way/1');
  assert.equal(places[2].within, undefined);
});

test('OSRM manoeuvres become readable instructions', () => {
  const f = (maneuver, name = '') => routing.osrmInstruction({ maneuver, name }).text;
  assert.equal(f({ type: 'depart', bearing_after: 0 }, 'Science Road'), 'Head north along Science Road');
  assert.equal(f({ type: 'turn', modifier: 'left' }, 'Valco Road'), 'Turn left onto Valco Road');
  assert.equal(f({ type: 'roundabout', exit: 2 }), 'At the roundabout, take the second exit');
  assert.equal(f({ type: 'arrive' }), 'Arrive at your destination');
});
