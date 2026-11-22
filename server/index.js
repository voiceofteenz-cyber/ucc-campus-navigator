import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCampusData } from './osm.js';
import crypto from 'node:crypto';
import { route, RoutingError, MODES } from './routing.js';

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
  const mode = String(req.query.mode || 'foot');
  if (!from || !to) return res.status(400).json({ error: 'Provide from=lat,lng and to=lat,lng.' });
  if (!MODES[mode]) return res.status(400).json({ error: 'mode must be foot, car, bike or moto.' });
  try {
    res.json(await route(from, to, mode));
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

// ---------- Live trip sharing ("Track ETA") ----------
// Kept in memory only: a trip lives at most 4 hours, is dropped after 30 minutes without updates,
// and stays readable for 10 minutes after it ends so viewers see "arrived / ended".
const live = new Map();
const LIVE_MAX_MS = 4 * 3600_000, LIVE_IDLE_MS = 30 * 60_000, LIVE_ENDED_MS = 10 * 60_000;
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
function cleanLive(b = {}) {
  const out = {
    name: str(b.name, 40), destName: str(b.destName, 80),
    mode: MODES[b.mode] ? b.mode : undefined,
    lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180), accuracy: num(b.accuracy, 0, 100000),
    remaining: num(b.remaining, 0, 1e7), remainingSeconds: num(b.remainingSeconds, 0, 1e7), progress: num(b.progress, 0, 1),
    arrived: typeof b.arrived === 'boolean' ? b.arrived : undefined,
  };
  if (b.dest && num(b.dest.lat, -90, 90) !== undefined && num(b.dest.lng, -180, 180) !== undefined) out.dest = { lat: b.dest.lat, lng: b.dest.lng };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}
function sweepLive() {
  const now = Date.now();
  for (const [id, s] of live) {
    if (now - s.createdAt > LIVE_MAX_MS || now - s.updatedAt > LIVE_IDLE_MS || (s.endedAt && now - s.endedAt > LIVE_ENDED_MS)) live.delete(id);
  }
}
setInterval(sweepLive, 60_000).unref();
const liveJson = express.json({ limit: '4kb' });
const owns = (req, s) => s && typeof req.get('x-live-token') === 'string' && req.get('x-live-token') === s.token;

app.post('/api/live', liveJson, (req, res) => {
  sweepLive();
  if (live.size >= 1000) return res.status(503).json({ error: 'Too many live trips right now. Try again later.' });
  const id = crypto.randomBytes(6).toString('base64url');
  const token = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  live.set(id, { token, createdAt: now, updatedAt: now, endedAt: null, data: cleanLive(req.body) });
  res.json({ id, token, expiresAt: new Date(now + LIVE_MAX_MS).toISOString() });
});
app.put('/api/live/:id', liveJson, (req, res) => {
  const s = live.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'This live trip has ended or expired.' });
  if (!owns(req, s)) return res.status(403).json({ error: 'Not allowed.' });
  if (s.endedAt) return res.status(410).json({ error: 'This live trip has ended.' });
  s.data = { ...s.data, ...cleanLive(req.body) };
  s.updatedAt = Date.now();
  res.json({ ok: true });
});
app.delete('/api/live/:id', (req, res) => {
  const s = live.get(req.params.id);
  if (!s) return res.json({ ok: true });
  if (!owns(req, s)) return res.status(403).json({ error: 'Not allowed.' });
  s.endedAt = Date.now(); s.updatedAt = s.endedAt;
  res.json({ ok: true });
});
app.get('/api/live/:id', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const s = live.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'This live trip has ended or expired.' });
  res.json({ ...s.data, updatedAt: s.updatedAt, ended: !!s.endedAt, expiresAt: s.createdAt + LIVE_MAX_MS });
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
