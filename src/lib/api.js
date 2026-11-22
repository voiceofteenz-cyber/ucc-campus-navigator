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

async function send(method, url, body, token) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Live-Token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: method === 'DELETE',
    });
  } catch {
    throw new Error('No connection to the UCC Navigator server.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (HTTP ${res.status})`);
  return data;
}

export const api = {
  campus: () => getJson('/api/campus'),
  paths: () => getJson('/api/paths'),
  route: (from, to, mode = 'foot', signal) => getJson(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=${mode}`, { signal }),
  liveCreate: (body) => send('POST', '/api/live', body),
  liveUpdate: (id, token, body) => send('PUT', `/api/live/${id}`, body, token),
  liveEnd: (id, token) => send('DELETE', `/api/live/${id}`, undefined, token),
  liveGet: (id, signal) => getJson(`/api/live/${id}`, { signal }),
  geocode: (q, signal) => getJson(`/api/geocode?q=${encodeURIComponent(q)}`, { signal }),
  photo: (qid) => getJson(`/api/photo?wikidata=${encodeURIComponent(qid)}`),
};
