# Life Before the Freeway — backend
# Usage: make setup && make dev

VENV    := .venv
PY      := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PORT    ?= 8000

.PHONY: help setup dev run test reset-db clean

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

$(VENV)/bin/uvicorn: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt
	@touch $@

setup: $(VENV)/bin/uvicorn ## Create the venv and install dependencies

dev: setup ## Run the API with auto-reload on :8000 (PORT=… to override)
	$(UVICORN) app.main:app --reload --port $(PORT)

run: setup ## Run the API without reload (closer to production)
	$(UVICORN) app.main:app --host 0.0.0.0 --port $(PORT)

test: setup ## Run the test suite
	$(PY) -m pytest -q

reset-db: ## Delete the SQLite DB + uploads; reseeds on next start
	rm -f lbtf.db
	rm -rf uploads/*

clean: reset-db ## reset-db + remove the venv and caches
	rm -rf $(VENV) .pytest_cache
	find . -name __pycache__ -type d -exec rm -rf {} +
