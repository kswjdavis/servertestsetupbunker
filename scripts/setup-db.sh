#!/usr/bin/env bash
#
# Provision PostgreSQL database and user for production deployment.
#
set -euo pipefail

DB_NAME="${DB_NAME:-bunkercolab}"
DB_USER="${DB_USER:-bunkercolab_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
INSTALL_PACKAGES="${INSTALL_PACKAGES:-true}"

log() {
  printf '[%(%Y-%m-%d %H:%M:%S)T] %s\n' -1 "$*"
}

usage() {
  cat <<'USAGE'
Initialize the PostgreSQL database used by the production backend.

Usage: sudo ./setup-db.sh [--db-name NAME] [--db-user USER] [--db-password PASS]

Options:
  --db-name NAME       Database name (default: bunkercolab)
  --db-user USER       Database role/user (default: bunkercolab_user)
  --db-password PASS   Password for the role (will prompt if omitted)
  --no-install         Skip apt package installation
  -h, --help           Show this help message

Environment:
  DB_NAME, DB_USER, DB_PASSWORD, INSTALL_PACKAGES
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --db-password)
      DB_PASSWORD="$2"
      shift 2
      ;;
    --no-install)
      INSTALL_PACKAGES="false"
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

validate_identifier() {
  local value="$1"
  if [[ ! "${value}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "ERROR: '${value}' is not a valid PostgreSQL identifier. Use letters, numbers, underscores." >&2
    exit 1
  fi
}

validate_identifier "${DB_NAME}"
validate_identifier "${DB_USER}"

if [[ -z "${DB_PASSWORD}" ]]; then
  read -r -s -p "Enter password for PostgreSQL role '${DB_USER}': " DB_PASSWORD
  echo
  if [[ -z "${DB_PASSWORD}" ]]; then
    echo "ERROR: Password may not be empty." >&2
    exit 1
  fi
fi

if [[ $EUID -ne 0 ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "ERROR: This script requires root privileges or sudo access." >&2
    exit 1
  fi
fi

APT_CMD="apt-get"
if command -v apt >/dev/null 2>&1; then
  APT_CMD="apt"
fi

psql_installed() {
  command -v psql >/dev/null 2>&1
}

if [[ "${INSTALL_PACKAGES}" == "true" ]] && ! psql_installed; then
  log "Installing PostgreSQL server packages..."
  sudo "${APT_CMD}" update
  sudo "${APT_CMD}" install -y postgresql postgresql-contrib
fi

if ! psql_installed; then
  echo "ERROR: psql command not found. Install PostgreSQL or rerun with sudo." >&2
  exit 1
fi

ESCAPED_PASSWORD="$(printf "%s" "${DB_PASSWORD}" | sed "s/'/''/g")"

log "Ensuring database role '${DB_USER}' exists..."
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
if [[ "${ROLE_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${ESCAPED_PASSWORD}';"
else
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${ESCAPED_PASSWORD}';"
fi

log "Ensuring database '${DB_NAME}' exists..."
DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if [[ "${DB_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
else
  sudo -u postgres psql -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};"
fi

log "Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

cat <<SUMMARY

=== PostgreSQL Setup Complete ===
- Database : ${DB_NAME}
- User     : ${DB_USER}

Update your DATABASE_URL accordingly, e.g.:
  postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}
SUMMARY
