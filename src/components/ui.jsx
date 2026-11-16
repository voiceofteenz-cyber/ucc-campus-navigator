import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import { CATEGORIES } from '../../shared/categories.js';
import { CategoryIcon } from '../lib/icons.jsx';
import { formatDistance } from '../lib/format.js';

export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className={compact ? 'h-8 w-8' : 'h-10 w-10'} aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#2E2D88" />
        <path d="M32 12c-8.3 0-15 6.5-15 14.6C17 37.5 32 52 32 52s15-14.5 15-25.4C47 18.5 40.3 12 32 12z" fill="#fff" />
        <path d="M32 16.5L36.2 26.6H27.8Z" fill="#E34234" />
        <path d="M32 36.7L36.2 26.6H27.8Z" fill="#2E2D88" />
        <circle cx="32" cy="26.6" r="2" fill="#FDEE00" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-cobalt-700">UCC Campus Navigator</div>
          <div className="text-[11px] font-semibold text-ink-400">University of Cape Coast · Ghana</div>
        </div>
      )}
    </div>
  );
}

export function CategoryBadge({ category, size = 40 }) {
  const c = CATEGORIES[category] || CATEGORIES.other;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl text-white"
      style={{ width: size, height: size, background: c.color }}>
      <CategoryIcon category={category} size={size * 0.48} strokeWidth={2.2} />
    </span>
  );
}

export function PlaceRow({ place, distance, onClick, saved, subtitle, right }) {
  const c = CATEGORIES[place.category] || CATEGORIES.other;
  return (
    <button onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-cobalt-50 active:bg-cobalt-100">
      <CategoryBadge category={place.category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-ink-900">{place.name}</span>
          {saved && <Star size={13} className="shrink-0 fill-aureolin-400 text-aureolin-500" />}
        </span>
        <span className="block truncate text-xs text-ink-500">{subtitle ?? c.short}</span>
      </span>
      {right ?? (distance != null && <span className="shrink-0 text-xs font-semibold text-ink-500">{formatDistance(distance)}</span>)}
      <ChevronRight size={16} className="shrink-0 text-ink-400 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-current border-r-transparent ${className}`} />;
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-cobalt-50 text-cobalt-600"><Icon size={26} /></span>}
      <p className="font-bold text-ink-900">{title}</p>
      <div className="mt-1 text-sm text-ink-500">{children}</div>
    </div>
  );
}

export function useIsDesktop() {
  const q = '(min-width: 768px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

/** Responsive container: left panel on desktop, draggable bottom sheet on phones. */
export function Sheet({ isDesktop, snap, onSnap, onHeight, header, children }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dragH, setDragH] = useState(null);
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const heights = { peek: 150, half: Math.round(vh * 0.52), full: vh - 88 };
  const h = dragH ?? heights[snap] ?? heights.half;

  useEffect(() => { if (!isDesktop) onHeight?.(Math.min(h, heights.half)); }, [h, isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isDesktop) {
    return (
      <aside className="absolute bottom-0 left-0 top-0 z-[1100] flex w-[400px] flex-col bg-white shadow-float">
        {header}
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
      </aside>
    );
  }

  const onDown = (e) => { drag.current = { y: e.clientY, h }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (drag.current) setDragH(Math.max(110, Math.min(heights.full, drag.current.h + drag.current.y - e.clientY))); };
  const onUp = (e) => {
    if (!drag.current) return;
    const moved = Math.abs(e.clientY - drag.current.y) > 6;
    const cur = dragH ?? h;
    drag.current = null; setDragH(null);
    if (!moved) { onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half'); return; }
    const nearest = Object.entries(heights).sort((a, b) => Math.abs(a[1] - cur) - Math.abs(b[1] - cur))[0][0];
    onSnap(nearest);
  };

  return (
    <section ref={ref} className="absolute inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-[28px] bg-white shadow-sheet"
      style={{ height: h, transition: dragH == null ? 'height .3s cubic-bezier(.2,.8,.2,1)' : 'none' }}>
      <div className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="h-1.5 w-11 rounded-full bg-slate-300" />
      </div>
      {header}
      <div className="no-scrollbar safe-bottom flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
