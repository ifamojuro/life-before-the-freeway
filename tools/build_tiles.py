"""Build two-tone XYZ map tiles for the three eras from full USGS sheets.

For each era this downloads the public-domain USGS Historical Topographic Map
GeoTIFFs for Oakland West and its neighbors, clips each sheet to its neatline
(dropping the white collar and legend), divides out area tints so sheets
printed with and without them match, warps them into one Web Mercator mosaic, and writes 256 px PNG tiles in the two-tone style from
frontend/src/lib/mapTone.json: grayscale, then dark -> ink and light -> paper.
Each tile is a small palette PNG whose palette *is* the two-tone ramp.

It also writes frontend/src/lib/mapCoverage.json (the area the tiles cover),
which the map uses to stop panning and zooming out at the edge.

Usage:  python3 -m venv tools/.venv && tools/.venv/bin/pip install rasterio pillow numpy
        tools/.venv/bin/python tools/build_tiles.py [--out DIR] [--eras 1950,1965,1985]
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path

os.environ.setdefault("PROJ_NETWORK", "ON")  # NAD27 -> WGS84 grid shift (~95 m here); don't skip it

import numpy as np
import rasterio
from PIL import Image, ImageFilter
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform as warp_points, transform_geom

S3 = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/GeoTIFF/CA"
QUAD = 0.125  # 7.5-minute sheets, corners on the NAD27 graticule
SW_CORNER = {  # quad -> (west, south), NAD27
    "Oakland West": (-122.375, 37.75), "Oakland East": (-122.25, 37.75),
    "Richmond": (-122.375, 37.875), "Briones Valley": (-122.25, 37.875),
}
# era -> [(quad, scan id, edition year)]. Printings chosen so the sheets of an
# era match (see docs/historical-maps.md); years are in each sheet's metadata.
ERAS = {
    "1950": [("Oakland West", 293623, 1949), ("Oakland East", 293613, 1949), ("Richmond", 294669, 1949), ("Briones Valley", 288607, 1949)],
    "1965": [("Oakland West", 293626, 1959), ("Oakland East", 293616, 1959), ("Richmond", 294672, 1959), ("Briones Valley", 288610, 1959)],
    "1985": [("Oakland West", 102315, 1993), ("Oakland East", 102314, 1997), ("Richmond", 294665, 1993), ("Briones Valley", 300007, 1993)],
}
MIN_Z, MAX_Z = 11, 16  # z16 (~1.9 m/px) matches the scans (~2 m/px); the map overzooms past it
R = 6378137.0
WORLD = 2 * np.pi * R

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
TONE = json.loads((ROOT / "frontend/src/lib/mapTone.json").read_text())


def fetch(quad: str, sid: int, year: int) -> Path:
    fname = f"CA_{quad.replace(' ', '%20')}_{sid}_{year}_24000_geo.tif"
    CACHE.mkdir(exist_ok=True)
    dest = CACHE / fname
    if not dest.exists():
        print(f"  downloading {fname} …")
        urllib.request.urlretrieve(f"{S3}/{fname}", dest)
    return dest


def neatline(quad: str) -> dict:
    """The sheet's map area as a densified NAD27 polygon."""
    w, s = SW_CORNER[quad]
    t = np.linspace(0, 1, 50)
    ring = ([(w + QUAD * f, s) for f in t] + [(w + QUAD, s + QUAD * f) for f in t]
            + [(w + QUAD * (1 - f), s + QUAD) for f in t] + [(w, s + QUAD * (1 - f)) for f in t])
    return {"type": "Polygon", "coordinates": [ring]}


def tone_ramp(levels: int):
    """Gray (0-255) -> tone (0 = ink, 255 = paper), and a palette of `levels` steps from ink to paper.

    Same black/white/gamma math as MapTone.tsx. Clamping at the black and white
    points and using few steps drops scan noise, which keeps the PNGs small.
    """
    hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
    ink, paper = hexrgb(TONE["ink"]), hexrgb(TONE["paper"])
    g = np.arange(256) / 255
    k = np.clip((g - TONE["black"]) / max(0.001, TONE["white"] - TONE["black"]), 0, 1) ** TONE["gamma"]
    tone = np.rint(k * 255).astype(np.uint8)
    steps = np.linspace(0, 1, levels)[:, None]
    palette = np.rint(ink + (paper - ink) * steps).astype(np.uint8).flatten().tolist()
    return tone, palette


def flatten(g: np.ndarray, block: int = 4, size: int = 5, floor: int = 140) -> np.ndarray:
    """Divide out each sheet's area tints (urban gray/pink, woodland green, paper tone).

    The local background is the brightest value within ~40 m (block * size px),
    which skips thin line work. Dividing by it turns every tint into paper, so
    sheets printed with and without tints match. The floor keeps solid black
    buildings dark.
    """
    h, w = g.shape[0] // block * block, g.shape[1] // block * block
    bg = g[:h, :w].reshape(h // block, block, w // block, block).max(axis=(1, 3))
    bg = np.asarray(Image.fromarray(bg).filter(ImageFilter.MaxFilter(size)).resize((g.shape[1], g.shape[0]), Image.Resampling.BILINEAR))
    return np.clip(g.astype(np.float32) / np.maximum(bg, floor) * 255, 0, 255).astype(np.uint8)


def tile_range(quads: list[str], z: int):
    """XYZ tile columns/rows at zoom z that cover the sheets (after the datum shift)."""
    lons, lats = [], []
    for q in quads:
        w, s = SW_CORNER[q]
        x, y = warp_points("EPSG:4267", "EPSG:4326", [w, w + QUAD, w, w + QUAD], [s, s, s + QUAD, s + QUAD])
        lons += x
        lats += y
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n)
    return (tx(min(lons)), tx(max(lons))), (ty(max(lats)), ty(min(lats))), (min(lons), min(lats), max(lons), max(lats))


def mosaic(sheets, xr, yr):
    """Warp the sheets' map areas into one grayscale z16 mosaic, plus a coverage mask."""
    w, h = (xr[1] - xr[0] + 1) * 256, (yr[1] - yr[0] + 1) * 256
    px = WORLD / (256 * 2 ** MAX_Z)
    dst_t = from_origin(-WORLD / 2 + xr[0] * 256 * px, WORLD / 2 - yr[0] * 256 * px, px, px)
    gray = np.full((h, w), 255, np.uint8)
    cover = np.zeros((h, w), np.uint8)
    for quad, sid, year in sheets:
        print(f"  {quad} {year} (scan {sid})")
        with rasterio.open(fetch(quad, sid, year)) as src:
            rgb = src.read([1, 2, 3]).astype(np.float32)  # scans are RGB; a paletted one would need expanding first
            g = flatten(np.clip(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], 0, 255).astype(np.uint8))
            inside = rasterize([transform_geom("EPSG:4267", src.crs, neatline(quad))], out_shape=g.shape, transform=src.transform)
            sg, sm = np.full_like(gray, 255), np.zeros_like(cover)
            kw = dict(src_transform=src.transform, src_crs=src.crs, dst_transform=dst_t, dst_crs="EPSG:3857")
            reproject(g, sg, resampling=Resampling.bilinear, **kw)
            reproject(inside, sm, resampling=Resampling.nearest, **kw)
        gray[sm == 1] = sg[sm == 1]
        cover |= sm
    gray[cover == 0] = 255  # outside every sheet: paper
    return gray


def write_tiles(gray, xr, yr, out: Path, levels: int) -> int:
    tone, palette = tone_ramp(levels)
    toned = tone[gray]  # tone before downsampling, so thin lines still darken low zooms
    n = 0
    for z in range(MAX_Z, MIN_Z - 1, -1):
        f = 2 ** (MAX_Z - z)
        img = Image.fromarray(toned)
        if f > 1:
            img = img.resize((toned.shape[1] // f, toned.shape[0] // f), Image.Resampling.LANCZOS)
        g = np.rint(np.asarray(img) / 255 * (levels - 1)).astype(np.uint8)
        x0, y0 = xr[0] * 256 // f, yr[0] * 256 // f  # mosaic origin in zoom-z pixels
        for ty in range(y0 // 256, (y0 + g.shape[0] - 1) // 256 + 1):
            for tx in range(x0 // 256, (x0 + g.shape[1] - 1) // 256 + 1):
                tile = np.full((256, 256), levels - 1, np.uint8)
                ox, oy = tx * 256 - x0, ty * 256 - y0
                a = g[max(0, oy):oy + 256, max(0, ox):ox + 256]
                tile[max(0, -oy):max(0, -oy) + a.shape[0], max(0, -ox):max(0, -ox) + a.shape[1]] = a
                if tile.min() == levels - 1:
                    continue  # all paper; the map's background shows instead
                p = Image.fromarray(tile, "P")
                p.putpalette(palette)
                dest = out / str(z) / str(tx) / f"{ty}.png"
                dest.parent.mkdir(parents=True, exist_ok=True)
                p.save(dest, optimize=True, bits=max(1, int(np.ceil(np.log2(levels)))))
                n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=ROOT / "frontend/public/tiles")
    ap.add_argument("--eras", default=",".join(ERAS))
    ap.add_argument("--levels", type=int, default=16, help="tone steps from ink to paper")
    args = ap.parse_args()
    quads = sorted({q for sheets in ERAS.values() for q, _, _ in sheets})
    xr, yr, bounds = tile_range(quads, MAX_Z)
    for era in args.eras.split(","):
        print(f"[{era}]")
        gray = mosaic(ERAS[era], xr, yr)
        n = write_tiles(gray, xr, yr, args.out / era, args.levels)
        size = sum(p.stat().st_size for p in (args.out / era).rglob("*.png"))
        print(f"  {n} tiles, {size / 1e6:.0f} MB -> {args.out / era}")
    west, south, east, north = (round(v, 5) for v in bounds)
    coverage = {"west": west, "south": south, "east": east, "north": north, "minZoom": MIN_Z, "maxNativeZoom": MAX_Z}
    (ROOT / "frontend/src/lib/mapCoverage.json").write_text(json.dumps(coverage, indent=2) + "\n")


if __name__ == "__main__":
    main()
