# Mangalore Atlas 🌴

A hand-built, low-poly 3D world of Mangalore (Kudla) — inspired by [levels.fyi/atlas](https://www.levels.fyi/atlas).

**60+ landmarks** with stylized 3D models: temples (Kadri with its ponds & hilltop Shiva, Kudroli's gopuram, Kateel on its river islet), beaches with kites & watersports, the hilltop airport, NITK, hospitals, malls, ice-cream parlours, and the city's IT buildings. Real geography — coastline, the Gurupura & Netravati rivers, the Bengre spit, illustrated elevations — plus living details: rampaging private buses on NH-66, the Tannirbhavi ferry, a circling plane, ships heading to NMPT.

## Features
- 📖 **Story Mode** — "A Day in Kudla", a 14-chapter cinematic tour
- 🧳 **Trip planner** — build an itinerary and tour it stop by stop
- 🔍 Search, category filters, fun facts on every landmark

## Run
Serve this folder to load both maps and their shared controls:

```bash
python3 -m http.server 8734
# → http://localhost:8734
```

Built with [Three.js](https://threejs.org). Created by [Deveesh Shetty](https://github.com/dev-shetty).


## Depth and presentation

The Three.js map uses building shadows, distance fog, and reflective water. The shadow camera follows the current view.
The MapLibre version uses opaque OSM buildings with directional light and vertical shading. Its ground remains flat.

Both maps include perspective controls, daylight and golden-hour lighting, presentation mode, and camera links.
The **Copy view link** button saves the camera and lighting. It does not save the trip, filters, or selected place.
**Present** hides the sidebar and tour controls. The Escape key exits presentation mode.

The shared controls live in `spatial.js` and `spatial.css`. Both HTML files load these files.

## Application integration

The same-page API becomes available after `spatial.js` loads. For MapLibre, wait for the map to load before selecting a place.

```js
const places = window.MangaloreAtlas.getPlaces();
window.MangaloreAtlas.selectPlace(places[0].id);
window.addEventListener('atlas:select', ({ detail }) => {
  // Connect this place to your application panel.
  console.log(detail.id, detail.name, detail.lng, detail.lat, detail.category);
});
```

`selectPlace` returns `false` for an invalid ID. IDs are array indices and can change after edits to the landmark list.
The API operates within the map page. It does not include a bridge for an iframe on another origin.

## Product scope

This prototype can support a guided city explorer with your own place details and actions.
A first commercial pilot can connect place selection to property details, local experiences, or a visitor itinerary.

The maps still use static landmark data and external CDN dependencies. The Three.js city includes procedural buildings and exaggerated landmark sizes.
OSM building heights depend on the source data. Missing heights use a default value.
The map style can report missing icons at close zoom levels.

Before a production launch, the application needs stable place IDs, a maintained data source, loading and failure states, and target-device performance checks.
The current implementation does not include accounts, bookings, payments, or a content editor.

## Miniature city rendering

The Three.js version now builds streets and plots with `miniature.js`. Kadri is the first district in the generation order.
The same rules create the other neighborhoods. The scene currently generates approximately 3,400 buildings from a fixed seed.

The terrain preserves low beaches and exaggerates inland elevations by up to four times. Landmark elevation targets use the same scale.
Roads, vegetation, and building foundations sample the rendered terrain triangles. Flat landmark grounds blend into the surrounding hills.
These elevations are illustrative. They are not a surveyed terrain model.

Building plots follow procedural neighborhood streets. Placement excludes water, major road corridors, nearby buildings, and reserved landmark grounds.
The smaller streets and plots are invented. They do not represent OSM building footprints or actual property boundaries.

Shared geometry and instanced meshes draw roofs, windows, balconies, awnings, palms, and streetlights.
Close detail disappears at longer distances. Landmark models retain their existing stylized scale.
Kadri, Kudroli, Sultan Battery, St. Aloysius, the port, and the airport include additional architectural details.
Pedestrians follow short paths on selected landmark plazas. Boat wakes follow the existing animated vessels.

`welcome.js` provides the introduction and connects its tour button to Story Mode.
Camera links skip the introduction. The introduction remembers dismissal for the browser session.
The `?intro=1` parameter displays it again. Golden hour remains the default.

## Visual checks

The following URLs provide repeatable views:

- Overview: `/?cam=-6500,4800,6500,1500,0,-2500&stats=1`
- Kadri neighborhood: `/?cam=400,1050,-700,1475,170,-1758&stats=1`
- Kadri close-up: `/?cam=1140,400,-1250,1475,200,-1758&stats=1`
- Mobile layout: `/checks/mobile.html`

The `stats` parameter displays a rolling frame-rate estimate, render draw calls, and the generated building count.
The frame estimate covers the latest 180 frames. It is not a GPU benchmark or a guarantee for other devices.
The mobile check uses a 390 × 844 iframe. It does not emulate touch hardware or a mobile GPU.

Validation included matching overview and Kadri screenshots, a close-up, the mobile introduction, and the Story Mode entry.
A local close-up reported approximately 144 fps after the final rendering fixes. Performance varies with the camera and active browser tabs.

Remaining limitations include procedural street layouts, simplified landmark architecture, approximate watercraft paths, and external CDN dependencies.
Real-device touch testing and lower-end GPU profiling remain necessary before a commercial release.

## Social preview

Both map pages use `assets/og-image.png`, a 1200 × 630 PNG captured from the Three.js golden-hour view with a title overlay.
Before deployment, set `og:image` and `twitter:image` in both HTML files to the full public HTTPS URL of this asset. Relative paths support local previews, but social crawlers require an absolute URL.
