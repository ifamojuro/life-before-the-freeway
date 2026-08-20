"""Staff-only moderation API: queue, detail + location tagging, decisions, field capture, staff, audit log."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_staff, issue_token, verify_password
from ..config import ERA_KEYS
from ..db import get_db
from ..models import AuditEntry, Location, Prompt, Staff, Story, Submission, Upload
from ..schemas import (Association, AssociationsIn, AuditOut, DecisionIn, FieldCaptureIn, LoginIn, LoginOut, PublishedStory,
                       QueueOut, StaffOut, SubmissionCard, SubmissionCreated, SubmissionDetail)
from ..services.places import extract_places

router = APIRouter(prefix="/api/admin", tags=["admin"])

ERA_LABEL = {"1950": "~1950 · before", "1965": "1965 · the takings", "1985": "1985 · after"}
AVATAR_COLORS = ["#1D9E75", "#185FA5", "#7A5AA8", "#8A6D3B", "#B4231F", "#0F7B6C"]


def _staff_out(s: Staff) -> StaffOut:
    return StaffOut(id=s.id, name=s.name, email=s.email, role=s.role, color=s.color, active=s.active)


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    staff = db.execute(select(Staff).where(func.lower(Staff.email) == body.email.strip().lower())).scalar_one_or_none()
    if not staff or not staff.active or not verify_password(body.password, staff.password_hash):
        raise HTTPException(401, "Email or password didn't match")
    staff.token = issue_token()
    db.commit()
    return LoginOut(token=staff.token, staff=_staff_out(staff))


@router.post("/logout", status_code=204)
def logout(staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    staff.token = None
    db.commit()


@router.get("/me", response_model=StaffOut)
def me(staff: Staff = Depends(current_staff)):
    return _staff_out(staff)


def _card(s: Submission, names: dict[int, str]) -> SubmissionCard:
    return SubmissionCard(
        id=s.id, primary_label=s.primary_label or "Untagged location", contributor_name=s.contributor_name, source=s.source,
        method=s.method, video_url=s.video_url, duration_s=s.duration_s, flag_count=len(s.flagged_terms or []),
        status=s.status, created_at=s.created_at, reviewed_at=s.reviewed_at,
        reviewer_name=names.get(s.reviewed_by_id) if s.reviewed_by_id else None,
    )


def _counts(db: Session) -> dict[str, int]:
    rows = db.execute(select(Submission.status, Submission.flagged_terms).where(Submission.source == "public")).all()
    c = {"pending": 0, "flagged": 0, "approved": 0, "rejected": 0}
    for status, flags in rows:
        c[status] = c.get(status, 0) + 1
        if status == "pending" and flags:
            c["flagged"] += 1
    return c


@router.get("/submissions", response_model=QueueOut)
def queue(
    status: str = Query("pending"),
    q: str = Query(""),
    sort: str = Query("oldest"),
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    stmt = select(Submission).where(Submission.source == "public")
    if status == "flagged":
        stmt = stmt.where(Submission.status == "pending")
    elif status in ("pending", "approved", "rejected"):
        stmt = stmt.where(Submission.status == status)
    stmt = stmt.order_by(Submission.created_at.asc() if sort == "oldest" else Submission.created_at.desc())
    subs = db.execute(stmt).scalars().all()
    if status == "flagged":
        subs = [s for s in subs if s.flagged_terms]
    if q:
        ql = q.lower()
        subs = [s for s in subs if ql in (s.primary_label or "").lower() or ql in s.contributor_name.lower()]
    names = {s.id: s.name for s in db.execute(select(Staff)).scalars()}
    return QueueOut(counts=_counts(db), items=[_card(s, names) for s in subs])


def _detail(db: Session, s: Submission) -> SubmissionDetail:
    names = {x.id: x.name for x in db.execute(select(Staff)).scalars()}
    pending_ids = [r for (r,) in db.execute(
        select(Submission.id).where(Submission.status == "pending", Submission.source == "public").order_by(Submission.created_at.asc())
    ).all()]
    prev_id = next_id = None
    if s.id in pending_ids:
        i = pending_ids.index(s.id)
        prev_id = pending_ids[i - 1] if i > 0 else None
        next_id = pending_ids[i + 1] if i + 1 < len(pending_ids) else None
    return SubmissionDetail(
        id=s.id, primary_label=s.primary_label or "Untagged location", contributor_name=s.contributor_name,
        contributor_email=s.contributor_email, contributor_detail=s.contributor_detail, prompt_text=s.prompt_text,
        source=s.source, method=s.method, video_url=s.video_url, duration_s=s.duration_s, transcript=s.transcript,
        segments=s.segments or [], flagged_terms=s.flagged_terms or [], eras=s.eras or [], places=s.places or [],
        associations=[Association(**a) for a in (s.associations or [])], status=s.status, created_at=s.created_at,
        reviewed_at=s.reviewed_at, reviewer_name=names.get(s.reviewed_by_id) if s.reviewed_by_id else None,
        reject_reason=s.reject_reason or "", prev_id=prev_id, next_id=next_id,
    )


@router.get("/submissions/{sid}", response_model=SubmissionDetail)
def submission_detail(sid: int, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Submission not found")
    return _detail(db, s)


def _validate_assocs(assocs: list[Association], duration: float) -> list[dict]:
    out = []
    for a in assocs:
        if a.end_s <= a.start_s:
            raise HTTPException(400, "A span must end after it starts")
        if a.era and a.era not in ERA_KEYS:
            raise HTTPException(400, f"Unknown era {a.era}")
        d = a.model_dump()
        d["start_s"] = max(0.0, round(a.start_s, 1))
        d["end_s"] = round(min(a.end_s, duration) if duration else a.end_s, 1)
        out.append(d)
    return out


@router.put("/submissions/{sid}/associations", response_model=SubmissionDetail)
def save_associations(sid: int, body: AssociationsIn, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Submission not found")
    s.associations = _validate_assocs(body.associations, s.duration_s)
    db.commit()
    return _detail(db, s)


def _resolve_location(db: Session, *, location_id: int | None, name: str, sub: str, lat: float | None, lng: float | None,
                      eras: list[str]) -> Location | None:
    if location_id:
        loc = db.get(Location, location_id)
        if loc:
            for e in eras:
                if e not in (loc.eras or []):
                    loc.eras = [*(loc.eras or []), e]
            return loc
    if not name and lat is None:
        return None
    if lat is None or lng is None:
        return None
    loc = Location(name=name or sub or "Untitled place", cross_street=sub or "", lat=lat, lng=lng, eras=list(eras) or ["1950"])
    db.add(loc)
    db.flush()
    return loc


def _initials(name: str) -> str:
    parts = [p for p in name.replace(".", "").split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "??"


def _publish(db: Session, s: Submission, assocs: list[dict], *, source: str) -> list[Story]:
    """Create one Story (perspective) per location association. If the reviewer
    tagged nothing, fall back to one whole-video story per contributor-tagged place."""
    created: list[Story] = []
    color = AVATAR_COLORS[s.id % len(AVATAR_COLORS)]
    targets: list[tuple[Location, float | None, float | None, str]] = []
    if assocs:
        for a in assocs:
            loc = _resolve_location(db, location_id=a.get("location_id"), name=a.get("name", ""), sub=a.get("sub", ""),
                                    lat=a.get("lat"), lng=a.get("lng"), eras=[a["era"]] if a.get("era") else s.eras or [])
            if loc:
                targets.append((loc, a["start_s"], a["end_s"], a.get("era") or (s.eras or ["1950"])[0]))
    if not targets:
        for p in s.places or []:
            loc = _resolve_location(db, location_id=p.get("location_id"), name=p.get("name", ""), sub="", lat=p.get("lat"),
                                    lng=p.get("lng"), eras=s.eras or [])
            if loc:
                targets.append((loc, None, None, (s.eras or ["1950"])[0]))
    if not targets:
        raise HTTPException(400, "Tag at least one mappable location before publishing")
    caption = (s.transcript or "").strip()
    if len(caption) > 200:
        caption = caption[:199].rstrip() + "…"
    for loc, start, end, era in targets:
        st = Story(
            location_id=loc.id, submission_id=s.id, contributor_name=s.contributor_name,
            contributor_detail=s.contributor_detail, initials=_initials(s.contributor_name), avatar_color=color,
            video_url=s.video_url, start_s=start, end_s=end, duration_s=(end - start) if start is not None and end is not None else s.duration_s,
            caption=_span_text(s, start, end) or caption, transcript=s.transcript, era=era, era_label=ERA_LABEL.get(era, era),
            source=source,
        )
        db.add(st)
        created.append(st)
    return created


def _span_text(s: Submission, start: float | None, end: float | None) -> str:
    if start is None or end is None:
        return ""
    parts = [seg["text"] for seg in (s.segments or []) if seg["end"] > start and seg["start"] < end]
    txt = " ".join(parts).strip()
    return txt if len(txt) <= 200 else txt[:199].rstrip() + "…"


@router.post("/submissions/{sid}/approve", response_model=SubmissionDetail)
def approve(sid: int, body: DecisionIn, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Submission not found")
    if s.status != "pending":
        raise HTTPException(409, f"Already {s.status}")
    if body.associations is not None:
        s.associations = _validate_assocs(body.associations, s.duration_s)
    stories = _publish(db, s, s.associations or [], source="public")
    s.status = "approved"
    s.reviewed_at = datetime.now(timezone.utc)
    s.reviewed_by_id = staff.id
    db.add(AuditEntry(submission_id=s.id, submission_label=s.primary_label, action="approved", reviewer_id=staff.id,
                      reviewer_name=staff.name, detail=f"{len(stories)} location tag(s) published"))
    db.commit()
    return _detail(db, s)


@router.post("/submissions/{sid}/reject", response_model=SubmissionDetail)
def reject(sid: int, body: DecisionIn, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    s = db.get(Submission, sid)
    if not s:
        raise HTTPException(404, "Submission not found")
    if s.status != "pending":
        raise HTTPException(409, f"Already {s.status}")
    if body.associations is not None:
        s.associations = _validate_assocs(body.associations, s.duration_s)
    s.status = "rejected"
    s.reject_reason = body.reason or ""
    s.reviewed_at = datetime.now(timezone.utc)
    s.reviewed_by_id = staff.id
    db.add(AuditEntry(submission_id=s.id, submission_label=s.primary_label, action="rejected", reviewer_id=staff.id,
                      reviewer_name=staff.name, detail=body.reason or ""))
    db.commit()
    return _detail(db, s)


@router.post("/field-capture", response_model=SubmissionCreated, status_code=201)
def field_capture(body: FieldCaptureIn, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    """Staff-recorded interview: publishes straight to the map, logged to the audit trail."""
    up = db.get(Upload, body.upload_id)
    if not up:
        raise HTTPException(404, "Upload not found")
    prompt = db.get(Prompt, body.prompt_id) if body.prompt_id else None
    places = [p.model_dump() for p in body.places] or extract_places(db, up.transcript)
    s = Submission(
        upload_id=up.id, contributor_name=body.contributor_name.strip(), contributor_detail=body.contributor_detail.strip(),
        prompt_id=prompt.id if prompt else None, prompt_text=prompt.text if prompt else "", source="field", method=up.method,
        video_url=up.video_url, duration_s=up.duration_s, transcript=up.transcript, segments=up.segments,
        flagged_terms=up.flagged_terms, eras=body.eras or ["1950"], places=places,
        primary_label=(places[0]["name"] if places else f"Field capture — {body.contributor_name}"), status="approved",
        agreed_norms=True, reviewed_at=datetime.now(timezone.utc), reviewed_by_id=staff.id,
    )
    db.add(s)
    db.flush()
    s.associations = _validate_assocs(body.associations, s.duration_s)
    stories = _publish(db, s, s.associations, source="field")
    db.add(AuditEntry(submission_id=s.id, submission_label=f"Field capture — {body.contributor_name} interview",
                      action="published_field", reviewer_id=staff.id, reviewer_name=staff.name,
                      detail=f"{len(stories)} location tag(s) published directly"))
    db.commit()
    return SubmissionCreated(id=s.id, status="approved", message="Published to the map (staff-vouched, no moderation step).")


@router.get("/stories", response_model=list[PublishedStory])
def published(staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    rows = db.execute(select(Story, Location).join(Location, Story.location_id == Location.id).order_by(Story.published_at.desc())).all()
    return [PublishedStory(id=s.id, location_id=l.id, location_name=l.name, cross_street=l.cross_street,
                           contributor_name=s.contributor_name, era_label=s.era_label, source=s.source, video_url=s.video_url,
                           duration_s=s.duration_s, published_at=s.published_at) for s, l in rows]


@router.delete("/stories/{story_id}", status_code=204)
def unpublish(story_id: int, staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    st = db.get(Story, story_id)
    if not st:
        raise HTTPException(404, "Story not found")
    db.add(AuditEntry(submission_id=st.submission_id, submission_label=f"{st.location.name} — {st.contributor_name}",
                      action="unpublished", reviewer_id=staff.id, reviewer_name=staff.name))
    db.delete(st)
    db.commit()


@router.get("/audit", response_model=list[AuditOut])
def audit(limit: int = Query(50, le=500), staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    rows = db.execute(select(AuditEntry).order_by(AuditEntry.at.desc()).limit(limit)).scalars().all()
    return [AuditOut.model_validate(r, from_attributes=True) for r in rows]


@router.get("/staff", response_model=list[StaffOut])
def staff_list(staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    return [_staff_out(s) for s in db.execute(select(Staff).order_by(Staff.id)).scalars()]


@router.get("/locations")
def admin_locations(staff: Staff = Depends(current_staff), db: Session = Depends(get_db)):
    """Full gazetteer (including places with no published stories yet) for the tagging search box."""
    return [{"id": l.id, "name": l.name, "cross_street": l.cross_street, "lat": l.lat, "lng": l.lng, "eras": l.eras or []}
            for l in db.execute(select(Location).order_by(Location.name)).scalars()]
