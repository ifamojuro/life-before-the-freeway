/**
 * Mobile contributor flow — six stepped screens:
 * 1 prompt → 2 record/upload → 3 places you mentioned → 4 map each place →
 * 5 eras → 6 your details + norms → confirmation. Enters the moderation queue.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RecorderControls, RecorderView, useRecorder } from "../../components/Recorder";
import { UploadPicker } from "../../components/UploadPicker";
import { ERAS } from "../../lib/types";
import { cx, fmtTime } from "../../lib/util";
import { AddPlaceInput, Confirmation, EraPickList, NORMS, TapMap } from "./shared";
import type { ContributeFlow } from "./useContributeFlow";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL = 6;

export function ContributeMobile({ flow }: { flow: ContributeFlow }) {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [placeIdx, setPlaceIdx] = useState(0);
  const rec = useRecorder();

  useEffect(() => { if (flow.result) setStep(7); }, [flow.result]);
  useEffect(() => { if (rec.recording) flow.setRecording(rec.recording); /* eslint-disable-next-line */ }, [rec.recording]);

  const back = () => {
    if (step === 2 && flow.method) { flow.setMethod(null); return; }
    if (step === 4 && placeIdx > 0) { setPlaceIdx(placeIdx - 1); return; }
    if (step > 1) setStep((step - 1) as Step);
    else nav("/");
  };
  const next = () => setStep((Math.min(7, step + 1)) as Step);

  const continueFromVideo = async () => {
    const r = await flow.processVideo();
    if (r) { setPlaceIdx(0); next(); }
  };
  const goMap = () => { setPlaceIdx(0); setStep(flow.places.length ? 4 : 5); };
  const nextPlace = () => { if (placeIdx + 1 < flow.places.length) setPlaceIdx(placeIdx + 1); else setStep(5); };

  const progress = step === 7 ? 100 : Math.round((step / TOTAL) * 100);
  const currentPlace = flow.places[placeIdx];

  return (
    <div className="mflow">
      <div className="ph-topbar">
        {step === 7 ? <span style={{ width: 28 }} /> : <button type="button" className="back" onClick={back} aria-label="Back">{step === 1 ? "✕" : "‹"}</button>}
        <span className="step-count">{step === 7 ? "Submitted" : `Step ${step} of ${TOTAL}`}</span>
        {step === 7 ? <button type="button" className="back" onClick={() => nav("/")} aria-label="Close">✕</button> : <span style={{ width: 28 }} />}
      </div>
      <div className="ph-progress"><i style={{ width: `${progress}%` }} /></div>

      {/* STEP 1 — prompt */}
      {step === 1 && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">Your prompt</div>
            <div className="prompt-card"><div className="qm">“</div><p>{flow.prompt?.text ?? "…"}</p></div>
            <div className="prompt-meta">Open-ended — there's no wrong answer. Speak from your own memory.</div>
            <div className="era-callout">
              <div className="ec-lbl">◆ We're especially seeking</div>
              <p>Memories tied to the neighborhood's turning points — before, during, and after I-980.</p>
              <div className="ec-yrs">
                {ERAS.map((e) => <div key={e.key} className="ec-yr"><b>{e.year}</b><span>{e.key === "1950" ? "Before" : e.key === "1965" ? "Takings" : "After"}</span></div>)}
              </div>
            </div>
            <button type="button" className="prompt-shuffle" onClick={() => void flow.shufflePrompt()}>↻ Give me a different prompt</button>
          </div>
          <div className="ph-footer"><button type="button" className="wbtn primary wide" onClick={next}>Tell your story</button></div>
        </>
      )}

      {/* STEP 2 — method */}
      {step === 2 && !flow.method && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">How do you want to share?</div>
            <div className="method-pick">
              <button type="button" className="method-opt primary" onClick={() => flow.setMethod("record")}>
                <span className="mic">◉</span><span className="mtx"><b>Record now</b><span>Use your camera for a ~30s selfie video.</span></span><span className="marrow">→</span>
              </button>
              <div className="method-or">or</div>
              <button type="button" className="method-opt" onClick={() => flow.setMethod("upload")}>
                <span className="mic">⇪</span><span className="mtx"><b>Upload a video</b><span>Choose a clip you already have.</span></span><span className="marrow">→</span>
              </button>
            </div>
            <div className="rec-hint-static">Either way, vertical and about 30 seconds works best.</div>
          </div>
          <div className="ph-footer" />
        </>
      )}

      {/* STEP 2 · record */}
      {step === 2 && flow.method === "record" && (
        <>
          <div className="ph-content">
            <div className="rec-view"><RecorderView rec={rec} /></div>
            <RecorderControls rec={rec} />
            {flow.uploadError && <div className="err-note" style={{ marginTop: 8 }}>{flow.uploadError}</div>}
          </div>
          <div className="ph-footer">
            {flow.uploading ? (
              <div className="processing" style={{ width: "100%", justifyContent: "center" }}><span className="spinner" /> Listening for places you mentioned…</div>
            ) : (
              <button type="button" className={cx("wbtn wide", rec.state === "done" ? "primary" : "ghost")} disabled={rec.state !== "done"} onClick={() => void continueFromVideo()}>Use this recording →</button>
            )}
          </div>
        </>
      )}

      {/* STEP 2 · upload */}
      {step === 2 && flow.method === "upload" && (
        <>
          <div className="ph-content">
            <UploadPicker picked={flow.picked} onPick={(p) => { flow.setPicked(p); }} onClear={flow.resetVideo} ownFootage={flow.ownFootage} setOwnFootage={flow.setOwnFootage} />
            {flow.uploadError && <div className="err-note">{flow.uploadError}</div>}
          </div>
          <div className="ph-footer">
            {flow.uploading ? (
              <div className="processing" style={{ width: "100%", justifyContent: "center" }}><span className="spinner" /> Uploading &amp; listening for places…</div>
            ) : (
              <button type="button" className="wbtn primary wide" disabled={!flow.picked || !flow.ownFootage} onClick={() => void continueFromVideo()}>Use this video →</button>
            )}
          </div>
        </>
      )}

      {/* STEP 3 — places you mentioned */}
      {step === 3 && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">Places you mentioned</div>
            <div className="det-note"><span className="di">✦</span><p>We listened to your video and pulled these places from what you said. Remove any we got wrong, or add ones we missed.</p></div>
            <div className="det-list">
              {flow.places.length === 0 && <div className="empty-note">We didn't catch any place names — add the ones your story is about.</div>}
              {flow.places.map((p) => (
                <div key={p.key} className={cx("det-item", p.source === "manual" && "manual")}>
                  <span className="dpin" />
                  <span className="dnm"><b>{p.name}</b><span>{p.source === "transcript" ? "heard in transcript" : "added by you"}</span></span>
                  <button type="button" className="drm" onClick={() => flow.removePlace(p.key)} aria-label={`Remove ${p.name}`}>✕</button>
                </div>
              ))}
            </div>
            <AddPlaceInput onAdd={flow.addPlace} />
          </div>
          <div className="ph-footer"><button type="button" className="wbtn primary wide" onClick={goMap}>{flow.places.length ? "Map these places →" : "Continue →"}</button></div>
        </>
      )}

      {/* STEP 4 — map each place */}
      {step === 4 && currentPlace && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">Place {placeIdx + 1} of {flow.places.length} · {currentPlace.name}</div>
            <TapMap flow={flow} activeKey={currentPlace.key} className="tapmap" />
            <div className="tap-fallback">
              <span className="fx">or type</span>
              <input value={currentPlace.name} onChange={(e) => flow.renamePlace(currentPlace.key, e.target.value)} placeholder="cross-street, e.g. 7th & Wood" aria-label="Cross street" />
            </div>
          </div>
          <div className="ph-footer">
            <button type="button" className="wbtn primary wide" onClick={nextPlace}>{placeIdx + 1 < flow.places.length ? "Next place →" : "Continue →"}</button>
          </div>
        </>
      )}

      {/* STEP 5 — eras */}
      {step === 5 && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">Which eras did you talk about?</div>
            <EraPickList flow={flow} />
            <div className="eras-hint">Pick all that your story touches on.</div>
          </div>
          <div className="ph-footer"><button type="button" className="wbtn primary wide" onClick={next}>Continue →</button></div>
        </>
      )}

      {/* STEP 6 — details + norms */}
      {step === 6 && (
        <>
          <div className="ph-content">
            <div className="ph-eyebrow">Before you submit</div>
            <div className="you-block">
              <div className="yl">Your details</div>
              <label className="you-field"><span className="fk">Name</span><input value={flow.name} onChange={(e) => flow.setName(e.target.value)} placeholder="Denise Watkins" autoComplete="name" /></label>
              <label className="you-field"><span className="fk">Email</span><input type="email" value={flow.email} onChange={(e) => flow.setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" /></label>
              <div className="you-note">We use this to notify you when your story is published. Your email is never shown publicly.</div>
            </div>
            <div className="guide-card">
              <h5>A few community norms</h5>
              {NORMS.map((n) => <div key={n.ic} className="guide-item"><span className="gi">{n.ic}</span><p>{n.text}</p></div>)}
            </div>
            <button type="button" className={cx("checkline", flow.agreed && "on")} onClick={() => flow.setAgreed(!flow.agreed)} aria-pressed={flow.agreed}>
              <span className="box">{flow.agreed ? "✓" : ""}</span>I've read and agree to these norms
            </button>
            {flow.submitError && <div className="err-note" style={{ marginTop: 10 }}>{flow.submitError}</div>}
            {flow.upload && <div className="you-note" style={{ marginTop: 12 }}>Submitting: {flow.upload.original_name} · {fmtTime(flow.upload.duration_s)} · {flow.places.length} place{flow.places.length === 1 ? "" : "s"}</div>}
          </div>
          <div className="ph-footer"><button type="button" className="wbtn gold wide" disabled={!flow.canSubmit} onClick={() => void flow.submit()}>{flow.submitting ? "Submitting…" : "Submit my story"}</button></div>
        </>
      )}

      {/* CONFIRMATION */}
      {step === 7 && (
        <>
          <div className="ph-content"><Confirmation flow={flow} onBack={() => nav("/")} compact /></div>
          <div className="ph-footer"><button type="button" className="wbtn ghost wide" onClick={() => nav("/")}>Back to the map</button></div>
        </>
      )}
    </div>
  );
}
