# Life Before the Freeway — backend
# Usage: make setup && make dev
#
# Profiles: `make dev` is local code + sample data on SQLite (disposable).
# `make dev-staging` is local code + the STAGING database (real data — writes
# count). It loads backend/.env.staging; see .env.staging.example.

VENV    := .venv
PY      := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PORT    ?= 8000

.PHONY: help setup dev dev-staging run test migrate migrate-staging migration reset-db clean

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

$(VENV)/bin/uvicorn: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt
	@touch $@

setup: $(VENV)/bin/uvicorn ## Create the venv and install dependencies

dev: setup ## Run the API with auto-reload on :8000 (PORT=… to override)
	$(UVICORN) app.main:app --reload --port $(PORT)

dev-staging: setup .env.staging ## Run local code against the STAGING database (real data; writes count)
	$(UVICORN) app.main:app --reload --port $(PORT) --env-file .env.staging

run: setup ## Run the API without reload (closer to production)
	$(UVICORN) app.main:app --host 0.0.0.0 --port $(PORT)

test: setup ## Run the test suite
	$(PY) -m pytest -q

migrate: setup ## Apply migrations to the configured DB (the app also does this on start)
	$(VENV)/bin/alembic upgrade head

migrate-staging: setup .env.staging ## Apply migrations to the STAGING database
	set -a; . ./.env.staging; set +a; $(VENV)/bin/alembic upgrade head

migration: setup ## Write a new migration from model changes: make migration M="add foo"
	$(VENV)/bin/alembic revision --autogenerate -m "$(M)"

reset-db: ## Delete the SQLite DB + uploads; reseeds on next start
	rm -f lbtf.db
	rm -rf uploads/*

.env.staging:
	@echo "backend/.env.staging is missing — copy .env.staging.example and fill it in."; exit 1

clean: reset-db ## reset-db + remove the venv and caches
	rm -rf $(VENV) .pytest_cache
	find . -name __pycache__ -type d -exec rm -rf {} +
