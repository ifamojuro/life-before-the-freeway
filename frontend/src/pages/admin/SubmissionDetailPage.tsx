/**
 * Admin — submission detail & location tagging.
 * Play the clip, read the flagged transcript, scrub the timeline and associate
 * spans of the video with map locations (+ the era each span discusses), then
 * approve & publish (one story per span) or reject. Saves to the audit log.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MapView } from "../../components/MapView";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { ERAS, type Association, type EraKey, type GazetteerEntry, type SubmissionDetail } from "../../lib/types";
import { cx, fmtDate, fmtTime } from "../../lib/util";
import { useAdmin } from "./AdminLayout";

const COLORS = ["#0F7B6C", "#185FA5", "#7A5AA8", "#8A6D3B", "#B4231F", "#D4A017"];
const ERA_COLOR: Record<EraKey, string> = { "1950": "#8A6D3B", "1965": "#B4231F", "1985": "#16202B" };
const ERA_CLS: Record<EraKey, string> = { "1950": "warm", "1965": "scar", "1985": "" };
let idc = 0;
const mkId = () => `s${Date.now().toString(36)}${(idc++).toString(36)}`;

function useSubmission(id: string | undefined) {
  const [sub, setSub] = useState<SubmissionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSub(null); setErr(null);
    if (id) api.submission(id).then(setSub).catch((e) => setErr(e.message));
  }, [id]);
  return { sub, setSub, err };
}

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const { sub, setSub, err } = useSubmission(id);
  const [assocs, setAssocs] = useState<Association[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [gaz, setGaz] = useState<GazetteerEntry[]>([]);
  const [search, setSearch] = useState("");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; mode: "move" | "l" | "r"; x0: number; s0: number; e0: number } | null>(null);

  useEffect(() => { if (sub) { setAssocs(sub.associations.map((a) => ({ ...a, id: a.id ?? mkId() }))); setDirty(false); setSel(null); setT(0); } }, [sub]);
  useEffect(() => { api.gazetteer().then(setGaz).catch(() => {}); }, []);

  const duration = sub?.duration_s || 30;
  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / duration) * 100))}%`;

  const update = useCallback((aid: string, patch: Partial<Association>) => {
    setAssocs((as) => as.map((a) => (a.id === aid ? { ...a, ...patch } : a)));
    setDirty(true);
  }, []);
  const remove = (aid: string) => { setAssocs((as) => as.filter((a) => a.id !== aid)); setDirty(true); if (sel === aid) setSel(null); };
  const addAt = (start = t) => {
    const s = Math.max(0, Math.min(duration - 2, start));
    const a: Association = { id: mkId(), start_s: +s.toFixed(1), end_s: +Math.min(duration, s + Math.min(10, duration / 3)).toFixed(1), location_id: null, name: "", sub: "", lat: null, lng: null, era: (sub?.eras[0] as EraKey) ?? null, color: COLORS[assocs.length % COLORS.length] };
    setAssocs((as) => [...as, a]); setDirty(true); setSel(a.id!); setSearch("");
  };

  // --- timeline drag (move / resize) ---
  const onSegDown = (e: PointerEvent, a: Association, mode: "move" | "l" | "r") => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: a.id!, mode, x0: e.clientX, s0: a.start_s, e0: a.end_s };
    setSel(a.id!);
  };
  const onSegMove = (e: PointerEvent) => {
    const d = dragRef.current; const tr = track.current;
    if (!d || !tr) return;
    const ds = ((e.clientX - d.x0) / tr.clientWidth) * duration;
    let s = d.s0, en = d.e0;
    if (d.mode === "move") { const len = d.e0 - d.s0; s = Math.max(0, Math.min(duration - len, d.s0 + ds)); en = s + len; }
    else if (d.mode === "l") s = Math.max(0, Math.min(d.e0 - 1, d.s0 + ds));
    else en = Math.min(duration, Math.max(d.s0 + 1, d.e0 + ds));
    update(d.id, { start_s: +s.toFixed(1), end_s: +en.toFixed(1) });
  };
  const onSegUp = () => { dragRef.current = null; };
  const seek = (clientX: number) => {
    const tr = track.current; if (!tr) return;
    const r = tr.getBoundingClientRect();
    const s = Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
    setT(s);
    if (video.current) video.current.currentTime = s;
  };

  const toggle = () => { const v = video.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); };
  const currentSeg = useMemo(() => sub?.segments.find((s) => t >= s.start && t < s.end), [sub, t]);

  const save = async () => {
    if (!sub) return;
    setBusy(true);
    try { setSub(await api.saveAssociations(sub.id, assocs)); toast("Location tags saved"); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setBusy(false); }
  };
  const approve = async () => {
    if (!sub) return;
    const unmappable = assocs.filter((a) => !a.location_id && (a.lat == null || a.lng == null));
    if (unmappable.length && !confirm(`${unmappable.length} span(s) have no location and won't be published. Continue?`)) return;
    setBusy(true);
    try { setSub(await api.approve(sub.id, assocs)); toast("Approved & published to the map"); refreshCounts(); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (!sub) return;
    setBusy(true);
    try { setSub(await api.reject(sub.id, reason, assocs)); toast("Rejected · logged"); setRejecting(false); refreshCounts(); }
    catch (e) { toast((e as Error).message, "err"); }
    finally { setBusy(false); }
  };

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return gaz.filter((g) => g.name.toLowerCase().includes(q) || g.cross_street.toLowerCase().includes(q)).slice(0, 6);
  }, [gaz, search]);

  if (err) return <div className="adm-scroll"><div className="adm-err">{err}</div><Link to="/admin">‹ Back to queue</Link></div>;
  if (!sub) return <div className="adm-scroll"><span className="spinner" /></div>;

  const flagged = sub.flagged_terms.length > 0;
  const decided = sub.status !== "pending";
  const flaggedSet = new Set(sub.flagged_terms.map((f) => f.term.toLowerCase()));
  const renderText = (txt: string) =>
    txt.split(/(\s+)/).map((w, i) => (flaggedSet.has(w.replace(/[^A-Za-z']/g, "").toLowerCase()) ? <span key={i} className="term">{w}</span> : w));

  return (
    <div className="mdet">
      <div className="mdet-top">
        <div className="mdet-crumb"><Link to="/admin" className="back">‹ Moderation queue</Link> / <span>Submission #{sub.id}</span></div>
        <div className="nav-arrows">
          {sub.prev_id ? <Link to={`/admin/submissions/${sub.prev_id}`} aria-label="Previous">‹</Link> : <span>‹</span>}
          {sub.next_id ? <Link to={`/admin/submissions/${sub.next_id}`} aria-label="Next">›</Link> : <span>›</span>}
        </div>
      </div>

      <div className="mdet-body">
        {/* LEFT: player + timeline + transcript */}
        <div className="mdet-left">
          <div className="mdet-player">
            {sub.video_url ? (
              <video ref={video} src={sub.video_url} playsInline onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={toggle} />
            ) : (
              <div className="frm"><span className="cap">submission video · {fmtTime(sub.duration_s)} · file not on disk (seed)</span></div>
            )}
            {flagged && <span className="flag-badge">Language flag</span>}
            {sub.video_url && <button type="button" className={cx("bigplay", playing && "pause")} onClick={toggle} aria-label={playing ? "Pause" : "Play"} style={playing ? { opacity: 0.25 } : undefined} />}
            <span className="tstamp">{fmtTime(t)} / {fmtTime(sub.duration_s)}</span>
          </div>

          <div className="timeline">
            <div className="tl-head">
              <h5>Tag locations to moments</h5>
              {!decided && <button type="button" className="add" onClick={() => addAt()}>＋ Mark span at playhead</button>}
            </div>
            <div className="tl-track" ref={track} onPointerDown={(e) => { if ((e.target as HTMLElement).closest(".tl-seg")) return; seek(e.clientX); }}>
              <div className="tl-wave" />
              {assocs.map((a) => (
                <div
                  key={a.id}
                  className={cx("tl-seg", !a.location_id && a.lat == null && "unassigned", sel === a.id && "sel")}
                  style={{ left: pct(a.start_s), width: pct(a.end_s - a.start_s), background: a.location_id || a.lat != null ? a.color : undefined }}
                  onPointerDown={(e) => !decided && onSegDown(e, a, "move")} onPointerMove={onSegMove} onPointerUp={onSegUp} onPointerCancel={onSegUp}
                  onClick={(e) => { e.stopPropagation(); setSel(a.id!); }}
                  title={`${a.name || "Unassigned"} · ${fmtTime(a.start_s)}–${fmtTime(a.end_s)}`}
                >
                  {!decided && <span className="h l" onPointerDown={(e) => onSegDown(e, a, "l")} onPointerMove={onSegMove} onPointerUp={onSegUp} />}
                  <span className="sl" style={!a.location_id && a.lat == null ? { color: "#3a4650" } : undefined}>{a.name || "Unassigned"}</span>
                  {!decided && <span className="h r" onPointerDown={(e) => onSegDown(e, a, "r")} onPointerMove={onSegMove} onPointerUp={onSegUp} />}
                </div>
              ))}
              <div className="tl-playhead" style={{ left: pct(t) }} />
            </div>
            <Ticks duration={duration} />

            <div className="tl-sub">◷ Era each span discusses</div>
            <div className="tl-track era" onPointerDown={(e) => seek(e.clientX)}>
              <div className="tl-wave" />
              {assocs.map((a) => (
                <div key={a.id} className={cx("tl-seg", !a.era && "unassigned", sel === a.id && "sel")} style={{ left: pct(a.start_s), width: pct(a.end_s - a.start_s), background: a.era ? ERA_COLOR[a.era] : undefined }} onClick={(e) => { e.stopPropagation(); setSel(a.id!); }}>
                  <span className="sl">{a.era ? `${ERAS.find((e) => e.key === a.era)?.year} · ${a.era === "1950" ? "before" : a.era === "1965" ? "takings" : "after"}` : "era?"}</span>
                </div>
              ))}
              <div className="tl-playhead" style={{ left: pct(t) }} />
            </div>
            <Ticks duration={duration} />
          </div>

          <div className="mdr-block" style={{ margin: 0 }}>
            <div className="bl">Auto-transcript <span style={{ textTransform: "none", letterSpacing: 0 }}>click a line to seek</span></div>
            <div className="mdr-transcript">
              {sub.segments.length ? sub.segments.map((s, i) => (
                <span key={i} className={cx("seg", currentSeg === s && "now")} onClick={() => { setT(s.start); if (video.current) video.current.currentTime = s.start; }}>
                  <span className="t">{fmtTime(s.start)}</span>{renderText(s.text)}{" "}
                </span>
              )) : <em>{renderText(sub.transcript) || "No transcript."}</em>}
            </div>
          </div>
        </div>

        {/* RIGHT: metadata + associations */}
        <div className="mdet-right">
          <div className="mdr-scroll">
            <div className="mdr-block">
              <div className="bl">Submission</div>
              <div className="mdr-meta-row"><span className="k">Contributor</span><span className="v">{sub.contributor_name}{sub.contributor_email && <div style={{ fontWeight: 400, color: "#6b7680", fontSize: 11 }}>{sub.contributor_email}</div>}</span></div>
              <div className="mdr-meta-row"><span className="k">Submitted</span><span className="v">{fmtDate(sub.created_at)}</span></div>
              <div className="mdr-meta-row"><span className="k">Source</span><span className="v">{sub.source === "field" ? "Field capture" : "Public"} · {sub.method}</span></div>
              <div className="mdr-meta-row"><span className="k">Era</span><span className="v">{sub.eras.map((e) => ERAS.find((x) => x.key === e)?.year).join(", ") || "—"}</span></div>
              <div className="mdr-meta-row"><span className="k">Contributor tagged</span><span className="v">{sub.places.map((p) => p.name).join(", ") || "—"}</span></div>
            </div>
            {sub.prompt_text && <div className="mdr-block"><div className="bl">Prompt answered</div><div className="mdr-prompt">{sub.prompt_text}</div></div>}
            {flagged && (
              <div className="mdr-block">
                <div className="bl">⚑ Transcript flag</div>
                <div className="mdr-flag">
                  <div className="fh">{sub.flagged_terms.length} term{sub.flagged_terms.length > 1 ? "s" : ""} flagged{sub.flagged_terms.length === 1 ? ` at ${fmtTime(sub.flagged_terms[0].at_s)}` : ""}</div>
                  {sub.flagged_terms.map((f, i) => (
                    <p key={i}>“…{f.context.split(" ").map((w, j) => (w.toLowerCase() === f.term.toLowerCase() ? <span key={j} className="term">{w} </span> : w + " "))}…” — <button type="button" onClick={() => { setT(f.at_s); if (video.current) video.current.currentTime = f.at_s; }}>review at {fmtTime(f.at_s)}</button></p>
                  ))}
                  <p style={{ marginTop: 6 }}>Mild language is usually fine — review in context.</p>
                </div>
              </div>
            )}

            <div className="mdr-block" style={{ margin: 0 }}>
              <div className="bl">Location associations · {assocs.length}</div>
              <div className="loc-assoc">
                {assocs.length === 0 && <div className="empty-note" style={{ padding: 12 }}>No spans yet. Play the clip and “Mark span at playhead”, or associate the whole clip below.</div>}
                {assocs.map((a) => {
                  const editing = sel === a.id;
                  const assigned = !!a.location_id || a.lat != null;
                  return (
                    <div key={a.id} className={cx("loc-item", editing && "editing")} onClick={() => setSel(a.id!)}>
                      <div className="li-top">
                        <span className="swatch" style={{ background: a.color }} />
                        <span className="li-time">
                          {editing && !decided ? (
                            <>
                              <input value={fmtTime(a.start_s)} onChange={(e) => update(a.id!, { start_s: parseTs(e.target.value, a.start_s) })} aria-label="Start" /> – <input value={fmtTime(a.end_s)} onChange={(e) => update(a.id!, { end_s: parseTs(e.target.value, a.end_s) })} aria-label="End" />
                            </>
                          ) : (
                            <>{fmtTime(a.start_s)} – {fmtTime(a.end_s)}</>
                          )}
                        </span>
                        {!decided && <button type="button" className="li-x" onClick={(e) => { e.stopPropagation(); remove(a.id!); }} aria-label="Remove span">✕</button>}
                      </div>
                      {assigned ? (
                        <div className="li-loc">
                          <span className="li-pin" style={{ background: a.color }} />
                          <span className="li-name">{a.name}<span>{a.location_id ? (a.sub || "existing pin") : "new pin"}</span></span>
                        </div>
                      ) : (
                        <div className="li-loc"><span className="li-pin" style={{ background: "#98a2aa" }} /><span className="li-name" style={{ color: "#98a2aa" }}>No location yet</span></div>
                      )}
                      {editing && !decided && (
                        <>
                          <input className="li-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search existing pins, or drop a pin on the map…" onClick={(e) => e.stopPropagation()} />
                          {results.length > 0 && (
                            <div className="li-results">
                              {results.map((g) => (
                                <button key={g.id} type="button" onClick={(e) => { e.stopPropagation(); update(a.id!, { location_id: g.id, name: g.name, sub: g.cross_street, lat: g.lat, lng: g.lng }); setSearch(""); }}>
                                  {g.name}<small>{g.cross_street}</small>
                                </button>
                              ))}
                            </div>
                          )}
                          {search.trim() && results.length === 0 && (
                            <div className="li-results"><button type="button" onClick={(e) => { e.stopPropagation(); update(a.id!, { location_id: null, name: search.trim() }); setSearch(""); }}>Use “{search.trim()}” as a new place name<small>then drop a pin below</small></button></div>
                          )}
                          <MapView
                            className="li-map"
                            era={a.era ?? "1950"}
                            gridSize={26}
                            showRoadNames={false}
                            pins={[
                              ...sub.places.filter((p) => p.lat != null).map((p) => ({ id: `p-${p.name}`, lat: p.lat as number, lng: p.lng as number, muted: true, title: p.name, label: "·" })),
                              ...(a.lat != null ? [{ id: "cur", lat: a.lat, lng: a.lng as number, active: true, label: "✓", title: a.name }] : []),
                            ]}
                            onPinClick={(pid) => {
                              const p = sub.places.find((x) => `p-${x.name}` === pid);
                              if (p) update(a.id!, { location_id: p.location_id ?? null, name: p.name, sub: p.location_id ? "existing pin" : "", lat: p.lat, lng: p.lng });
                            }}
                            onTap={({ lat, lng }) => update(a.id!, { lat, lng, location_id: null, name: a.name || "New place", sub: "" })}
                          />
                          <div className="li-eralbl">Discusses era</div>
                          <div className="li-era">
                            {ERAS.map((e) => (
                              <button key={e.key} type="button" className={cx("ep", a.era === e.key && "on", a.era === e.key && ERA_CLS[e.key])} onClick={(ev) => { ev.stopPropagation(); update(a.id!, { era: e.key }); }}>{e.year}</button>
                            ))}
                          </div>
                        </>
                      )}
                      {!editing && a.era && (
                        <>
                          <div className="li-eralbl">Discusses era</div>
                          <div className="li-era">{ERAS.map((e) => <span key={e.key} className={cx("ep", a.era === e.key && "on", a.era === e.key && ERA_CLS[e.key])}>{e.year}</span>)}</div>
                        </>
                      )}
                    </div>
                  );
                })}
                {!decided && (
                  <>
                    <button type="button" className="loc-add" onClick={() => addAt()}>＋ Associate another location</button>
                    {assocs.length === 0 && sub.places.length > 0 && (
                      <button type="button" className="loc-add" style={{ borderStyle: "solid" }} onClick={() => {
                        setAssocs(sub.places.map((p, i) => ({ id: mkId(), start_s: 0, end_s: duration, location_id: p.location_id ?? null, name: p.name, sub: p.location_id ? "existing pin" : "", lat: p.lat, lng: p.lng, era: (sub.eras[0] as EraKey) ?? null, color: COLORS[i % COLORS.length] })));
                        setDirty(true);
                      }}>Use contributor's {sub.places.length} place{sub.places.length > 1 ? "s" : ""} for the whole clip</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mdet-footer">
            {decided ? (
              <div className={cx("mdet-decided", sub.status === "rejected" && "rej")}>
                {sub.status === "approved" ? "Approved & published" : "Rejected"} by {sub.reviewer_name ?? "staff"}{sub.reviewed_at ? ` · ${fmtDate(sub.reviewed_at)}` : ""}{sub.reject_reason && ` — ${sub.reject_reason}`}
              </div>
            ) : rejecting ? (
              <div className="reject-box">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, logged to the audit trail)" />
                <div className="fbtns" style={{ marginTop: 8 }}>
                  <button type="button" className="qbtn reject" disabled={busy} onClick={() => void reject()}>Confirm reject</button>
                  <button type="button" className="qbtn review" onClick={() => setRejecting(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="fbtns">
                  <button type="button" className="qbtn approve" disabled={busy} onClick={() => void approve()}>Approve &amp; publish</button>
                  <button type="button" className="qbtn reject" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
                </div>
                {dirty && <button type="button" className="adm-btn" onClick={() => void save()} disabled={busy}>Save tags without deciding</button>}
              </>
            )}
            <div className={cx("save-note", dirty && "dirty")}>{dirty ? "Unsaved location tags · saved with your decision" : "Location tags save with your decision · logged to audit trail"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ticks({ duration }: { duration: number }) {
  const step = duration > 60 ? 20 : 10;
  const ticks: number[] = [];
  for (let s = 0; s < duration; s += step) ticks.push(s);
  ticks.push(duration);
  return <div className="tl-ticks">{ticks.map((s) => <span key={s}>{fmtTime(s)}</span>)}</div>;
}

function parseTs(v: string, fallback: number): number {
  const m = v.trim().match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}
