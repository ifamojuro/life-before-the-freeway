# Historical aerial photos as a map layer — research notes (Oct 2026)

Question: could real aerial photographs replace or sit alongside the USGS
topo tiles for one or more eras? Short answer: **yes for the 1985 era with
little risk, probably for ~1950 and the 1960s, but every option needs
georeferencing by hand.** None of the free sources ship orthorectified,
map-ready imagery for these years.

## Sources

| Source | Years | What it is | Cost / terms | Fit |
|---|---|---|---|---|
| **NHAP** on [USGS EarthExplorer](https://earthexplorer.usgs.gov/) | 1980–89 | High-altitude survey of the lower 48 states. B&W at 1:80,000 and color infrared at 1:58,000, on 9-inch film ([USGS](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-high-altitude-photography-nhap)). | US government work. Free account. Some frames are already scanned; others are listed as on-demand scans ([data dictionary](https://www.usgs.gov/centers/eros/science/national-high-altitude-photography-nhap-data-dictionary)). | **Best match for 1985.** One B&W frame covers about 18 km square, i.e. all of West Oakland and downtown. At the 1,000 dpi "high resolution" scan that's about 2 m/px, the same detail as the topo tiles. |
| **USGS Aerial Photo Single Frames / Mosaics** (EarthExplorer) | 1937–1980 | Mostly B&W frames from many federal flights. The mosaics are photo indexes, not orthomosaics ([USGS](https://usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-aerial-photo-mosaics)). | US government work. | A ~1950 and a 1960s flight over Oakland are likely, but coverage has to be checked by hand in EarthExplorer (it needs a login). |
| **UCSB [FrameFinder](https://mil.library.ucsb.edu/ap_indexes/FrameFinder/)** | 1927–2010 | About 2.5 M California frames, including Fairchild Aerial Surveys, the bulk of their 1920s–50s coverage ([UCSB guide](https://guides.library.ucsb.edu/geospatial/airphotos)). | Scanned frames download free as full TIFFs. UCSB asks for attribution, and I found no formal license. Only about 15% is scanned, and paid on-demand scanning ended in June 2024 ([UCSB](https://www.library.ucsb.edu/node/10255)). | Good for ~1950, if an Oakland Fairchild flight is among the scanned frames. |
| **UC Berkeley [aerial catalog](https://dpg.lib.berkeley.edu/webdb/aerial/)** (Earth Sciences & Map Library) | 1931– | About 80,000 images centered on San Francisco and the East Bay, at 1:2,400–1:40,000 ([guide](https://guides.lib.berkeley.edu/maps/airphotos)). A web search summary mentions a **1958 Oakland flight at 1:6,800** and a **1968 Bay Area flight at 1:30,000 with a photomosaic** in its catalog. *Unconfirmed: the catalog blocked automated access, so I haven't seen these records myself.* | Public-domain digitized items are free to use. Some items may still be under copyright, and checking is up to us. | *If confirmed*, **1968 is the best match for the 1965 era**, and it's the same year as the topo photorevision. The 1958 flight is very detailed but would take dozens of frames. |
| Commercial ([Aerial Archives](https://aerialarchives.com/Aerial-Photographs-of-Oakland.htm)) | 1920s– | They sell licensed prints and files, some orthorectified. | Paid license. | A fallback only; the license would make the vendor-neutral handoff harder. |

## What it would take

1. **Find frames.** For each era, pick the one to three frames that cover the
   coverage area, choosing low cloud and the central part of the frame (less
   lens and relief displacement).
2. **Georeference.** West Oakland is flat, so a polynomial or thin-plate
   warp with 20–40 ground control points per frame should reach about 5–10 m.
   Street intersections that survived make good control points, matched
   against OpenStreetMap or the 1993 topo. Two tools:
   - [Allmaps](https://allmaps.org): open, IIIF-based, works in the browser,
     and its control points can be shared and checked.
   - QGIS Georeferencer: offline, writes GeoTIFFs directly.
   Expect about half a day per frame, including checking.
3. **Tile.** `tools/build_tiles.py` already takes georeferenced GeoTIFFs. A
   photo source would add a sheet list without the neatline clip and tint
   flattening. B&W photos map naturally onto the two-tone ink/paper ramp,
   so they'd match the topo tiles.
4. **UI.** Add a "Map / Photo" switch per era. It becomes another stacked
   opacity layer, the same mechanism the eras already use.

## Recommendation

**Pilot the 1985 era with NHAP:** one frame, public domain, about a day of
work. If it looks good, request the UC Berkeley **1968** mosaic or frames for
1965. That's the era where seeing the clearance matters most. Search
FrameFinder and EarthExplorer for a ~1950 flight last.

## Still to check by hand

These are blocked for automated access (login or bot protection):
- Which NHAP frame IDs cover 37.81 N, 122.28 W, and whether they're already scanned or on-demand only.
- Whether UCSB has a scanned Fairchild Oakland flight from about 1946–52.
- Whether the UC Berkeley 1958 and 1968 items exist as described, and whether they're already scanned.
