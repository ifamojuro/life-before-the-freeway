/**
 * In-browser selfie recorder (~30s). Uses getUserMedia + MediaRecorder; the
 * resulting Blob is handed back to the caller for upload. Falls back to a
 * helpful message when the camera is unavailable (non-HTTPS, denied, etc).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtTime, cx } from "../lib/util";

export const MAX_SECONDS = 30;

export interface Recording {
  blob: Blob;
  url: string;
  durationS: number;
  mimeType: string;
}

export function useRecorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);
  const [state, setState] = useState<"idle" | "ready" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (face = facing) => {
    setError(null);
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser can't record video here. Use “Upload a video” instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setState("ready");
    } catch (e) {
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError" ? "Camera access was denied. Allow camera + microphone, or upload a video instead."
        : name === "NotFoundError" ? "No camera found on this device. Upload a video instead."
        : "Couldn't start the camera. Upload a video instead.",
      );
    }
  }, [facing, stopStream]);

  const begin = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || "video/webm" });
      // Detach the live stream from the preview element before switching to
      // playback: `srcObject` takes precedence over `src`, and if React reuses
      // the DOM node the (now stopped) stream would block the recorded clip.
      if (videoRef.current) videoRef.current.srcObject = null;
      const durationS = Math.min(MAX_SECONDS, (Date.now() - startedAt.current) / 1000);
      setRecording({ blob, url: URL.createObjectURL(blob), durationS, mimeType: blob.type });
      setState("done");
      stopStream();
    };
    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start(250);
    setState("recording");
    timer.current = window.setInterval(() => {
      const s = (Date.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) { window.clearInterval(timer.current); recRef.current?.stop(); }
    }, 200);
  }, [stopStream]);

  const stop = useCallback(() => {
    window.clearInterval(timer.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const retake = useCallback(() => {
    if (recording) URL.revokeObjectURL(recording.url);
    setRecording(null);
    setElapsed(0);
    setState("idle");
    void start();
  }, [recording, start]);

  const flip = useCallback(() => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (state === "ready") void start(next);
  }, [facing, state, start]);

  useEffect(() => () => { window.clearInterval(timer.current); stopStream(); }, [stopStream]);

  return { videoRef, state, elapsed, facing, error, recording, start, begin, stop, retake, flip };
}

export function RecorderView({ rec, compact }: { rec: ReturnType<typeof useRecorder>; compact?: boolean }) {
  const { videoRef, state, elapsed, facing, error, recording } = rec;
  useEffect(() => { if (state === "idle" && !recording) void rec.start(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="rec-frame">
      {state === "done" && recording ? (
        <video key="playback" src={recording.url} controls playsInline className="nomirror" />
      ) : (
        <video key="preview" ref={videoRef} autoPlay playsInline muted className={cx(facing === "environment" && "nomirror")} style={{ display: state === "idle" ? "none" : undefined }} />
      )}
      {state === "idle" && !error && <div className="selfie">front camera<br />starting…</div>}
      {error && <div className="rec-err">{error}</div>}
      <div className={cx("rec-timer", state === "recording" ? "live" : "idle")}>{fmtTime(state === "done" ? recording?.durationS : elapsed)} / {fmtTime(MAX_SECONDS)}</div>
      {!compact && <div className="rec-hint">{state === "done" ? "Looks good? Continue, or retake." : "Hold steady · aim for about 30 seconds"}</div>}
    </div>
  );
}

export function RecorderControls({ rec, compact }: { rec: ReturnType<typeof useRecorder>; compact?: boolean }) {
  const { state } = rec;
  const recording = state === "recording";
  return (
    <div className={compact ? "ctl" : "rec-ctrls"} style={compact ? { display: "flex", gap: 16, alignItems: "center", justifyContent: "center", marginTop: 14 } : undefined}>
      <button type="button" className="rec-btn" onClick={rec.retake} disabled={state !== "done"} aria-label="Retake"><span className="cir">↺</span>{!compact && "Retake"}</button>
      <button
        type="button"
        className={cx("rec-btn main", recording && "recording")}
        onClick={() => (recording ? rec.stop() : rec.begin())}
        disabled={state !== "ready" && state !== "recording"}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        <span className="cir"><b /></span>{!compact && (recording ? "Stop" : state === "done" ? "Done" : "Record")}
      </button>
      <button type="button" className="rec-btn" onClick={rec.flip} disabled={state === "recording" || state === "done"} aria-label="Flip camera"><span className="cir">⤢</span>{!compact && "Flip"}</button>
    </div>
  );
}
