import { useMemo } from 'react';
import { Navigation, RefreshCw, AlertTriangle, Footprints, Info, X, CircleDot, MapPin } from 'lucide-react';
import { haversine } from '../../shared/geo.js';
import { ManeuverIcon } from '../lib/icons.jsx';
import { formatDistance, formatDuration, formatClock } from '../lib/format.js';
import { Spinner } from './ui.jsx';
import LocationNotice from './LocationNotice.jsx';

export default function DirectionsPanel({
  destination, origin, onOrigin, places, geo, routeState, onStart, onClose, onRetry,
}) {
  const route = routeState.data;
  const sortedPlaces = useMemo(() => places.filter((p) => !p.unnamed && p.id !== destination.id)
    .sort((a, b) => a.name.localeCompare(b.name)), [places, destination]);
  const connector = route ? haversine(route.pts[route.pts.length - 1], destination) : 0;
  const usingGps = origin === 'gps';
  const totalTime = route ? route.duration + connector * (route.pace || 0) : null;

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Walking directions</h2>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-500 hover:bg-slate-200" aria-label="Close directions">
          <X size={18} />
        </button>
      </div>

      {/* From / To */}
      <div className="relative rounded-3xl border border-slate-200 p-3">
        <span className="absolute left-[27px] top-[38px] h-[26px] border-l-2 border-dotted border-slate-300" />
        <label className="flex items-center gap-3">
          <CircleDot size={18} className="shrink-0 text-[#1A73E8]" />
          <select value={usingGps ? 'gps' : origin.id} onChange={(e) => onOrigin(e.target.value === 'gps' ? 'gps' : sortedPlaces.find((p) => p.id === e.target.value))}
            className="min-w-0 flex-1 appearance-none truncate bg-transparent py-1.5 text-sm font-semibold outline-none" aria-label="Starting point">
            <option value="gps">Your location (live GPS)</option>
            <optgroup label="Or preview from a campus place">
              {sortedPlaces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          </select>
        </label>
        <div className="my-1 ml-8 border-t border-slate-100" />
        <div className="flex items-center gap-3">
          <MapPin size={18} className="shrink-0 text-vermilion-500" />
          <span className="truncate py-1.5 text-sm font-semibold">{destination.name}</span>
        </div>
      </div>

      {usingGps && geo.status !== 'watching' && <div className="mt-3"><LocationNotice geo={geo} /></div>}

      {routeState.status === 'loading' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cobalt-50 p-4 text-sm font-medium text-cobalt-700">
          <Spinner /> Calculating the best walking route…
        </div>
      )}

      {routeState.status === 'error' && (
        <div className="mt-4 rounded-2xl bg-vermilion-500/10 p-4 text-sm text-vermilion-600">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle size={16} /> Route unavailable</p>
          <p className="mt-1 text-ink-700">{routeState.error}</p>
          <button onClick={onRetry} className="btn-outline mt-3 py-2"><RefreshCw size={15} /> Try again</button>
        </div>
      )}

      {route && routeState.status === 'ready' && (
        <div className="animate-slideUp">
          <div className="mt-4 flex items-end justify-between rounded-3xl bg-cobalt-600 p-4 text-white">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-cobalt-100"><Footprints size={14} /> Walking</p>
              <p className="text-3xl font-extrabold leading-none">{formatDuration(totalTime)}</p>
              <p className="mt-1 text-sm text-cobalt-100">{formatDistance(route.distance + connector)}{usingGps && <> · arrive {formatClock(totalTime)}</>}</p>
            </div>
            {usingGps ? (
              <button onClick={onStart} disabled={!geo.position} className="btn bg-aureolin-400 px-5 text-ink-900 hover:bg-aureolin-300">
                <Navigation size={18} /> START NAVIGATION
              </button>
            ) : (
              <span className="max-w-[45%] text-right text-[11px] text-cobalt-100">Preview only. Live navigation starts from your GPS location.</span>
            )}
          </div>

          {connector > 25 && (
            <p className="mt-3 flex gap-2 rounded-2xl bg-aureolin-300/30 p-3 text-xs text-ink-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              The mapped paths end about {formatDistance(connector)} from {destination.name}. The dotted line shows the final stretch; follow the entrance signs there.
            </p>
          )}
          {route.snap?.start > 40 && usingGps && (
            <p className="mt-3 flex gap-2 rounded-2xl bg-aureolin-300/30 p-3 text-xs text-ink-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              You are about {formatDistance(route.snap.start)} from the nearest mapped path. Walk to the start of the blue line first.
            </p>
          )}

          <h3 className="section-title mt-5">Step-by-step · {route.steps.length} steps</h3>
          <ol className="relative">
            {route.steps.map((s, i) => (
              <li key={i} className="flex gap-3 py-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.kind === 'arrive' ? 'bg-vermilion-500 text-white' : 'bg-cobalt-50 text-cobalt-700'}`}>
                  <ManeuverIcon kind={s.kind} size={18} />
                </span>
                <div className="min-w-0 flex-1 border-b border-slate-100 pb-2.5">
                  <p className="text-sm font-semibold text-ink-900">{s.kind === 'arrive' ? `Arrive at ${destination.name}` : s.instruction}</p>
                  {s.distance > 0 && <p className="text-xs text-ink-500">{formatDistance(s.distance)} · {formatDuration(s.duration)}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-ink-400">Route: {route.provider}. Distances and times are calculated from OpenStreetMap paths.</p>
        </div>
      )}
    </div>
  );
}
