# Life Before the Freeway — repo-level checks.
# Usage: make test   (everything CI checks, except the browser tests)
#        make e2e    (browser tests in Chromium; starts its own API + web server)

.PHONY: help test e2e

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-6s %s\n", $$1, $$2}'

test: ## Backend tests, frontend unit tests, typecheck and build
	$(MAKE) -C backend test
	npm --prefix frontend test
	npm --prefix frontend run build

e2e: ## End-to-end browser tests (Playwright)
	npm --prefix frontend run e2e
