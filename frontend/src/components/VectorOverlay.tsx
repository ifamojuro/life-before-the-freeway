/**
 * v1 digitized vector layer — streets / freeways / takings corridors /
 * landmarks from /overlays/features.geojson (built by tools/build_vector_overlay.py).
 * Features carry an `eras` list; this renders only the active era's features,
 * projected onto the same plane as the pins, so everything stays aligned.
 */
import { useEffect, useMemo, useState } from "react";
import { project } from "../lib/geo";
import type { EraKey } from "../lib/types";

interface FeatProps {
  name: string;
  kind: "street" | "major" | "freeway" | "takings" | "park" | "school" | "rail";
  eras: string[];
  erased?: boolean;
}
interface Feature {
  properties: FeatProps;
  geometry: { type: "LineString" | "Polygon" | "Point"; coordinates: number[][] | number[][][] | number[] };
}

let cache: Promise<Feature[]> | null = null;
function loadFeatures(): Promise<Feature[]> {
  cache ??= fetch("/overlays/features.geojson")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((fc) => fc.features as Feature[])
    .catch(() => []);
  return cache;
}

function toPath(coords: number[][]): string {
  return coords
    .map(([lng, lat], i) => {
      const { x, y } = project(lat, lng);
      return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("");
}

const LINE_STYLE: Record<string, { stroke: string; width: number; opacity?: number; dash?: string }> = {
  street: { stroke: "#0d1b2a", width: 1, opacity: 0.45 },
  major: { stroke: "#0d1b2a", width: 2, opacity: 0.6 },
  freeway: { stroke: "#b4231f", width: 3.5, opacity: 0.8 },
};

export function VectorOverlay({ era, muted }: { era: EraKey; muted?: boolean }) {
  const [features, setFeatures] = useState<Feature[]>([]);
  useEffect(() => { void loadFeatures().then(setFeatures); }, []);

  const active = useMemo(() => features.filter((f) => f.properties.eras.includes(era)), [features, era]);
  const labels = useMemo(
    () =>
      active
        .filter((f) => ["park", "school", "rail", "takings"].includes(f.properties.kind))
        .map((f) => {
          const g = f.geometry;
          let lat: number, lng: number;
          if (g.type === "Point") [lng, lat] = g.coordinates as number[];
          else {
            const ring = (g.type === "Polygon" ? (g.coordinates as number[][][])[0] : (g.coordinates as number[][]));
            lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
            lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
          }
          return { name: f.properties.name, kind: f.properties.kind, ...project(lat, lng) };
        }),
    [active],
  );

  if (!active.length) return null;
  return (
    <>
      <svg className="vec-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style={muted ? { opacity: 0.55 } : undefined} aria-hidden>
        <defs>
          <pattern id="takings-hatch" width="1.2" height="1.2" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="1.2" height="1.2" fill="rgba(180,35,31,0.07)" />
            <line x1="0" y1="0" x2="0" y2="1.2" stroke="rgba(180,35,31,0.30)" strokeWidth="0.35" />
          </pattern>
        </defs>
        {/* polygons under lines */}
        {active.map((f, i) => {
          const p = f.properties;
          if (f.geometry.type !== "Polygon") return null;
          const d = toPath((f.geometry.coordinates as number[][][])[0]) + "Z";
          if (p.kind === "takings")
            return <path key={i} d={d} fill="url(#takings-hatch)" stroke="rgba(180,35,31,.55)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />;
          if (p.kind === "park")
            return <path key={i} d={d} fill="rgba(29,158,117,.22)" stroke="rgba(15,123,108,.6)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
          return null;
        })}
        {active.map((f, i) => {
          const p = f.properties;
          if (f.geometry.type !== "LineString") return null;
          const s = LINE_STYLE[p.kind];
          if (!s) return null;
          return (
            <path
              key={i}
              d={toPath(f.geometry.coordinates as number[][])}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeOpacity={s.opacity}
              strokeDasharray={p.erased ? "6 4" : undefined}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {labels.map((l) => (
        <span key={l.name} className={`vec-label ${l.kind}`} style={{ left: `${l.x}%`, top: `${l.y}%` }}>{l.name}</span>
      ))}
    </>
  );
}
