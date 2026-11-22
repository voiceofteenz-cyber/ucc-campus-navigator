import { Footprints, Car, Bike } from 'lucide-react';

// Motorbike icon in the same line style as the other icons.
function Motorbike({ size = 24, strokeWidth = 2, className = '', ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      <circle cx="5" cy="16" r="3" />
      <circle cx="19" cy="16" r="3" />
      <path d="M8 16h5l3-6h-3" />
      <path d="M16 10l3 6" />
      <path d="M7 11h5l1 2" />
      <path d="M14 7h2.5l1 3" />
    </svg>
  );
}

// Travel modes. Each uses its own real router on the server:
// foot / car / bike → OSRM profiles, moto → Valhalla motorcycle profile.
export const MODES = ['foot', 'car', 'moto', 'bike'];
export const MODE_INFO = {
  foot: { label: 'Walk', verb: 'walk', doing: 'walking', icon: Footprints },
  car: { label: 'Car', verb: 'drive', doing: 'driving', icon: Car },
  moto: { label: 'Motorbike', verb: 'ride', doing: 'riding', icon: Motorbike },
  bike: { label: 'Bike', verb: 'cycle', doing: 'cycling', icon: Bike },
};
