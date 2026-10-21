PY := engine/.venv/bin/python
PARITY := engine/.venv/bin/parity

.PHONY: setup fetch run test lint web web-build docs check

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

check: lint test  ## everything CI runs
	python3 scripts/docs.py check
	cd web && npm run build
