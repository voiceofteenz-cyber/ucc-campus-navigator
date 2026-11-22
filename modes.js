import { Footprints, Car, Bike } from 'lucide-react';

// Travel modes. Each uses its own real router on the server (OSRM foot / car / bicycle profiles).
export const MODES = ['foot', 'car', 'bike'];
export const MODE_INFO = {
  foot: { label: 'Walk', verb: 'walk', doing: 'walking', icon: Footprints },
  car: { label: 'Car', verb: 'drive', doing: 'driving', icon: Car },
  bike: { label: 'Bike', verb: 'cycle', doing: 'cycling', icon: Bike },
};
