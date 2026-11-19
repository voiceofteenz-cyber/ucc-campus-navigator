import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Star, History, Settings } from 'lucide-react';
import L from 'leaflet';
import { haversine, pointInPolygon } from '../shared/geo.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useCampusData } from './hooks/useCampusData.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { useTheme } from './hooks/useTheme.js';
import { api } from './lib/api.js';
import { searchPlaces, popularPlaces } from './lib/search.js';
import { prepareRoute, progressFor } from './lib/nav.js';
import { speak, stopSpeaking } from './lib/speech.js';
import { spokenDistance } from './lib/format.js';
import MapView from './components/MapView.jsx';
import SearchBar from './components/SearchBar.jsx';
import HomePanel from './components/HomePanel.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import PlaceDetails from './components/PlaceDetails.jsx';
import DirectionsPanel from './components/DirectionsPanel.jsx';
import NavigationView from './components/NavigationView.jsx';
import ShareLocation from './components/ShareLocation.jsx';
import { SavedPanel, RecentPanel, SettingsPanel } from './components/SavedRecentSettings.jsx';
import { Sheet, useIsDesktop } from './components/ui.jsx';

const DEFAULT_SETTINGS = { voice: true, follow: true, wakeLock: true, mapStyle: 'standard', showPaths: true, theme: 'auto' };
const TABS = [
  { key: 'explore', label: 'Explore', icon: Compass },
  { key: 'saved', label: 'Saved', icon: Star },
  { key: 'recent', label: 'Recent', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings },
];
const compact = (p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, tags: {}, external: p.external });
const ringOf = (p) => p.polygon.map(([lat, lng]) => ({ lat, lng }));

export default function App() {
  const isDesktop = useIsDesktop();
  const geo = useGeolocation();
  const campus = useCampusData();
  const [storedSettings, setSettings] = useLocalStorage('ucc.settings', DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...storedSettings };
  const isDark = useTheme(settings.theme);
  const setSetting = useCallback((k, v) => setSettings((s) => ({ ...s, [k]: v })), [setSettings]);
  const [favourites, setFavourites] = useLocalStorage('ucc.favourites', []);
  const [history, setHistory] = useLocalStorage('ucc.history', []);
  const [visits, setVisits] = useLocalStorage('ucc.visits', {});

  const [tab, setTab] = useState('explore');
  const [view, setView] = useState('home'); // home | search | place | directions
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(null);
  const [origin, setOrigin] = useState('gps');
  const [routeState, setRouteState] = useState({ status: 'idle' });
  const [nav, setNav] = useState(null); // { progress, rerouting }
  const [follow, setFollow] = useState(false);
  const [snap, setSnap] = useState('half');
  const [sheetH, setSheetH] = useState(300);
  const [paths, setPaths] = useState(null);
  const [toast, setToast] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const mapApi = useRef(null);
  const inputRef = useRef(null);
  const lastSelect = useRef(0);
  const posRef = useRef(null);
  posRef.current = geo.position;
  const routeAbort = useRef(null);
  const navRef = useRef(null);
  navRef.current = nav;
  const spoken = useRef({ index: -1, near: false });
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  const centredOnce = useRef(false);

  const favouriteIds = useMemo(() => new Set(favourites.map((f) => f.id)), [favourites]);
  const results = useMemo(() => searchPlaces(campus.index, query, { category }), [campus.index, query, category]);
  const popular = useMemo(() => popularPlaces(campus.places, visits), [campus.places, visits]);
  const navigating = !!nav;

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => setToast(null), 2600);
  }, []);

  // Distance from the user to the nearest mapped campus place.
  const campusDistance = useMemo(() => {
    if (!geo.position || !campus.places.length) return null;
    let min = Infinity;
    for (const p of campus.places) min = Math.min(min, haversine(geo.position, p));
    return min;
  }, [geo.position, campus.places]);

  // Load the footpath layer on demand.
  useEffect(() => {
    if (settings.showPaths && !paths && campus.data) api.paths().then((r) => setPaths(r.paths)).catch(() => setPaths([]));
  }, [settings.showPaths, paths, campus.data]);

  // First GPS fix on campus → centre on the user.
  useEffect(() => {
    if (centredOnce.current || !geo.position || campusDistance == null) return;
    centredOnce.current = true;
    if (campusDistance < 1500 && view === 'home') mapApi.current?.flyTo(geo.position, 17);
  }, [geo.position, campusDistance, view]);

  const padding = isDesktop
    ? (navigating ? { left: 430, top: 0, bottom: 0 } : { left: 400 })
    : (navigating ? { top: 150, bottom: 130 } : { top: 76, bottom: sheetH });

  // ---------- selection ----------
  const focusPlace = useCallback((p) => {
    if (p.polygon) mapApi.current?.fitBounds(L.latLngBounds(p.polygon), 19);
    else mapApi.current?.flyTo([p.lat, p.lng], 18);
  }, []);

  const selectPlace = useCallback((p, { record = true } = {}) => {
    lastSelect.current = Date.now();
    setSelected(p);
    setView('place');
    setTab('explore');
    setSnap('half');
    setFollow(false);
    inputRef.current?.blur();
    focusPlace(p);
    if (record && p.category !== 'pin') {
      setHistory((h) => [{ ts: Date.now(), query: query.trim(), placeId: p.id, placeName: p.name, place: compact(p) }, ...h].slice(0, 60));
      setVisits((v) => ({ ...v, [p.id]: (v[p.id] || 0) + 1 }));
    }
  }, [focusPlace, query, setHistory, setVisits]);

  // Deep links: ?place=way/123  or a shared location ?at=lat,lng&t=time&near=name
  useEffect(() => {
    if (!campus.data) return;
    const qs = new URLSearchParams(window.location.search);
    const at = qs.get('at');
    if (at) {
      const [lat, lng] = at.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const t = Number(qs.get('t'));
        const when = Number.isFinite(t) && t > 0 ? new Date(t) : null;
        const near = qs.get('near');
        selectPlace({
          id: `pin/${lat.toFixed(6)},${lng.toFixed(6)}`, name: 'Shared location', lat, lng, category: 'pin', shared: true,
          tags: { description: `Someone shared this location with you${when ? ` at ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${when.toLocaleDateString()}` : ''}${near ? `, near ${near}` : ''}. Tap “Get directions” to walk there.` },
        }, { record: false });
        return;
      }
    }
    const id = qs.get('place');
    const p = id && campus.byId.get(id);
    if (p) selectPlace(p, { record: false });
  }, [campus.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeAt = useCallback((latlng) => {
    const pt = { lat: latlng.lat, lng: latlng.lng };
    const inside = campus.places.filter((p) => p.polygon && pointInPolygon(pt, ringOf(p))).sort((a, b) => a.area - b.area)[0];
    if (inside) return inside;
    let best = null, bd = 30;
    for (const p of campus.places) { const d = haversine(pt, p); if (d < bd) { bd = d; best = p; } }
    return best;
  }, [campus.places]);

  const onMapClick = useCallback((latlng) => {
    if (navigating || Date.now() - lastSelect.current < 400) return;
    const p = placeAt(latlng);
    if (p) selectPlace(p);
  }, [navigating, placeAt, selectPlace]);

  const onMapLongPress = useCallback((latlng) => {
    if (navigating) return;
    selectPlace({ id: `pin/${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`, name: 'Dropped pin', lat: latlng.lat, lng: latlng.lng, category: 'pin', tags: {} }, { record: false });
  }, [navigating, selectPlace]);

  const chooseCategory = useCallback((k) => {
    setCategory(k);
    setView('search');
    setTab('explore');
    setSnap('half');
    if (k) {
      const list = campus.places.filter((p) => p.category === k);
      if (list.length) mapApi.current?.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng])), 18);
    }
  }, [campus.places]);

  const goHome = useCallback(() => {
    setView('home'); setSelected(null); setCategory(null); setQuery(''); setRouteState({ status: 'idle' });
    routeAbort.current?.abort();
  }, []);

  const onBack = () => {
    if (view === 'directions') { routeAbort.current?.abort(); setRouteState({ status: 'idle' }); setView('place'); return; }
    if (view === 'place' && (query || category)) { setSelected(null); setView('search'); return; }
    goHome();
  };

  const toggleFavourite = (p) => {
    if (favouriteIds.has(p.id)) { setFavourites((f) => f.filter((x) => x.id !== p.id)); showToast('Removed from saved places'); }
    else { setFavourites((f) => [compact(p), ...f]); showToast('Saved ★'); }
  };

  // ---------- routing ----------
  const requestRoute = useCallback((from, to, { fit = true, keep = false } = {}) => {
    routeAbort.current?.abort();
    const ctrl = new AbortController();
    routeAbort.current = ctrl;
    // While rerouting, keep showing the current route until the new one arrives.
    if (!keep) setRouteState({ status: 'loading' });
    return api.route(from, to, ctrl.signal)
      .then((r) => {
        const data = prepareRoute(r);
        setRouteState({ status: 'ready', data });
        if (fit) mapApi.current?.fitBounds(L.latLngBounds([...r.geometry, [from.lat, from.lng], [to.lat, to.lng]]), 18);
        return data;
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && !keep) setRouteState({ status: 'error', error: err.message });
        throw err;
      });
  }, []);

  const hasPos = !!geo.position;
  useEffect(() => {
    if (view !== 'directions' || !selected || navigating) return;
    const from = origin === 'gps' ? posRef.current : origin;
    if (!from) { setRouteState({ status: 'idle' }); return; }
    requestRoute(from, selected).catch(() => {});
  }, [view, selected, origin, hasPos, requestRoute, navigating]);

  const openDirections = (p) => {
    setSelected(p);
    setOrigin('gps');
    setView('directions');
    setTab('explore');
    setSnap('half');
    if (!geo.position && geo.status !== 'locating') geo.start();
  };

  // ---------- live navigation ----------
  useWakeLock(navigating && settings.wakeLock);

  const startNavigation = () => {
    const route = routeState.data;
    if (!route || !geo.position) return;
    spoken.current = { index: -1, near: false };
    offCount.current = 0;
    setNav({ progress: progressFor(route, geo.position, selected, null), rerouting: false });
    setFollow(settings.follow);
    mapApi.current?.flyTo([geo.position.lat, geo.position.lng], 18);
    if (settings.voice) speak(`Starting navigation to ${selected.name}. ${route.steps[0]?.instruction || ''}`);
  };

  const endNavigation = () => {
    setNav(null);
    stopSpeaking();
    setFollow(false);
    setView('place');
    setRouteState({ status: 'idle' });
  };

  useEffect(() => {
    if (!navRef.current || !geo.position || routeState.status !== 'ready') return;
    const n = navRef.current;
    if (n.progress?.arrived || n.rerouting) return;
    const route = routeState.data;
    const pr = progressFor(route, geo.position, selected, n.progress);

    if (pr.arrived) {
      if (settings.voice) speak(`You have arrived at ${selected.name}.`);
      setNav((x) => x && { ...x, progress: pr });
      return;
    }

    // Off-route → recalculate from the current position (two consecutive fixes, throttled).
    offCount.current = pr.offRoute ? offCount.current + 1 : 0;
    if (offCount.current >= 2 && Date.now() - lastReroute.current > 12000) {
      lastReroute.current = Date.now();
      offCount.current = 0;
      setNav((x) => x && { ...x, rerouting: true, progress: pr });
      if (settings.voice) speak('Recalculating route.');
      requestRoute(geo.position, selected, { fit: false, keep: true })
        .then(() => { spoken.current = { index: -1, near: false }; setNav((x) => x && { ...x, rerouting: false, progress: null }); })
        .catch(() => setNav((x) => x && { ...x, rerouting: false }));
      return;
    }

    // Spoken instructions.
    if (settings.voice) {
      const step = route.steps[pr.nextIndex];
      const text = step.kind === 'arrive' ? `arrive at ${selected.name}` : step.instruction;
      if (spoken.current.index !== pr.nextIndex) {
        spoken.current = { index: pr.nextIndex, near: pr.distToNext <= 30 };
        speak(pr.distToNext > 30 ? `In ${spokenDistance(pr.distToNext)}, ${text.charAt(0).toLowerCase()}${text.slice(1)}.` : `${text}.`);
      } else if (!spoken.current.near && pr.distToNext <= 25) {
        spoken.current.near = true;
        speak(`${text}.`);
      }
    }
    setNav((x) => x && { ...x, progress: pr });
  }, [geo.position]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock for detecting stale GPS while navigating.
  useEffect(() => {
    if (!navigating) return undefined;
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, [navigating]);
  const gpsStale = navigating && (!geo.position || now - geo.position.timestamp > 15000);

  const onLocate = () => {
    if (geo.position) {
      setFollow(true);
      mapApi.current?.flyTo([geo.position.lat, geo.position.lng], 18);
    } else {
      geo.start();
      showToast(geo.error || 'Finding your location…');
    }
  };

  // Android back button inside the mobile app: close panels before leaving the app.
  const backRef = useRef(null);
  backRef.current = () => {
    if (navigating) return true; // ignore during navigation; use the End button
    if (view !== 'home') { onBack(); return true; }
    if (tab !== 'explore') { setTab('explore'); return true; }
    return false;
  };
  useEffect(() => { window.__uccBack = () => backRef.current(); return () => { delete window.__uccBack; }; }, []);

  // ---------- render ----------
  const showTabs = view === 'home';
  const tabsRow = showTabs && (
    <nav className="flex shrink-0 gap-1 px-3 pb-2 pt-1">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition ${tab === key ? 'bg-cobalt-50 text-cobalt-700' : 'text-ink-400 hover:text-ink-700'}`}>
          <Icon size={19} strokeWidth={tab === key ? 2.5 : 2} /> {label}
        </button>
      ))}
    </nav>
  );

  const searchBar = (
    <SearchBar
      value={query}
      onChange={(v) => { setQuery(v); if (view !== 'search') { setView('search'); setSnap('full'); } }}
      onFocus={() => { if (view !== 'search') { setView('search'); setSnap(isDesktop ? 'half' : 'full'); } }}
      onBack={onBack}
      showBack={view !== 'home'}
      inputRef={inputRef}
      floating={!isDesktop}
    />
  );

  let content;
  if (view === 'search') {
    content = (
      <SearchPanel
        query={query} category={category} results={results} userPos={geo.position} favouriteIds={favouriteIds} history={history.filter((h) => h.query || h.placeName)}
        onSelect={(p) => selectPlace(p)} onCategory={chooseCategory}
        onPickQuery={(h) => { const p = h.placeId && campus.byId.get(h.placeId); if (p) selectPlace(p); else setQuery(h.query || h.placeName); }}
        onRemoveHistory={(ts) => setHistory((h) => h.filter((x) => x.ts !== ts))}
        onClearHistory={() => setHistory([])}
      />
    );
  } else if (view === 'place' && selected) {
    content = (
      <PlaceDetails
        key={selected.id} place={selected} byId={campus.byId} places={campus.places} userPos={geo.position}
        isFavourite={favouriteIds.has(selected.id)} onToggleFavourite={() => toggleFavourite(selected)}
        onDirections={() => openDirections(selected)} onSelect={(p) => selectPlace(p)}
        onShowOnMap={() => { focusPlace(selected); if (!isDesktop) setSnap('peek'); }}
        onClose={onBack} onToast={showToast}
      />
    );
  } else if (view === 'directions' && selected) {
    content = (
      <DirectionsPanel
        destination={selected} origin={origin} onOrigin={setOrigin} places={campus.places} geo={geo}
        routeState={routeState} onStart={startNavigation} onClose={onBack}
        onRetry={() => { const from = origin === 'gps' ? geo.position : origin; if (from) requestRoute(from, selected).catch(() => {}); else geo.start(); }}
      />
    );
  } else if (tab === 'saved') {
    content = <SavedPanel favourites={favourites} byId={campus.byId} userPos={geo.position} onSelect={(p) => selectPlace(p, { record: false })} onNavigate={openDirections} onRemove={(id) => setFavourites((f) => f.filter((x) => x.id !== id))} />;
  } else if (tab === 'recent') {
    content = <RecentPanel history={history} byId={campus.byId} onSelect={(p) => selectPlace(p, { record: false })} onSearch={(q) => { setQuery(q); setView('search'); }} onClear={() => setHistory([])} />;
  } else if (tab === 'settings') {
    content = <SettingsPanel settings={settings} setSetting={setSetting} geo={geo} campus={campus} onClearHistory={() => { setHistory([]); setVisits({}); }} onClearFavourites={() => setFavourites([])} onToast={showToast} />;
  } else {
    content = <HomePanel campus={campus} geo={geo} popular={popular} favouriteIds={favouriteIds} onSelect={(p) => selectPlace(p)} onCategory={chooseCategory} campusDistance={campusDistance} onShareLocation={() => { setSharing(true); if (!geo.position && geo.status !== 'locating') geo.start(); }} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView
        data={campus.data} paths={paths} settings={settings} userPos={geo.position}
        selected={navigating ? null : selected}
        results={view === 'search' ? results.slice(0, 60) : []}
        route={(view === 'directions' || navigating) ? routeState.data || null : null}
        progress={nav?.progress}
        destination={view === 'directions' || navigating ? selected : null}
        onSelectPlace={(p) => selectPlace(p)} onMapClick={onMapClick} onMapLongPress={onMapLongPress}
        isDark={isDark} apiRef={mapApi} padding={padding} follow={follow} navigating={navigating}
        onUserMove={() => setFollow(false)} onLocate={onLocate} onShareLocation={() => { setSharing(true); if (!geo.position && geo.status !== 'locating') geo.start(); }} onToggleSetting={setSetting}
      />

      {!navigating && !isDesktop && <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-[1150] px-3"><div className="pointer-events-auto">{searchBar}</div></div>}

      {!navigating && (
        <Sheet isDesktop={isDesktop} snap={snap} onSnap={setSnap} onHeight={setSheetH}
          header={<>{isDesktop && <div className="shrink-0 p-4 pb-2">{searchBar}</div>}{tabsRow}</>}>
          {content}
        </Sheet>
      )}

      {navigating && routeState.data && (
        <NavigationView
          destination={selected} route={routeState.data} progress={nav.progress} voice={settings.voice}
          onToggleVoice={() => { const v = !settings.voice; setSetting('voice', v); if (!v) stopSpeaking(); }}
          onEnd={endNavigation} onRecenter={() => setFollow(true)} follow={follow}
          rerouting={nav.rerouting} gpsStale={gpsStale} isDesktop={isDesktop}
        />
      )}

      {sharing && !navigating && <ShareLocation geo={geo} places={campus.places} onClose={() => setSharing(false)} onToast={showToast} />}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[1300] flex justify-center px-4 md:top-6">
          <p className="animate-slideUp rounded-full bg-ink-900/90 px-4 py-2 text-sm font-semibold text-white shadow-float">{toast}</p>
        </div>
      )}
    </div>
  );
}
