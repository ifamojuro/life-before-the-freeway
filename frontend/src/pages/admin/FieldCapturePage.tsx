/**
 * Field Interview Capture — staff-recorded, publishes straight to the map.
 * Same intake pieces (record/upload, places, eras) without the moderation stop.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RecorderControls, RecorderView, useRecorder } from "../../components/Recorder";
import { useToast } from "../../components/Toast";
import { UploadPicker, type PickedFile } from "../../components/UploadPicker";
import { MapView } from "../../components/MapView";
import { api } from "../../lib/api";
import { ERAS, type DetectedPlace, type EraKey, type UploadResult } from "../../lib/types";
import { cx } from "../../lib/util";
import { useAdmin } from "./AdminLayout";

interface Draft extends DetectedPlace { key: string }
let kc = 0;
const mk = () => `f${Date.now().toString(36)}${(kc++).toString(36)}`;

export default function FieldCapturePage() {
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAdmin();
  const rec = useRecorder();
  const [method, setMethod] = useState<"record" | "upload">("record");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [own, setOwn] = useState(true);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [places, setPlaces] = useState<Draft[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [eras, setEras] = useState<EraKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [newPlace, setNewPlace] = useState("");

  useEffect(() => { if (upload) { setPlaces(upload.detected_places.map((p) => ({ ...p, key: mk() }))); } }, [upload]);
  useEffect(() => { if (!activeKey && places.length) setActiveKey(places[0].key); }, [places, activeKey]);

  const blob = rec.recording?.blob ?? picked?.file;
  const process = async () => {
    if (!blob || upload) return;
    setUploading(true);
    try {
      setUpload(await api.upload(blob, rec.recording ? "recorded" : "uploaded", rec.recording?.durationS ?? picked?.durationS, picked?.file.name));
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setUploading(false); }
  };

  const active = useMemo(() => places.find((p) => p.key === activeKey), [places, activeKey]);
  const publish = async () => {
    if (!upload) return;
    setBusy(true);
    try {
      await api.fieldCapture({
        upload_id: upload.upload_id, contributor_name: name.trim(), contributor_detail: detail.trim(), prompt_id: null,
        places: places.map(({ key: _k, ...p }) => p), eras, associations: [],
      });
      toast("Published to the map (field capture, logged)");
      nav("/admin/published");
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setBusy(false); }
  };

  const canPublish = !!upload && name.trim() && places.some((p) => p.lat != null || p.location_id) && !busy;

  return (
    <>
      <div className="adm-top"><h3>Field Interview Capture<span>staff-vouched · publishes directly, no moderation step</span></h3></div>
      <div className="adm-scroll">
        <div className="adm-card">
          <h4>1 · The interview video</h4>
          {!upload ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button type="button" className={cx("adm-btn", method === "record" && "primary")} onClick={() => setMethod("record")}>◉ Record now</button>
                <button type="button" className={cx("adm-btn", method === "upload" && "primary")} onClick={() => setMethod("upload")}>⇪ Upload</button>
              </div>
              {method === "record" ? (
                <div style={{ maxWidth: 420 }}>
                  <div className="rec-view" style={{ minHeight: 300 }}><RecorderView rec={rec} /></div>
                  <RecorderControls rec={rec} />
                </div>
              ) : (
                <div style={{ maxWidth: 420 }}>
                  <UploadPicker picked={picked} onPick={setPicked} onClear={() => setPicked(null)} ownFootage={own} setOwnFootage={setOwn} />
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button type="button" className="adm-btn primary" disabled={!blob || uploading} onClick={() => void process()}>
                  {uploading ? "Transcribing…" : "Use this video →"}
                </button>
              </div>
            </>
          ) : (
            <p>✓ Video attached ({upload.original_name}). Transcript &amp; detected places loaded below.</p>
          )}
        </div>

        {upload && (
          <>
            <div className="adm-card">
              <h4>2 · Interviewee</h4>
              <div style={{ display: "flex", gap: 12, maxWidth: 640 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Name (shown on the map)</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mr. Ellis" /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>Detail</label><input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Delivered here as a teen, b. 1944" /></div>
              </div>
              <p>Interviewer: {me.name} — recorded in the audit log.</p>
            </div>
            <div className="adm-card">
              <h4>3 · Places &amp; eras</h4>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px" }}>
                  {places.map((p) => (
                    <div key={p.key} className={cx("dtc-place", activeKey === p.key && "sel", p.lat == null && !p.location_id && "unmapped")} style={{ marginBottom: 8 }} onClick={() => setActiveKey(p.key)}>
                      <span className="dpin" /><span className="nm">{p.name}</span>
                      <span className={cx("src", (p.lat != null || p.location_id != null) && "ok")}>{p.lat != null || p.location_id ? "placed" : p.source}</span>
                      <button type="button" className="rm" onClick={(e) => { e.stopPropagation(); setPlaces((ps) => ps.filter((x) => x.key !== p.key)); }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="adm-search" style={{ flex: 1, width: "auto" }} value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder="Add a place…" />
                    <button type="button" className="adm-btn" onClick={() => { if (newPlace.trim()) { setPlaces((ps) => [...ps, { key: mk(), name: newPlace.trim(), source: "manual", lat: null, lng: null, location_id: null }]); setNewPlace(""); } }}>Add</button>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div className="li-eralbl">Eras discussed</div>
                    <div className="li-era" style={{ maxWidth: 260 }}>
                      {ERAS.map((e) => (
                        <button key={e.key} type="button" className={cx("ep", eras.includes(e.key) && "on")} onClick={() => setEras((es) => (es.includes(e.key) ? es.filter((x) => x !== e.key) : [...es, e.key]))}>{e.year}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <MapView
                  className="dtc-map" era="1950" gridSize={34}
                  pins={places.filter((p) => p.lat != null).map((p) => ({ id: p.key, lat: p.lat as number, lng: p.lng as number, active: p.key === activeKey, muted: p.key !== activeKey, label: p.key === activeKey ? "✓" : "•", title: p.name }))}
                  onTap={activeKey ? ({ lat, lng }) => setPlaces((ps) => ps.map((p) => (p.key === activeKey ? { ...p, lat, lng } : p))) : undefined}
                >
                  <div className="tap-instruction">{active ? `Click the map to place “${active.name}”` : "Add or select a place"}</div>
                </MapView>
              </div>
            </div>
            <div className="adm-card" style={{ background: "#16202b", border: "none" }}>
              <p style={{ color: "rgba(255,255,255,.75)", marginBottom: 12 }}>Because this is staff-vouched, publishing puts it on the public map immediately — one story per placed location, whole clip, logged to the audit trail under your name.</p>
              <button type="button" className="adm-btn gold" disabled={!canPublish} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish to the map"}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
