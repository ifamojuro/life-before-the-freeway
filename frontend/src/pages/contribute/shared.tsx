/** Pieces shared by the mobile and desktop contributor flows. */
import { useState, type FormEvent } from "react";
import { MapView, type MapPin } from "../../components/MapView";
import { ERAS, type EraKey } from "../../lib/types";
import { cx } from "../../lib/util";
import type { ContributeFlow, PlaceDraft } from "./useContributeFlow";

export const NORMS = [
  { ic: "♡", text: "Speak from your own experience and memory." },
  { ic: "✓", text: "This is your story — we're not fact-checking it." },
  { ic: "◎", text: "Keep it decent: no hate, threats, or explicit content." },
];

export function placePins(places: PlaceDraft[], activeKey?: string | null): MapPin[] {
  return places
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.key, lat: p.lat as number, lng: p.lng as number, label: p.key === activeKey ? "✓" : "•", title: p.name, active: p.key === activeKey, muted: p.key !== activeKey }));
}

export function TapMap({ flow, activeKey, className, instruction, era }: { flow: ContributeFlow; activeKey: string | null; className?: string; instruction?: string; era?: EraKey }) {
  const active = flow.places.find((p) => p.key === activeKey);
  return (
    <MapView
      era={era ?? "1950"}
      className={className}
      pins={placePins(flow.places, activeKey)}
      gridSize={34}
      showRoadNames
      onTap={activeKey ? ({ lat, lng }) => flow.setPlaceCoords(activeKey, lat, lng) : undefined}
    >
      {instruction !== "" && (
        <div className="tap-instruction">
          {active ? instruction ?? <>Tap the map to place “{active.name}” — exact spot doesn't matter</> : "Select a place to position it"}
        </div>
      )}
    </MapView>
  );
}

export function AddPlaceInput({ onAdd, className = "det-add" }: { onAdd: (n: string) => void; className?: string }) {
  const [v, setV] = useState("");
  const go = (e: FormEvent) => { e.preventDefault(); onAdd(v); setV(""); };
  return (
    <form className={className} onSubmit={go}>
      <span className="dplus">＋</span>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add another place…" aria-label="Add another place" />
      {v.trim() && <button type="submit" className="wbtn primary" style={{ padding: "6px 10px" }}>Add</button>}
    </form>
  );
}

export function EraPickList({ flow, desktop }: { flow: ContributeFlow; desktop?: boolean }) {
  if (desktop) {
    return (
      <div className="dtc-eras">
        {ERAS.map((e) => {
          const on = flow.eras.includes(e.key);
          return (
            <button key={e.key} type="button" className={cx("dtc-era", on && "on")} onClick={() => flow.toggleEra(e.key)} aria-pressed={on}>
              <span className="yr">{e.year}</span><span className="et">{e.label}</span><span className="ck">{on ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="eras-pick">
      {ERAS.map((e) => {
        const on = flow.eras.includes(e.key);
        return (
          <button key={e.key} type="button" className={cx("era-opt", on && "on")} onClick={() => flow.toggleEra(e.key)} aria-pressed={on}>
            <span className="eo-yr">{e.year}</span>
            <span className="eo-txt"><b>{e.label}</b><span>{e.detail}</span></span>
            <span className="eo-chk">{on ? "✓" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Confirmation({ flow, onBack, compact }: { flow: ContributeFlow; onBack: () => void; compact?: boolean }) {
  return (
    <div className="confirm">
      <div className="seal" />
      <h5>Thank you for<br />sharing your story</h5>
      <p>A moderator will review it before it appears on the map.{flow.email.trim() ? ` We'll email ${flow.email.trim()} once it's live.` : ""}</p>
      <div className="queue-note">{flow.result?.message ?? "In the review queue · not published yet. We'll notify you once it's live."}</div>
      {!compact && <button type="button" className="wbtn ghost" style={{ marginTop: 22 }} onClick={onBack}>Back to the map</button>}
    </div>
  );
}
