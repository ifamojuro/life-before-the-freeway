"""Build the three era AERIAL basemaps from UCSB Library aerial photography.

Frames are discovered via UCSB FrameFinder's public feature service and
downloaded free from mil.library.ucsb.edu (see docs/historical-maps.md).
Each frame is georeferenced by frame center + scale + rotation + shift
(parameters tuned by QA against the app's digitized street vectors), warped to
MAP_BOUNDS in EPSG:4326, and written to frontend/public/aerials/{era}.jpg.
The 1965 era is a 3-frame feathered mosaic.

Flights used:
  ~1950  GS_CP  frame 1-17   (1947, 1:23,600)
  1965   CAS_65_130 frames 15-117 / 15-133 / 15-134  (May 18 1965, 1:12,000)
  1985   GS_VEZR frame 1-25  (1980, 1:24,000 — I-980 corridor cleared/under
         construction; WAC_84C 4-32 (1984) is a better date but its flightline
         is rotated off-north and needs proper GCP georeferencing — TODO)

Usage: .venv/bin/python tools/build_aerials.py   (needs numpy + pillow;
       frames are cached in tools/.cache/)
"""
from __future__ import annotations

import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

WEST, SOUTH, EAST, NORTH = -122.3045, 37.7955, -122.2680, 37.8215
OW, OH = 2000, 1425
MLAT = (NORTH + SOUTH) / 2
M_LNG = 111320 * math.cos(math.radians(MLAT))
M_LAT = 110574.0

BASE = "https://mil.library.ucsb.edu/ap_images"
FRAMES = {
    "gs-cp_1-17":        {"url": f"{BASE}/gs-cp/gs-cp_1-17.tif",               "ctr": (-122.2930, 37.8021), "m": 1.0016, "rot": 0.0,  "dx": -24, "dy": 10},
    "cas-65-130_15-117": {"url": f"{BASE}/cas-65-130/cas-65-130_15-117.tif",   "ctr": (-122.2971, 37.8083), "m": 0.4909, "rot": 0.35, "dx": -3,  "dy": 0},
    "cas-65-130_15-133": {"url": f"{BASE}/cas-65-130/cas-65-130_15-133.tif",   "ctr": (-122.2736, 37.8006), "m": 0.4909, "rot": 0.35, "dx": 0,   "dy": 0},
    "cas-65-130_15-134": {"url": f"{BASE}/cas-65-130/cas-65-130_15-134.tif",   "ctr": (-122.2727, 37.8101), "m": 0.4909, "rot": 0.35, "dx": 0,   "dy": 0},
    "cas-65-130_15-116": {"url": f"{BASE}/cas-65-130/cas-65-130_15-116.tif",   "ctr": (-122.2965, 37.8187), "m": 0.4909, "rot": 0.35, "dx": 0,   "dy": 0},
    "cas-65-130_15-118": {"url": f"{BASE}/cas-65-130/cas-65-130_15-118.tif",   "ctr": (-122.2971, 37.7982), "m": 0.4909, "rot": 0.35, "dx": 0,   "dy": 0},
    "gs-vezr_1-25":      {"url": f"{BASE}/gs-vezr/gs-vezr_1-25.tif",           "ctr": (-122.2951, 37.8118), "m": 1.7288, "rot": 0.0,  "dx": 0,   "dy": 0},
}
ERAS = {
    "1950": ["gs-cp_1-17"],
    "1965": ["cas-65-130_15-117", "cas-65-130_15-133", "cas-65-130_15-134", "cas-65-130_15-116", "cas-65-130_15-118"],
    "1985": ["gs-vezr_1-25"],
}

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "frontend" / "public" / "aerials"
CACHE = Path(__file__).resolve().parent / ".cache"


def fetch(name: str) -> Path:
    CACHE.mkdir(exist_ok=True)
    dest = CACHE / f"{name}.tif"
    if not dest.exists():
        print(f"downloading {name} …")
        urllib.request.urlretrieve(FRAMES[name]["url"], dest)
    return dest


def warp_frame(name: str) -> tuple[np.ndarray, np.ndarray]:
    """Return (grey uint8 OHxOW, weight float OHxOW) for one frame."""
    p = FRAMES[name]
    im = np.asarray(Image.open(fetch(name)).convert("L"), dtype=np.float32)
    H, W = im.shape
    cx, cy = W / 2, H / 2
    th = math.radians(p["rot"])
    lng = np.linspace(WEST, EAST, OW)[None, :].repeat(OH, 0)
    lat = np.linspace(NORTH, SOUTH, OH)[:, None].repeat(OW, 1)
    e = (lng - p["ctr"][0]) * M_LNG - p["dx"]
    n = (lat - p["ctr"][1]) * M_LAT - p["dy"]
    ei = math.cos(th) * e + math.sin(th) * n
    ni = -math.sin(th) * e + math.cos(th) * n
    px = cx + ei / p["m"]
    py = cy - ni / p["m"]
    inb = (px >= 0) & (px <= W - 1) & (py >= 0) & (py <= H - 1)
    pxi = np.clip(px, 0, W - 1).astype(np.int32)
    pyi = np.clip(py, 0, H - 1).astype(np.int32)
    grey = im[pyi, pxi]
    # normalize exposure so mosaic seams blend
    m, s = grey[inb].mean(), grey[inb].std() + 1e-6
    grey = np.clip((grey - m) / s * 46 + 128, 0, 255)
    # ignore the film collar (fiducials, date/frame labels) near the edges,
    # then feather toward the usable interior
    edge = np.minimum.reduce([px, W - 1 - px, py, H - 1 - py])
    inset = 0.06 * min(W, H)     # collar zone -> weight 0
    margin = 350.0
    w = np.clip((edge - inset) / margin, 0, 1) * inb
    return grey.astype(np.float32), w.astype(np.float32)


def build(era: str, names: list[str]) -> None:
    # pick-best compositing (weight = distance into frame interior): avoids the
    # ghosting a weighted average produces where frames overlap with ~10-20 m
    # relative misalignment. Exposure normalization keeps the seams subtle.
    best = np.full((OH, OW), 16, np.float32)
    wbest = np.zeros((OH, OW), np.float32)
    for n in names:
        g, w = warp_frame(n)
        take = w > wbest
        best[take] = g[take]
        wbest[take] = w[take]
    out = best.astype(np.uint8)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f"{era}.jpg"
    Image.fromarray(out).save(dest, quality=82, optimize=True, progressive=True)
    print(f"  {dest.relative_to(ROOT)}  {OW}x{OH}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for era, names in ERAS.items():
        print(f"[{era}] {', '.join(names)}")
        build(era, names)
