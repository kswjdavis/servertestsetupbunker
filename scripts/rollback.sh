#!/usr/bin/env bash
#
# Roll back the repository to a previous commit and restart services.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-bunkercolab}"

usage() {
  cat <<'USAGE'
Rollback repository to a previous commit hash or tag.

Usage: ./rollback.sh <git-ref> [--no-restart]

Options:
  --no-restart  Skip automatic systemd service restart
  -h, --help    Show this help message
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TARGET_REF=""
RESTART_SERVICE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-restart)
      RESTART_SERVICE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "${TARGET_REF}" ]]; then
        TARGET_REF="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "${TARGET_REF}" ]]; then
  echo "ERROR: git reference required." >&2
  usage
  exit 1
fi

if [[ ! -d "${PROJECT_ROOT}/.git" ]]; then
  echo "ERROR: ${PROJECT_ROOT} is not a git repository." >&2
  exit 1
fi

CURRENT_REF="$(git -C "${PROJECT_ROOT}" rev-parse HEAD)"
echo "Current commit: ${CURRENT_REF}"
echo "Target commit : ${TARGET_REF}"
read -r -p "Proceed with hard reset to ${TARGET_REF}? This discards local changes. (y/N) " reply
if [[ ! "${reply}" =~ ^[Yy]$ ]]; then
  echo "Rollback aborted."
  exit 0
fi

git -C "${PROJECT_ROOT}" fetch --all --prune
git -C "${PROJECT_ROOT}" reset --hard "${TARGET_REF}"

echo
echo "Repository reset to ${TARGET_REF}."

if [[ ${RESTART_SERVICE} -eq 1 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    echo "Restarting ${SERVICE_NAME} service..."
    sudo systemctl restart "${SERVICE_NAME}" || true
  else
    echo "sudo not available; skipping service restart."
  fi
fi

cat <<SUMMARY

=== Rollback Complete ===
Repository now at: $(git -C "${PROJECT_ROOT}" rev-parse HEAD)

Next steps:
  1. Rebuild backend dependencies if required: scripts/deploy-server.sh --skip-git
  2. Rebuild frontend assets: scripts/build-web.sh --skip-install
  3. Verify application health before announcing rollback complete.
SUMMARY
