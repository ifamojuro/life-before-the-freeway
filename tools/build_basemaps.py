"""Build the three era basemaps from USGS Historical Topographic Map GeoTIFFs.

Downloads the public-domain "Oakland West, CA" quadrangle scans, reprojects
them (NAD27 polyconic/TM -> EPSG:4326), clips to the app's MAP_BOUNDS, and
writes frontend/public/basemaps/{1950,1965,1985}.jpg.

The output grid is linear lat/lng over exactly MAP_BOUNDS, which is the same
mapping as frontend/src/lib/geo.ts project() — so pins align by construction.

Usage:  python3 -m venv .venv && .venv/bin/pip install rasterio pillow numpy
        .venv/bin/python tools/build_basemaps.py
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject

# Must match MAP_BOUNDS in frontend/src/lib/geo.ts
WEST, SOUTH, EAST, NORTH = -122.3045, 37.7955, -122.2680, 37.8215
OUT_W = 2000
OUT_H = round(OUT_W * (NORTH - SOUTH) / (EAST - WEST))

S3 = "https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/GeoTIFF/CA"
SOURCES = {
    # era key -> (scan file, note)
    "1950": ("CA_Oakland%20West_293623_1949_24000_geo.tif", "1949 edition — pre-freeway neighborhood"),
    "1965": ("CA_Oakland%20West_293621_1959_24000_geo.tif", "1959 edition, photorevised print (purple = demolition-era changes)"),
    "1985": ("CA_Oakland%20West_102315_1993_24000_geo.tif", "1993 edition — I-980 complete"),
}

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "frontend" / "public" / "basemaps"
CACHE = Path(__file__).resolve().parent / ".cache"


def fetch(fname: str) -> Path:
    CACHE.mkdir(exist_ok=True)
    dest = CACHE / fname
    if not dest.exists():
        print(f"downloading {fname} …")
        urllib.request.urlretrieve(f"{S3}/{fname}", dest)
    return dest


def build(era: str, fname: str) -> None:
    src_path = fetch(fname)
    with rasterio.open(src_path) as src:
        dst_transform = from_bounds(WEST, SOUTH, EAST, NORTH, OUT_W, OUT_H)
        rgb = src.read([1, 2, 3]) if src.count >= 3 else np.repeat(src.read([1]), 3, axis=0)
        dst = np.zeros((3, OUT_H, OUT_W), dtype=np.uint8)
        for b in range(3):
            reproject(
                rgb[b], dst[b],
                src_transform=src.transform, src_crs=src.crs,
                dst_transform=dst_transform, dst_crs="EPSG:4326",
                resampling=Resampling.lanczos,
            )
    out = OUT_DIR / f"{era}.jpg"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(dst.transpose(1, 2, 0)).save(out, quality=82, optimize=True, progressive=True)
    print(f"  {out.relative_to(ROOT)}  {OUT_W}x{OUT_H}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for era, (fname, note) in SOURCES.items():
        print(f"[{era}] {note}")
        build(era, fname)
