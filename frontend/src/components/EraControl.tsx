import { ERAS, ERA_SHORT, type EraKey } from "../lib/types";
import { cx } from "../lib/util";

const DESKTOP_LABELS: Record<EraKey, string> = {
  "1950": "Full pre-freeway\nneighborhood",
  "1965": "Property takings —\n“a giant scar”",
  "1985": "Freeway opens /\npresent-day",
};

export function EraControlCard({ value, onChange }: { value: EraKey; onChange: (e: EraKey) => void }) {
  return (
    <div className="map-overlay-ctrl" role="radiogroup" aria-label="Time overlay">
      <div className="moc-title">Time overlay</div>
      <div className="era-row">
        {ERAS.map((e) => (
          <button key={e.key} type="button" role="radio" aria-checked={value === e.key} className={cx("era", value === e.key && "on")} onClick={() => onChange(e.key)}>
            <span className="yr">{e.year}</span>
            <span className="lbl" style={{ whiteSpace: "pre-line" }}>{DESKTOP_LABELS[e.key]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EraSegmented({ value, onChange }: { value: EraKey; onChange: (e: EraKey) => void }) {
  return (
    <div className="m1-era" role="radiogroup" aria-label="Time overlay">
      {ERAS.map((e) => (
        <button key={e.key} type="button" role="radio" aria-checked={value === e.key} className={cx(value === e.key && "on")} onClick={() => onChange(e.key)}>
          {e.year}
          <em>{ERA_SHORT[e.key]}</em>
        </button>
      ))}
    </div>
  );
}
