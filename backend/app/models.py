"""SQLAlchemy ORM models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Location(Base):
    """A place on the map. Pins are derived from locations with published stories."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    cross_street: Mapped[str] = mapped_column(String(160), default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    eras: Mapped[list] = mapped_column(JSON, default=list)  # ["1950","1965","1985"]
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    stories: Mapped[list["Story"]] = relationship(back_populates="location", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="location", cascade="all, delete-orphan")


class Story(Base):
    """A published clip (or clip span) attached to a location — one 'perspective'."""

    __tablename__ = "stories"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"), nullable=True)
    contributor_name: Mapped[str] = mapped_column(String(120))
    contributor_detail: Mapped[str] = mapped_column(String(200), default="")
    initials: Mapped[str] = mapped_column(String(4), default="")
    avatar_color: Mapped[str] = mapped_column(String(12), default="#1D9E75")
    video_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    start_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_s: Mapped[float] = mapped_column(Float, default=30)
    caption: Mapped[str] = mapped_column(Text, default="")
    transcript: Mapped[str] = mapped_column(Text, default="")
    era: Mapped[str] = mapped_column(String(8), default="1950")
    era_label: Mapped[str] = mapped_column(String(40), default="")
    source: Mapped[str] = mapped_column(String(16), default="public")  # public | field | backfill
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    location: Mapped[Location] = relationship(back_populates="stories")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    author: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    location: Mapped[Location] = relationship(back_populates="comments")


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Upload(Base):
    """A video that has been received + transcribed but not yet attached to a submission."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    original_name: Mapped[str] = mapped_column(String(300), default="")
    video_url: Mapped[str] = mapped_column(String(400))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    duration_s: Mapped[float] = mapped_column(Float, default=0)
    method: Mapped[str] = mapped_column(String(16), default="uploaded")  # recorded | uploaded
    transcript: Mapped[str] = mapped_column(Text, default="")
    segments: Mapped[list] = mapped_column(JSON, default=list)  # [{start,end,text}]
    flagged_terms: Mapped[list] = mapped_column(JSON, default=list)  # [{term,at_s,context}]
    detected_places: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id"), nullable=True)
    contributor_name: Mapped[str] = mapped_column(String(120))
    contributor_email: Mapped[str] = mapped_column(String(200), default="")
    contributor_detail: Mapped[str] = mapped_column(String(200), default="")
    prompt_id: Mapped[int | None] = mapped_column(ForeignKey("prompts.id"), nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(16), default="public")  # public | field
    method: Mapped[str] = mapped_column(String(16), default="recorded")
    video_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    duration_s: Mapped[float] = mapped_column(Float, default=0)
    transcript: Mapped[str] = mapped_column(Text, default="")
    segments: Mapped[list] = mapped_column(JSON, default=list)
    flagged_terms: Mapped[list] = mapped_column(JSON, default=list)
    eras: Mapped[list] = mapped_column(JSON, default=list)
    places: Mapped[list] = mapped_column(JSON, default=list)  # [{name, lat, lng, source, location_id?}]
    # reviewer-authored time-range → location pairings
    associations: Mapped[list] = mapped_column(JSON, default=list)
    primary_label: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|approved|rejected
    agreed_norms: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    reject_reason: Mapped[str] = mapped_column(Text, default="")


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    role: Mapped[str] = mapped_column(String(32), default="intern")  # super-admin | moderator | intern
    password_hash: Mapped[str] = mapped_column(String(200))
    token: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(12), default="#0F7B6C")


class AuditEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"), nullable=True)
    submission_label: Mapped[str] = mapped_column(String(240))
    action: Mapped[str] = mapped_column(String(32))  # approved | rejected | published_field | associations_saved
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), nullable=True)
    reviewer_name: Mapped[str] = mapped_column(String(120))
    detail: Mapped[str] = mapped_column(Text, default="")
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
