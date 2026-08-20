/**
 * Mobile home: full-screen map, segmented era control on top, the archive chat
 * as a draggable bottom sheet (collapsed → expanded), FAB to leave a story,
 * and the centered first-visit card.
 */
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { CitationList, SUGGESTIONS, useArchiveChat } from "../../components/ChatPanel";
import { EraSegmented } from "../../components/EraControl";
import { FirstTimeOverlay, useFirstVisit } from "../../components/FirstTimeOverlay";
import { MapView } from "../../components/MapView";
import { cx } from "../../lib/util";
import { pinsToMap } from "./HomeDesktop";
import type { useHomeData } from "./HomePage";

const COLLAPSED = 236; // px — enough for title, two chips, input
const PEEK = 96;

export function HomeMobile({ era, setEra, pins, error }: ReturnType<typeof useHomeData>) {
  const nav = useNavigate();
  const chat = useArchiveChat();
  const ft = useFirstVisit();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapH, setMapH] = useState(600);
  const [sheetH, setSheetH] = useState(COLLAPSED);
  const [dragging, setDragging] = useState(false);
  const [input, setInput] = useState("");
  const [peekPin, setPeekPin] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; h0: number } | null>(null);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMapH(el.clientHeight));
    ro.observe(el);
    setMapH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const expandedH = Math.round(mapH * 0.68);
  const expanded = sheetH > (COLLAPSED + expandedH) / 2;

  useEffect(() => {
    if (chat.messages.length) setSheetH(expandedH);
  }, [chat.messages.length, expandedH]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

  const onDown = (e: PointerEvent) => {
    drag.current = { y0: e.clientY, h0: sheetH };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const h = Math.max(PEEK, Math.min(mapH - 40, drag.current.h0 - (e.clientY - drag.current.y0)));
    setSheetH(h);
  };
  const onUp = () => {
    if (!drag.current) return;
    const moved = sheetH - drag.current.h0;
    drag.current = null;
    setDragging(false);
    // snap: flick direction wins, otherwise nearest
    if (moved > 40) setSheetH(expandedH);
    else if (moved < -40) setSheetH(sheetH < COLLAPSED ? PEEK : COLLAPSED);
    else setSheetH(expanded ? expandedH : sheetH < (PEEK + COLLAPSED) / 2 ? PEEK : COLLAPSED);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void chat.ask(input);
    setInput("");
  };

  const active = pins.find((p) => p.id === peekPin);

  return (
    <div className="m1">
      <AppHeader />
      <div className="m1-map" ref={mapRef}>
        <MapView
          className="map-fill"
          era={era}
          pins={pinsToMap(pins, peekPin)}
          onPinClick={(id) => setPeekPin(peekPin === id ? null : Number(id))}
          gridSize={38}
          showRoadNames={false}
        />
        <EraSegmented value={era} onChange={setEra} />
        {error && <div className="err-note" style={{ position: "absolute", left: 10, right: 10, top: 64, zIndex: 4 }}>Couldn't load pins: {error}</div>}

        {active && (
          <Link to={`/story/${active.id}`} className="m1-pinpeek" style={{ bottom: sheetH + 64 }}>
            <span className="dot" style={{ width: 12, height: 12, borderRadius: "50% 50% 50% 2px", background: "var(--gold)", transform: "rotate(45deg)", flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0 }}><b>{active.name}</b><span>{active.cross_street} · {active.story_count} {active.story_count === 1 ? "story" : "stories"} · tap to watch</span></span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--slate)" }}>›</span>
          </Link>
        )}

        <Link to="/contribute" className="m1-fab" style={{ bottom: sheetH + 12 }} aria-label="Leave a story">＋</Link>

        <div className={cx("m1-sheet", dragging && "dragging")} style={{ height: sheetH }} role="region" aria-label="Ask the archive">
          <div className="m1-sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => { if (!expanded && sheetH <= PEEK) setSheetH(COLLAPSED); }}>
            <div className="m1-grab" />
            <h4>Ask the archive</h4>
            <div className="sub">Answers come only from the elders we interviewed.</div>
          </div>
          <div className="m1-scroll" ref={scroller}>
            {chat.messages.length === 0 ? (
              <div className="m1-chiprow">
                {SUGGESTIONS.slice(0, 2).map((s) => (
                  <button key={s} type="button" className="m1-chip" onClick={() => void chat.ask(s)}>{s}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="m1-youasked">You asked</div>
                {chat.messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="m1-user">{m.content}</div>
                  ) : (
                    <div key={i} className="m1-answer">
                      <div className="role">◆ From the interviews</div>
                      {m.pending ? <div className="thinking" style={{ display: "flex", gap: 5 }}><i /><i /><i /></div> : <p>{m.content}</p>}
                      {m.citations && <CitationList citations={m.citations} compact />}
                    </div>
                  ),
                )}
              </>
            )}
          </div>
          <form className="m1-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setSheetH(expandedH)}
              placeholder={chat.messages.length ? "Ask a follow-up…" : "Ask about a place or a memory…"}
              aria-label="Your question"
            />
            <button type="submit" className="cs" disabled={chat.busy || !input.trim()} aria-label="Send">↑</button>
          </form>
        </div>

        {ft.show && <FirstTimeOverlay variant="mobile" onDone={ft.dismiss} />}
      </div>
      {/* Keep nav target for screen-readers */}
      <span className="sr-only" onClick={() => nav("/")} />
    </div>
  );
}
