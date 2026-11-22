// Loads real University of Cape Coast map data from OpenStreetMap (Overpass API).
// Nothing here invents a location: every place, outline and path comes from OSM.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categorize, fallbackName } from '../shared/categories.js';
import { polygonStats, pointInPolygon, haversine } from '../shared/geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_FILE = path.join(__dirname, 'data', 'campus.json');
const CACHE_HOURS = Number(process.env.CACHE_HOURS || 72);
const USER_AGENT = process.env.USER_AGENT || 'UCC-Campus-Navigator/1.0 (university student project)';

const OVERPASS_URLS = (process.env.OVERPASS_URLS ||
  'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Published coordinate of the University of Cape Coast (Wikipedia: 5.115788 N, 1.290810 W).
// Used ONLY to find the campus polygons in OSM, and as a last-resort search window.
export const UCC_REFERENCE = { lat: 5.115788, lng: -1.29081 };
const FALLBACK_BBOX = { s: 5.096, w: -1.312, n: 5.134, e: -1.268 };
const BBOX_PADDING_DEG = 0.004; // ~450 m around the campus outline (catches nearby hostels)

async function overpass(query) {
  let lastError;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`${new URL(url).host} responded HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      console.warn(`[osm] Overpass mirror failed: ${err.message}`);
    }
  }
  throw new Error(`All Overpass mirrors failed (${lastError?.message})`);
}

const ll = (g) => ({ lat: g.lat, lng: g.lon });

/** Outer ring(s) of a way or multipolygon relation returned with `out geom`. */
function ringsOf(el) {
  if (el.type === 'way' && el.geometry?.length > 2) {
    const ring = el.geometry.map(ll);
    const first = ring[0], last = ring[ring.length - 1];
    const closed = first.lat === last.lat && first.lng === last.lng;
    return closed ? [ring] : [];
  }
  if (el.type === 'relation' && el.members) {
    // Join outer member ways into rings.
    const segs = el.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry?.length > 1)
      .map((m) => m.geometry.map(ll));
    const rings = [];
    const key = (p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
    while (segs.length) {
      let ring = segs.shift();
      let progress = true;
      while (key(ring[0]) !== key(ring[ring.length - 1]) && progress) {
        progress = false;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          const end = key(ring[ring.length - 1]);
          if (key(s[0]) === end) { ring = ring.concat(s.slice(1)); }
          else if (key(s[s.length - 1]) === end) { ring = ring.concat(s.slice(0, -1).reverse()); }
          else continue;
          segs.splice(i, 1); progress = true; break;
        }
      }
      if (ring.length > 3) rings.push(ring);
    }
    return rings;
  }
  return [];
}

const round = (n) => Math.round(n * 1e6) / 1e6;
const simplifyRing = (ring) => ring.map((p) => [round(p.lat), round(p.lng)]);

const KEEP_TAGS = ['name', 'alt_name', 'short_name', 'official_name', 'old_name', 'amenity', 'building', 'leisure',
  'shop', 'office', 'tourism', 'healthcare', 'highway', 'sport', 'operator', 'brand', 'description', 'note',
  'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website', 'email', 'addr:street', 'addr:housename',
  'building:levels', 'image', 'wikimedia_commons', 'wikidata', 'wikipedia', 'wheelchair', 'access', 'capacity',
  'religion', 'denomination', 'cuisine', 'level', 'start_date'];

function pickTags(tags) {
  const out = {};
  for (const k of KEEP_TAGS) if (tags[k]) out[k] = tags[k];
  return out;
}

function isUcc(tags) {
  const n = `${tags.name || ''} ${tags.alt_name || ''} ${tags.short_name || ''} ${tags.operator || ''}`;
  return /cape coast/i.test(n) || /\bUCC\b/.test(n);
}

/** Find UCC campus outlines in OSM and derive the search window. */
async function loadCampus() {
  const q = `[out:json][timeout:60];
nwr["amenity"~"^(university|college)$"](around:4500,${UCC_REFERENCE.lat},${UCC_REFERENCE.lng});
out geom;`;
  const data = await overpass(q);
  const campus = [];
  for (const el of data.elements || []) {
    if (!el.tags || !isUcc(el.tags)) continue;
    for (const ring of ringsOf(el)) {
      const { area } = polygonStats(ring);
      if (area < 40000) continue; // a building, not a campus outline
      campus.push({ id: `${el.type}/${el.id}`, name: el.tags.name || 'University of Cape Coast', ring });
    }
  }
  let bbox;
  if (campus.length) {
    const all = campus.flatMap((c) => c.ring);
    bbox = {
      s: Math.min(...all.map((p) => p.lat)) - BBOX_PADDING_DEG,
      n: Math.max(...all.map((p) => p.lat)) + BBOX_PADDING_DEG,
      w: Math.min(...all.map((p) => p.lng)) - BBOX_PADDING_DEG,
      e: Math.max(...all.map((p) => p.lng)) + BBOX_PADDING_DEG,
    };
    // Guard against a mis-tagged giant polygon.
    if (bbox.n - bbox.s > 0.08 || bbox.e - bbox.w > 0.08) bbox = FALLBACK_BBOX;
  } else {
    console.warn('[osm] No UCC campus outline found in OSM; using fallback search window.');
    bbox = FALLBACK_BBOX;
  }
  return { campus, bbox };
}

async function loadPlaces(bbox) {
  const b = `${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;
  const q = `[out:json][timeout:120];
(
  node["name"][!"place"][!"highway"](${b});
  node["highway"="bus_stop"](${b});
  way["name"][!"highway"][!"waterway"][!"railway"][!"power"][!"boundary"][!"natural"][!"place"](${b});
  relation["name"]["type"="multipolygon"][!"boundary"][!"natural"][!"place"](${b});
  nwr["amenity"~"^(atm|bank|parking|bus_station|place_of_worship|restaurant|cafe|fast_food|pharmacy|clinic|hospital|library|toilets)$"](${b});
  nwr["leisure"~"^(pitch|sports_centre|stadium|track|swimming_pool)$"](${b});
);
out geom;`;
  const data = await overpass(q);
  const places = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    if (!tags.name) {
      const fb = fallbackName(tags);
      if (!fb) continue;
      tags.name = fb;
      tags._unnamed = 'yes';
    }
    let point = null, ring = null, area = 0;
    if (el.type === 'node') point = { lat: el.lat, lng: el.lon };
    else {
      const rings = ringsOf(el);
      if (rings.length) {
        // Use the largest outer ring.
        let best = null;
        for (const r of rings) { const s = polygonStats(r); if (!best || s.area > best.area) best = { ...s, ring: r }; }
        ring = best.ring; area = best.area; point = best.centroid;
        // Centroid of an L/U-shaped building can fall outside; use a vertex-average fallback then.
        if (!pointInPolygon(point, ring)) {
          const inner = ring.find((_, i) => i > 0 && pointInPolygon(midpoint(ring[0], ring[i]), ring));
          if (inner) point = midpoint(ring[0], inner);
        }
      } else if (el.bounds) {
        point = { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lng: (el.bounds.minlon + el.bounds.maxlon) / 2 };
      } else if (el.geometry?.length) {
        point = ll(el.geometry[Math.floor(el.geometry.length / 2)]);
      }
    }
    if (!point) continue;
    if (point.lat < bbox.s || point.lat > bbox.n || point.lng < bbox.w || point.lng > bbox.e) continue;
    if (area > 3_000_000) continue; // huge landuse/admin polygons are not destinations
    const category = categorize(tags, { areaM2: area });
    if (category === 'campus') continue; // campus outlines are returned separately
    if (tags.amenity === 'toilets' && tags._unnamed) continue;
    places.push({
      id: `${el.type}/${el.id}`,
      name: tags.name.trim(),
      lat: round(point.lat),
      lng: round(point.lng),
      category,
      tags: pickTags(tags),
      unnamed: tags._unnamed === 'yes' || undefined,
      area: Math.round(area) || undefined,
      polygon: ring ? simplifyRing(ring) : undefined,
    });
  }
  return linkPlaces(dedupe(places));
}

const midpoint = (a, b) => ({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });

/** Same name mapped twice (e.g. a node inside its building) → keep the richer one. */
function dedupe(places) {
  const byName = new Map();
  for (const p of places) {
    const k = p.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(p);
  }
  const out = [];
  for (const group of byName.values()) {
    const kept = [];
    for (const p of group.sort((a, b) => (b.polygon ? 1 : 0) - (a.polygon ? 1 : 0) || Object.keys(b.tags).length - Object.keys(a.tags).length)) {
      const dup = kept.find((k) => haversine(k, p) < 60 || (k.polygon && pointInPolygon(p, k.polygon.map(([lat, lng]) => ({ lat, lng })))));
      if (dup) { dup.tags = { ...p.tags, ...dup.tags }; continue; }
      kept.push(p);
    }
    out.push(...kept);
  }
  return out;
}

/** Facilities located inside a building outline ("contains") and its parent ("within"). */
function linkPlaces(places) {
  const polys = places.filter((p) => p.polygon && p.area < 300_000)
    .map((p) => ({ p, ring: p.polygon.map(([lat, lng]) => ({ lat, lng })) }))
    .sort((a, b) => a.p.area - b.p.area);
  for (const child of places) {
    for (const { p: parent, ring } of polys) {
      if (parent === child || (child.area && child.area >= parent.area)) continue;
      if (pointInPolygon(child, ring)) {
        child.within = parent.id;
        (parent.contains ||= []).push(child.id);
        break; // smallest enclosing outline
      }
    }
  }
  return places;
}

async function loadPaths(bbox) {
  const b = `${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;
  const q = `[out:json][timeout:90];
way["highway"~"^(footway|path|pedestrian|steps|track|living_street)$"](${b});
out geom;`;
  const data = await overpass(q);
  return (data.elements || []).filter((el) => el.geometry?.length > 1).map((el) => ({
    id: el.id,
    kind: el.tags?.highway,
    name: el.tags?.name,
    coords: el.geometry.map((g) => [round(g.lat), round(g.lon)]),
  }));
}

export async function buildCampusData() {
  console.log('[osm] Downloading UCC campus data from OpenStreetMap…');
  const { campus, bbox } = await loadCampus();
  const places = await loadPlaces(bbox);
  let paths = [];
  try { paths = await loadPaths(bbox); } catch (e) { console.warn('[osm] Footpath layer unavailable:', e.message); }
  const data = {
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap contributors (ODbL) via Overpass API',
    bbox,
    campus: campus.map((c) => ({ id: c.id, name: c.name, ring: simplifyRing(c.ring) })),
    places: places.sort((a, b) => a.name.localeCompare(b.name)),
    paths,
  };
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data));
  console.log(`[osm] Saved ${data.places.length} places, ${paths.length} paths, ${campus.length} campus outline(s).`);
  return data;
}

let memo = null;
let inflight = null;

export async function readCache() {
  try { return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); } catch { return null; }
}

/** Returns cached data immediately when present and refreshes stale data in the background. */
export async function getCampusData() {
  if (!memo) memo = await readCache();
  const stale = !memo || Date.now() - Date.parse(memo.generatedAt) > CACHE_HOURS * 3600_000;
  if (stale && !inflight) {
    inflight = buildCampusData().then((d) => { memo = d; return d; }).finally(() => { inflight = null; });
    if (memo) inflight.catch((e) => console.warn('[osm] Background refresh failed:', e.message));
  }
  if (!memo) return inflight; // first run: wait for the download
  return memo;
}

// Exposed for tests.
export const _internal = { ringsOf, dedupe, linkPlaces };
