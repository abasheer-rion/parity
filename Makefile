PY := engine/.venv/bin/python
PARITY := engine/.venv/bin/parity

.PHONY: setup fetch run test lint web web-build docs auth check

setup:            ## create the Python env, install packages, turn on git hooks
	python3 -m venv engine/.venv
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -e "engine[dev]"
	cd web && npm ci
	git config core.hooksPath .githooks

fetch:            ## download all data into engine/data
	$(PARITY) fetch

run:              ## backtest every strategy, write engine/output/latest.json
	$(PARITY) run

test:             ## engine tests
	cd engine && .venv/bin/python -m pytest -q

lint:             ## engine lint and dashboard type check
	engine/.venv/bin/ruff check engine/src engine/tests
	cd web && npm run typecheck

web:              ## dashboard on http://localhost:5173, reading engine/output
	cd web && npm run dev

web-build:
	cd web && npm run build

docs:             ## tidy, re-index and check every markdown file
	python3 scripts/docs.py fix
	python3 scripts/docs.py check --suggest

auth:             ## rebuild the auth emails into auth/dist and auth/preview.html
	python3 auth/build.py

check: lint test  ## everything CI runs
	python3 scripts/docs.py check
	python3 auth/build.py --check
	cd web && npm run build

# Load tests (REF-0025). k6 is downloaded into tools/k6 (git-ignored) and checked against the
# release checksums; nothing is installed globally. Every target needs BASE (a preview address).
K6 := tools/k6/k6
.PHONY: k6 load-static load-entry load-functions load-ws
k6:               ## download and check k6 into tools/k6
	load/get-k6.sh
load-static: k6   ## BASE=<preview> STEPS=25,50,100 STEP_S=30
	$(K6) run load/static.js
load-entry: k6    ## BASE=<preview> front page and signed-out app entry (runs functions)
	$(K6) run load/entry.js
load-functions: k6 ## BASE=<preview> live status, beacons, badges, MCP discovery
	$(K6) run load/functions.js
load-ws: k6       ## BASE=<preview> live fan-out viewers on one public feed
	$(K6) run load/ws.js
