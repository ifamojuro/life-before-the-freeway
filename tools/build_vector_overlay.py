"""Build the v1 digitized vector overlay (streets / freeways / takings / landmarks).

Strategy (documented in docs/historical-maps.md):
- The 1949 street grid largely SURVIVES in modern OSM north of 7th St, so the
  skeleton comes from an Overpass pull of today's streets (ODbL, attributed).
- Era logic is applied per feature: freeways only exist in the eras they were
  built ("Grove Shafter Freeway" = I-980 -> 1985; Nimitz/Cypress -> 1965+1985);
  Mandela Parkway is re-issued as 1949 "Cypress Street" (its pre-freeway
  identity) and as the 1965/1985 Cypress Structure.
- Streets ERASED by the freeways/postal facility don't exist in OSM; v1
  hand-adds them from the georeferenced 1949 USGS scan (see anchors below) and
  marks them erased:true so they render dashed. Correction beats creation:
  fixing these against the scan in QGIS/geojson.io is the follow-up volunteer task.
- Takings corridors (1965) and a few landmarks are hand-authored polygons/points.

Input:  Overpass JSON (ways w/ geometry) — fetched by the command below.
Output: frontend/public/overlays/features.geojson  (one file; the app filters by era)

  curl -s "https://overpass-api.de/api/interpreter" --data-urlencode \
    'data=[out:json][timeout:50];(way["highway"~"^(motorway|motorway_link|trunk|primary|secondary|tertiary|residential|unclassified)$"](37.7955,-122.3045,37.8215,-122.2680););out geom;' \
    -o /tmp/osm_streets.json
  python3 tools/build_vector_overlay.py /tmp/osm_streets.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "overlays" / "features.geojson"

ALL = ["1950", "1965", "1985"]

# --- hand-added geometry -----------------------------------------------------
# 7th St line (verified anchors): (37.80707,-122.30236) at Wood -> slope dlat/dlon = -0.2332
SLOPE_EW = -0.2332          # east-west streets
SLOPE_NS = 1 / 0.2332       # north-south streets are perpendicular in the grid

def ew_line(lat_at_wood: float, lng0=-122.3024, lng1=-122.2955):
    """An east-west street segment given its latitude where it crosses Wood St."""
    return [[lng0, lat_at_wood], [lng1, lat_at_wood + SLOPE_EW * (lng1 - lng0)]]

def ns_line(lng_at_7th: float, lat7: float, dlat=-0.004):
    """A north-south street segment running south from 7th St."""
    dlng = dlat / SLOPE_NS
    return [[lng_at_7th, lat7], [lng_at_7th + dlng, lat7 + dlat]]

def lat_on_7th(lng: float) -> float:
    return 37.80707 + SLOPE_EW * (lng + 122.30236)

HAND_STREETS = [
    # South Prescott streets erased by the I-880/postal-facility era —
    # positions read off the georeferenced 1949 USGS quad (approximate; v1).
    {"name": "Pine Street",   "coords": ns_line(-122.3004, lat_on_7th(-122.3004)), "eras": ["1950", "1965"]},
    {"name": "Cedar Street",  "coords": ns_line(-122.2984, lat_on_7th(-122.2984)), "eras": ["1950", "1965"]},
    {"name": "4th Street",    "coords": ew_line(37.80707 - 0.0028), "eras": ["1950", "1965"]},
    {"name": "5th Street (west)", "coords": ew_line(37.80707 - 0.0019), "eras": ["1950", "1965"]},
    {"name": "6th Street (west)", "coords": ew_line(37.80707 - 0.0010), "eras": ["1950", "1965"]},
]

def strip(p0, p1, half_w_lng):
    """Rectangle polygon along a line, buffered in longitude."""
    (x0, y0), (x1, y1) = p0, p1
    return [[
        [x0 - half_w_lng, y0], [x0 + half_w_lng, y0],
        [x1 + half_w_lng, y1], [x1 - half_w_lng, y1], [x0 - half_w_lng, y0],
    ]]

TAKINGS = [
    {"name": "Cypress corridor clearance", "eras": ["1965"],
     "poly": strip((-122.2944, 37.7995), (-122.2921, 37.8180), 0.0006)},
    {"name": "Grove-Shafter (I-980) right-of-way", "eras": ["1965"],
     "poly": strip((-122.2748, 37.7990), (-122.2688, 37.8195), 0.0009)},
]

LANDMARKS = [
    {"name": "DeFremery Park", "kind": "park", "eras": ALL,
     "poly": [[[-122.2898, 37.8100], [-122.2866, 37.8107], [-122.2872, 37.8129], [-122.2903, 37.8122], [-122.2898, 37.8100]]]},
    {"name": "Prescott School", "kind": "school", "eras": ALL, "pt": [-122.3005, 37.8078]},
    {"name": "McClymonds High Sch", "kind": "school", "eras": ALL, "pt": [-122.2820, 37.8085]},
    {"name": "Southern Pacific yards", "kind": "rail", "eras": ALL, "pt": [-122.3010, 37.7985]},
]

# --- OSM classification ------------------------------------------------------

def classify(tags: dict) -> list[dict]:
    """Return era-specific variants of one OSM way (usually one, sometimes two)."""
    hw = tags.get("highway", "")
    name = tags.get("name", "")
    if name == "Mandela Parkway":
        # pre-freeway identity + the structure that replaced it
        return [
            {"name": "Cypress Street", "kind": "major", "eras": ["1950"]},
            {"name": "Cypress Structure · Nimitz Fwy", "kind": "freeway", "eras": ["1965", "1985"]},
        ]
    if hw in ("motorway", "motorway_link"):
        is980 = name == "Grove Shafter Freeway" or tags.get("ref", "").find("980") >= 0
        return [{"name": "I-980 · Grove Shafter Fwy" if is980 else (name or "Nimitz Freeway"),
                 "kind": "freeway", "eras": ["1985"] if is980 else ["1965", "1985"]}]
    kind = "major" if hw in ("trunk", "primary", "secondary") else "street"
    return [{"name": name, "kind": kind, "eras": ALL}]


def is_980_link(coords: list) -> bool:
    """Unnamed motorway links near the 980 corridor belong to 1985 only."""
    x = sum(c[0] for c in coords) / len(coords)
    y = sum(c[1] for c in coords) / len(coords)
    return x > -122.2790 and y > 37.7995


def main(osm_path: str) -> None:
    osm = json.loads(Path(osm_path).read_text())
    feats = []
    for el in osm.get("elements", []):
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
        coords = [[round(g["lon"], 6), round(g["lat"], 6)] for g in geom]
        tags = el.get("tags", {})
        for v in classify(tags):
            eras = v["eras"]
            if v["kind"] == "freeway" and not tags.get("name") and tags.get("highway") == "motorway_link":
                eras = ["1985"] if is_980_link(coords) else eras
            feats.append({"type": "Feature",
                          "properties": {"name": v["name"], "kind": v["kind"], "eras": eras, "src": "osm"},
                          "geometry": {"type": "LineString", "coordinates": coords}})
    for h in HAND_STREETS:
        feats.append({"type": "Feature",
                      "properties": {"name": h["name"], "kind": "street", "eras": h["eras"], "erased": True, "src": "usgs-1949"},
                      "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in h["coords"]]}})
    for t in TAKINGS:
        feats.append({"type": "Feature",
                      "properties": {"name": t["name"], "kind": "takings", "eras": t["eras"], "src": "usgs"},
                      "geometry": {"type": "Polygon", "coordinates": t["poly"]}})
    for lm in LANDMARKS:
        geom = ({"type": "Polygon", "coordinates": lm["poly"]} if "poly" in lm
                else {"type": "Point", "coordinates": lm["pt"]})
        feats.append({"type": "Feature",
                      "properties": {"name": lm["name"], "kind": lm["kind"], "eras": lm["eras"], "src": "usgs"},
                      "geometry": geom})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection",
          "properties": {"attribution": "Street geometry © OpenStreetMap contributors (ODbL); historical additions traced from public-domain USGS quads"},
          "features": feats}
    OUT.write_text(json.dumps(fc, separators=(",", ":")))
    kinds = {}
    for f in feats:
        kinds[f["properties"]["kind"]] = kinds.get(f["properties"]["kind"], 0) + 1
    print(f"{OUT.relative_to(ROOT)}: {len(feats)} features {kinds}, {OUT.stat().st_size//1024} KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/osm_streets.json")
