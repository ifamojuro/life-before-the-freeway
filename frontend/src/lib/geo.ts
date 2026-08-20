/**
 * Geography for the West Oakland map.
 *
 * Pins are stored as real lat/lng (WGS84). MAP_BOUNDS is the fixed frame the
 * app shows; the three era basemaps in /public/basemaps/ are USGS Historical
 * Topographic Map scans reprojected to EPSG:4326 and clipped to EXACTLY this
 * box (see tools/build_basemaps.py), so the linear percent projection below
 * aligns with the imagery by construction. If you change MAP_BOUNDS, re-run
 * the basemap build script.
 */
export const MAP_BOUNDS = {
  north: 37.8215,
  south: 37.7955,
  west: -122.3045,
  east: -122.268,
};

/** Width/height of the frame measured on the ground (meters), for aspect-true rendering. */
export function groundAspect(): number {
  const { north, south, west, east } = MAP_BOUNDS;
  const midLat = ((north + south) / 2) * (Math.PI / 180);
  const w = (east - west) * 111320 * Math.cos(midLat);
  const h = (north - south) * 110574;
  return w / h;
}

export interface Pt {
  x: number; // percent 0..100 from left
  y: number; // percent 0..100 from top
}

export function project(lat: number, lng: number): Pt {
  const { north, south, west, east } = MAP_BOUNDS;
  return {
    x: ((lng - west) / (east - west)) * 100,
    y: ((north - lat) / (north - south)) * 100,
  };
}

export function unproject(xPct: number, yPct: number): { lat: number; lng: number } {
  const { north, south, west, east } = MAP_BOUNDS;
  return {
    lng: west + (xPct / 100) * (east - west),
    lat: north - (yPct / 100) * (north - south),
  };
}

export function clampPct(v: number) {
  return Math.max(1, Math.min(99, v));
}

/** Era key -> basemap image + credit line. */
export const BASEMAPS: Record<string, { url: string; credit: string }> = {
  "1950": { url: "/basemaps/1950.jpg", credit: "USGS 1949 · Oakland West quad" },
  "1965": { url: "/basemaps/1965.jpg", credit: "USGS 1959 (photorev.) · Oakland West quad" },
  "1985": { url: "/basemaps/1985.jpg", credit: "USGS 1993 · Oakland West quad" },
};

/** Era key -> era aerial photography (built by tools/build_aerials.py). */
export const AERIALS: Record<string, { url: string; credit: string }> = {
  "1950": { url: "/aerials/1950.jpg", credit: "Aerial 1947 · UCSB Library collection" },
  "1965": { url: "/aerials/1965.jpg", credit: "Aerial May 1965 · UCSB Library collection" },
  "1985": { url: "/aerials/1985.jpg", credit: "Aerial 1980 · UCSB Library collection" },
};
