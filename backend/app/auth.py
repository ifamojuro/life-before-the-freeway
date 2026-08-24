"""Token auth for the staff-only admin API.

Deliberately small: passwords are salted SHA-256 (swap for bcrypt/argon2 in
production), sessions are opaque bearer tokens stored on the Staff row.
"""
from __future__ import annotations

import hashlib
import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Staff


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return secrets.compare_digest(hash_password(password, salt), stored)


def issue_token() -> str:
    return secrets.token_urlsafe(32)


def current_staff(
    x_staff_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Staff:
    # Prefer the dedicated X-Staff-Token header. The Authorization header can't
    # be used for the staff token when the site sits behind the optional
    # HTTP Basic gate (LBTF_SITE_PASSWORD) — the browser owns Authorization for
    # Basic, so a `Bearer` there would collide with (and be overwritten by) it.
    # Bearer is still accepted as a fallback (tests, curl, ungated deployments).
    token = (x_staff_token or "").strip()
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Staff login required")
    staff = db.execute(select(Staff).where(Staff.token == token, Staff.active.is_(True))).scalar_one_or_none()
    if not staff:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired — sign in again")
    return staff


def require_super_admin(staff: Staff = Depends(current_staff)) -> Staff:
    if staff.role != "super-admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super-admin only")
    return staff
