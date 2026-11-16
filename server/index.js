import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCampusData } from './osm.js';
import { walkingRoute, RoutingError } from './routing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5174);
const USER_AGENT = process.env.USER_AGENT || 'UCC-Campus-Navigator/1.0 (university student project)';
const app = express();
app.disable('x-powered-by');

const parsePoint = (s) => {
  const [lat, lng] = String(s || '').split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Places + campus outlines (paths are served separately to keep this payload small).
app.get('/api/campus', async (_req, res) => {
  try {
    const d = await getCampusData();
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ generatedAt: d.generatedAt, source: d.source, bbox: d.bbox, campus: d.campus, places: d.places });
  } catch (err) {
    console.error('[api] campus data:', err.message);
    res.status(503).json({ error: 'Campus map data could not be downloaded from OpenStreetMap. Check the server\'s internet connection and try again.' });
  }
});

app.get('/api/paths', async (_req, res) => {
  try {
    const d = await getCampusData();
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ paths: d.paths || [] });
  } catch {
    res.status(503).json({ error: 'Footpath data unavailable.' });
  }
});

app.get('/api/route', async (req, res) => {
  const from = parsePoint(req.query.from);
  const to = parsePoint(req.query.to);
  if (!from || !to) return res.status(400).json({ error: 'Provide from=lat,lng and to=lat,lng.' });
  try {
    res.json(await walkingRoute(from, to));
  } catch (err) {
    const status = err instanceof RoutingError ? err.status : 503;
    console.warn('[api] route:', err.message);
    res.status(status).json({ error: err.message || 'Walking route service unavailable.' });
  }
});

// OpenStreetMap search (Nominatim) limited to the campus area, for things not in the local list.
app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const { bbox } = await getCampusData();
    const params = new URLSearchParams({
      q, format: 'jsonv2', limit: '8', bounded: '1', addressdetails: '0',
      viewbox: `${bbox.w},${bbox.n},${bbox.e},${bbox.s}`,
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list = await r.json();
    res.json({
      results: list.map((x) => ({
        id: `${x.osm_type}/${x.osm_id}`, name: x.name || x.display_name.split(',')[0],
        label: x.display_name, lat: Number(x.lat), lng: Number(x.lon), type: x.type,
      })),
    });
  } catch (err) {
    res.status(503).json({ error: 'OpenStreetMap search is unavailable right now.', detail: err.message });
  }
});

// Building photo from Wikidata (P18 image) when the OSM feature links to Wikidata.
const photoCache = new Map();
app.get('/api/photo', async (req, res) => {
  const qid = String(req.query.wikidata || '');
  if (!/^Q\d+$/.test(qid)) return res.status(400).json({ error: 'Invalid Wikidata id' });
  if (photoCache.has(qid)) return res.json(photoCache.get(qid));
  try {
    const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json();
    const file = j.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const out = file
      ? { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=900`, credit: `Wikimedia Commons: ${file}`, page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}` }
      : { url: null };
    photoCache.set(qid, out);
    res.json(out);
  } catch {
    res.json({ url: null });
  }
});

// Production: serve the built React app.
const dist = path.join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`UCC Campus Navigator API listening on http://localhost:${PORT}`);
  // Warm the campus data cache on start-up.
  getCampusData().catch((e) => console.warn('[startup] Campus data not loaded yet:', e.message));
});
