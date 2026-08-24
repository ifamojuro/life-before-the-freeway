"""Life Before the Freeway — API entrypoint.

Run:  uvicorn app.main:app --reload --port 8000   (from backend/)
"""
from __future__ import annotations

import base64
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, CORS_ORIGINS, UPLOAD_DIR
from .db import Base, SessionLocal, engine
from .routers import admin, public, submissions
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Life Before the Freeway API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def _basic_auth_password(header: str) -> str | None:
    """Extract the password from an HTTP Basic `Authorization` header, or None."""
    if not header.startswith("Basic "):
        return None
    try:
        decoded = base64.b64decode(header[6:]).decode("utf-8", "ignore")
    except (ValueError, base64.binascii.Error):
        return None
    # Browsers send "user:password"; accept any username, compare the password.
    return decoded.split(":", 1)[1] if ":" in decoded else decoded


@app.middleware("http")
async def site_password_gate(request: Request, call_next):
    """Optional shared-password gate for the WHOLE site (SPA + API + /uploads).

    Active only when the LBTF_SITE_PASSWORD env var is set. Local dev and the
    test suite don't set it, so they're unaffected — its absence is the off
    switch (no DEBUG/ENV flag to keep in sync). Used to keep the hosted preview
    instance private during usability testing; browsers show their native login
    dialog on the 401. `/api/health` stays open so uptime/health checks work.

    Fails OPEN: if the var is unset the site is public, so after deploying,
    confirm the password prompt actually appears.
    """
    password = os.environ.get("LBTF_SITE_PASSWORD")
    if password and request.url.path != "/api/health":
        supplied = _basic_auth_password(request.headers.get("authorization", ""))
        if supplied is None or not secrets.compare_digest(supplied, password):
            return Response(
                status_code=401,
                headers={"WWW-Authenticate": 'Basic realm="Life Before the Freeway - preview"'},
            )
    return await call_next(request)

app.include_router(public.router)
app.include_router(submissions.router)
app.include_router(admin.router)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/health")
def health():
    return {"ok": True}


# In production we serve the built SPA from this same origin (matching the Vite
# dev proxy's "one origin in prod" assumption). The block is skipped when there
# is no build — so local dev (Vite serves the frontend) and the test suite are
# unaffected. Registered last, so /api/* and /uploads/* above take precedence.
SPA_DIST = BASE_DIR.parent / "frontend" / "dist"
if SPA_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(SPA_DIST / "assets")), name="spa-assets")

    @app.get("/{full_path:path}")
    async def spa_shell(full_path: str):
        candidate = SPA_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(SPA_DIST / "index.html")  # client-side route → SPA shell
