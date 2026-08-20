/**
 * Desktop contributor flow — page per step with a persistent prompt + progress
 * rail: 1 your video → 2 places (list + map) → 3 eras → 4 you & submit.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { RecorderControls, RecorderView, useRecorder } from "../../components/Recorder";
import { UploadPicker } from "../../components/UploadPicker";
import { cx } from "../../lib/util";
import { AddPlaceInput, Confirmation, EraPickList, TapMap } from "./shared";
import type { ContributeFlow } from "./useContributeFlow";

type Page = 1 | 2 | 3 | 4 | 5;
const STEPS = ["Your video", "Places", "Eras", "You & submit"];

export function ContributeDesktop({ flow }: { flow: ContributeFlow }) {
  const nav = useNavigate();
  const [page, setPage] = useState<Page>(1);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rec = useRecorder();

  useEffect(() => { if (flow.result) setPage(5); }, [flow.result]);
  useEffect(() => { if (rec.recording) flow.setRecording(rec.recording); /* eslint-disable-next-line */ }, [rec.recording]);
  useEffect(() => {
    if (page === 2 && !activeKey && flow.places.length) setActiveKey(flow.places[0].key);
    if (activeKey && !flow.places.some((p) => p.key === activeKey)) setActiveKey(flow.places[0]?.key ?? null);
  }, [page, flow.places, activeKey]);

  const continueFromVideo = async () => {
    const r = await flow.processVideo();
    if (r) setPage(2);
  };
  const method = flow.method ?? "record";

  return (
    <div className="dtc">
      <AppHeader variant="intake" />
      <div className="dtc-body">
        <aside className="dtc-aside">
          <div className="pr">Your prompt</div>
          <div className="qm">“{flow.prompt?.text ?? "…"}”</div>
          <button type="button" className="shuffle" onClick={() => void flow.shufflePrompt()} disabled={page === 5}>↻ Give me a different prompt</button>
          <div className="dtc-steps">
            {STEPS.map((s, i) => {
              const n = (i + 1) as Page;
              const done = page > n;
              return (
                <button key={s} type="button" className={cx("st", page === n && "on", done && "done")} onClick={() => done && page !== 5 && setPage(n)} disabled={!done || page === 5}>
                  <span className="n">{done ? "✓" : n}</span>{s}
                </button>
              );
            })}
          </div>
          <div className="promise">Your story enters a moderation queue and isn't published until a community reviewer approves it.</div>
        </aside>

        <main className="dtc-main">
          {page === 1 && (
            <>
              <div className="dtc-sh"><span className="num">1</span><h4>Your video</h4><span className="req">required</span></div>
              <div className="dtc-methods">
                <button type="button" className={cx("dtc-method", method === "record" && "on")} onClick={() => flow.setMethod("record")}>
                  <span className="mi">◉</span><div><b>Record now</b><span>~30s selfie video, in your browser</span></div>
                </button>
                <button type="button" className={cx("dtc-method", method === "upload" && "on")} onClick={() => flow.setMethod("upload")}>
                  <span className="mi">⇪</span><div><b>Upload a video</b><span>a clip you already have</span></div>
                </button>
              </div>
              {method === "record" ? (
                <div className="dtc-rec">
                  <div className="prev"><RecorderView rec={rec} compact /></div>
                  <div className="rc">
                    <div className="hint">Hold steady and aim for about 30 seconds. You can retake as many times as you like before continuing.</div>
                    <RecorderControls rec={rec} compact />
                  </div>
                </div>
              ) : (
                <div className="dtc-upload">
                  <UploadPicker picked={flow.picked} onPick={flow.setPicked} onClear={flow.resetVideo} ownFootage={flow.ownFootage} setOwnFootage={flow.setOwnFootage} />
                </div>
              )}
              {flow.uploadError && <div className="err-note" style={{ marginTop: 12 }}>{flow.uploadError}</div>}
              <div className="dtc-actions end">
                {flow.uploading && <div className="processing"><span className="spinner" /> Listening for places you mentioned…</div>}
                <button type="button" className="wbtn primary" disabled={flow.uploading || (method === "record" ? rec.state !== "done" : !flow.picked || !flow.ownFootage)} onClick={() => void continueFromVideo()}>Use this video →</button>
              </div>
            </>
          )}

          {page === 2 && (
            <>
              <div className="dtc-sh"><span className="num">2</span><h4>Places you mentioned</h4><span className="req">{flow.unmapped.length ? `${flow.unmapped.length} still to place` : "all placed"}</span></div>
              <div className="dtc-cols">
                <div className="dtc-col">
                  <div className="dtc-note">Pulled from your video's transcript. Remove any we got wrong, or add ones we missed — then select each and click the map to place it.</div>
                  <div className="dtc-places">
                    {flow.places.map((p) => {
                      const mapped = p.lat != null;
                      return (
                        <div key={p.key} className={cx("dtc-place", activeKey === p.key && "sel", !mapped && "unmapped")} onClick={() => setActiveKey(p.key)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setActiveKey(p.key)}>
                          <span className="dpin" />
                          <span className="nm">{p.name}</span>
                          <span className={cx("src", mapped && "ok")}>{mapped ? "placed" : p.source}</span>
                          <button type="button" className="rm" onClick={(e) => { e.stopPropagation(); flow.removePlace(p.key); }} aria-label={`Remove ${p.name}`}>✕</button>
                        </div>
                      );
                    })}
                    <AddPlaceInput onAdd={(n) => { flow.addPlace(n); }} className="dtc-place add" />
                  </div>
                </div>
                <TapMap flow={flow} activeKey={activeKey} className="dtc-map" />
              </div>
              <div className="dtc-actions">
                <button type="button" className="wbtn ghost" onClick={() => setPage(1)}>← Back</button>
                <button type="button" className="wbtn primary" onClick={() => setPage(3)}>Continue →</button>
              </div>
            </>
          )}

          {page === 3 && (
            <>
              <div className="dtc-sh"><span className="num">3</span><h4>Which eras did you talk about?</h4><span className="req">pick all that apply</span></div>
              <EraPickList flow={flow} desktop />
              <div className="dtc-actions">
                <button type="button" className="wbtn ghost" onClick={() => setPage(2)}>← Back</button>
                <button type="button" className="wbtn primary" onClick={() => setPage(4)}>Continue →</button>
              </div>
            </>
          )}

          {page === 4 && (
            <>
              <div className="dtc-sh"><span className="num">4</span><h4>You &amp; submit</h4></div>
              <div className="dtc-you">
                <label className="f"><div className="l">Name</div><input value={flow.name} onChange={(e) => flow.setName(e.target.value)} placeholder="Denise Watkins" autoComplete="name" /></label>
                <label className="f"><div className="l">Email · never shown publicly</div><input type="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" /></label>
              </div>
              <button type="button" className={cx("checkline dtc-decency", flow.agreed && "on")} onClick={() => flow.setAgreed(!flow.agreed)} aria-pressed={flow.agreed}>
                <span className="box">{flow.agreed ? "✓" : ""}</span>
                I'm sharing from my own memory and agree to keep it decent — no hate, threats, or explicit content. (We don't fact-check your story.)
              </button>
              {flow.submitError && <div className="err-note" style={{ marginTop: 12 }}>{flow.submitError}</div>}
              <div className="dtc-submit">
                <p><b>On submit:</b> your story enters the moderation queue and isn't published until a reviewer approves it. We'll email you when it's live.</p>
                <button type="button" className="wbtn gold" disabled={!flow.canSubmit} onClick={() => void flow.submit()}>{flow.submitting ? "Submitting…" : "Submit my story"}</button>
              </div>
              <div style={{ display: "flex", marginTop: 16 }}><button type="button" className="wbtn ghost" onClick={() => setPage(3)}>← Back</button></div>
            </>
          )}

          {page === 5 && <div className="dtc-confirm"><Confirmation flow={flow} onBack={() => nav("/")} /></div>}
        </main>
      </div>
    </div>
  );
}
