import { Star, Navigation, Trash2, History, Volume2, Footprints, Map, Sun, LocateFixed, Info, RefreshCw } from 'lucide-react';
import { haversine } from '../../shared/geo.js';
import { CATEGORIES } from '../../shared/categories.js';
import { timeAgo } from '../lib/format.js';
import { speechSupported, speak } from '../lib/speech.js';
import { MAP_STYLES } from './MapView.jsx';
import { PlaceRow, Empty } from './ui.jsx';
import LocationNotice from './LocationNotice.jsx';

export function SavedPanel({ favourites, byId, userPos, onSelect, onNavigate, onRemove }) {
  if (!favourites.length) {
    return <Empty icon={Star} title="No saved places yet">Open any place and tap the star to save it here for quick access.</Empty>;
  }
  return (
    <div className="px-4 pb-6 pt-1">
      <h2 className="section-title">Saved places · {favourites.length}</h2>
      <ul className="-mx-2">
        {favourites.map((f) => {
          const place = byId.get(f.id) || f; // falls back to the stored copy if OSM data changed
          return (
            <li key={f.id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <PlaceRow place={place} onClick={() => onSelect(place)} distance={userPos ? haversine(userPos, place) : null} />
              </div>
              <button onClick={() => onNavigate(place)} className="flex h-10 w-10 items-center justify-center rounded-full bg-cobalt-600 text-white" aria-label={`Directions to ${place.name}`}>
                <Navigation size={17} />
              </button>
              <button onClick={() => onRemove(f.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-vermilion-500" aria-label={`Remove ${place.name}`}>
                <Trash2 size={17} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecentPanel({ history, byId, onSelect, onSearch, onClear }) {
  const places = [];
  const seen = new Set();
  for (const h of history) {
    if (h.placeId && !seen.has(h.placeId)) { seen.add(h.placeId); places.push({ h, p: byId.get(h.placeId) || h.place }); }
  }
  const queries = history.filter((h) => h.query && !h.placeId);
  if (!history.length) return <Empty icon={History} title="Nothing here yet">Places you open and searches you make will appear here.</Empty>;
  return (
    <div className="space-y-5 px-4 pb-6 pt-1">
      <div className="flex justify-end"><button onClick={onClear} className="text-xs font-semibold text-cobalt-600 hover:underline">Clear history</button></div>
      {places.length > 0 && (
        <section>
          <h2 className="section-title">Recently viewed</h2>
          <div className="-mx-2">
            {places.filter((x) => x.p).slice(0, 15).map(({ h, p }) => (
              <PlaceRow key={h.ts} place={p} onClick={() => onSelect(p)} subtitle={`${CATEGORIES[p.category]?.short || ''} · ${timeAgo(h.ts)}`} />
            ))}
          </div>
        </section>
      )}
      {queries.length > 0 && (
        <section>
          <h2 className="section-title">Recent searches</h2>
          <div className="flex flex-wrap gap-2">
            {queries.slice(0, 15).map((h) => <button key={h.ts} onClick={() => onSearch(h.query)} className="chip">{h.query}</button>)}
          </div>
        </section>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, icon: Icon, hint, disabled }) {
  return (
    <label className={`flex items-center gap-3 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <Icon size={19} className="shrink-0 text-cobalt-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-cobalt-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function SettingsPanel({ settings, setSetting, geo, campus, onClearHistory, onClearFavourites, onToast }) {
  return (
    <div className="space-y-5 px-4 pb-6 pt-1">
      <section>
        <h2 className="section-title">Navigation</h2>
        <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 px-4">
          <Toggle icon={Volume2} label="Spoken directions" hint={speechSupported ? 'Read each instruction aloud while navigating' : 'Not supported by this browser'}
            checked={settings.voice && speechSupported} disabled={!speechSupported} onChange={(v) => { setSetting('voice', v); if (v) speak('Voice guidance is on.'); }} />
          <Toggle icon={LocateFixed} label="Follow my position" hint="Keep the map centred on you during navigation" checked={settings.follow} onChange={(v) => setSetting('follow', v)} />
          <Toggle icon={Sun} label="Keep screen awake" hint="While navigating, where the browser supports it" checked={settings.wakeLock} onChange={(v) => setSetting('wakeLock', v)} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Map</h2>
        <div className="rounded-3xl border border-slate-200 px-4">
          <div className="flex items-center gap-3 py-3">
            <Map size={19} className="text-cobalt-600" />
            <span className="flex-1 text-sm font-semibold">Map style</span>
            <select value={settings.mapStyle} onChange={(e) => setSetting('mapStyle', e.target.value)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold outline-none">
              {Object.entries(MAP_STYLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </div>
          <div className="border-t border-slate-100" />
          <Toggle icon={Footprints} label="Show footpaths" hint="Highlight pedestrian paths and steps from OpenStreetMap" checked={settings.showPaths} onChange={(v) => setSetting('showPaths', v)} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Location</h2>
        {geo.status === 'watching' ? (
          <p className="rounded-2xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800">
            GPS active · accuracy about ±{Math.round(geo.position.accuracy)} m
          </p>
        ) : <LocationNotice geo={geo} />}
      </section>

      <section>
        <h2 className="section-title">Your data</h2>
        <p className="mb-2 text-xs text-ink-500">Saved places and history are stored only on this device.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { onClearHistory(); onToast('History cleared'); }} className="btn-outline py-2"><History size={15} /> Clear history</button>
          <button onClick={() => { if (window.confirm('Remove all saved places?')) { onClearFavourites(); onToast('Saved places removed'); } }} className="btn-outline py-2"><Trash2 size={15} /> Clear saved places</button>
        </div>
      </section>

      <section>
        <h2 className="section-title">About</h2>
        <div className="space-y-2 rounded-3xl bg-slate-50 p-4 text-xs leading-relaxed text-ink-500">
          <p className="flex gap-2"><Info size={14} className="mt-0.5 shrink-0" /> Buildings, outlines and footpaths: © OpenStreetMap contributors (ODbL), downloaded {campus.data ? new Date(campus.data.generatedAt).toLocaleString() : '—'} · {campus.places.length} places.</p>
          <p className="pl-6">Walking routes: OSRM foot profile (routing.openstreetmap.de, FOSSGIS). Map tiles: OpenStreetMap / HOT / Esri.</p>
          <button onClick={campus.reload} className="ml-6 inline-flex items-center gap-1.5 font-semibold text-cobalt-600 hover:underline"><RefreshCw size={13} /> Reload map data</button>
        </div>
      </section>
    </div>
  );
}
