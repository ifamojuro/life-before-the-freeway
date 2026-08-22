/**
 * Regression test for the "recorded video won't play back" bug (PR #2).
 *
 * RecorderView renders a live-preview <video> while recording and a playback
 * <video src=blob:…> once done. Both sat at the same position in the tree, so
 * React reused the DOM node — and the camera MediaStream left on `srcObject`
 * (a DOM property React doesn't manage) shadowed the blob `src`, because
 * `srcObject` takes precedence. Result: readyState 0, play() never resolved.
 *
 * jsdom has no camera or MediaRecorder, so both are stubbed just enough to
 * drive the hook through start → record → stop → retake.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecorderControls, RecorderView, useRecorder } from "./Recorder";

// ---- stubs -----------------------------------------------------------------

function fakeStream(): MediaStream {
  const tracks = [{ kind: "video", readyState: "live", stop() { this.readyState = "ended"; } }, { kind: "audio", readyState: "live", stop() { this.readyState = "ended"; } }];
  return { getTracks: () => tracks } as unknown as MediaStream;
}

type RecorderHandlers = { ondataavailable: ((ev: { data: Blob }) => void) | null; onstop: (() => void) | null };

class FakeMediaRecorder implements RecorderHandlers {
  static isTypeSupported = () => true;
  static instances: FakeMediaRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  mimeType = "video/webm";
  ondataavailable: RecorderHandlers["ondataavailable"] = null;
  onstop: RecorderHandlers["onstop"] = null;
  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: "video/webm" }) });
    this.onstop?.();
  }
}

function Harness() {
  const rec = useRecorder();
  return (
    <>
      <RecorderView rec={rec} />
      <RecorderControls rec={rec} />
    </>
  );
}

const video = () => document.querySelector<HTMLVideoElement>(".rec-frame video")!;

let streams: MediaStream[];

beforeEach(() => {
  streams = [];
  FakeMediaRecorder.instances = [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => { const s = fakeStream(); streams.push(s); return s; }) },
  });
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: vi.fn(() => "blob:test/clip"), revokeObjectURL: vi.fn() }));
  // jsdom's HTMLMediaElement.play() is "not implemented"; make it resolve.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- tests -----------------------------------------------------------------

describe("RecorderView playback after recording", () => {
  it("hands the recorded clip to a fresh <video> with no lingering srcObject", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Camera starts on mount: the preview element is bound to the live stream.
    const startBtn = await screen.findByRole("button", { name: "Start recording" });
    await act(async () => {});
    expect(startBtn).toBeEnabled();
    const preview = video();
    expect(preview.srcObject).toBe(streams[0]);
    expect(preview).not.toHaveAttribute("controls");

    await user.click(startBtn);
    expect(FakeMediaRecorder.instances).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Stop recording" }));

    // The playback element must be a different node, with the blob as its
    // source and *nothing* on srcObject — otherwise the stopped stream wins.
    const playback = video();
    expect(playback).not.toBe(preview);
    expect(playback.srcObject ?? null).toBeNull();
    expect(playback).toHaveAttribute("src", "blob:test/clip");
    expect(playback).toHaveAttribute("controls");
    expect(playback).toHaveClass("nomirror");

    // And the camera was released.
    expect(streams[0].getTracks().every((t) => t.readyState === "ended")).toBe(true);
  });

  it("re-attaches a live stream to a preview element on Retake", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: "Start recording" }));
    await user.click(screen.getByRole("button", { name: "Stop recording" }));
    const playback = video();

    await user.click(screen.getByRole("button", { name: "Retake" }));
    await screen.findByRole("button", { name: "Start recording" });
    await act(async () => {});

    const preview = video();
    expect(preview).not.toBe(playback);
    expect(preview.srcObject).toBe(streams[1]);
    expect(preview).not.toHaveAttribute("src");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test/clip");
  });
});
