async function getJson(url, { signal } = {}) {
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('No connection to the UCC Navigator server. Check your internet connection.');
  }
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(body?.error || `Request failed (HTTP ${res.status})`);
  return body;
}

export const api = {
  campus: () => getJson('/api/campus'),
  paths: () => getJson('/api/paths'),
  route: (from, to, signal) => getJson(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`, { signal }),
  geocode: (q, signal) => getJson(`/api/geocode?q=${encodeURIComponent(q)}`, { signal }),
  photo: (qid) => getJson(`/api/photo?wikidata=${encodeURIComponent(qid)}`),
};
