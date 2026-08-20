"""Auto-transcription + language flagging.

Every submission is transcribed and scanned for flagged terms before a
moderator sees it. The default backend is a deterministic *mock* so the full
contributor → moderation flow runs offline; set LBTF_TRANSCRIBER=whisper and
install `openai-whisper` to transcribe for real. Either way the output shape is
identical: a list of timed segments + a list of flagged terms with timestamps.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

from ..config import TRANSCRIBER

# Small, explicit list — moderation is human; this only raises a badge.
FLAG_TERMS = {"damn", "hell", "shit", "bitch", "ass", "bastard", "crap", "piss"}

# Canned transcripts used by the mock backend. They deliberately mention places
# that exist in the seed gazetteer so place-extraction has something to find.
MOCK_TRANSCRIPTS = [
    [
        (0.0, 6.5, "Well, we lived on Wood Street, two doors down from 7th,"),
        (6.5, 13.0, "and on Friday nights you could hear the horns from Slim Jenkins' clear from our porch."),
        (13.0, 21.0, "We'd walk down 7th, past the record store, all the way to where the three banks were on Chestnut."),
        (21.0, 28.0, "My daddy called it the busiest damn corner in Oakland. Then the freeway came and took the whole block."),
        (28.0, 34.0, "After that we'd go up to DeFremery Park on Sundays. It was never the same."),
    ],
    [
        (0.0, 7.0, "The best thing about being here was everybody knew you. On Union Street the neighbors looked out for each other."),
        (7.0, 15.0, "There was a bakery near Chestnut and 8th, and the church on Peralta had a choir you could hear a block away."),
        (15.0, 23.0, "When they started buying up the houses in '65 it felt like a giant scar opening up down the middle of us."),
        (23.0, 30.0, "I still drive past 7th and Wood sometimes. There's nothing there now, but I see it all."),
    ],
    [
        (0.0, 8.0, "I delivered groceries on 7th Street as a teenager — every shop, every bar, I knew the back door."),
        (8.0, 16.0, "Folks call Slim Jenkins' a supper club but by my time it was more of a pool hall, depends who you ask."),
        (16.0, 25.0, "The bank block at 7th and Chestnut, that was the money corner. Three banks in a row."),
        (25.0, 31.0, "Wood and 5th was where my cousins stayed until the takings. Then everybody scattered."),
    ],
]


@dataclass
class Transcript:
    text: str
    segments: list[dict] = field(default_factory=list)
    duration_s: float = 0.0
    flagged_terms: list[dict] = field(default_factory=list)


def _mock_transcribe(path: Path) -> Transcript:
    # Deterministic choice so re-uploading the same file yields the same text.
    h = hashlib.sha1(path.name.encode()).hexdigest()
    rows = MOCK_TRANSCRIPTS[int(h[:2], 16) % len(MOCK_TRANSCRIPTS)]
    segments = [{"start": s, "end": e, "text": t} for s, e, t in rows]
    text = " ".join(t for _, _, t in rows)
    return Transcript(text=text, segments=segments, duration_s=rows[-1][1])


def _whisper_transcribe(path: Path) -> Transcript:
    import whisper  # type: ignore  # optional dependency

    model = whisper.load_model("base")
    result = model.transcribe(str(path))
    segments = [
        {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
        for s in result.get("segments", [])
    ]
    duration = segments[-1]["end"] if segments else 0.0
    return Transcript(text=result.get("text", "").strip(), segments=segments, duration_s=duration)


def flag_terms(segments: list[dict]) -> list[dict]:
    flags: list[dict] = []
    for seg in segments:
        words = re.findall(r"[A-Za-z']+", seg["text"])
        for i, w in enumerate(words):
            if w.lower() in FLAG_TERMS:
                # Approximate the timestamp by word position within the segment.
                frac = i / max(len(words), 1)
                at = seg["start"] + frac * (seg["end"] - seg["start"])
                ctx = " ".join(words[max(0, i - 4): i + 5])
                flags.append({"term": w, "at_s": round(at, 1), "context": ctx})
    return flags


def transcribe(path: Path) -> Transcript:
    if TRANSCRIBER == "whisper":
        try:
            t = _whisper_transcribe(path)
        except Exception:  # pragma: no cover - depends on optional dependency
            t = _mock_transcribe(path)
    else:
        t = _mock_transcribe(path)
    t.flagged_terms = flag_terms(t.segments)
    return t


def format_ts(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"
