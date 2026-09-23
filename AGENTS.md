# Life Before the Freeway — agent instructions

A map-based oral-history archive of West Oakland before Interstate 980 (EVOAK! × OpenOakland). The public can explore interview stories on a map, ask a chat questions answered from those stories, and record their own. `README.md` covers the features and screens in detail.

## Layout
- `frontend/` — React 18 + TypeScript (Vite)
- `backend/` — FastAPI + SQLAlchemy, Alembic migrations in `backend/alembic/`
- `tools/` — one-off scripts (historical basemap builder)

## Running
- API: `make -C backend dev` → :8000 with auto-reload (creates the venv on first run)
- Web: `npm --prefix frontend run dev` → :5173, proxies `/api` and `/uploads` to :8000
- Keep both running in the background during a session. Both reload on change.

## Testing
- Backend: `make -C backend test`. To also run against Postgres, as CI does, set `LBTF_TEST_DATABASE_URL`.
- Frontend: `npm --prefix frontend test` (Vitest) and `npm --prefix frontend run build` (typecheck + build).
- CI runs all of these on every PR. Keep them green.

## Environments and data
- **dev** (`make -C backend dev`): SQLite with the sample archive. Disposable.
- **staging** (Render, and `make -C backend dev-staging` locally): the hosted Postgres with the real interviews. **Writes count.** Don't run anything that writes to staging without asking first.
- Real stories live only in staging. Reach them by pointing at staging, never by copying them into dev or into the repo.
- Never commit `backend/.env.staging` or any secret. `backend/.env.staging.example` lists every setting.

## Rules
- **Schema changes:** edit `app/models.py`, run `make -C backend migration M="…"` and commit the generated migration in the same PR. `tests/test_migrations.py` fails if models and migrations drift apart.
- **Stay vendor-neutral:** use a plain database URL (no provider-specific drivers) and the S3 API for object storage, so the hosting can move to another account or provider with a dump and reload.
- **Keep video object keys stable** (`interviews/<name>.mp4`). A handoff rewrites the URL prefix with one `UPDATE`, which only works if keys never change.
- **The chat answers only from the archive.** Answers are composed from retrieved story excerpts and cite their sources. Don't loosen that constraint.
- **Protect community members' privacy.** Don't put contributors' or usability-test participants' names or personal details in code, commits, PRs, logs or test fixtures. Published interview metadata that EVOAK! approved is the exception. Never store home addresses.
