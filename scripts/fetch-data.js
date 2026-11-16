// Downloads a fresh snapshot of UCC campus data from OpenStreetMap into server/data/campus.json.
// Run: npm run fetch-data
import { buildCampusData, CACHE_FILE } from '../server/osm.js';

try {
  const d = await buildCampusData();
  const counts = d.places.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {});
  console.log(`\nSnapshot written to ${CACHE_FILE}`);
  console.log('Campus outlines:', d.campus.map((c) => c.name).join(', ') || '(none found)');
  console.log('Places by category:', counts);
} catch (err) {
  console.error('Failed to download campus data:', err.message);
  process.exit(1);
}
