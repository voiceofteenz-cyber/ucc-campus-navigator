import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, CircleMarker, Circle, Polyline, Polygon, Tooltip, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus, LocateFixed, Layers, Footprints, Check } from 'lucide-react';
import { CATEGORIES } from '../../shared/categories.js';
import { categoryMarker, userMarker } from '../lib/icons.jsx';
import { splitRoute } from '../lib/nav.js';

export const MAP_STYLES = {
  standard: {
    label: 'Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  humanitarian: {
    label: 'Walking detail',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles: Humanitarian OSM Team',
    maxNativeZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics | Places &copy; OpenStreetMap contributors',
    maxNativeZoom: 19,
  },
};

const ring = (r) => r.map(([lat, lng]) => [lat, lng]);

function Controller({ apiRef, padding, follow, userPos, navigating, onUserMove, onZoom, onMapClick, onMapLongPress }) {
  const map = useMap();
  const padRef = useRef(padding);
  padRef.current = padding;

  useEffect(() => {
    apiRef.current = {
      flyTo: (latlng, zoom = 18) => {
        const z = Math.max(map.getZoom(), zoom);
        // shift the target so it isn't hidden behind the panel/sheet
        const p = padRef.current;
        const pt = map.project(latlng, z).add([((p.left || 0) - (p.right || 0)) / -2, ((p.top || 0) - (p.bottom || 0)) / -2]);
        map.flyTo(map.unproject(pt, z), z, { duration: 0.8 });
      },
      fitBounds: (bounds, maxZoom = 18) => {
        const p = padRef.current;
        map.flyToBounds(bounds, {
          paddingTopLeft: [(p.left || 0) + 40, (p.top || 0) + 40],
          paddingBottomRight: [(p.right || 0) + 40, (p.bottom || 0) + 40],
          maxZoom, duration: 0.8,
        });
      },
      getMap: () => map,
    };
  }, [apiRef, map]);

  // Follow the user (always during navigation unless they pan away).
  useEffect(() => {
    if (!follow || !userPos) return;
    const z = navigating ? Math.max(map.getZoom(), 18) : map.getZoom();
    const p = padRef.current;
    const pt = map.project([userPos.lat, userPos.lng], z).add([((p.left || 0) - (p.right || 0)) / -2, ((p.top || 0) - (p.bottom || 0)) / -2]);
    map.setView(map.unproject(pt, z), z, { animate: true, duration: 0.5 });
  }, [follow, userPos, navigating, map]);

  useMapEvents({
    dragstart: () => onUserMove?.(),
    zoomend: () => onZoom?.(map.getZoom()),
    click: (e) => onMapClick?.(e.latlng),
    contextmenu: (e) => onMapLongPress?.(e.latlng),
  });
  return null;
}

export default function MapView({
  data, paths, settings, userPos, selected, results, route, progress, destination,
  onSelectPlace, onMapClick, onMapLongPress, isDark, apiRef, padding, follow, onUserMove, onLocate, onToggleSetting, navigating,
}) {
  const [zoom, setZoom] = useState(16);
  const [layersOpen, setLayersOpen] = useState(false);
  const canvas = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const style = MAP_STYLES[settings.mapStyle] || MAP_STYLES.standard;

  const bounds = useMemo(() => {
    const b = data?.bbox;
    return b ? L.latLngBounds([b.s, b.w], [b.n, b.e]) : L.latLngBounds([5.1, -1.31], [5.13, -1.27]);
  }, [data]);

  const resultIds = useMemo(() => new Set((results || []).map((p) => p.id)), [results]);
  const split = useMemo(() => (route && progress ? splitRoute(route, progress.along) : null), [route, progress]);
  const routeEnd = route?.pts?.[route.pts.length - 1];

  const routeColor = isDark ? '#8B89F0' : '#2E2D88';
  const showDots = zoom >= 16 && !navigating;
  const dotRadius = zoom >= 18 ? 6 : zoom >= 17 ? 5 : 3.5;

  return (
    <div className={`absolute inset-0 ${isDark && settings.mapStyle !== 'satellite' ? 'map-dark' : ''}`} style={{ '--map-bottom': `${padding.bottom || 0}px`, '--map-left': `${padding.left || 0}px` }}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [20, 20] }}
        zoomControl={false}
        attributionControl
        preferCanvas
        maxZoom={21}
        minZoom={12}
        className="h-full w-full"
      >
        <TileLayer key={settings.mapStyle} url={style.url} attribution={style.attribution} maxZoom={21} maxNativeZoom={style.maxNativeZoom} />
        <Controller
          apiRef={apiRef} padding={padding} follow={follow} userPos={userPos} navigating={navigating}
          onUserMove={onUserMove} onZoom={setZoom} onMapClick={onMapClick} onMapLongPress={onMapLongPress}
        />

        {/* Campus outlines from OSM */}
        {data?.campus?.map((c) => (
          <Polygon key={c.id} positions={ring(c.ring)} interactive={false}
            pathOptions={{ color: '#2E2D88', weight: 2, dashArray: '6 6', fillColor: '#2E2D88', fillOpacity: 0.04 }} />
        ))}

        {/* Pedestrian paths from OSM */}
        {settings.showPaths && paths?.map((p) => (
          <Polyline key={p.id} positions={p.coords} interactive={false} renderer={canvas}
            pathOptions={{ color: p.kind === 'steps' ? '#E34234' : '#2E2D88', weight: zoom >= 17 ? 3 : 2, opacity: 0.55, dashArray: p.kind === 'footway' || p.kind === 'pedestrian' ? null : '4 5' }} />
        ))}

        {/* Selected building outline */}
        {selected?.polygon && (
          <Polygon positions={ring(selected.polygon)} interactive={false}
            pathOptions={{ color: CATEGORIES[selected.category]?.color || '#2E2D88', weight: 3, fillOpacity: 0.18 }} />
        )}

        {/* All campus places as light dots */}
        {showDots && data?.places?.map((p) => (resultIds.has(p.id) || p.id === selected?.id ? null : (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={dotRadius} renderer={canvas}
            bubblingMouseEvents={false}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: CATEGORIES[p.category]?.color || '#64748B', fillOpacity: 0.9 }}
            eventHandlers={{ click: () => onSelectPlace(p) }}>
            <Tooltip className="ucc-tip" direction="top" offset={[0, -6]}>{p.name}</Tooltip>
          </CircleMarker>
        )))}

        {/* Search / category results */}
        {!navigating && results?.map((p) => (p.id === selected?.id ? null : (
          <Marker key={`r-${p.id}`} position={[p.lat, p.lng]} icon={categoryMarker(p.category, 'chip')}
            eventHandlers={{ click: () => onSelectPlace(p) }}>
            <Tooltip className="ucc-tip" direction="top" offset={[0, -14]}>{p.name}</Tooltip>
          </Marker>
        )))}

        {/* Route */}
        {route && (
          <>
            {split ? (
              <>
                <Polyline positions={split.done} pathOptions={{ color: '#9AA0B4', weight: 7, opacity: 0.9, lineCap: 'round' }} />
                <Polyline positions={split.rest} pathOptions={{ color: '#fff', weight: 11, opacity: 1, lineCap: 'round' }} />
                <Polyline positions={split.rest} pathOptions={{ color: routeColor, weight: 7, opacity: 1, lineCap: 'round' }} />
              </>
            ) : (
              <>
                <Polyline positions={route.geometry} pathOptions={{ color: '#fff', weight: 11, opacity: 1, lineCap: 'round' }} />
                <Polyline positions={route.geometry} pathOptions={{ color: routeColor, weight: 7, opacity: 1, lineCap: 'round' }} />
              </>
            )}
            {destination && routeEnd && (
              <Polyline positions={[[routeEnd.lat, routeEnd.lng], [destination.lat, destination.lng]]}
                pathOptions={{ color: routeColor, weight: 4, dashArray: '2 8', lineCap: 'round' }} />
            )}
          </>
        )}

        {/* Selected / destination pin */}
        {(destination || selected) && (
          <Marker position={[(destination || selected).lat, (destination || selected).lng]}
            icon={categoryMarker((destination || selected).category, 'pin')} zIndexOffset={900} />
        )}

        {/* Live GPS position */}
        {userPos && (
          <>
            {userPos.accuracy < 300 && (
              <Circle center={[userPos.lat, userPos.lng]} radius={userPos.accuracy} interactive={false}
                pathOptions={{ color: '#1A73E8', weight: 1, opacity: 0.4, fillColor: '#1A73E8', fillOpacity: 0.12 }} />
            )}
            <Marker position={[userPos.lat, userPos.lng]} icon={userMarker(userPos.heading)} zIndexOffset={1000} interactive={false} />
          </>
        )}
      </MapContainer>

      {/* Floating map controls */}
      <div className="pointer-events-none absolute right-3 z-[1050] flex flex-col items-end gap-2 transition-[bottom] duration-300"
        style={{ bottom: (padding.bottom || 0) + 16 }}>
        {layersOpen && (
          <div className="pointer-events-auto card w-52 animate-slideUp p-2 text-sm">
            <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Map style</p>
            {Object.entries(MAP_STYLES).map(([k, s]) => (
              <button key={k} onClick={() => onToggleSetting('mapStyle', k)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 font-medium hover:bg-cobalt-50">
                {s.label}{settings.mapStyle === k && <Check size={16} className="text-cobalt-600" />}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button onClick={() => onToggleSetting('showPaths', !settings.showPaths)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 font-medium hover:bg-cobalt-50">
              <span className="flex items-center gap-2"><Footprints size={16} /> Footpaths</span>
              {settings.showPaths && <Check size={16} className="text-cobalt-600" />}
            </button>
          </div>
        )}
        <button className="icon-btn pointer-events-auto" aria-label="Map layers" onClick={() => setLayersOpen((v) => !v)}><Layers size={20} /></button>
        <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full bg-white shadow-float">
          <button className="flex h-11 w-11 items-center justify-center hover:bg-slate-50" aria-label="Zoom in" onClick={() => apiRef.current?.getMap().zoomIn()}><Plus size={20} /></button>
          <div className="mx-2 border-t border-slate-100" />
          <button className="flex h-11 w-11 items-center justify-center hover:bg-slate-50" aria-label="Zoom out" onClick={() => apiRef.current?.getMap().zoomOut()}><Minus size={20} /></button>
        </div>
        <button className={`icon-btn pointer-events-auto ${follow ? 'text-[#1A73E8]' : ''}`} aria-label="Centre on my location" onClick={onLocate}>
          <LocateFixed size={22} />
        </button>
      </div>
    </div>
  );
}
