import { useEffect, useState } from 'react';
import { Clock, Globe, SearchX, X } from 'lucide-react';
import { CATEGORIES, SEARCH_CATEGORIES } from '../../shared/categories.js';
import { haversine } from '../../shared/geo.js';
import { CategoryIcon } from '../lib/icons.jsx';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { PlaceRow, Spinner, Empty } from './ui.jsx';

export default function SearchPanel({
  query, category, results, userPos, favouriteIds, history, onSelect, onCategory, onPickQuery, onRemoveHistory, onClearHistory,
}) {
  const [osm, setOsm] = useState({ loading: false, results: [], error: null });

  // When the local OSM index has few matches, also ask OpenStreetMap's search (bounded to campus).
  useEffect(() => {
    setOsm({ loading: false, results: [], error: null });
    const q = query.trim();
    if (q.length < 3 || results.length >= 3) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setOsm((s) => ({ ...s, loading: true }));
      api.geocode(q, ctrl.signal)
        .then((r) => setOsm({
          loading: false, error: null,
          results: r.results.filter((x) => !results.some((p) => p.id === x.id)),
        }))
        .catch((e) => { if (e.name !== 'AbortError') setOsm({ loading: false, results: [], error: e.message }); });
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, results]);

  const dist = (p) => (userPos ? haversine(userPos, p) : null);

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {SEARCH_CATEGORIES.map((k) => (
          <button key={k} onClick={() => onCategory(category === k ? null : k)} className={`chip ${category === k ? 'chip-active' : ''}`}>
            <CategoryIcon category={k} size={14} /> {CATEGORIES[k].label}
          </button>
        ))}
      </div>

      {!query && !category ? (
        <section>
          <div className="section-title">
            <span>Recent searches</span>
            {history.length > 0 && <button onClick={onClearHistory} className="normal-case tracking-normal text-cobalt-600 hover:underline">Clear</button>}
          </div>
          {history.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-ink-500">Your searches will appear here. Try “library”, “hall” or “ATM”.</p>
          ) : (
            <ul className="-mx-2">
              {history.slice(0, 12).map((h) => (
                <li key={h.ts} className="flex items-center">
                  <button onClick={() => onPickQuery(h)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-cobalt-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-ink-500"><Clock size={18} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{h.placeName || h.query}</span>
                      <span className="block text-xs text-ink-500">{h.placeName && h.query ? `“${h.query}” · ` : ''}{timeAgo(h.ts)}</span>
                    </span>
                  </button>
                  <button onClick={() => onRemoveHistory(h.ts)} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100" aria-label="Remove">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <p className="section-title">
            {category && !query ? CATEGORIES[category].label : 'Results'} · {results.length}
          </p>
          {results.length > 0 && (
            <div className="-mx-2">
              {results.map((p) => (
                <PlaceRow key={p.id} place={p} distance={dist(p)} saved={favouriteIds.has(p.id)} onClick={() => onSelect(p)} />
              ))}
            </div>
          )}

          {osm.loading && <p className="mt-3 flex items-center gap-2 text-sm text-ink-500"><Spinner className="h-4 w-4" /> Searching OpenStreetMap…</p>}
          {osm.results.length > 0 && (
            <div className="mt-4">
              <p className="section-title"><span className="flex items-center gap-1.5"><Globe size={13} /> More from OpenStreetMap</span></p>
              <div className="-mx-2">
                {osm.results.map((r) => {
                  const place = { id: r.id, name: r.name, lat: r.lat, lng: r.lng, category: 'other', tags: { description: r.label }, external: true };
                  return <PlaceRow key={r.id} place={place} distance={dist(place)} subtitle={r.label} onClick={() => onSelect(place)} />;
                })}
              </div>
            </div>
          )}
          {results.length === 0 && !osm.loading && osm.results.length === 0 && (
            <Empty icon={SearchX} title="No matching campus places">
              {osm.error ? osm.error : 'Nothing called that is mapped on OpenStreetMap yet. Try another name, a short form (e.g. “LT”), or a category above.'}
            </Empty>
          )}
        </section>
      )}
    </div>
  );
}
