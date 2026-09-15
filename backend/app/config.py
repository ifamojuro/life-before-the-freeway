"""Runtime configuration for the Life Before the Freeway API."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# LBTF_ENV_FILE=path loads a profile (e.g. backend/.env.staging) before any
# setting is read, for tools that don't go through uvicorn's --env-file
# (alembic, scripts). Parsed by python-dotenv, never the shell, so connection
# strings containing & or ? need no quoting. Existing variables win.
_ENV_FILE = os.environ.get("LBTF_ENV_FILE")
if _ENV_FILE:
    if not Path(_ENV_FILE).is_file():
        sys.exit(f"LBTF_ENV_FILE={_ENV_FILE!r} does not exist")
    load_dotenv(_ENV_FILE, override=False)
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
# Migrations may use a different URL: Neon hands out a pooled string (PgBouncer,
# for the app) and a direct one (for DDL). Unset = same as the app.
MIGRATE_DATABASE_URL = _normalise_db_url(os.environ.get("LBTF_MIGRATE_DATABASE_URL") or "") or DATABASE_URL

# What to seed on startup:
#   base    prompts + the first admin account (LBTF_ADMIN_EMAIL / _PASSWORD).
#           Every environment needs these; nothing else. Staging runs this.
#   sample  base + the wireframe's sample archive (fake locations, stories,
#           queue, comments, staff). Local dev and the test suite.
#   none    touch nothing (e.g. after restoring a dump).
# Default depends on the database: sample data belongs in a disposable SQLite
# file, so a Postgres URL with no explicit mode gets "base" — a forgotten
# setting can't put fake stories in a real database.
SEED_MODES = ("base", "sample", "none")
SEED = os.environ.get("LBTF_SEED") or ("sample" if IS_SQLITE else "base")
ADMIN_EMAIL = os.environ.get("LBTF_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("LBTF_ADMIN_PASSWORD", "")
ADMIN_NAME = os.environ.get("LBTF_ADMIN_NAME", "Admin")

SITE_PASSWORD = os.environ.get("LBTF_SITE_PASSWORD", "")

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


def validate() -> list[str]:
    """Return the problems with the current configuration (empty = fine).

    Each mode that needs extra settings declares them here, so a deploy with an
    incomplete environment fails at startup with a list, not at first use.
    """
    problems: list[str] = []
    if SEED not in SEED_MODES:
        problems.append(f"LBTF_SEED={SEED!r} is not one of {', '.join(SEED_MODES)}")
    if SEED == "base":
        if not ADMIN_EMAIL:
            problems.append("LBTF_ADMIN_EMAIL is required when LBTF_SEED=base")
        if not ADMIN_PASSWORD:
            problems.append("LBTF_ADMIN_PASSWORD is required when LBTF_SEED=base")
    if TRANSCRIBER not in ("mock", "whisper"):
        problems.append(f"LBTF_TRANSCRIBER={TRANSCRIBER!r} is not mock or whisper")
    return problems


def validate_or_exit() -> None:
    problems = validate()
    if problems:
        sys.exit("Refusing to start. Missing or invalid settings:\n  " + "\n  ".join(problems))


def describe() -> str:
    """One line for the startup log: enough to spot a misconfigured deploy."""
    host = "sqlite" if IS_SQLITE else (urlparse(DATABASE_URL).hostname or "?")
    return (
        f"config: db={host} seed={SEED} transcriber={TRANSCRIBER} "
        f"gate={'on' if SITE_PASSWORD else 'OFF'} uploads={UPLOAD_DIR}"
    )
