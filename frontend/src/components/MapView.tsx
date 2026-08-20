/**
 * West Oakland map.
 *
 * Renders the era's real historical basemap (USGS Historical Topographic Map
 * scans, warped to MAP_BOUNDS — see tools/build_basemaps.py) on a
 * ground-aspect-preserving "plane" that covers the container (like
 * background-size: cover), with pan + zoom. Pins are projected from real
 * lat/lng onto the plane, so they stay glued to their streets at any container
 * shape. Falls back to the original stylized grid if an image fails to load.
 * Optional tap-to-place mode is used by the contributor + moderation flows.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BASEMAPS, clampPct, groundAspect, project, unproject } from "../lib/geo";
import { VectorOverlay } from "./VectorOverlay";
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
  showRoadNames?: boolean;
  zoomable?: boolean;
  scaleLabel?: string;
  gridSize?: number;
  /** Render the historical basemap (default). false = always stylized. */
  photo?: boolean;
  /** Render the digitized vector layer (default). */
  vector?: boolean;
  /** Show the scan/vector base-mode toggle chip. */
  baseToggle?: boolean;
  children?: ReactNode;
}

const ROADS = [
  { kind: "h", at: 22, size: 14, name: "12th St" },
  { kind: "h", at: 44, size: 18, name: "7th St" },
  { kind: "h", at: 80, size: 12, name: "3rd St" },
  { kind: "v", at: 24, size: 12, name: "Wood St" },
  { kind: "v", at: 50, size: 14, name: "Chestnut St" },
  { kind: "v", at: 64, size: 12, name: "Union St" },
  { kind: "v", at: 86, size: 12, name: "Adeline St" },
] as const;

const TAKINGS = [
  { l: 8, t: 54, w: 22, h: 9 },
  { l: 34, t: 50, w: 18, h: 8 },
  { l: 56, t: 45, w: 20, h: 9 },
  { l: 80, t: 40, w: 18, h: 8 },
];

const ASPECT = groundAspect();

export function MapView({
  era = "1965", pins = [], onPinClick, onTap, className, showRoadNames = true, zoomable = false, scaleLabel, gridSize = 46, photo = true, vector = true, baseToggle = false, children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // px offset of plane center from container center
  const [photoOk, setPhotoOk] = useState(true);
  const [baseMode, setBaseMode] = useState<"both" | "vector" | "scan">("both");
  const drag = useRef<{ x0: number; y0: number; px: number; py: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Plane covers the container while preserving ground aspect ("cover" fit).
  const plane = useMemo(() => {
    const { w, h } = box;
    if (!w || !h) return { w: 0, h: 0 };
    const base = w / h >= ASPECT ? { w, h: w / ASPECT } : { w: h * ASPECT, h };
    return { w: base.w * zoom, h: base.h * zoom };
  }, [box, zoom]);

  const clampPan = (p: { x: number; y: number }, pw = plane.w, ph = plane.h) => ({
    x: Math.max(-(pw - box.w) / 2, Math.min((pw - box.w) / 2, p.x)),
    y: Math.max(-(ph - box.h) / 2, Math.min((ph - box.h) / 2, p.y)),
  });
  useEffect(() => { setPan((p) => clampPan(p)); /* eslint-disable-next-line */ }, [plane.w, plane.h, box.w, box.h]);

  const showPhoto = photo && photoOk && !!BASEMAPS[era] && baseMode !== "vector";
  const showVector = vector && baseMode !== "scan";

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".pin, .map-overlay-ctrl, .map-zoom, .m1-era")) return;
    drag.current = { x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (Math.hypot(dx, dy) > 6) d.moved = true;
    if (d.moved) setPan(clampPan({ x: d.px + dx, y: d.py + dy }));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !onTap || !planeRef.current) return;
    if ((e.target as HTMLElement).closest(".pin, .map-overlay-ctrl, .map-zoom, .m1-era")) return;
    const r = planeRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    onTap(unproject(clampPct(x), clampPct(y)));
  };

  return (
    <div
      ref={containerRef}
      className={cx("map-surface", onTap && "tappable", className)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { drag.current = null; }}
      role={onTap ? "button" : undefined}
      aria-label={onTap ? "Tap the map to place a pin" : "Map of West Oakland"}
    >
      <div
        ref={planeRef}
        className={cx("map-plane", !showPhoto && vector && baseMode === "vector" && "vec-ground")}
        style={{ width: plane.w, height: plane.h, left: (box.w - plane.w) / 2 + pan.x, top: (box.h - plane.h) / 2 + pan.y }}
      >
        {showPhoto && (
          <img
            className="map-photo"
            src={BASEMAPS[era].url}
            alt={`Historical map of West Oakland, ${era} era (${BASEMAPS[era].credit})`}
            draggable={false}
            onError={() => setPhotoOk(false)}
          />
        )}
        {!showPhoto && (
          <>
            <div className="map-grid" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }} />
            <div className="map-roads">
              {ROADS.map((r) => (
                <div
                  key={r.name}
                  className={cx("road", r.kind === "v" && "v")}
                  style={r.kind === "h" ? { left: 0, right: 0, top: `${r.at}%`, height: r.size } : { top: 0, bottom: 0, left: `${r.at}%`, width: r.size }}
                >
                  {showRoadNames && <span className="rname">{r.name}</span>}
                </div>
              ))}
            </div>
            {era === "1965" && TAKINGS.map((t, i) => (
              <div key={i} className="map-taken" style={{ left: `${t.l}%`, top: `${t.t}%`, width: `${t.w}%`, height: `${t.h}%` }} />
            ))}
            <div className={cx("freeway-scar", `era-${era}`)}>
              <span>{era === "1965" ? "Property takings · 1965" : era === "1985" ? "I-980 · opened 1985" : ""}</span>
            </div>
          </>
        )}
        {showVector && <VectorOverlay era={era} muted={showPhoto} />}
        {pins.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          return (
            <button
              key={p.id}
              type="button"
              className={cx("pin", p.active && "active", p.cluster && "cluster", p.muted && "muted")}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={(e) => { e.stopPropagation(); onPinClick?.(p.id); }}
              aria-label={p.title ?? String(p.label ?? "pin")}
              title={p.title}
            >
              <span className="dot" style={p.color ? { background: p.color } : undefined}><b>{p.label}</b></span>
              {p.title && <span className="pin-label">{p.title}</span>}
            </button>
          );
        })}
      </div>
      {children}
      {(showPhoto || showVector) && (
        <div className="map-attrib">
          {showPhoto ? `${BASEMAPS[era].credit} · public domain` : "streets © OpenStreetMap contributors · USGS"}
        </div>
      )}
      {baseToggle && photo && photoOk && (
        <button
          type="button"
          className="map-basetoggle"
          onClick={(e) => {
            e.stopPropagation();
            setBaseMode((m) => (m === "both" ? "vector" : m === "vector" ? "scan" : "both"));
          }}
        >
          Base: {baseMode === "both" ? "scan + vectors" : baseMode === "vector" ? "vectors" : "scan"}
        </button>
      )}
      {scaleLabel && <div className="map-scale">{scaleLabel}</div>}
      {zoomable && (
        <div className="map-zoom">
          <button type="button" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(3, +(z + 0.5).toFixed(2))); }} aria-label="Zoom in">+</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2))); }} aria-label="Zoom out">−</button>
        </div>
      )}
    </div>
  );
}
