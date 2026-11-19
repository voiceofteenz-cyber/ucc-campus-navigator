import { useMemo, useState } from 'react';
import { Share2, Copy, Check, X, MessageCircle, MapPin, LocateFixed } from 'lucide-react';
import { haversine } from '../../shared/geo.js';
import { formatDistance } from '../lib/format.js';
import { Spinner } from './ui.jsx';

/** Nearest named campus place, used to describe where the user is ("near Sam Jonah Library"). */
export function nearestLandmark(places, pos, maxDist = 250) {
  let best = null, bd = maxDist;
  for (const p of places) {
    if (p.unnamed) continue;
    const d = haversine(pos, p);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? { place: best, distance: bd } : null;
}

export function buildShareLink(pos, near) {
  const params = new URLSearchParams({
    at: `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`,
    t: String(Date.now()),
  });
  if (near) params.set('near', near.place.name);
  return `${window.location.origin}/?${params}`;
}

/** Bottom sheet / dialog for sharing the user's current GPS position. */
export default function ShareLocation({ geo, places, onClose, onToast }) {
  const [copied, setCopied] = useState(false);
  const pos = geo.position;
  const near = useMemo(() => (pos ? nearestLandmark(places, pos) : null), [pos, places]);
  const url = pos ? buildShareLink(pos, near) : '';
  const message = pos
    ? `I'm here${near ? ` near ${near.place.name}` : ''} on UCC campus. Open the link for walking directions to me:`
    : '';
  const canNativeShare = !!window.__UCC_NATIVE__ || !!navigator.share;

  const share = async () => {
    if (window.__UCC_NATIVE__) { window.__uccShare?.(message, url); return; }
    try { await navigator.share({ title: 'My location – UCC Campus Navigator', text: message, url }); onClose(); }
    catch { /* user cancelled */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message} ${url}`);
      setCopied(true); onToast('Location link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch { onToast('Could not copy. Long-press the link to copy it.'); }
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;

  return (
    <div className="absolute inset-0 z-[1250] flex items-end justify-center bg-ink-900/40 md:items-center" onClick={onClose}>
      <div className="safe-bottom w-full max-w-md animate-slideUp rounded-t-[28px] bg-white p-5 shadow-sheet md:rounded-[28px]" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Share my location">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink-900">Share my location</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-500" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!pos ? (
          <div className="rounded-2xl bg-cobalt-50 p-4 text-sm text-cobalt-700">
            {geo.status === 'locating' ? (
              <p className="flex items-center gap-3 font-medium"><Spinner /> Finding your location…</p>
            ) : (
              <>
                <p className="font-semibold">Your location isn’t available yet.</p>
                {geo.error && <p className="mt-1 text-ink-700">{geo.error}</p>}
                <button onClick={geo.start} className="btn-primary mt-3 py-2"><LocateFixed size={16} /> Turn on location</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-cobalt-50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A73E8] text-white"><MapPin size={20} /></span>
              <div className="min-w-0 text-sm">
                <p className="font-bold text-ink-900">{near ? `Near ${near.place.name}` : 'Your current position'}</p>
                <p className="text-ink-500">GPS accuracy about ±{Math.round(pos.accuracy)} m · {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</p>
              </div>
            </div>
            {pos.accuracy > 100 && (
              <p className="mt-2 rounded-2xl bg-aureolin-300/30 p-3 text-xs text-ink-700">GPS is not very accurate right now. Move outside or wait a few seconds for a better position.</p>
            )}
            <p className="mt-3 text-xs text-ink-500">The person you send it to sees this spot on the map and can get walking directions to you. It shares this one position only, not live tracking.</p>

            <div className="mt-4 grid gap-2">
              {canNativeShare && (
                <button onClick={share} className="btn-primary w-full"><Share2 size={18} /> Share…</button>
              )}
              <a href={whatsapp} target="_blank" rel="noreferrer" className="btn w-full bg-[#25D366] text-white hover:bg-[#1ebe5a]">
                <MessageCircle size={18} /> Send on WhatsApp
              </a>
              <button onClick={copy} className="btn-outline w-full">{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
