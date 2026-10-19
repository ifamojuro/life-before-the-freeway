/**
 * West Oakland map, drawn with Leaflet.
 *
 * Each era's historical map (two-tone tiles built from whole USGS Historical
 * Topographic Map sheets — see tools/build_tiles.py) is its own tile layer, and
 * all three are loaded at once and stacked; switching eras only changes their
 * opacity. With ?tune, the layers use grayscale tiles colored live by the
 * MapTone filter instead.
 * Pins are Leaflet markers placed at their real lat/lng. Optional
 * tap-to-place mode is used by the contributor + moderation flows.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, type ReactNode } from "react";
import { ERA_MAPS, MAP_BOUNDS, MAP_COVERAGE, TILES_URL } from "../lib/geo";
import type { EraKey } from "../lib/types";
import { cx } from "../lib/util";

export interface MapPin {
  id: number | string;
  lat: number;
  lng: number;
  label?: string; // shown inside the pin
  title?: string; // hover/active label
  active?: boolean;
  cluster?: boolean;
  muted?: boolean;
  color?: string;
}

interface Props {
  era?: EraKey;
  pins?: MapPin[];
  onPinClick?: (id: MapPin["id"]) => void;
  onTap?: (p: { lat: number; lng: number }) => void;
  className?: string;
  zoomable?: boolean;
  scaleLabel?: string;
  children?: ReactNode;
}

const START = L.latLngBounds([MAP_BOUNDS.south, MAP_BOUNDS.west], [MAP_BOUNDS.north, MAP_BOUNDS.east]);
const COVERAGE = L.latLngBounds([MAP_COVERAGE.south, MAP_COVERAGE.west], [MAP_COVERAGE.north, MAP_COVERAGE.east]);
const TUNING = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tune");
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACw="; // tiles that are all paper aren't built

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Same markup as the old absolutely-positioned pins, so styles and tests carry over. */
function pinIcon(p: MapPin) {
  const label = esc(p.title ?? String(p.label ?? "pin"));
  const dotStyle = p.color ? ` style="background:${esc(p.color)}"` : "";
  return L.divIcon({
    className: "map-pin-icon",
    iconSize: [0, 0],
    html:
      `<button type="button" class="${cx("pin", p.active && "active", p.cluster && "cluster", p.muted && "muted")}" aria-label="${label}"${p.title ? ` title="${esc(p.title)}"` : ""}>` +
      `<span class="dot"${dotStyle}><b>${esc(p.label ?? "")}</b></span>` +
      (p.title ? `<span class="pin-label">${esc(p.title)}</span>` : "") +
      `</button>`,
  });
}

export function MapView({ era = "1965", pins = [], onPinClick, onTap, className, zoomable = false, scaleLabel, children }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const eraLayers = useRef<Partial<Record<string, L.TileLayer>>>({});
  const pinLayer = useRef<L.LayerGroup | null>(null);
  // Leaflet handlers are bound once; read the latest callbacks through a ref.
  const handlers = useRef({ onPinClick, onTap });
  handlers.current = { onPinClick, onTap };

  useEffect(() => {
    const map = L.map(elRef.current!, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, maxZoom: 18, maxBounds: COVERAGE, maxBoundsViscosity: 1 });
    // Never zoom out past the point where the historical maps stop covering the view.
    const fitMinZoom = () => map.setMinZoom(map.getBoundsZoom(COVERAGE, true));
    fitMinZoom();
    map.fitBounds(START);
    map.on("resize", fitMinZoom);
    const base = TUNING ? "/tiles-gray" : TILES_URL;
    for (const key of Object.keys(ERA_MAPS)) {
      eraLayers.current[key] = L.tileLayer(`${base}/${key}/{z}/{x}/{y}.png`, {
        bounds: COVERAGE, minNativeZoom: MAP_COVERAGE.minZoom, maxNativeZoom: MAP_COVERAGE.maxNativeZoom, opacity: 0, errorTileUrl: BLANK, keepBuffer: 4,
      }).addTo(map);
    }
    pinLayer.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (COVERAGE.contains(e.latlng)) handlers.current.onTap?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // All eras stay loaded; switching is an opacity change (room for a transition later).
  useEffect(() => {
    for (const [key, layer] of Object.entries(eraLayers.current)) layer?.setOpacity(key === era ? 1 : 0);
  }, [era]);

  const pinsKey = JSON.stringify(pins);
  useEffect(() => {
    const group = pinLayer.current;
    if (!group) return;
    group.clearLayers();
    for (const p of pins) {
      L.marker([p.lat, p.lng], { icon: pinIcon(p), keyboard: false, zIndexOffset: p.active ? 1000 : 0 })
        .on("click", () => handlers.current.onPinClick?.(p.id))
        .addTo(group);
    }
  }, [pinsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const credit = ERA_MAPS[era]?.credit;
  return (
    <div className={cx("map-surface", onTap && "tappable", TUNING && "tuning", className)}>
      {/* Positioned inline: Leaflet forces position: relative (and so zero height) if it starts before the CSS has applied. */}
      <div ref={elRef} className="map-leaflet" style={{ position: "absolute", inset: 0 }} role={onTap ? "button" : undefined} aria-label={onTap ? "Tap the map to place a pin" : "Map of West Oakland"} />
      {children}
      {credit && <div className="map-attrib">{credit} · public domain</div>}
      {scaleLabel && <div className="map-scale">{scaleLabel}</div>}
      {zoomable && (
        <div className="map-zoom">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">−</button>
        </div>
      )}
    </div>
  );
}
