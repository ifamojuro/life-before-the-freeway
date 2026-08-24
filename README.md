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

## How the pieces work

- **RAG chat** (`backend/app/services/rag.py`): BM25-style retrieval over the
  published story transcripts; if `ANTHROPIC_API_KEY` is set the answer is
  composed by Claude **constrained to the retrieved excerpts** (with server-side
  refusal fallback), otherwise an extractive answer is built from the same
  excerpts. Both modes cite source stories; out-of-corpus questions say so.
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
| `LBTF_TRANSCRIBER` | `mock` | `whisper` for real transcription |
| `LBTF_CORS_ORIGINS` | `http://localhost:5173,…` | dev CORS |
| `LBTF_SITE_PASSWORD` | — | when set, gate the whole site (SPA + API + /uploads) behind one shared password via HTTP Basic auth; unset = open. `/api/health` stays open. |

## Tests

```bash
cd backend && make test                     # 9 tests: full contributor → moderation flow, RAG scoping, auth, field capture
cd frontend && npm test                     # Vitest (jsdom + Testing Library), src/**/*.test.ts(x)
cd frontend && npm run build                # typecheck + production build
```
