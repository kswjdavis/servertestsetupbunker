#!/usr/bin/env bash
#
# Deploy the FastAPI backend on the production droplet.
# Run as the bunkercolab user after the repository has been cloned.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVER_DIR="${PROJECT_ROOT}/server"
VENV_DIR="${SERVER_DIR}/venv"
ENV_FILE="${SERVER_DIR}/.env.production"
# Fall back to .env if .env.production doesn't exist
if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${SERVER_DIR}/.env"
fi
SERVICE_NAME="bunkercolab"
SYSTEMD_TEMPLATE="${PROJECT_ROOT}/config/bunkercolab.service"

log() {
  printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*"
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command '$1' is not installed." >&2
    exit 1
  fi
}

usage() {
  cat <<'USAGE'
Deploy the FastAPI backend.

Usage: ./deploy-server.sh [--skip-git]

Options:
  --skip-git   Skip fetching the latest code from git
  -h, --help   Show this help message
USAGE
}

SKIP_GIT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-git)
      SKIP_GIT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

echo "=== Bunkercolab Backend Deployment ==="
echo "Project root: ${PROJECT_ROOT}"
echo

if [[ "$(whoami)" != "bunkercolab" ]]; then
  echo "WARNING: Recommended to run as the bunkercolab user."
  read -r -p "Continue anyway? (y/N) " reply
  if [[ ! "${reply}" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

ensure_command python3
ensure_command git
ensure_command sudo

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "ERROR: Server directory not found at ${SERVER_DIR}" >&2
  exit 1
fi

if [[ ${SKIP_GIT} -eq 0 && -d "${PROJECT_ROOT}/.git" ]]; then
  log "Updating repository..."
  if ! git -C "${PROJECT_ROOT}" pull --ff-only; then
    log "WARNING: git pull failed. Continuing with existing code."
  fi
else
  log "Skipping git update."
fi

log "Ensuring Python virtual environment..."
cd "${SERVER_DIR}"
if [[ ! -d "${VENV_DIR}" ]]; then
  python3 -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/python" -m pip install --upgrade pip
"${VENV_DIR}/bin/pip" install -r requirements.txt

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Create it from server/.env.production.example." >&2
  exit 1
fi

log "Applying database migrations..."
set +u
set -o allexport
source "${ENV_FILE}"
set +o allexport
set -u

if [[ -d "${SERVER_DIR}/alembic" ]]; then
  "${VENV_DIR}/bin/alembic" upgrade head
else
  log "WARNING: Alembic directory missing; skipping migrations."
fi

if [[ -f "${SYSTEMD_TEMPLATE}" ]]; then
  log "Installing systemd service (${SERVICE_NAME})..."
  sed \
    -e "s#__PROJECT_ROOT__#${PROJECT_ROOT}#g" \
    -e "s#__DEPLOY_USER__#$(whoami)#g" \
    "${SYSTEMD_TEMPLATE}" | sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1 || true
  sudo systemctl restart "${SERVICE_NAME}"
else
  log "Systemd template not found at ${SYSTEMD_TEMPLATE}. Skipping unit installation."
fi

log "Deployment complete. Checking service status..."
sleep 2
sudo systemctl status "${SERVICE_NAME}" --no-pager || true

echo
echo "=== Deployment Summary ==="
echo "- Backend directory: ${SERVER_DIR}"
echo "- Environment file : ${ENV_FILE}"
echo "- Service name     : ${SERVICE_NAME}"
echo
echo "Logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo "Health check: curl http://localhost:8000/healthz"
echo
