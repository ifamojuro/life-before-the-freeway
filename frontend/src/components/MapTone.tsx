/**
 * Two-tone map style: every historical sheet is turned to grayscale, then
 * mapped from ink (dark) to paper (light), so all eras read as one printed
 * archive. Settings live in lib/mapTone.json.
 *
 * This is the in-browser prototype: an SVG filter on the map's image layers.
 * Open any map page with ?tune to get sliders, then paste the copied settings
 * into mapTone.json.
 */
import { useState, useSyncExternalStore } from "react";
import defaults from "../lib/mapTone.json";

export interface MapTone {
  ink: string;
  paper: string;
  black: number; // gray level (0–1) that becomes pure ink
  white: number; // gray level (0–1) that becomes pure paper
  gamma: number; // >1 darkens mid-tones, <1 lightens them
}

let current: MapTone = defaults;
const listeners = new Set<() => void>();
const setTone = (t: MapTone) => { current = t; listeners.forEach((l) => l()); };
const useMapTone = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Per-channel lookup tables (0–1) from gray level to the two-tone color. */
export function toneTables(t: MapTone, steps = 32): [number[], number[], number[]] {
  const ink = rgb(t.ink);
  const paper = rgb(t.paper);
  const out: [number[], number[], number[]] = [[], [], []];
  for (let i = 0; i < steps; i++) {
    const g = i / (steps - 1);
    const k = Math.min(1, Math.max(0, (g - t.black) / Math.max(0.001, t.white - t.black))) ** t.gamma;
    for (let c = 0; c < 3; c++) out[c].push(+(ink[c] + (paper[c] - ink[c]) * k).toFixed(4));
  }
  return out;
}

/** Hidden SVG filter referenced from CSS as url(#map-two-tone). Render once. */
export function MapToneFilter() {
  const [r, g, b] = toneTables(useMapTone());
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="map-two-tone" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={r.join(" ")} />
          <feFuncG type="table" tableValues={g.join(" ")} />
          <feFuncB type="table" tableValues={b.join(" ")} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

/** Tuning panel, shown only with ?tune in the URL. */
export function MapToneTuner() {
  const tone = useMapTone();
  const [copied, setCopied] = useState(false);
  if (!new URLSearchParams(window.location.search).has("tune")) return null;
  const set = (patch: Partial<MapTone>) => { setTone({ ...tone, ...patch }); setCopied(false); };
  const slider = (key: "black" | "white" | "gamma", min: number, max: number) => (
    <label>
      {key} <b>{tone[key]}</b>
      <input type="range" min={min} max={max} step={0.01} value={tone[key]} onChange={(e) => set({ [key]: +e.target.value })} />
    </label>
  );
  return (
    <div className="tone-tuner" role="region" aria-label="Map color tuning">
      <label>ink <input type="color" value={tone.ink} onChange={(e) => set({ ink: e.target.value })} /></label>
      <label>paper <input type="color" value={tone.paper} onChange={(e) => set({ paper: e.target.value })} /></label>
      {slider("black", 0, 1)}
      {slider("white", 0, 1)}
      {slider("gamma", 0.3, 3)}
      <button type="button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(tone, null, 2)).then(() => setCopied(true))}>
        {copied ? "Copied — paste into mapTone.json" : "Copy settings"}
      </button>
      <button type="button" onClick={() => set(defaults)}>Reset</button>
    </div>
  );
}
