/**
 * High-fidelity map: MapLibre GL + OpenFreeMap "liberty" vector tiles (the
 * familiar green-parks / blue-water / grey-buildings cartography, street
 * labels included) with the project's era layers on top:
 *
 *  - modern motorways are ALWAYS hidden from the base style; freeways are
 *    drawn era-correct from /overlays/features.geojson (I-980 only in 1985,
 *    Cypress structure in 1965/85, none in 1950)
 *  - 1965 takings corridors render as hatched red fills
 *  - hand-traced erased streets render dashed
 *  - the USGS scan can still be layered in (base chip: streets+scan / streets / scan)
 *
 * Falls back to the offline PlaneMap if tiles/style fail to load.
 */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { AERIALS, BASEMAPS, MAP_BOUNDS } from "../lib/geo";
import type { EraKey } from "../lib/types";
import { cx } from "../lib/util";
import type { MapPin } from "./MapView";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const B = MAP_BOUNDS;
const SCAN_COORDS: [[number, number], [number, number], [number, number], [number, number]] =
  [[B.west, B.north], [B.east, B.north], [B.east, B.south], [B.west, B.south]];

export type BaseMode = "streets" | "aerial" | "scan" | "both";

interface Props {
  era: EraKey;
  pins?: MapPin[];
  onPinClick?: (id: MapPin["id"]) => void;
  onTap?: (p: { lat: number; lng: number }) => void;
  className?: string;
  zoomable?: boolean;
  scaleLabel?: string;
  baseToggle?: boolean;
  onFail?: () => void;
}

type Filter = maplibregl.ExpressionSpecification;

function eraFilter(era: EraKey): Filter {
  return ["in", era, ["get", "eras"]] as Filter;
}

function kindFilter(kind: string, era: EraKey): Filter {
  return ["all", ["==", ["get", "kind"], kind], eraFilter(era)] as Filter;
}

function erasedFilter(era: EraKey): Filter {
  return ["all", ["==", ["get", "erased"], true], eraFilter(era)] as Filter;
}

export function MapLibreView({ era, pins = [], onPinClick, onTap, className, zoomable = true, scaleLabel, baseToggle, onFail }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<BaseMode>("streets");
  const eraRef = useRef(era);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  // ---- init once ----
  useEffect(() => {
    if (!el.current) return;
    let dead = false;
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE_URL,
      bounds: [[B.west, B.south], [B.east, B.north]],
      fitBoundsOptions: { padding: 8 },
      maxBounds: [[B.west - 0.012, B.south - 0.008], [B.east + 0.012, B.north + 0.008]],
      minZoom: 12.8,
      maxZoom: 17.8,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    if (zoomable) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.once("error", (e) => {
      // style/tiles unreachable -> let the parent fall back to the offline map
      const err = (e as unknown as { error?: Error }).error;
      if (!map.isStyleLoaded()) {
        console.warn("MapLibre style failed, falling back:", err?.message);
        if (!dead) onFail?.();
      }
    });

    map.on("load", () => {
      if (dead) return;
      // 1. hide modern motorways + their shields/labels (freeways come from era data)
      for (const layer of map.getStyle().layers ?? []) {
        const sl = (layer as { "source-layer"?: string })["source-layer"];
        if (sl !== "transportation" && sl !== "transportation_name") continue;
        const id = layer.id.toLowerCase();
        if (id.includes("motorway") || id.includes("shield")) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      // 2. era imagery as optional raster layers, inserted BELOW the first
      // symbol layer so street/place labels float above (hybrid look)
      const firstSymbol = (map.getStyle().layers ?? []).find((l) => l.type === "symbol")?.id;
      map.addSource("usgs-scan", { type: "image", url: BASEMAPS[eraRef.current].url, coordinates: SCAN_COORDS });
      map.addLayer({ id: "usgs-scan", type: "raster", source: "usgs-scan", paint: { "raster-opacity": 0, "raster-fade-duration": 150 } }, firstSymbol);
      map.addSource("era-aerial", { type: "image", url: AERIALS[eraRef.current].url, coordinates: SCAN_COORDS });
      map.addLayer({ id: "era-aerial", type: "raster", source: "era-aerial", paint: { "raster-opacity": 0, "raster-fade-duration": 150 } }, firstSymbol);

      // 3. era features
      map.addSource("era", { type: "geojson", data: "/overlays/features.geojson" });
      map.addLayer({
        id: "era-takings", type: "fill", source: "era",
        filter: kindFilter("takings", eraRef.current),
        paint: { "fill-color": "#b4231f", "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "era-takings-line", type: "line", source: "era",
        filter: kindFilter("takings", eraRef.current),
        paint: { "line-color": "#b4231f", "line-opacity": 0.55, "line-width": 1.5, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "era-erased", type: "line", source: "era",
        filter: erasedFilter(eraRef.current),
        paint: { "line-color": "#5b6772", "line-width": 1.6, "line-dasharray": [2, 2] },
      });
      // era-correct freeways, in the familiar orange w/ casing
      map.addLayer({
        id: "era-freeway-casing", type: "line", source: "era",
        filter: kindFilter("freeway", eraRef.current),
        layout: { "line-cap": "round" },
        paint: { "line-color": "#e66a4e", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 4.5, 16, 12] },
      });
      map.addLayer({
        id: "era-freeway", type: "line", source: "era",
        filter: kindFilter("freeway", eraRef.current),
        layout: { "line-cap": "round" },
        paint: { "line-color": "#fcb37e", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 16, 8] },
      });

      map.on("click", (e: maplibregl.MapMouseEvent) => {
        tapRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      setReady(true);
    });

    mapRef.current = map;
    return () => { dead = true; markers.current.forEach((m) => m.remove()); markers.current = []; map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- era changes ----
  useEffect(() => {
    eraRef.current = era;
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("usgs-scan") as maplibregl.ImageSource | undefined)?.updateImage({ url: BASEMAPS[era].url, coordinates: SCAN_COORDS });
    (map.getSource("era-aerial") as maplibregl.ImageSource | undefined)?.updateImage({ url: AERIALS[era].url, coordinates: SCAN_COORDS });
    map.setFilter("era-takings", kindFilter("takings", era));
    map.setFilter("era-takings-line", kindFilter("takings", era));
    map.setFilter("era-erased", erasedFilter(era));
    map.setFilter("era-freeway-casing", kindFilter("freeway", era));
    map.setFilter("era-freeway", kindFilter("freeway", era));
  }, [era, ready]);

  // ---- base mode (streets / aerial / scan / streets+scan) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty("usgs-scan", "raster-opacity", mode === "scan" ? 1 : mode === "both" ? 0.5 : 0);
    map.setPaintProperty("era-aerial", "raster-opacity", mode === "aerial" ? 1 : 0);
  }, [mode, ready]);

  // ---- pins ----
  const pinsKey = JSON.stringify(pins);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = pins.map((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cx("pin ml", p.active && "active", p.cluster && "cluster", p.muted && "muted");
      btn.setAttribute("aria-label", p.title ?? String(p.label ?? "pin"));
      if (p.title) btn.title = p.title;
      const dot = document.createElement("span");
      dot.className = "dot";
      if (p.color) dot.style.background = p.color;
      const b = document.createElement("b");
      b.textContent = p.label ?? "";
      dot.appendChild(b);
      btn.appendChild(dot);
      btn.addEventListener("click", (ev) => { ev.stopPropagation(); onPinClick?.(p.id); });
      return new maplibregl.Marker({ element: btn, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, ready]);

  return (
    <div className={cx("mlwrap", className)}>
      <div ref={el} className="ml-canvas" role={onTap ? "button" : undefined} aria-label={onTap ? "Tap the map to place a pin" : "Map of West Oakland"} />
      {mode !== "streets" && (
        <div className="map-attrib ml">{mode === "aerial" ? AERIALS[era].credit : `${BASEMAPS[era].credit} · public domain`}</div>
      )}
      {scaleLabel && <div className="map-scale">{scaleLabel}</div>}
      {baseToggle && (
        <button
          type="button"
          className="map-basetoggle"
          onClick={() => setMode((m) => (m === "streets" ? "aerial" : m === "aerial" ? "scan" : m === "scan" ? "both" : "streets"))}
        >
          Base: {mode === "streets" ? "streets" : mode === "aerial" ? `aerial ${era === "1950" ? "1947" : era === "1965" ? "1965" : "1980"}` : mode === "scan" ? "USGS scan" : "streets + scan"}
        </button>
      )}
    </div>
  );
}
