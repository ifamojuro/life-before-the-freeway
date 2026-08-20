"""Pydantic request/response shapes."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class EraOut(BaseModel):
    key: str
    year: str
    label: str
    detail: str


class LocationPin(BaseModel):
    id: int
    name: str
    cross_street: str
    lat: float
    lng: float
    eras: list[str]
    story_count: int


class StoryOut(BaseModel):
    id: int
    location_id: int
    contributor_name: str
    contributor_detail: str
    initials: str
    avatar_color: str
    video_url: Optional[str]
    start_s: Optional[float]
    end_s: Optional[float]
    duration_s: float
    caption: str
    era: str
    era_label: str
    source: str
    published_at: datetime


class CommentOut(BaseModel):
    id: int
    author: str
    text: str
    created_at: datetime


class CommentIn(BaseModel):
    author: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=2000)


class LocationDetail(BaseModel):
    id: int
    name: str
    cross_street: str
    lat: float
    lng: float
    eras: list[str]
    era_range: str
    stories: list[StoryOut]
    comments: list[CommentOut]


class PromptOut(BaseModel):
    id: int
    text: str


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = []


class Citation(BaseModel):
    story_id: int
    location_id: int
    location_name: str
    cross_street: str
    contributor_name: str
    era_label: str
    excerpt: str


class ChatOut(BaseModel):
    answer: str
    citations: list[Citation]
    mode: Literal["claude", "extractive"]


class DetectedPlace(BaseModel):
    name: str
    source: Literal["transcript", "manual"] = "transcript"
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_id: Optional[int] = None
    confidence: float = 1.0


class UploadOut(BaseModel):
    upload_id: int
    video_url: str
    original_name: str
    size_bytes: int
    duration_s: float
    transcript: str
    segments: list[dict]
    flagged_terms: list[dict]
    detected_places: list[DetectedPlace]


class PlaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    source: Literal["transcript", "manual"] = "manual"
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_id: Optional[int] = None


class SubmissionIn(BaseModel):
    upload_id: int
    prompt_id: Optional[int] = None
    contributor_name: str = Field(min_length=1, max_length=120)
    contributor_email: str = Field(default="", max_length=200)
    contributor_detail: str = Field(default="", max_length=200)
    places: list[PlaceIn] = []
    eras: list[str] = []
    agreed_norms: bool
    own_footage: bool = True


class SubmissionCreated(BaseModel):
    id: int
    status: str
    message: str


# ---- admin ----

class LoginIn(BaseModel):
    email: str
    password: str


class StaffOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    color: str
    active: bool


class LoginOut(BaseModel):
    token: str
    staff: StaffOut


class Association(BaseModel):
    id: Optional[str] = None
    start_s: float
    end_s: float
    location_id: Optional[int] = None
    name: str = ""
    sub: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    era: Optional[str] = None
    color: str = "#0F7B6C"


class SubmissionCard(BaseModel):
    id: int
    primary_label: str
    contributor_name: str
    source: str
    method: str
    video_url: Optional[str]
    duration_s: float
    flag_count: int
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime]
    reviewer_name: Optional[str]


class QueueOut(BaseModel):
    counts: dict[str, int]
    items: list[SubmissionCard]


class SubmissionDetail(BaseModel):
    id: int
    primary_label: str
    contributor_name: str
    contributor_email: str
    contributor_detail: str
    prompt_text: str
    source: str
    method: str
    video_url: Optional[str]
    duration_s: float
    transcript: str
    segments: list[dict]
    flagged_terms: list[dict]
    eras: list[str]
    places: list[dict]
    associations: list[Association]
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime]
    reviewer_name: Optional[str]
    reject_reason: str
    prev_id: Optional[int]
    next_id: Optional[int]


class AssociationsIn(BaseModel):
    associations: list[Association]


class DecisionIn(BaseModel):
    associations: Optional[list[Association]] = None
    reason: str = ""


class AuditOut(BaseModel):
    id: int
    submission_id: Optional[int]
    submission_label: str
    action: str
    reviewer_name: str
    detail: str
    at: datetime


class FieldCaptureIn(BaseModel):
    upload_id: int
    contributor_name: str = Field(min_length=1, max_length=120)
    contributor_detail: str = ""
    prompt_id: Optional[int] = None
    places: list[PlaceIn] = []
    eras: list[str] = []
    associations: list[Association] = []


class PublishedStory(BaseModel):
    id: int
    location_id: int
    location_name: str
    cross_street: str
    contributor_name: str
    era_label: str
    source: str
    video_url: Optional[str]
    duration_s: float
    published_at: datetime
