# UCC Campus Navigator

A GPS walking-navigation web app for the **University of Cape Coast (UCC), Ghana**.
It uses React, Tailwind CSS, Leaflet and OpenStreetMap, with pedestrian routing from OSRM's foot profile and a Node.js/Express backend.

Open the site, allow location access, search for a campus destination, and tap **START NAVIGATION**. You get live turn-by-turn walking directions from where you are.

---

## Features

| Area | What it does |
|---|---|
| **Interactive map** | Leaflet map with OpenStreetMap tiles, a "Walking detail" (HOT) style and a satellite style. It shows the UCC campus outline, a footpath overlay, building outlines and colour-coded places. You can zoom, tap a place to select it, or long-press to drop a pin. |
| **Live GPS** | Asks for permission when the app opens. Shows a blue dot with an accuracy circle and a heading cone, and updates as you move. Has a re-centre button. Handles denied permission, no signal, timeouts and insecure (non-https) pages with clear messages and a retry button. |
| **Smart search** | Searches as you type and handles typos, abbreviations (e.g. "LT") and keywords. Includes 16 category filters, search history, popular destinations, and a fallback search on OpenStreetMap (Nominatim) limited to the campus area. |
| **Walking navigation** | Calculates a real pedestrian route and draws it on the map. Shows the distance, walking time, arrival time and step-by-step directions. Live navigation snaps your GPS position to the route and shows the next turn and the distance to it. It also shows a progress bar and remaining distance and time. It recalculates if you go off the route, detects arrival, speaks instructions (Web Speech API) and keeps the screen awake. |
| **Place details** | Shows the name, a photo (from Wikidata or Wikimedia Commons when OSM links one), the description, opening hours, phone and website. Also lists the facilities mapped inside the building and nearby landmarks with directions. Buttons: **Get directions**, Save, Share. |
| **Nearby places** | Groups places as Academic, Food, Accommodation, Healthcare, Banking, Transport and Recreation, with straight-line distances from you. |
| **Favourites** | Save, open, navigate to and remove places, stored in localStorage. |
| **Screens** | Home/Explore, Map, Search results, Place details, Directions, Navigation, Saved, Recent, Settings. Works on phones (draggable bottom sheet) and on tablets and desktops (side panel). |

### Where the data comes from (nothing is made up)
- **Buildings, places, campus outlines, footpaths:** downloaded live from **OpenStreetMap** through the Overpass API. The server finds the OSM polygons tagged as the University of Cape Coast. Then it downloads every named feature and footpath in and around them, sorts them into categories and caches them.
- **Routes, distances, times:** from the **OSRM foot profile** run by FOSSGIS at `routing.openstreetmap.de/routed-foot` (the walking router used on openstreetmap.org). Driving routers are never used. An optional fallback is OpenRouteService `foot-walking` (`ORS_API_KEY`).
- **Arrival times** use the routing engine's own walking time for the route.
- If OSM has no path all the way to a building, the app draws the last stretch as a dotted line and says so. It does not invent a path.
- If a building is missing or wrong, fix it on openstreetmap.org. The app picks up changes on its next data refresh.

---

## Requirements
- **Node.js 18.17 or newer** (20 or 22 recommended), plus npm
- An internet connection (for map tiles, OSM data and routing)

## Install and run (development)

```bash
cd ucc-campus-navigator
npm install
npm run dev
```

- Web app: **http://localhost:5173**
- API: http://localhost:5174, proxied automatically under `/api`

The first start downloads the UCC data from OpenStreetMap, which takes about 10–60 seconds, and saves it to `server/data/campus.json`. Later starts load instantly. To download a fresh copy manually and see a summary by category:

```bash
npm run fetch-data
```

## Testing on a phone (real GPS)

Browsers only allow GPS on **https** or `localhost`. Choose one of these:

1. **Same Wi-Fi, quick:** run `npm run dev:https` and open `https://<your-computer-IP>:5173` on the phone. Accept the self-signed certificate warning. Vite prints the network URL.
2. **Public https tunnel:** run `npm run build && npm start`, then `npx localtunnel --port 5174` (or `cloudflared tunnel --url http://localhost:5174`). Open the https link on any phone.
3. **Deploy:** push to GitHub and create a Web Service on Render or Railway. Build command: `npm install && npm run build`. Start command: `npm start`. Hosted sites get https automatically.

## Production build

```bash
npm run build      # builds the React app into dist/
npm start          # Express serves dist/ and the API on http://localhost:5174
```

## Automated tests

```bash
npm test
```

These unit tests cover categories, the geodesy helpers, navigation maths (snapping, next turn, remaining time, off-route and arrival), OSM multipolygon handling, linking facilities to the building they are in, and wording of turn instructions.

## Manual test checklist (for the demo)
1. Open the app and allow location. The blue dot appears with an accuracy circle.
2. Type "library" (or tap a category). Results appear on the map and in the list.
3. Open a result. You see the details, the building outline, nearby landmarks and the facilities inside.
4. Tap **Get directions**. The route, distance, time, arrival time and steps appear.
5. Tap **START NAVIGATION** and walk. The next-turn banner, distance and progress bar update, and instructions are spoken.
6. Walk off the route. After a couple of GPS updates the app shows "Rerouting…" and calculates a new route.
7. Reach the building. "You have arrived" appears.
8. Save a place with ★, then check the **Saved** tab. Check the **Recent** tab too.
9. Deny location in browser settings. You get a clear message and a **Try again** button.

## Configuration (optional, `.env` or environment variables)
See `.env.example`: `PORT`, `ORS_API_KEY`, `OSRM_FOOT_URL`, `CACHE_HOURS`, `OVERPASS_URLS`.

## Project structure

```
server/
  index.js        Express API: /api/campus, /api/paths, /api/route, /api/geocode, /api/photo
  osm.js          OpenStreetMap download, campus detection, classification, caching
  routing.js      OSRM foot routing (+ optional OpenRouteService), turn-instruction text
shared/
  categories.js   Category rules for OSM tags, plus labels, colours and nearby groups
  geo.js          Distance, bearing, point-in-polygon, polygon centroid
src/
  App.jsx         Screen flow, search, routing, live navigation loop
  components/     MapView, SearchBar, HomePanel, SearchPanel, PlaceDetails,
                  DirectionsPanel, NavigationView, Saved/Recent/Settings, ui
  hooks/          useGeolocation (watchPosition), useCampusData, useLocalStorage, useWakeLock
  lib/            nav.js (navigation maths), search.js, speech.js, format.js, api.js, icons.jsx
scripts/fetch-data.js   Downloads a fresh campus snapshot
tests/core.test.js      Unit tests
```

## Notes and limitations
- How complete the map is depends on how well UCC is mapped in OpenStreetMap. Unmapped buildings cannot be shown. That is deliberate: the app never adds places that are not mapped.
- The public FOSSGIS and Overpass servers are free community services. Keep request volume reasonable. The server caches campus data so it is only downloaded every few days.
- Spoken directions depend on the browser (Chrome, Edge and Safari support them).

## Credits
Map data © OpenStreetMap contributors (ODbL). Routing by OSRM on FOSSGIS servers. Tiles by OpenStreetMap, the Humanitarian OSM Team and Esri. Icons by Lucide.
