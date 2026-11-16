import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import {
  Presentation, Landmark, Building2, Library, FlaskConical, Briefcase, BedDouble, Utensils, Banknote,
  Stethoscope, Trophy, SquareParking, Bus, Church, ShoppingBag, GraduationCap, School, MapPin,
  ArrowUp, CornerUpLeft, CornerUpRight, ArrowUpLeft, ArrowUpRight, RotateCcw, RotateCw, Flag, Navigation,
} from 'lucide-react';
import { CATEGORIES } from '../../shared/categories.js';

export const ICONS = {
  presentation: Presentation, landmark: Landmark, building: Building2, library: Library, flask: FlaskConical,
  briefcase: Briefcase, bed: BedDouble, utensils: Utensils, banknote: Banknote, stethoscope: Stethoscope,
  trophy: Trophy, parking: SquareParking, bus: Bus, church: Church, shopping: ShoppingBag,
  graduation: GraduationCap, school: School, pin: MapPin,
};

export function CategoryIcon({ category, ...props }) {
  const Icon = ICONS[CATEGORIES[category]?.icon] || MapPin;
  return <Icon {...props} />;
}

export const MANEUVER_ICONS = {
  depart: Navigation, arrive: Flag, straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight,
  'sharp-left': CornerUpLeft, 'sharp-right': CornerUpRight, 'slight-left': ArrowUpLeft, 'slight-right': ArrowUpRight,
  uturn: RotateCcw, roundabout: RotateCw,
};

export function ManeuverIcon({ kind, ...props }) {
  const Icon = MANEUVER_ICONS[kind] || ArrowUp;
  return <Icon {...props} />;
}

const cache = new Map();

/** Leaflet pin marker for a category. variant: 'pin' (selected/destination) | 'chip' */
export function categoryMarker(category, variant = 'pin') {
  const key = `${category}:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const color = CATEGORIES[category]?.color || '#2E2D88';
  const Icon = ICONS[CATEGORIES[category]?.icon] || MapPin;
  const svg = renderToStaticMarkup(<Icon size={variant === 'pin' ? 18 : 14} color="#fff" strokeWidth={2.4} />);
  const icon = variant === 'pin'
    ? L.divIcon({
      className: 'ucc-pin',
      html: `<div class="ucc-pin__body" style="--c:${color}">${svg}</div><div class="ucc-pin__tip" style="--c:${color}"></div>`,
      iconSize: [40, 50], iconAnchor: [20, 48], popupAnchor: [0, -44],
    })
    : L.divIcon({
      className: 'ucc-chip',
      html: `<div class="ucc-chip__body" style="--c:${color}">${svg}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  cache.set(key, icon);
  return icon;
}

export function userMarker(heading) {
  const cone = Number.isFinite(heading)
    ? `<div class="ucc-user__cone" style="transform: rotate(${Math.round(heading)}deg)"></div>` : '';
  return L.divIcon({
    className: 'ucc-user',
    html: `${cone}<div class="ucc-user__pulse"></div><div class="ucc-user__dot"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}
