import { useEffect, useState } from 'react';
import { X, Radio, Flag, Navigation, Crosshair, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { MODE_INFO } from '../lib/modes.js';
import { formatDistance, formatDuration, formatClock } from '../lib/format.js';
import { Spinner } from './ui.jsx';

const POLL_MS = 4000;

/** Polls a live trip shared by a friend ("Track ETA"). */
export function useLiveTrip(id) {
  const [state, setState] = useState({ data: null, error: null, loading: !!id });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    let timer;
    const ctrl = new AbortController();
    const tick = () => {
      api.liveGet(id, ctrl.signal)
        .then((data) => { if (alive) setState({ data, error: null, loading: false }); if (alive && !data.ended) timer = setTimeout(tick, POLL_MS); })
        .catch((e) => {
          if (!alive || e.name === 'AbortError') return;
          setState((s) => ({ ...s, error: e.message, loading: false }));
          if (!/ended|expired/i.test(e.message)) timer = setTimeout(tick, POLL_MS * 2);
        });
    };
    tick();
    return () => { alive = false; clearTimeout(timer); ctrl.abort(); };
  }, [id]);
  return state;
}

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 10 ? 'just now' : s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}

export default function LivePanel({ trip, onClose, onCentre, onDirectionsToFriend }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  const d = trip.data;
  const who = d?.name || 'Your friend';
  const mode = MODE_INFO[d?.mode] || MODE_INFO.foot;
  const stale = d && !d.ended && !d.arrived && Date.now() - d.updatedAt > 60_000;

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Radio size={18} className={d && !d.ended && !d.arrived ? 'text-vermilion-500' : 'text-ink-400'} /> Live trip
        </h2>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-500" aria-label="Close live trip">
          <X size={18} />
        </button>
      </div>

      {trip.loading && <p className="flex items-center gap-3 rounded-2xl bg-cobalt-50 p-4 text-sm font-medium text-cobalt-700"><Spinner /> Loading the live trip…</p>}

      {!d && trip.error && (
        <div className="rounded-2xl bg-vermilion-500/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-bold text-vermilion-600"><AlertTriangle size={16} /> Live trip unavailable</p>
          <p className="mt-1 text-ink-700">{trip.error}</p>
        </div>
      )}

      {d && (
        <div className="animate-slideUp">
          <div className={`rounded-3xl p-4 text-white ${d.arrived ? 'bg-emerald-600' : d.ended ? 'bg-slate-500' : 'bg-cobalt-600'}`}>
            <p className="text-sm font-semibold text-white/80">
              {d.arrived ? `${who} has arrived` : d.ended ? `${who} stopped sharing` : `${who} is on the way · ${mode.doing}`}
            </p>
            <p className="mt-0.5 text-lg font-extrabold leading-snug">{d.destName ? `To ${d.destName}` : 'Live location'}</p>
            {!d.arrived && !d.ended && d.remainingSeconds != null && (
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-extrabold leading-none">{formatClock(d.remainingSeconds - (Date.now() - d.updatedAt) / 1000)}</p>
                  <p className="mt-1 text-xs text-white/80">estimated arrival</p>
                </div>
                <p className="text-right text-sm font-semibold">{formatDuration(d.remainingSeconds)} · {formatDistance(d.remaining)} left</p>
              </div>
            )}
            {d.progress != null && !d.ended && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-aureolin-400 transition-[width] duration-700" style={{ width: `${Math.round((d.arrived ? 1 : d.progress) * 100)}%` }} />
              </div>
            )}
          </div>
          <p className={`mt-2 text-xs ${stale ? 'font-semibold text-vermilion-600' : 'text-ink-500'}`}>
            {d.arrived ? <><Flag size={12} className="mr-1 inline" />Arrived</> : `Last update ${ago(d.updatedAt)}`}
            {stale && ' · their phone may have lost signal'}
            {d.accuracy != null && !d.ended && ` · GPS ±${Math.round(d.accuracy)} m`}
          </p>

          {d.lat != null && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onCentre} className="btn-ghost"><Crosshair size={17} /> Show {who === 'Your friend' ? 'friend' : who}</button>
              <button onClick={onDirectionsToFriend} className="btn-primary"><Navigation size={17} /> Go to them</button>
            </div>
          )}
          <p className="mt-4 text-[11px] text-ink-400">Updates every few seconds while they are sharing. Sharing stops automatically when they end the trip or after 4 hours.</p>
        </div>
      )}
    </div>
  );
}
