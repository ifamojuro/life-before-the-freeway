import { useState } from "react";
import { FIRST_VISIT_KEY, cx } from "../lib/util";

export function useFirstVisit() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem(FIRST_VISIT_KEY); } catch { return true; }
  });
  const dismiss = () => {
    try { localStorage.setItem(FIRST_VISIT_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };
  return { show, dismiss };
}

const STEPS = {
  desktop: [
    {
      title: "Two ways to explore",
      body: "This is a living archive of West Oakland before, during, and after the I-980 freeway. Explore it two ways:",
      halves: [
        { ic: "On the left", kind: "map", text: "Click pins to watch stories. Toggle the year to see the neighborhood change." },
        { ic: "On the right", kind: "chat", text: "Ask a question — answers come only from the recorded interviews." },
      ],
    },
    {
      title: "Add your own memory",
      body: "Every pin here was placed by someone who lived it. If you or an elder you know remember this neighborhood, leave a ~30-second video story — it goes to a community moderator before it appears.",
      halves: [
        { ic: "Leave a Story", kind: "rec", text: "Record in your browser or upload a clip. We'll help you place it on the map." },
        { ic: "Multiple perspectives", kind: "persp", text: "When residents remember a place differently, both accounts are shown side by side." },
      ],
    },
  ],
  mobile: [
    {
      title: "Two ways to explore",
      body: "A living archive of West Oakland before, during, and after I-980.",
      halves: [
        { ic: "The map", kind: "map", text: "Tap pins to watch stories." },
        { ic: "The sheet", kind: "chat", text: "Ask about a place or memory." },
      ],
    },
    {
      title: "Add your memory",
      body: "Tap + to leave a ~30s video story. A moderator reviews it before it appears.",
      halves: [
        { ic: "Record", kind: "rec", text: "In your browser, or upload a clip." },
        { ic: "Perspectives", kind: "persp", text: "Different memories sit side by side." },
      ],
    },
  ],
};

function Mini({ kind, h }: { kind: string; h: number }) {
  if (kind === "map")
    return (
      <div className="ft-mini-map" style={{ height: h }}>
        <div className="mg" />
        <span className="mp" style={{ left: "30%", top: "35%" }} /><span className="mp" style={{ left: "58%", top: "52%", background: "var(--gold)" }} /><span className="mp" style={{ left: "72%", top: "28%" }} />
      </div>
    );
  if (kind === "chat")
    return <div className="ft-mini-chat" style={{ height: h }}><i className="u" /><i className="b" /><i style={{ width: "60%" }} /></div>;
  if (kind === "rec")
    return (
      <div className="ft-mini-map" style={{ height: h, background: "var(--night)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--red)", border: "2px solid #fff" }} />
      </div>
    );
  return (
    <div className="ft-mini-map" style={{ height: h, display: "flex", gap: 4, padding: 4, background: "#fff" }}>
      <span style={{ flex: 1, background: "var(--mist)", borderRadius: 3 }} /><span style={{ flex: 1, background: "var(--mist)", borderRadius: 3 }} />
    </div>
  );
}

export function FirstTimeOverlay({ variant, onDone }: { variant: "desktop" | "mobile"; onDone: () => void }) {
  const [i, setI] = useState(0);
  const steps = STEPS[variant];
  const s = steps[i];
  const last = i === steps.length - 1;
  if (variant === "mobile") {
    return (
      <div className="m1-ftov" role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="m1-ftcard">
          <div className="fk">First visit · {i + 1} of {steps.length}</div>
          <h5>{s.title}</h5>
          <p>{s.body}</p>
          <div className="m1-ftrow">
            {s.halves.map((h) => (
              <div key={h.ic} className="m1-fthalf"><div className="ic">{h.ic}</div><Mini kind={h.kind} h={34} /><small>{h.text}</small></div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="wbtn ghost" style={{ flex: 1 }} onClick={onDone}>Skip</button>
            <button type="button" className="wbtn primary" style={{ flex: 1 }} onClick={() => (last ? onDone() : setI(i + 1))}>{last ? "Start exploring" : "Next"}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="ft-overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="ft-card">
        <div className="fk">First visit · {i + 1} of {steps.length}</div>
        <h4>{s.title}</h4>
        <p>{s.body}</p>
        <div className="ft-split">
          {s.halves.map((h) => (
            <div key={h.ic} className="ft-half"><div className="ic">{h.ic}</div><Mini kind={h.kind} h={44} /><small>{h.text}</small></div>
          ))}
        </div>
        <div className="ft-foot">
          <div className="ft-dots">{steps.map((_, k) => <i key={k} className={cx(k === i && "on")} />)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="wbtn ghost" onClick={onDone}>Skip</button>
            <button type="button" className="wbtn primary" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? "Start exploring" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
