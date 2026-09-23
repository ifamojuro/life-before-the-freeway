# Life Before the Freeway — implementation

Implementation of **Concept A** ("warm newsprint archive") from
`Life Before the Freeway - Wireframes.dc.html` (EVOAK! × OpenOakland).

- **frontend/** — React 18 + TypeScript (Vite). Desktop-first, fully responsive;
  when a mobile browser is detected (user agent, or a phone-sized viewport) the
  dedicated mobile flows render instead (map + chat bottom sheet, stepped
  contributor flow). Force a layout with `?layout=mobile` / `?layout=desktop`.
- **backend/** — Python FastAPI + SQLAlchemy (SQLite). Seeds itself with the
  wireframe's sample archive on first start.

## Run it

```bash
# API (port 8000)
cd backend
make dev            # creates the venv + installs deps on first run
# (no make? python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
#           && .venv/bin/uvicorn app.main:app --reload --port 8000)

# Web (port 5173, proxies /api and /uploads to :8000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Admin panel: http://localhost:5173/admin/login —
seeded accounts `randolph@lbtf.org` (super-admin), `maya@lbtf.org`,
`jordan@lbtf.org`, password `admin`.

## Screens (↔ wireframe)

| Wireframe | Route | Notes |
|---|---|---|
| 01 Homepage — map + chat (desktop) | `/` | 60/40 split, 3 era overlays, story pins, RAG chat with citations, first-visit overlay |
| 1·M Mobile — map + chat sheet | `/` (mobile) | segmented era control, draggable bottom sheet, FAB → Leave a Story, centered first-visit card |
| 02 Story pin — playback | `/story/:id` | side-by-side "multiple perspectives", share CTA, reflections thread |
| 03 Leave a Story (mobile, 6 steps) | `/contribute` (mobile) | prompt → record/upload → detected places → map each → eras → norms + details → confirmation |
| 3·D Desktop — page per step | `/contribute` (desktop) | persistent prompt + progress rail, 4 pages |
| 04 Admin — moderation panel | `/admin` | queue tabs (pending/flagged/approved/rejected), search/sort, field-capture callout, audit log |
| 04b Admin — submission detail | `/admin/submissions/:id` | video player, clickable flagged transcript, **timeline span → location tagging** (drag/resize spans, era per span), approve publishes one story per span |

## Environments

| | code | data | how |
|---|---|---|---|
| dev | local | sample archive, SQLite | `make dev` (defaults; nothing to configure) |
| dev-staging | local | **staging** Postgres — real data, writes count | `make dev-staging`, loads `backend/.env.staging` |
| staging | Render | same staging Postgres | Render sources the same file as a Secret File (see `render.yaml`) |

Real stories live in exactly one place (staging). Local work reaches them by
pointing at staging, never by copying. `backend/.env.staging.example` lists
every setting; the app refuses to start if a chosen mode is missing one.

Handoff to another account later: `pg_dump`/restore the database, copy the
bucket, rewrite the video URL prefix in one `UPDATE`, transfer the GitHub repo.

## Database schema changes

The schema is managed by Alembic (`backend/alembic/`). On start the API runs
`upgrade head` itself, so a fresh database, the test suite and the hosted
instance all reach the same schema through the same path; databases created
before Alembic existed are stamped at the baseline first.

To change the schema: edit `app/models.py`, then

```bash
cd backend
make migration M="add instagram_shortcode to stories"   # writes alembic/versions/<date>_<rev>_<slug>.py
make migrate                                            # or just start the app
```

Review the generated file and commit it in the same PR as the model change.
`tests/test_migrations.py` fails if the migrations and the models drift apart.

## How the pieces work

- **RAG chat** (`backend/app/services/rag.py`): BM25-style retrieval over the
  published story transcripts. The answer is composed **only from the retrieved
  excerpts** by, in order: an open-weight model at `LBTF_LLM_BASE_URL` (any
  OpenAI-compatible server, e.g. Ollama, run on infrastructure the project
  controls); Claude, if `ANTHROPIC_API_KEY` is set (with server-side refusal
  fallback); otherwise an extractive answer built from the same excerpts. If the
  model is slow or down, the chat falls back to the extractive answer. Every
  mode cites source stories; out-of-corpus questions say so.
  To try it locally: `ollama pull qwen3.5:9b`, then run with
  `LBTF_LLM_BASE_URL=http://localhost:11434/v1 LBTF_LLM_MODEL=qwen3.5:9b`.
- **Transcription + language flag** (`services/transcription.py`): every upload
  is transcribed and scanned for flagged terms. Default backend is a
  deterministic mock (works offline, exercises the whole flow); set
  `LBTF_TRANSCRIBER=whisper` (+ `pip install openai-whisper`) for real
  transcription. Same output shape either way.
- **Place extraction** (`services/places.py`): gazetteer match against known
  locations/aliases + cross-street regex — powers "Places you mentioned" and
  the backfill pass.
- **Moderation → publish**: approving creates one Story per reviewer-tagged
  time-span (span → pin → era); with no spans it falls back to whole-video per
  contributor-tagged place. Field capture publishes directly. Everything lands
  in the audit log with reviewer identity + timestamp.
- **Map**: real historical basemaps — public-domain USGS "Oakland West" quad
  scans (1949 / 1959-photorevised / 1993), one per era, reprojected to the
  app's frame by `tools/build_basemaps.py` (see `docs/historical-maps.md`).
  `MapView` renders them aspect-true with pan + zoom; pins are real lat/lng
  (`frontend/src/lib/geo.ts`). The stylized grid remains as a fallback if the
  imagery fails to load.

## Env vars (backend)

| Var | Default | Purpose |
|---|---|---|
| `LBTF_DATABASE_URL` | `sqlite:///backend/lbtf.db` | database |
| `LBTF_UPLOAD_DIR` | `backend/uploads` | uploaded clips (served at `/uploads`) |
| `ANTHROPIC_API_KEY` | — | enables Claude-composed chat answers |
| `LBTF_CLAUDE_MODEL` | `claude-opus-5` | chat model |
| `LBTF_USE_CLAUDE` | `auto` | `1`/`0` to force/disable Claude |
| `LBTF_LLM_BASE_URL` | — | OpenAI-compatible open-weight model server (e.g. `http://localhost:11434/v1`); when set, it composes chat answers instead of Claude |
| `LBTF_LLM_MODEL` | — | model name on that server (required with `LBTF_LLM_BASE_URL`) |
| `LBTF_LLM_TIMEOUT` | `25` | seconds to wait before answering extractively instead |
| `LBTF_LLM_HEADERS` | — | auth headers for a proxy in front of the model, `Name:value,Name:value` |
| `LBTF_TRANSCRIBER` | `mock` | `whisper` for real transcription |
| `LBTF_CORS_ORIGINS` | `http://localhost:5173,…` | dev CORS |
| `LBTF_SITE_PASSWORD` | — | when set, gate the whole site (SPA + API + /uploads) behind one shared password via HTTP Basic auth; unset = open. `/api/health` stays open. |

## Tests

```bash
make test                                   # everything below except e2e, from the repo root
make e2e                                    # Playwright browser tests in frontend/e2e/ (starts its own servers)
```

Or one piece at a time:

```bash
cd backend && make test                     # 9 tests: full contributor → moderation flow, RAG scoping, auth, field capture
cd frontend && npm test                     # Vitest (jsdom + Testing Library), src/**/*.test.ts(x)
cd frontend && npm run build                # typecheck + production build
```
