import { LocateFixed, LocateOff, RefreshCw } from 'lucide-react';
import { Spinner } from './ui.jsx';

/** Explains the current GPS state and offers a retry. Renders nothing when GPS is working. */
export default function LocationNotice({ geo, compact = false }) {
  if (geo.status === 'watching' || geo.status === 'idle') return null;
  if (geo.status === 'locating') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#1A73E8]/10 p-3.5 text-sm font-medium text-[#1558b0]">
        <Spinner /> Finding your location… allow location access when your browser asks.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-vermilion-500/20 bg-vermilion-500/5 p-3.5 text-sm">
      <p className="flex items-center gap-2 font-bold text-vermilion-600"><LocateOff size={16} /> Location unavailable</p>
      <p className="mt-1 text-ink-700">{geo.error}</p>
      {!compact && ['denied', 'unavailable', 'timeout'].includes(geo.status) && (
        <button onClick={geo.start} className="btn-outline mt-3 py-2"><RefreshCw size={15} /> Try again</button>
      )}
      {geo.status === 'denied' && !compact && (
        <p className="mt-2 text-xs text-ink-500">
          <LocateFixed size={12} className="mr-1 inline" />
          Phone: Settings → Privacy / Location → your browser → allow. Desktop: click the lock icon in the address bar → Location → Allow.
        </p>
      )}
    </div>
  );
}
