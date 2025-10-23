#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python_version="$(python3 --version 2>/dev/null || true)"
node_version="$(node --version 2>/dev/null || true)"
psql_version="$(psql --version 2>/dev/null || true)"

if [[ -z "$python_version" ]]; then
  echo "[error] Python 3 is required but not found in PATH." >&2
  exit 1
fi

if [[ -z "$node_version" ]]; then
  echo "[error] Node.js is required but not found in PATH." >&2
  exit 1
fi

if [[ -z "$psql_version" ]]; then
  echo "[warning] PostgreSQL client (psql) not found in PATH." >&2
  echo "[warning] You will need to install PostgreSQL before running the backend." >&2
fi

echo "[info] Using $python_version"
echo "[info] Using Node $node_version"
if [[ -n "$psql_version" ]]; then
  echo "[info] Using $psql_version"
fi

echo "[info] Creating virtual environment (.venv)"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r server/requirements.txt

echo "[info] Installing frontend dependencies"
(cd web && npm install)

echo "[info] Setup complete. Activate the env with 'source .venv/bin/activate'"
