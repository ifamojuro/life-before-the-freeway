import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { ChatPanel, useArchiveChat } from "../../components/ChatPanel";
import { EraControlCard } from "../../components/EraControl";
import { FirstTimeOverlay, useFirstVisit } from "../../components/FirstTimeOverlay";
import { MapView, type MapPin } from "../../components/MapView";
import type { useHomeData } from "./HomePage";

export function pinsToMap(pins: ReturnType<typeof useHomeData>["pins"], activeId?: number | null): MapPin[] {
  return pins.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: p.story_count >= 4 ? String(p.story_count) : p.cross_street.match(/^(\d+\w+)/)?.[1] ?? String(p.story_count),
    title: `${p.name} · ${p.story_count} ${p.story_count === 1 ? "story" : "stories"}`,
    cluster: p.story_count >= 4,
    active: p.id === activeId,
  }));
}

export function HomeDesktop({ era, setEra, pins, error }: ReturnType<typeof useHomeData>) {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const activeId = Number(sp.get("pin")) || null;
  const chat = useArchiveChat();
  const ft = useFirstVisit();

  return (
    <div className="home">
      <AppHeader />
      <div className="s1-body">
        <div className="s1-map">
          <MapView className="map-fill" baseToggle era={era} pins={pinsToMap(pins, activeId)} onPinClick={(id) => nav(`/story/${id}`)} zoomable scaleLabel="West Oakland · 7th & Chestnut" />
          <EraControlCard value={era} onChange={setEra} />
          {error && <div className="err-note" style={{ position: "absolute", left: 16, top: 200, zIndex: 4 }}>Couldn't load pins: {error}. Is the API running on :8000?</div>}
          {!error && pins.length === 0 && (
            <div className="map-scale" style={{ left: "50%", bottom: "auto", top: 16, transform: "translateX(-50%)" }}>No stories tagged to this era yet</div>
          )}
        </div>
        <ChatPanel chat={chat} />
        {ft.show && <FirstTimeOverlay variant="desktop" onDone={ft.dismiss} />}
      </div>
    </div>
  );
}
