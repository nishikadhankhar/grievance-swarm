PY := backend/.venv/bin/python

.PHONY: install seed run web test

install:
	python3 -m venv backend/.venv
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm install

seed:
	cd backend && .venv/bin/python -m app.seed

run:
	cd backend && .venv/bin/uvicorn app.main:app --reload --timeout-graceful-shutdown 3 --port 8000

web:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest -q
