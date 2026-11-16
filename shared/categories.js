// Category system shared by the server (classifies OpenStreetMap features)
// and the client (labels, colours, icons, filters).
// Classification only interprets real OSM tags and names — it never creates places.

export const CATEGORIES = {
  lecture:    { label: 'Lecture halls',          short: 'Lecture hall',       color: '#2E2D88', icon: 'presentation' },
  faculty:    { label: 'Faculties & schools',    short: 'Faculty / school',   color: '#3F3DB0', icon: 'landmark' },
  department: { label: 'Departments',            short: 'Department',         color: '#5452C8', icon: 'building' },
  library:    { label: 'Libraries',              short: 'Library',            color: '#7C3AED', icon: 'library' },
  lab:        { label: 'Laboratories',           short: 'Laboratory',         color: '#0E7490', icon: 'flask' },
  admin:      { label: 'Administrative offices', short: 'Office',             color: '#475569', icon: 'briefcase' },
  hostel:     { label: 'Halls & hostels',        short: 'Accommodation',      color: '#C2410C', icon: 'bed' },
  food:       { label: 'Restaurants & cafeterias', short: 'Food',             color: '#E34234', icon: 'utensils' },
  bank:       { label: 'Banks & ATMs',           short: 'Bank / ATM',         color: '#15803D', icon: 'banknote' },
  health:     { label: 'Hospitals & clinics',    short: 'Healthcare',         color: '#DC2626', icon: 'stethoscope' },
  sports:     { label: 'Sports & recreation',    short: 'Sports / recreation', color: '#0891B2', icon: 'trophy' },
  parking:    { label: 'Parking',                short: 'Parking',            color: '#1D4ED8', icon: 'parking' },
  transport:  { label: 'Transport',              short: 'Transport',          color: '#0F766E', icon: 'bus' },
  worship:    { label: 'Places of worship',      short: 'Worship',            color: '#9333EA', icon: 'church' },
  shop:       { label: 'Shops & markets',        short: 'Shop',               color: '#DB2777', icon: 'shopping' },
  academic:   { label: 'Academic buildings',     short: 'Academic building',  color: '#2E2D88', icon: 'graduation' },
  campus:     { label: 'Campus areas',           short: 'Campus',             color: '#2E2D88', icon: 'school' },
  other:      { label: 'Other buildings & places', short: 'Place',            color: '#64748B', icon: 'pin' },
  pin:        { label: 'Dropped pin',            short: 'Dropped pin',        color: '#E34234', icon: 'pin' },
};

// Categories offered in the search screen, in the order the brief lists them.
export const SEARCH_CATEGORIES = [
  'lecture', 'faculty', 'department', 'hostel', 'library', 'admin', 'lab',
  'bank', 'food', 'health', 'sports', 'parking', 'transport', 'worship', 'shop', 'academic',
];

// Groups used by the "Nearby places" section.
export const NEARBY_GROUPS = [
  { key: 'academic',  label: 'Academic',      icon: 'graduation', cats: ['lecture', 'faculty', 'department', 'library', 'lab', 'academic', 'admin'] },
  { key: 'food',      label: 'Food',          icon: 'utensils',   cats: ['food'] },
  { key: 'stay',      label: 'Accommodation', icon: 'bed',        cats: ['hostel'] },
  { key: 'health',    label: 'Healthcare',    icon: 'stethoscope', cats: ['health'] },
  { key: 'bank',      label: 'Banking',       icon: 'banknote',   cats: ['bank'] },
  { key: 'transport', label: 'Transport',     icon: 'bus',        cats: ['transport', 'parking'] },
  { key: 'fun',       label: 'Recreation',    icon: 'trophy',     cats: ['sports'] },
];

const has = (re, s) => re.test(s);

/**
 * Classify an OpenStreetMap feature from its tags.
 * @param {Record<string,string>} tags
 * @param {{ areaM2?: number }} [meta]
 */
export function categorize(tags = {}, meta = {}) {
  const name = [tags.name, tags.alt_name, tags.short_name, tags.official_name].filter(Boolean).join(' ');
  const a = tags.amenity;
  const b = tags.building;
  const l = tags.leisure;

  // Large university/college polygons that are not buildings are campus areas.
  if ((a === 'university' || a === 'college') && !b && (meta.areaM2 ?? 0) > 40000) return 'campus';

  if (a === 'atm' || a === 'bank' || a === 'bureau_de_change' || has(/\batm\b|\bbank\b/i, name)) return 'bank';
  if (['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist'].includes(a) || tags.healthcare ||
      has(/hospital|clinic|pharmacy|health cent(er|re)|infirmary/i, name)) return 'health';
  if (a === 'library' || has(/librar/i, name)) return 'library';
  if (has(/laborator|\blabs?\b/i, name)) return 'lab';
  if (has(/lecture|theat(re|er)|auditorium|\bl\.?t\b|classroom|exam(ination)?s? (cent(er|re)|hall|block)|\blecture complex\b/i, name)) return 'lecture';
  if (['restaurant', 'cafe', 'fast_food', 'food_court', 'canteen', 'bar', 'ice_cream', 'pub'].includes(a) ||
      has(/restaurant|cafeteria|canteen|eatery|\bfood\b|chop bar|kitchen|snack|\bcaf(e|é)\b/i, name)) return 'food';
  if (b === 'dormitory' || a === 'student_accommodation' || ['hostel', 'guest_house', 'hotel', 'motel', 'apartment'].includes(tags.tourism) ||
      has(/hostel|\bhall\b|residence|apartments?|lodge|\bannex\b/i, name)) return 'hostel';
  if (has(/faculty|college of|school of|\bschool\b/i, name)) return 'faculty';
  if (has(/department|\bdept\b|institute|cent(re|er) for|\bdirectorate\b/i, name)) return 'department';
  if (tags.office || has(/administration|\badmin\b|registr|vice[- ]?chancellor|senate|council|bursar|admissions|\boffice\b|secretariat/i, name)) return 'admin';
  if (['pitch', 'sports_centre', 'stadium', 'track', 'swimming_pool', 'fitness_centre', 'sports_hall', 'park', 'garden', 'playground'].includes(l) ||
      has(/stadium|sports|\bpitch\b|\bgym\b|\bcourt\b|\bfield\b|\bpark\b|garden|\bzoo\b/i, name) && !has(/parking|car park/i, name)) return 'sports';
  if (a === 'parking' || a === 'parking_space' || a === 'motorcycle_parking' || has(/car park|parking/i, name)) return 'parking';
  if (tags.highway === 'bus_stop' || ['bus_station', 'taxi', 'ferry_terminal'].includes(a) || tags.public_transport ||
      has(/station|bus stop|lorry park|taxi rank|\bterminal\b/i, name)) return 'transport';
  if (a === 'place_of_worship' || has(/church|chapel|mosque|cathedral/i, name)) return 'worship';
  if (tags.shop || a === 'marketplace' || has(/market|\bshop\b|store|\bmart\b|mall/i, name)) return 'shop';
  if (['university', 'college', 'school', 'kindergarten', 'research_institute'].includes(a) ||
      ['university', 'college', 'school'].includes(b)) return 'academic';
  return 'other';
}

/** Fallback display name for useful features that have no name tag in OSM. */
export function fallbackName(tags = {}) {
  const who = tags.brand || tags.operator || tags.network;
  switch (tags.amenity) {
    case 'atm': return who ? `${who} ATM` : 'ATM';
    case 'bank': return who ? `${who} Bank` : 'Bank';
    case 'parking': return tags.access === 'private' ? 'Parking (private)' : 'Parking area';
    case 'toilets': return 'Toilets';
    case 'bus_station': return 'Bus station';
    case 'place_of_worship': return 'Place of worship';
    case 'pharmacy': return 'Pharmacy';
    default: break;
  }
  if (tags.leisure === 'pitch') return tags.sport ? `${cap(tags.sport.replace(/_/g, ' '))} pitch` : 'Sports pitch';
  if (tags.leisure === 'stadium') return 'Stadium';
  if (tags.leisure === 'track') return 'Running track';
  if (tags.highway === 'bus_stop') return 'Bus stop';
  return null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
