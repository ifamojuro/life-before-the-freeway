"""Runtime configuration for the Life Before the Freeway API."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.environ.get("LBTF_UPLOAD_DIR", BASE_DIR / "uploads"))


def _normalise_db_url(url: str) -> str:
    """Accept the URL forms hosted Postgres providers hand out and pin the driver.

    Neon/Render/Heroku-style URLs start with ``postgres://`` or ``postgresql://``;
    SQLAlchemy needs ``postgresql+psycopg://`` to pick psycopg 3 (the driver we
    ship) rather than defaulting to psycopg2. SQLite URLs pass through untouched.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _normalise_db_url(os.environ.get("LBTF_DATABASE_URL", f"sqlite:///{BASE_DIR / 'lbtf.db'}"))
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# RAG chat: when an Anthropic credential is available the answer is composed by
# Claude, constrained to the retrieved interview excerpts. Otherwise an
# extractive answer is assembled from the same excerpts. Set LBTF_USE_CLAUDE=0
# to force the extractive path even when a key is present.
USE_CLAUDE = os.environ.get("LBTF_USE_CLAUDE", "auto")
CLAUDE_MODEL = os.environ.get("LBTF_CLAUDE_MODEL", "claude-opus-5")

# Transcription backend: "mock" (default, deterministic canned transcript so the
# full flow is exercisable offline) or "whisper" (requires `openai-whisper`).
TRANSCRIBER = os.environ.get("LBTF_TRANSCRIBER", "mock")

# Comma-separated list of allowed CORS origins for the Vite dev server.
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "LBTF_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]

ERAS = [
    {"key": "1950", "year": "~1950", "label": "Before the freeway", "detail": "The full pre-freeway neighborhood."},
    {"key": "1965", "year": "1965", "label": "The takings", "detail": "Homes cleared — “a giant scar.”"},
    {"key": "1985", "year": "1985", "label": "Freeway opens / today", "detail": "The neighborhood after I-980."},
]
ERA_KEYS = [e["key"] for e in ERAS]
