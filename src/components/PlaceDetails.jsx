import { useEffect, useMemo, useState } from 'react';
import {
  Navigation, Star, Share2, Clock, Phone, Globe, Layers3, Accessibility, Building2, ExternalLink, X, MapPin, Crosshair,
} from 'lucide-react';
import { CATEGORIES } from '../../shared/categories.js';
import { haversine, bearing, compassWord } from '../../shared/geo.js';
import { api } from '../lib/api.js';
import { formatDistance } from '../lib/format.js';
import { CategoryBadge, PlaceRow } from './ui.jsx';

function usePhoto(tags = {}) {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    setPhoto(null);
    if (tags.image && /^https?:\/\//.test(tags.image)) { setPhoto({ url: tags.image, credit: 'Image linked in OpenStreetMap' }); return; }
    if (tags.wikimedia_commons?.startsWith('File:')) {
      const f = tags.wikimedia_commons.slice(5);
      setPhoto({ url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=900`, credit: `Wikimedia Commons: ${f}` });
      return;
    }
    if (/^Q\d+$/.test(tags.wikidata || '')) {
      let alive = true;
      api.photo(tags.wikidata).then((r) => { if (alive && r.url) setPhoto(r); }).catch(() => {});
      return () => { alive = false; };
    }
    return undefined;
  }, [tags.image, tags.wikimedia_commons, tags.wikidata]);
  return photo;
}

function Detail({ icon: Icon, children }) {
  return <li className="flex items-start gap-3 py-2 text-sm text-ink-700"><Icon size={17} className="mt-0.5 shrink-0 text-cobalt-500" /><span className="min-w-0 break-words">{children}</span></li>;
}

export default function PlaceDetails({
  place, byId, places, userPos, isFavourite, onToggleFavourite, onDirections, onSelect, onShowOnMap, onClose, onToast,
}) {
  const t = place.tags || {};
  const cat = CATEGORIES[place.category] || CATEGORIES.other;
  const photo = usePhoto(t);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [photo?.url]);

  const inside = useMemo(() => (place.contains || []).map((id) => byId.get(id)).filter(Boolean), [place, byId]);
  const parent = place.within ? byId.get(place.within) : null;
  const landmarks = useMemo(() => {
    const exclude = new Set([place.id, ...(place.contains || []), place.within]);
    return places
      .filter((p) => !exclude.has(p.id) && !p.unnamed && p.within !== place.id)
      .map((p) => ({ p, d: haversine(place, p) }))
      .filter((x) => x.d > 5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
  }, [place, places]);

  const distance = userPos ? haversine(userPos, place) : null;
  const osmUrl = place.id.includes('/') && !place.id.startsWith('pin') ? `https://www.openstreetmap.org/${place.id}` : null;
  const website = t.website || t['contact:website'];
  const phone = t.phone || t['contact:phone'];

  const share = async () => {
    const url = `${window.location.origin}/?place=${encodeURIComponent(place.id)}`;
    if (window.__UCC_NATIVE__) { window.__uccShare?.(`${place.name} – UCC Campus Navigator`, url); return; }
    try {
      if (navigator.share) await navigator.share({ title: place.name, text: `${place.name} – UCC Campus Navigator`, url });
      else { await navigator.clipboard.writeText(url); onToast('Link copied to clipboard'); }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="pb-6">
      {photo && !imgFailed && (
        <figure className="relative mx-4 mb-3 overflow-hidden rounded-3xl bg-slate-100">
          <img src={photo.url} alt={place.name} className="h-44 w-full object-cover" onError={() => setImgFailed(true)} loading="lazy" />
          <figcaption className="absolute bottom-0 right-0 max-w-full truncate rounded-tl-xl bg-black/50 px-2 py-0.5 text-[10px] text-white">{photo.credit}</figcaption>
        </figure>
      )}

      <div className="flex items-start gap-3 px-4">
        <CategoryBadge category={place.category} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold leading-tight text-ink-900">{place.name}</h2>
          <p className="mt-0.5 text-sm font-medium text-ink-500">
            {place.shared ? 'Shared with you' : cat.short}{parent ? ` · in ${parent.name}` : ''}
            {distance != null && <> · <span className="text-cobalt-600">{formatDistance(distance)} away</span></>}
          </p>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink-500 hover:bg-slate-200" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4">
        <button onClick={onDirections} className="btn-primary"><Navigation size={18} /> Get directions</button>
        <button onClick={onToggleFavourite} className={`btn-ghost px-3.5 ${isFavourite ? 'bg-aureolin-300/40 text-ink-900' : ''}`} aria-label={isFavourite ? 'Remove from saved' : 'Save'}>
          <Star size={18} className={isFavourite ? 'fill-aureolin-400 text-aureolin-500' : ''} />
        </button>
        <button onClick={onShowOnMap} className="btn-ghost px-3.5" aria-label="Show on map"><Crosshair size={18} /></button>
        <button onClick={share} className="btn-ghost px-3.5" aria-label="Share"><Share2 size={18} /></button>
      </div>

      <section className="mt-5 px-4">
        <h3 className="section-title">About</h3>
        {t.description ? (
          <p className="text-sm leading-relaxed text-ink-700">{t.description}</p>
        ) : place.external ? (
          <p className="text-sm text-ink-500">{t.description || 'Result from OpenStreetMap search.'}</p>
        ) : place.category === 'pin' && !place.shared ? (
          <p className="text-sm text-ink-500">A point you selected on the map ({place.lat.toFixed(5)}, {place.lng.toFixed(5)}).</p>
        ) : (
          <p className="text-sm text-ink-500">No description has been added to OpenStreetMap for this place yet.</p>
        )}
        <ul className="mt-2 divide-y divide-slate-100">
          {t.opening_hours && <Detail icon={Clock}>{t.opening_hours}</Detail>}
          {phone && <Detail icon={Phone}><a className="text-cobalt-600 hover:underline" href={`tel:${phone}`}>{phone}</a></Detail>}
          {website && <Detail icon={Globe}><a className="text-cobalt-600 hover:underline" href={website} target="_blank" rel="noreferrer">{website.replace(/^https?:\/\//, '')}</a></Detail>}
          {t.operator && <Detail icon={Building2}>Operated by {t.operator}</Detail>}
          {t['building:levels'] && <Detail icon={Layers3}>{t['building:levels']} floor{t['building:levels'] === '1' ? '' : 's'}</Detail>}
          {t.wheelchair && <Detail icon={Accessibility}>Wheelchair access: {t.wheelchair}</Detail>}
          {(t['addr:street'] || t['addr:housename']) && <Detail icon={MapPin}>{[t['addr:housename'], t['addr:street']].filter(Boolean).join(', ')}</Detail>}
        </ul>
      </section>

      {inside.length > 0 && (
        <section className="mt-5 px-4">
          <h3 className="section-title">Departments & facilities inside · {inside.length}</h3>
          <div className="-mx-2">{inside.map((p) => <PlaceRow key={p.id} place={p} onClick={() => onSelect(p)} />)}</div>
        </section>
      )}

      {landmarks.length > 0 && (
        <section className="mt-5 px-4">
          <h3 className="section-title">Nearby landmarks</h3>
          <div className="-mx-2">
            {landmarks.map(({ p, d }) => (
              <PlaceRow key={p.id} place={p} onClick={() => onSelect(p)}
                subtitle={`${CATEGORIES[p.category]?.short} · ${compassWord(bearing(place, p))} of here`}
                distance={d} />
            ))}
          </div>
        </section>
      )}

      {osmUrl && (
        <a href={osmUrl} target="_blank" rel="noreferrer" className="mx-4 mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-ink-500 hover:bg-slate-100">
          <ExternalLink size={14} /> Map data © OpenStreetMap contributors. Missing or wrong information? Improve it on OpenStreetMap.
        </a>
      )}
    </div>
  );
}
