import { Volume2, VolumeX, X, LocateFixed, PartyPopper, SignalLow, Footprints } from 'lucide-react';
import { ManeuverIcon } from '../lib/icons.jsx';
import { formatDistance, formatDuration, formatClock } from '../lib/format.js';
import { speechSupported } from '../lib/speech.js';

export default function NavigationView({
  destination, route, progress, voice, onToggleVoice, onEnd, onRecenter, follow, rerouting, gpsStale, isDesktop,
}) {
  const step = progress ? route.steps[progress.nextIndex] : route.steps[0];
  const after = progress ? route.steps[progress.nextIndex + 1] : route.steps[1];

  if (progress?.arrived) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-[1200] p-3 md:left-auto md:right-4 md:top-4 md:bottom-auto md:w-[380px]">
        <div className="card animate-slideUp p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aureolin-400 text-ink-900"><PartyPopper size={30} /></span>
          <h2 className="mt-3 text-2xl font-extrabold">You have arrived</h2>
          <p className="mt-1 text-ink-500">{destination.name}</p>
          <button onClick={onEnd} className="btn-primary mt-5 w-full">Done</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Next instruction */}
      <div className={`safe-top absolute left-0 right-0 top-0 z-[1200] px-3 ${isDesktop ? 'md:left-4 md:right-auto md:w-[400px] md:pt-4' : ''}`}>
        <div className="animate-slideUp overflow-hidden rounded-3xl bg-cobalt-700 text-white shadow-float">
          {rerouting ? (
            <div className="flex items-center gap-3 p-4">
              <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white border-r-transparent" />
              <p className="text-lg font-bold">Rerouting from your position…</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <ManeuverIcon kind={step?.kind} size={32} strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-3xl font-extrabold leading-none">{progress ? formatDistance(progress.distToNext) : '—'}</p>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-cobalt-100">
                  {step?.kind === 'arrive' ? `Arrive at ${destination.name}` : step?.instruction}
                </p>
              </div>
            </div>
          )}
          {after && !rerouting && (
            <div className="flex items-center gap-2 bg-cobalt-800 px-4 py-2 text-sm text-cobalt-100">
              <span className="font-semibold">Then</span>
              <ManeuverIcon kind={after.kind} size={16} />
              <span className="truncate">{after.kind === 'arrive' ? destination.name : after.instruction}</span>
            </div>
          )}
        </div>
        {gpsStale && (
          <p className="mt-2 flex items-center gap-2 rounded-2xl bg-aureolin-400 px-4 py-2 text-sm font-semibold text-ink-900 shadow-float">
            <SignalLow size={16} /> Weak GPS signal: waiting for a new position…
          </p>
        )}
        {progress?.offRoute && !rerouting && (
          <p className="mt-2 rounded-2xl bg-vermilion-500 px-4 py-2 text-sm font-semibold text-white shadow-float">
            You are {formatDistance(progress.offRouteBy)} off the route
          </p>
        )}
      </div>

      {/* Trip summary */}
      <div className={`safe-bottom absolute inset-x-0 bottom-0 z-[1200] px-3 ${isDesktop ? 'md:left-4 md:right-auto md:w-[400px] md:pb-4' : ''}`}>
        {!follow && (
          <button onClick={onRecenter} className="btn mb-2 bg-white text-[#1A73E8] shadow-float"><LocateFixed size={18} /> Re-centre</button>
        )}
        <div className="card animate-slideUp p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-vermilion-500">{formatDuration(progress?.remainingSeconds ?? route.duration)}</span>
                <span className="text-sm font-semibold text-ink-500">{formatDistance(progress?.remaining ?? route.distance)}</span>
              </p>
              <p className="truncate text-sm text-ink-500">
                <Footprints size={13} className="mr-1 inline" />Arrive {formatClock(progress?.remainingSeconds ?? route.duration)} · {destination.name}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {speechSupported && (
                <button onClick={onToggleVoice} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-ink-700" aria-label={voice ? 'Mute voice' : 'Unmute voice'}>
                  {voice ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
              )}
              <button onClick={onEnd} className="btn bg-vermilion-500 px-4 text-white hover:bg-vermilion-600"><X size={18} /> End</button>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round((progress?.progress || 0) * 100)}>
            <div className="h-full rounded-full bg-gradient-to-r from-cobalt-600 to-vermilion-500 transition-[width] duration-700"
              style={{ width: `${Math.round((progress?.progress || 0) * 100)}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}
