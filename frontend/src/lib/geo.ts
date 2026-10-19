/**
 * Geography for the West Oakland map.
 *
 * Pins are stored as real lat/lng (WGS84). The era maps are XYZ tiles built by
 * tools/build_tiles.py from whole USGS Historical Topographic Map sheets;
 * mapCoverage.json (written by the same script) is the area they cover.
 */
import coverage from "./mapCoverage.json";

export const MAP_COVERAGE = coverage;

/** The old fixed frame around the neighborhood: the map's first view. */
export const MAP_BOUNDS = {
  north: 37.8215,
  south: 37.7955,
  west: -122.3045,
  east: -122.268,
};

/**
 * Where the tiles are served from: `<base>/<era>/<z>/<x>/<y>.png`. Defaults to
 * frontend/public/tiles (run the builder); set VITE_MAP_TILES_URL at build
 * time to serve them from object storage instead.
 */
export const TILES_URL: string = import.meta.env.VITE_MAP_TILES_URL ?? "/tiles";

/** Era key -> credit line for its sheets (see docs/historical-maps.md). */
export const ERA_MAPS: Record<string, { credit: string }> = {
  "1950": { credit: "USGS topo maps, 1949" },
  "1965": { credit: "USGS topo maps, 1959 rev. 1968" },
  "1985": { credit: "USGS topo maps, 1993–97" },
};
