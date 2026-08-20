# Historical map sources for the three era basemaps

Goal: replace the stylized `MapView` background with real historical basemaps for
the three eras (~1950 · 1965 · 1985). West Oakland falls on the USGS
**"Oakland West, CA" 7.5-minute quadrangle**, which turns out to map almost
perfectly onto our eras.

## 1. USGS Historical Topographic Maps — primary recommendation (public domain)

Free, public-domain, **already georeferenced** (GeoTIFF), one file per era.
Verified direct downloads (via ScienceBase / The National Map):

| Era | Edition | GeoTIFF (georeferenced) |
|---|---|---|
| ~1950 "before" | Oakland West **1949** | https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/GeoTIFF/CA/CA_Oakland%20West_293623_1949_24000_geo.tif |
| 1965 "the takings" | Oakland West **1959** base (several printings exist, incl. photorevised states — pick the printing whose collar says the right revision year in topoView) | https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/GeoTIFF/CA/CA_Oakland%20West_293621_1959_24000_geo.tif |
| 1985 "after" | Oakland West **1993** (I-980 complete) | https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/GeoTIFF/CA/CA_Oakland%20West_102315_1993_24000_geo.tif |

Each is also available as GeoPDF (swap `/GeoTIFF/CA/` → `/PDF/CA/24000/` and add
`24000_geo.pdf`). Browse all printings visually at **topoView**:
https://ngmdb.usgs.gov/topoview/viewer/ (search "Oakland West"). The five 1959
printings differ by photo-revision year — open each in topoView and read the
collar ("PHOTOREVISED 19xx") to choose the state closest to 1965.

License: US government work, **public domain** — no attribution required
(credit "USGS Historical Topographic Map Collection" anyway).

## 2. Sanborn fire insurance maps — block-level detail (public domain)

For the neighborhood texture the topo quads can't give (individual buildings,
business footprints on 7th St), the Library of Congress has digitized Oakland
Sanborn atlases (1912 base with pasted corrections through **Nov 1951** —
essentially a ~1950 snapshot, perfect for the "before" era):

- Collection: https://www.loc.gov/collections/sanborn-maps/?all=true&fa=access-restricted:false|location:california|location:alameda+county|location:oakland
- Example volume: https://www.loc.gov/item/sanborn00727_001/

Public domain, free to reuse. Caveat: sheets are **not georeferenced** — you'd
warp the handful of sheets covering 7th & Wood / 7th & Chestnut yourself (see
"Georeferencing" below). Best used as a zoomed-in "block view" or story-page
backdrop rather than the whole basemap.

## 3. Historical aerial photography (public domain)

Real photographs of the neighborhood, before/after the clearance — powerful for
the 1965 era where the story *is* the demolition:

- **UCSB FrameFinder** — 2.5M CA aerials, 1920s–2010, incl. Fairchild surveys
  of Oakland (1927–1965); digitized frames download free:
  https://mil.library.ucsb.edu/ap_indexes/FrameFinder/
- **USGS EarthExplorer** (free account) — "Aerial Photo Single Frames" for the
  1940s–60s, and **NHAP (National High Altitude Photography, 1980–89)** which is
  a near-exact match for the 1985 era. Public domain.
  https://earthexplorer.usgs.gov/
- **UC Berkeley aerial photo catalog** (Bay Area coverage):
  https://dpg.lib.berkeley.edu/webdb/aerial/

## 4. Supporting / thematic layers

- **HOLC "redlining" map of Oakland (1937)** — Mapping Inequality project;
  West Oakland's grades are directly relevant context for the freeway routing.
  Georeferenced tiles + GeoJSON downloads: https://dsl.richmond.edu/panorama/redlining/
  (check their license — CC BY-NC-SA — fine for this non-commercial civic project, attribution required).
- **David Rumsey Map Collection** — Oakland street maps & Thomas Bros atlases,
  high-res scans, many already georeferenced in Georeferencer:
  https://www.davidrumsey.com/ (CC BY-NC-SA 3.0 — attribution required).
- **OpenHistoricalMap** — vector historical OSM; sparse for Oakland but usable
  as a labeled street layer: https://www.openhistoricalmap.org/

## Georeferencing & integration path

1. The USGS GeoTIFFs are already georeferenced — clip to our bounding box
   (`frontend/src/lib/geo.ts` MAP_BOUNDS: 37.7985–37.8165 N, −122.3045–−122.2775 W)
   and tile them:
   ```bash
   gdalwarp -t_srs EPSG:3857 -te -122.3045 37.7985 -122.2775 37.8165 -te_srs EPSG:4326 in.tif era.tif
   gdal2tiles.py --zoom=13-18 era.tif tiles/1950/
   ```
2. Non-georeferenced scans (Sanborn sheets, aerial frames): warp with
   **Allmaps** (https://allmaps.org, IIIF, serves tiles directly) or
   **Map Warper** (https://mapwarper.net).
3. Frontend: swap `MapView`'s styled background for **MapLibre GL** with one
   raster source per era, toggled by the existing era control. Pins already
   store real lat/lng, so nothing else changes.

Because MAP_BOUNDS is a plain lat/lng box, the current pin projection will line
up with any correctly georeferenced layer without touching the data model.

---

## Implementation note (Aug 19, 2026)

The USGS quads are now **wired into the app** — the era toggle switches real
historical basemaps.

**What was done**

- `tools/build_basemaps.py` downloads the three public-domain "Oakland West"
  GeoTIFFs, reprojects them (NAD27 polyconic/TM → EPSG:4326 — PROJ applies the
  NAD27→WGS84 datum shift, ~92 m here, so don't skip it), clips to
  `MAP_BOUNDS`, and writes `frontend/public/basemaps/{1950,1965,1985}.jpg`
  (~2000×1425, ~0.7–0.9 MB each). Re-run it whenever `MAP_BOUNDS` changes.
- Era → scan mapping: **~1950** → 1949 edition (intact pre-freeway grid);
  **1965** → 1959 edition, *photorevised printing* (scan 293621 — the purple
  overprint is demolition-era change: BART on 7th St, clearance; the clean
  un-revised 1959 base is scan 293624 if a quieter look is preferred);
  **1985** → 1993 edition (I-980 built and labeled). All printings browsable in
  topoView.
- `MAP_BOUNDS` was widened (now W −122.3045, S 37.7955, E −122.2680,
  N 37.8215) so the real I-980 corridor is in frame.
- `MapView` renders the basemap on a ground-aspect-preserving plane that
  *covers* its container (like `background-size: cover`) with **pan + zoom**,
  instead of stretching the image — otherwise portrait phones would distort
  streets ~2×. Pins, tap-to-place, and the moderation tagging maps all project
  onto the same plane, so they stay glued to their streets at any container
  shape. If a basemap image fails to load, the old stylized grid renders as a
  fallback. A "USGS … public domain" credit chip shows on-map.
- **Why no MapLibre/tile pipeline (yet):** the app shows one small fixed
  extent, and the 1:24000 scans only carry ~1,200 px of detail across it —
  tiling adds serving complexity with zero added detail. A single warped image
  per era is the ceiling of the source material. If deep zoom is ever needed
  (e.g. warped Sanborn sheets), swap `MapView`'s plane for MapLibre raster/
  image sources; pins already store real lat/lng so nothing else changes.
- Seed pin coordinates were corrected to real intersections — verified against
  OSM (Nominatim/Overpass: 7th & Wood, 7th & Center, 10th & Union,
  12th & Peralta, West Oakland BART, DeFremery) and read off the georeferenced
  1949 quad for intersections the freeway/postal facility erased
  (7th & Chestnut, 8th & Chestnut, 12th & Myrtle). Reset `lbtf.db` to reseed.

**Caveats:** pin accuracy is now "correct block" quality — good enough for the
sample archive; real submissions get moderator-placed pins anyway. The 1965
slot uses a photorevised printing whose exact revision year should be read off
the map collar in topoView before public launch (it's cited on-screen as
"USGS 1959 (photorev.)").

---

## v1 digitized vector layer (branch: `digitized-maps-v1`)

A first pass at fully **digital** (vector) era maps, layered over — or replacing —
the scans. On the home map a **"Base: scan + vectors / vectors / scan"** chip
cycles the modes.

**How it was made** (`tools/build_vector_overlay.py` → `frontend/public/overlays/features.geojson`, ~1,450 features):

- **Skeleton from modern OSM** (Overpass pull, © OpenStreetMap contributors,
  ODbL): most of the 1949 grid survives north of 7th St, so today's centerlines
  are correct geometry for all three eras.
- **Era logic per feature**: `Grove Shafter Freeway` (I-980) → 1985 only;
  Nimitz/Cypress structure → 1965 + 1985; `Mandela Parkway` is re-issued as
  1950 "Cypress Street" (its pre-freeway identity); unnamed motorway ramps near
  the 980 corridor → 1985 only.
- **Hand-added erased streets** (dashed): South Prescott segments wiped out by
  the postal facility era, positioned from the georeferenced 1949 USGS quad.
- **Hand-authored polygons**: 1965 takings corridors (Cypress + Grove-Shafter
  rights-of-way, hatched red) and DeFremery Park; a few landmark labels.
- Rendered by `frontend/src/components/VectorOverlay.tsx` as SVG on the same
  projected plane as the pins — crisp at any zoom, era-filtered at runtime.

**Known v1 gaps (the volunteer correction pass, ~1–2 days in QGIS/geojson.io):**

- Modern-only roads leak into 1950/1965 (Frontage Rd, some Grand Ave/Mandela
  geometry, post-1985 realignments) — need `eras` trimmed per feature.
- Erased-street coverage is minimal (5 hand segments); the full South Prescott
  + 980-corridor grids should be traced from the 1949 scan.
- Street-name labels aren't rendered yet (only landmarks/takings).
- Attribution requirement: any public deployment must credit
  "© OpenStreetMap contributors" (ODbL) for the street geometry.

Correcting this file against the scans is also the on-ramp to contributing the
result to **OpenHistoricalMap** so the digitization outlives this app.

### v1.1 — high-fidelity base (MapLibre GL + OpenFreeMap)

The map now renders with the familiar digital-map cartography (green parks,
blue water, grey buildings, labeled streets): **MapLibre GL** with
**OpenFreeMap "liberty" vector tiles** (openfreemap.org — free, no API key,
© OpenStreetMap contributors). Era correctness on top:

- Modern motorways + route shields are hidden from the base style everywhere;
  freeways draw era-correct from `features.geojson` (none in 1950, the Cypress
  structure in 1965/85, I-980 only in 1985) in standard motorway orange.
- 1965 takings corridors and hand-traced erased streets render above the base.
- The USGS scan remains available as a raster layer — base chip cycles
  **streets / streets + scan / scan**.
- If tiles are unreachable (offline demo), `MapView` falls back to the previous
  self-contained plane renderer automatically.

Known anachronisms of using modern tiles under historical eras: building
footprints, park shapes, and some street labels are present-day (e.g.
"Mandela Parkway" labels the 1950 Cypress St alignment). The era freeway/
takings layers correct the big story; label-level fixes are part of the
digitization correction pass.

### v1.2 — era aerial photography (UCSB Library)

Each era now has a **photographic basemap from the era itself** — the
"satellite view" of its decade — selectable from the base chip
(streets → aerial → USGS scan → streets + scan). Imagery renders below the
vector style's labels, giving the familiar hybrid look.

**Frames** (discovered via UCSB FrameFinder's public feature service —
`services1.arcgis.com/.../All_Flights_Merge/FeatureServer/0` — and downloaded
free from `mil.library.ucsb.edu/ap_images/`):

| Era | Flight / frames | Date · scale |
|---|---|---|
| ~1950 | C_5750 289-103 | **Aug 2, 1939** · 1:20,000 (single frame covers the full extent) |
| 1965 | CAS_65_130 15-116/117/118/133/134 (5-frame mosaic) | **May 18, 1965** · 1:12,000 |
| 1985 | GS_VEZR 1-25 | 1980 · 1:24,000 (corridor cleared / construction) |

The GS_CP 1946/47 flight was tried first for the "before" era, but its
FrameFinder centerpoints proved off by 1–2 km in inconsistent directions
(frame 1-17 is actually centered over Alameda) — which is what made the first
"1947" basemap look zoomed-out and mis-oriented. The 1939 frame calibrates
cleanly and covers the whole extent alone.

`tools/build_aerials.py` georeferences each frame by center + scale +
rotation + shift (tuned by QA against the digitized street vectors; residuals
~5–15 m), masks the film collar, normalizes exposure, composites the 1965
mosaic pick-best (no ghosting), and writes `frontend/public/aerials/{era}.jpg`.

**Accuracy note:** frames are georeferenced by a global center/scale/rotation
fit, QA'd at anchors to ~5–40 m — but single-frame aerials carry lens/relief
distortion, so local drift up to ~100 m exists away from the QA anchors (e.g.
the 1965 mosaic drifts near DeFremery). The proper fix is a per-frame
multi-GCP affine fit (QGIS georeferencer, or extending build_aerials.py) — a
good volunteer pass.

**TODOs:** WAC_84C 4-32 (1984, post-opening I-980) is cached but its NASA
flightline is rotated off-north — needs proper GCP georeferencing before it
can replace the 1980 frame; a couple of small no-coverage slivers at the 1965
mosaic's north edge; confirm UCSB's reuse terms for public launch (collection
is served as free downloads; attribution shown on-map).
