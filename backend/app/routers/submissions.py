"""Contributor intake: upload/record a clip → transcript + detected places → submit to the queue."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import ERA_KEYS, UPLOAD_DIR
from ..db import get_db
from ..models import Prompt, Submission, Upload
from ..schemas import DetectedPlace, SubmissionCreated, SubmissionIn, UploadOut
from ..services.places import extract_places
from ..services.transcription import transcribe

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

ALLOWED = {"video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/3gpp", "application/octet-stream"}
MAX_BYTES = 250 * 1024 * 1024


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", name)[:80] or "clip"


@router.post("/upload", response_model=UploadOut, status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    method: str = Form("uploaded"),
    duration_s: float | None = Form(None),
    db: Session = Depends(get_db),
):
    if file.content_type and file.content_type not in ALLOWED and not file.content_type.startswith("video/"):
        raise HTTPException(415, "Please upload a video file")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "clip.webm").suffix or ".webm"
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / fname
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, "Video is larger than 250 MB")
            out.write(chunk)

    t = transcribe(dest)
    places = extract_places(db, t.text)
    up = Upload(
        filename=fname, original_name=_safe_name(file.filename or fname), video_url=f"/uploads/{fname}", size_bytes=size,
        duration_s=duration_s or t.duration_s, method=method if method in ("recorded", "uploaded") else "uploaded",
        transcript=t.text, segments=t.segments, flagged_terms=t.flagged_terms, detected_places=places,
    )
    db.add(up)
    db.commit()
    db.refresh(up)
    return UploadOut(
        upload_id=up.id, video_url=up.video_url, original_name=up.original_name, size_bytes=up.size_bytes,
        duration_s=up.duration_s, transcript=up.transcript, segments=up.segments, flagged_terms=up.flagged_terms,
        detected_places=[DetectedPlace(**p) for p in places],
    )


@router.post("", response_model=SubmissionCreated, status_code=201)
def create_submission(body: SubmissionIn, db: Session = Depends(get_db)):
    up = db.get(Upload, body.upload_id)
    if not up:
        raise HTTPException(404, "Upload not found — please record or upload your video again")
    if not body.agreed_norms:
        raise HTTPException(400, "Please agree to the community norms before submitting")
    bad = [e for e in body.eras if e not in ERA_KEYS]
    if bad:
        raise HTTPException(400, f"Unknown era: {bad[0]}")
    prompt = db.get(Prompt, body.prompt_id) if body.prompt_id else None
    places = [p.model_dump() for p in body.places]
    label = places[0]["name"] if places else "Untagged location"
    sub = Submission(
        upload_id=up.id, contributor_name=body.contributor_name.strip(), contributor_email=body.contributor_email.strip(),
        contributor_detail=body.contributor_detail.strip(), prompt_id=prompt.id if prompt else None,
        prompt_text=prompt.text if prompt else "", source="public", method=up.method, video_url=up.video_url,
        duration_s=up.duration_s, transcript=up.transcript, segments=up.segments, flagged_terms=up.flagged_terms,
        eras=body.eras, places=places, primary_label=label, status="pending", agreed_norms=True,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubmissionCreated(id=sub.id, status=sub.status,
                             message="In the review queue · not published yet. We'll notify you once it's live.")
