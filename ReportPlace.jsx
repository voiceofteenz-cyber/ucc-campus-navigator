import { useState } from 'react';
import { X, Send, CheckCircle2, ExternalLink, MapPin } from 'lucide-react';
import { CATEGORIES, SEARCH_CATEGORIES } from '../../shared/categories.js';
import { api } from '../lib/api.js';
import { Spinner } from './ui.jsx';

/**
 * Sends a "missing place" or "wrong information" report as an OpenStreetMap note at a location.
 * at: { lat, lng, label }   type: 'missing' | 'wrong'   place: the place being reported (for 'wrong')
 */
export default function ReportPlace({ at, type = 'missing', place, onClose }) {
  const [name, setName] = useState(type === 'wrong' ? place?.name || '' : '');
  const [kind, setKind] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState({ status: 'idle' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'sending' });
    try {
      const r = await api.report({
        type, lat: at.lat, lng: at.lng, name: name.trim(),
        kind: kind ? CATEGORIES[kind].short : undefined, details: details.trim() || undefined,
      });
      setState({ status: 'done', url: r.url });
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  };

  const field = 'mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-900 outline-none focus:ring-2 focus:ring-cobalt-300';

  return (
    <div className="absolute inset-0 z-[1250] flex items-end justify-center bg-ink-900/40 md:items-center" onClick={onClose}>
      <div className="safe-bottom max-h-[92%] w-full max-w-md animate-slideUp overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-sheet md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={type === 'wrong' ? 'Report wrong information' : 'Add a missing place'}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink-900">{type === 'wrong' ? 'Report wrong information' : 'Add a missing place'}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-ink-500" aria-label="Close"><X size={18} /></button>
        </div>

        {state.status === 'done' ? (
          <div className="text-center">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
            <p className="mt-3 font-bold text-ink-900">Thank you! Your report was sent.</p>
            <p className="mt-1 text-sm text-ink-500">
              It is now a public note on OpenStreetMap at this spot. When a mapper adds or fixes the place, it appears in UCC Navigator within about 3 days.
            </p>
            {state.url && (
              <a href={state.url} target="_blank" rel="noreferrer" className="btn-ghost mt-4 w-full"><ExternalLink size={16} /> View the note</a>
            )}
            <button onClick={onClose} className="btn-primary mt-2 w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="flex items-start gap-2 rounded-2xl bg-cobalt-50 p-3 text-xs text-cobalt-700">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              <span>Location: {at.label || `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}`}. {type === 'missing' ? 'Stand at the entrance or long-press the exact spot on the map for best accuracy.' : ''}</span>
            </p>
            {type === 'missing' && (
              <>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-ink-500">Name of the place *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="e.g. New Examination Centre" className={field} />
                </label>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-ink-500">Type</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
                    <option value="">Choose…</option>
                    {SEARCH_CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORIES[k].short}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-ink-500">{type === 'wrong' ? 'What is wrong? *' : 'Details (optional)'}</span>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={400} rows={3} required={type === 'wrong'}
                placeholder={type === 'wrong' ? 'e.g. This building is called … / it is on the other side of the road' : 'e.g. departments inside, floor, which entrance'} className={field} />
            </label>
            {state.status === 'error' && <p className="mt-3 rounded-2xl bg-vermilion-500/10 p-3 text-sm text-vermilion-600">{state.error}</p>}
            <button type="submit" disabled={state.status === 'sending'} className="btn-primary mt-4 w-full">
              {state.status === 'sending' ? <Spinner className="h-4 w-4" /> : <Send size={17} />} Send to OpenStreetMap
            </button>
            <p className="mt-2 text-[11px] text-ink-400">Reports are public notes on openstreetmap.org. Do not include personal information.</p>
          </form>
        )}
      </div>
    </div>
  );
}
