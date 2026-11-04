/**
 * Geography for the West Oakland map.
 *
 * Pins are stored as real lat/lng (WGS84). The three era basemaps in
 * /public/basemaps/ are USGS Historical Topographic Map scans reprojected to
 * EPSG:4326 and clipped to EXACTLY MAP_BOUNDS (see tools/build_basemaps.py),
 * which MapView uses as the images' corners. If you change MAP_BOUNDS, re-run
 * the basemap build script.
 */
export const MAP_BOUNDS = {
  north: 37.8215,
  south: 37.7955,
  west: -122.3045,
  east: -122.268,
};

/** Era key -> basemap image + credit line. */
export const BASEMAPS: Record<string, { url: string; credit: string }> = {
  "1950": { url: "/basemaps/1950.jpg", credit: "USGS 1949 · Oakland West quad" },
  "1965": { url: "/basemaps/1965.jpg", credit: "USGS 1959 (photorev.) · Oakland West quad" },
  "1985": { url: "/basemaps/1985.jpg", credit: "USGS 1993 · Oakland West quad" },
};
