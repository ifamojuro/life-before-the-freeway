import { useRef, useState, type DragEvent } from "react";
import { fmtBytes, fmtTime, cx } from "../lib/util";

export interface PickedFile {
  file: File;
  url: string;
  durationS: number;
}

export async function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(v.src); resolve(isFinite(d) ? d : 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export function UploadPicker({ picked, onPick, onClear, ownFootage, setOwnFootage }: {
  picked: PickedFile | null;
  onPick: (p: PickedFile) => void;
  onClear: () => void;
  ownFootage: boolean;
  setOwnFootage: (v: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v|3gp)$/i.test(f.name)) { alert("Please choose a video file."); return; }
    const durationS = await probeDuration(f);
    onPick({ file: f, url: URL.createObjectURL(f), durationS });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files?.[0]); };

  if (picked) {
    const ext = (picked.file.name.split(".").pop() || "video").toUpperCase().slice(0, 4);
    return (
      <div className="upload-selected">
        <div className="up-preview">
          <video src={picked.url} controls playsInline />
          <span className="dur">{fmtTime(picked.durationS)}</span>
        </div>
        <div className="up-filerow">
          <span className="fico">{ext}</span>
          <span className="fmeta"><b>{picked.file.name}</b><span>{fmtTime(picked.durationS)} · {fmtBytes(picked.file.size)}</span></span>
          <button type="button" className="fx" onClick={onClear} aria-label="Remove video">✕</button>
        </div>
        <button type="button" className={cx("checkline muted", ownFootage && "on")} onClick={() => setOwnFootage(!ownFootage)} aria-pressed={ownFootage}>
          <span className="box">{ownFootage ? "✓" : ""}</span>
          This is my own footage and the people in it agreed to share it.
        </button>
      </div>
    );
  }
  return (
    <div
      className={cx("upload-drop", over && "over")}
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
    >
      <div className="uic">⇪</div>
      <h5>Choose a video</h5>
      <p>Pick a clip from your phone or computer. Vertical and about 30 seconds works best.</p>
      <div className="req">MP4 · MOV · WEBM<br />up to 250 MB</div>
      <input ref={input} type="file" accept="video/*" capture={undefined} hidden onChange={(e) => void handle(e.target.files?.[0])} />
    </div>
  );
}
