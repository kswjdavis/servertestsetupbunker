#!/usr/bin/env bash
#
# Build and deploy the React frontend assets.
# Run as the bunkercolab user after nginx is configured.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WEB_DIR="${PROJECT_ROOT}/web"
DIST_DIR="${WEB_DIR}/dist"
NGINX_ROOT="${WEB_DEPLOY_ROOT:-/var/www/bunkercolab}"
NODE_MAJOR="${NODE_MAJOR:-20}"

log() {
  printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*"
}

ensure_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command '$1' is not available." >&2
    exit 1
  fi
}

usage() {
  cat <<'USAGE'
Build the React frontend and deploy it to the nginx web root.

Usage: ./build-web.sh [--skip-install]

Options:
  --skip-install  Skip npm dependency installation
  -h, --help      Show this help message

Environment:
  WEB_DEPLOY_ROOT  Override nginx destination (default: /var/www/bunkercolab)
  NODE_MAJOR       Node.js major version to install if missing (default: 20)
USAGE
}

SKIP_INSTALL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
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

echo "=== Bunkercolab Frontend Build ==="
echo "Project root: ${PROJECT_ROOT}"
echo "Deploy root : ${NGINX_ROOT}"
echo

if [[ ! -d "${WEB_DIR}" ]]; then
  echo "ERROR: Frontend directory not found at ${WEB_DIR}" >&2
  exit 1
fi

ensure_command curl
ensure_command sudo

if ! command -v npm >/dev/null 2>&1; then
  log "Node.js not detected. Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

cd "${WEB_DIR}"

if [[ ${SKIP_INSTALL} -eq 0 ]]; then
  log "Installing npm dependencies..."
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
else
  log "Skipping dependency installation as requested."
fi

log "Building production bundle..."
npm run build

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "ERROR: Build output not found at ${DIST_DIR}" >&2
  exit 1
fi

log "Deploying assets to nginx..."
sudo mkdir -p "${NGINX_ROOT}"
sudo rm -rf "${NGINX_ROOT:?}/"*
sudo cp -r "${DIST_DIR}/." "${NGINX_ROOT}/"
sudo chown -R www-data:www-data "${NGINX_ROOT}"

log "Build complete. Listing deployed files..."
sudo find "${NGINX_ROOT}" -maxdepth 1 -type f -print

echo
echo "=== Frontend Deployment Summary ==="
echo "- Source directory : ${WEB_DIR}"
echo "- Build output     : ${DIST_DIR}"
echo "- nginx root       : ${NGINX_ROOT}"
echo
echo "Tip: sudo systemctl reload nginx"
echo
