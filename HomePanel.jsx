import { useMemo, useState } from 'react';
import { MapPinned, RefreshCw, AlertTriangle, LocateOff, Share2, ChevronRight, MapPinPlus, Smartphone } from 'lucide-react';
import { CATEGORIES, NEARBY_GROUPS, SEARCH_CATEGORIES } from '../../shared/categories.js';
import { haversine } from '../../shared/geo.js';
import { ICONS, CategoryIcon } from '../lib/icons.jsx';
import { formatDistance } from '../lib/format.js';
import { PlaceRow, Spinner } from './ui.jsx';
import LocationNotice from './LocationNotice.jsx';

const QUICK = ['lecture', 'hostel', 'library', 'food', 'bank', 'health', 'admin', 'sports'];
const QUICK_LABEL = { lecture: 'Lecture halls', hostel: 'Hostels', library: 'Libraries', food: 'Food', bank: 'Banks & ATMs', health: 'Health', admin: 'Offices', sports: 'Sports' };

export default function HomePanel({ campus, geo, popular, favouriteIds, onSelect, onCategory, campusDistance, onShareLocation, onAddMissing, install }) {
  const [group, setGroup] = useState('academic');
  const userPos = geo.position;

  const nearby = useMemo(() => {
    if (!userPos) return [];
    const g = NEARBY_GROUPS.find((x) => x.key === group);
    return campus.places
      .filter((p) => g.cats.includes(p.category) && !p.unnamed)
      .map((p) => ({ p, d: haversine(userPos, p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
  }, [campus.places, userPos, group]);

  return (
    <div className="space-y-6 px-4 pb-6 pt-1">
      <div className="animate-slideUp rounded-3xl bg-gradient-to-br from-cobalt-600 to-cobalt-800 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-aureolin-400">Akwaaba!</p>
        <h1 className="mt-1 text-xl font-extrabold leading-snug">Find your way around the University of Cape Coast</h1>
        <p className="mt-1.5 text-sm text-cobalt-100">Search any hall, faculty or facility and get live walking directions from where you are.</p>
      </div>

      <LocationNotice geo={geo} />

      <button onClick={onShareLocation} className="flex w-full items-center gap-3 rounded-2xl bg-cobalt-50 p-3.5 text-left transition hover:bg-cobalt-100">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A73E8] text-white"><Share2 size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">Share my location</span>
          <span className="block text-xs text-ink-500">Send a friend a link so they can walk to you</span>
        </span>
        <ChevronRight size={18} className="text-ink-400" />
      </button>

      {install?.available && (
        <button onClick={install.prompt} className="flex w-full items-center gap-3 rounded-2xl bg-cobalt-600 p-3.5 text-left text-white transition hover:bg-cobalt-700">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15"><Smartphone size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Install UCC Navigator</span>
            <span className="block text-xs text-cobalt-100">{install.ios ? 'Tap Share, then “Add to Home Screen”' : 'Add it to your home screen like an app'}</span>
          </span>
        </button>
      )}

      {campus.loading && (
        <div className="flex items-center gap-3 rounded-2xl bg-cobalt-50 p-4 text-sm font-medium text-cobalt-700">
          <Spinner /> Loading campus map data from OpenStreetMap…
        </div>
      )}
      {campus.error && (
        <div className="rounded-2xl bg-vermilion-500/10 p-4 text-sm text-vermilion-600">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle size={16} /> Campus data unavailable</p>
          <p className="mt-1">{campus.error}</p>
          <button onClick={campus.reload} className="btn-outline mt-3 py-2"><RefreshCw size={15} /> Try again</button>
        </div>
      )}

      <section>
        <h2 className="section-title">Explore by category</h2>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((k) => (
            <button key={k} onClick={() => onCategory(k)}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition hover:bg-cobalt-50 active:scale-95">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: CATEGORIES[k].color }}>
                <CategoryIcon category={k} size={22} />
              </span>
              <span className="text-[11px] font-semibold leading-tight text-ink-700">{QUICK_LABEL[k]}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {SEARCH_CATEGORIES.filter((k) => !QUICK.includes(k)).map((k) => (
            <button key={k} onClick={() => onCategory(k)} className="chip">
              <CategoryIcon category={k} size={14} /> {CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Nearby places <span className="normal-case tracking-normal">straight-line distance</span></h2>
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {NEARBY_GROUPS.map((g) => {
            const Icon = ICONS[g.icon];
            return (
              <button key={g.key} onClick={() => setGroup(g.key)} className={`chip ${group === g.key ? 'chip-active' : ''}`}>
                <Icon size={14} /> {g.label}
              </button>
            );
          })}
        </div>
        {!userPos ? (
          <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-ink-500"><LocateOff size={16} /> Allow location access to see what is near you.</p>
        ) : nearby.length ? (
          <>
            {campusDistance > 3000 && (
              <p className="mb-2 rounded-2xl bg-aureolin-300/30 p-3 text-xs font-medium text-ink-700">
                You are about {formatDistance(campusDistance)} from campus, so these are the closest campus places, not places around you.
              </p>
            )}
            <div className="-mx-2">{nearby.map(({ p, d }) => <PlaceRow key={p.id} place={p} distance={d} saved={favouriteIds.has(p.id)} onClick={() => onSelect(p)} />)}</div>
          </>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-ink-500">No {NEARBY_GROUPS.find((g) => g.key === group).label.toLowerCase()} places are mapped near you in OpenStreetMap yet.</p>
        )}
      </section>

      {popular.length > 0 && (
        <section>
          <h2 className="section-title">Popular destinations</h2>
          <div className="-mx-2">
            {popular.map((p) => (
              <PlaceRow key={p.id} place={p} saved={favouriteIds.has(p.id)} onClick={() => onSelect(p)}
                distance={userPos ? haversine(userPos, p) : null} />
            ))}
          </div>
        </section>
      )}

      <button onClick={onAddMissing} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-3.5 text-left transition hover:bg-slate-50">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aureolin-400 text-ink-900"><MapPinPlus size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink-900">Can’t find a building?</span>
          <span className="block text-xs text-ink-500">Add it to the map. Stand at it, or long-press its spot on the map.</span>
        </span>
      </button>

      {campus.data && (
        <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-400">
          <MapPinned size={14} className="mt-0.5 shrink-0" />
          {campus.places.length} campus places from OpenStreetMap contributors, updated {new Date(campus.data.generatedAt).toLocaleDateString()}. Walking routes by OSRM (foot profile).
        </p>
      )}
    </div>
  );
}
