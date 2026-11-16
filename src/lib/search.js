import { CATEGORIES } from '../../shared/categories.js';

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the', 'of', 'and', 'for', 'at', 'a', 'in', 'to', 'block', 'building']);

function initials(name) {
  return norm(name).split(' ').filter((w) => w && !STOP.has(w)).map((w) => w[0]).join('');
}

function lev1(a, b) {
  // true when edit distance ≤ 1 (cheap check for typos)
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Build a search index once per data load. */
export function buildIndex(places, byId) {
  return places.map((p) => {
    const t = p.tags || {};
    const names = [p.name, t.alt_name, t.short_name, t.official_name, t.old_name].filter(Boolean);
    const insideNames = (p.contains || []).map((id) => byId.get(id)?.name).filter(Boolean);
    const parent = p.within ? byId.get(p.within)?.name : '';
    return {
      p,
      names: names.map(norm),
      words: names.flatMap((n) => norm(n).split(' ')),
      acr: names.map(initials).filter((a) => a.length >= 2),
      cat: norm(`${CATEGORIES[p.category]?.label} ${CATEGORIES[p.category]?.short}`),
      extra: norm([t.description, t.operator, t.amenity, t.building !== 'yes' && t.building, t.leisure, t.sport, t.shop, t.office, t.cuisine, parent, ...insideNames].filter(Boolean).join(' ')),
    };
  });
}

/** Ranked search over the index. Returns places. */
export function searchPlaces(index, query, { limit = 40, category } = {}) {
  const q = norm(query);
  if (!q && !category) return [];
  const qWords = q.split(' ').filter(Boolean);
  const scored = [];
  for (const e of index) {
    if (category && e.p.category !== category) continue;
    if (!q) { scored.push({ p: e.p, s: e.p.unnamed ? 0 : 1 }); continue; }
    let s = 0;
    for (const n of e.names) {
      if (n === q) s = Math.max(s, 100);
      else if (n.startsWith(q)) s = Math.max(s, 85);
      else if (n.includes(q)) s = Math.max(s, 60);
    }
    if (e.acr.includes(q.replace(/ /g, ''))) s = Math.max(s, 80);
    // every query word must match something
    let all = true, wordScore = 0;
    for (const w of qWords) {
      if (e.words.some((x) => x.startsWith(w))) wordScore += 12;
      else if (w.length >= 4 && e.words.some((x) => lev1(x, w))) wordScore += 8;
      else if (e.cat.includes(w)) wordScore += 6;
      else if (e.extra.includes(w)) wordScore += 4;
      else { all = false; break; }
    }
    if (all) s = Math.max(s, 20 + wordScore);
    if (s > 0) {
      if (e.p.unnamed) s -= 15;
      if (e.p.polygon) s += 2; // mapped buildings are better destinations
      scored.push({ p: e.p, s });
    }
  }
  scored.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((x) => x.p);
}

// Well-known kinds of destination used for "Popular destinations".
// Each keyword is only matched against real OpenStreetMap names — nothing is added that isn't mapped.
const POPULAR_KEYWORDS = [/library/i, /auditorium/i, /lecture theat/i, /hospital/i, /examination/i, /administration/i,
  /science/i, /stadium|sports complex/i, /\bhall\b/i, /cafeteria|restaurant/i, /bank/i, /senate|council/i];

export function popularPlaces(places, visits = {}, max = 8) {
  const out = [];
  const seen = new Set();
  const push = (p) => { if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); } };
  const byId = new Map(places.map((p) => [p.id, p]));
  Object.entries(visits).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([id]) => push(byId.get(id)));
  const named = places.filter((p) => !p.unnamed);
  for (const re of POPULAR_KEYWORDS) {
    if (out.length >= max) break;
    const match = named.filter((p) => re.test(p.name)).sort((a, b) => (b.area || 0) - (a.area || 0))[0];
    push(match);
  }
  return out.slice(0, max);
}
