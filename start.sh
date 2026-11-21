#!/usr/bin/env bash
# Sobe backend (porta 8000) e frontend (porta 5173) juntos. Ctrl+C encerra os dois.
set -e
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
[ -d frontend/node_modules ] || (cd frontend && npm install)

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACK=$!
trap "kill $BACK 2>/dev/null" EXIT
cd frontend && npm run dev
