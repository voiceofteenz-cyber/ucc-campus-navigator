export function formatDistance(m) {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 10) return `${Math.round(m)} m`;
  if (m < 1000) return `${m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(s) {
  if (s == null || !Number.isFinite(s)) return '—';
  const min = Math.round(s / 60);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

export function formatClock(secondsFromNow) {
  if (secondsFromNow == null || !Number.isFinite(secondsFromNow)) return '—';
  const d = new Date(Date.now() + secondsFromNow * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

/** Spoken form of a distance ("in 50 metres"). */
export function spokenDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} kilometres`;
  const r = m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
  return `${Math.max(10, r)} metres`;
}
