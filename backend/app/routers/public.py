"""Public, unauthenticated API: map pins, story pages, comments, prompts, chat."""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import ERAS
from ..db import get_db
from ..models import Comment, Location, Prompt, Story
from ..schemas import (ChatIn, ChatOut, Citation, CommentIn, CommentOut, EraOut, LocationDetail, LocationPin,
                       PromptOut, StoryOut)
from ..services import rag

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/eras", response_model=list[EraOut])
def eras():
    return ERAS


@router.get("/locations", response_model=list[LocationPin])
def list_locations(era: str | None = Query(default=None), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Story.location_id, func.count(Story.id)).group_by(Story.location_id)).all())
    out = []
    for loc in db.execute(select(Location).order_by(Location.id)).scalars():
        n = counts.get(loc.id, 0)
        if n == 0:
            continue  # pins only exist for places with published stories
        if era and era not in (loc.eras or []):
            continue
        out.append(LocationPin(id=loc.id, name=loc.name, cross_street=loc.cross_street, lat=loc.lat, lng=loc.lng,
                               eras=loc.eras or [], story_count=n))
    return out


def _era_range(eras_: list[str]) -> str:
    if not eras_:
        return ""
    order = [e["key"] for e in ERAS]
    ks = sorted(set(eras_), key=order.index)
    label = {"1950": "~1950", "1965": "1965", "1985": "1985"}
    return label[ks[0]] if len(ks) == 1 else f"{label[ks[0]]}–{label[ks[-1]]}"


@router.get("/locations/{location_id}", response_model=LocationDetail)
def get_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    stories = db.execute(select(Story).where(Story.location_id == loc.id).order_by(Story.published_at)).scalars().all()
    comments = db.execute(select(Comment).where(Comment.location_id == loc.id).order_by(Comment.created_at.desc())).scalars().all()
    return LocationDetail(
        id=loc.id, name=loc.name, cross_street=loc.cross_street, lat=loc.lat, lng=loc.lng, eras=loc.eras or [],
        era_range=_era_range([s.era for s in stories] or loc.eras or []),
        stories=[StoryOut.model_validate(s, from_attributes=True) for s in stories],
        comments=[CommentOut.model_validate(c, from_attributes=True) for c in comments],
    )


@router.post("/locations/{location_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(location_id: int, body: CommentIn, db: Session = Depends(get_db)):
    if not db.get(Location, location_id):
        raise HTTPException(404, "Location not found")
    c = Comment(location_id=location_id, author=body.author.strip(), text=body.text.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return CommentOut.model_validate(c, from_attributes=True)


@router.get("/prompts", response_model=list[PromptOut])
def prompts(db: Session = Depends(get_db)):
    return [PromptOut(id=p.id, text=p.text) for p in db.execute(select(Prompt).where(Prompt.active.is_(True))).scalars()]


@router.get("/prompts/random", response_model=PromptOut)
def random_prompt(exclude: int | None = None, db: Session = Depends(get_db)):
    rows = db.execute(select(Prompt).where(Prompt.active.is_(True))).scalars().all()
    pool = [p for p in rows if p.id != exclude] or rows
    if not pool:
        raise HTTPException(404, "No prompts configured")
    p = random.choice(pool)
    return PromptOut(id=p.id, text=p.text)


@router.post("/chat", response_model=ChatOut)
def chat(body: ChatIn, db: Session = Depends(get_db)):
    text, passages, mode = rag.answer(db, body.question, [h.model_dump() for h in body.history])
    cites = []
    seen = set()
    for p in passages:
        if p.story.id in seen:
            continue
        seen.add(p.story.id)
        cites.append(Citation(
            story_id=p.story.id, location_id=p.location.id, location_name=p.location.name,
            cross_street=p.location.cross_street, contributor_name=p.story.contributor_name,
            era_label=p.story.era_label or p.story.era, excerpt=p.excerpt,
        ))
    return ChatOut(answer=text, citations=cites, mode=mode)
