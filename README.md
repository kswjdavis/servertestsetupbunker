# Bunkercolab Monorepo

Full-stack workspace that houses the firmware, backend API, and web dashboard for the Bunkercolab project.

## Repository Structure

```
firmware/   # ESP32 firmware (ESP-IDF 5.x)
server/     # FastAPI backend (Python 3.10+)
web/        # React + Vite + Tailwind UI (Node 18+)
docs/       # Product, architecture, and story documentation
scripts/    # Helper scripts for local setup
```

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer + npm
- PostgreSQL 14 (local server running)
- ESP-IDF 5.x toolchain with `idf.py` available
- `createdb` and `psql` CLI tools for PostgreSQL

## Quick Start

1. Clone the repository and enter the project directory.
2. Copy environment template files:
   ```bash
   cp server/.env.example server/.env
   cp web/.env.local.example web/.env.local
   ```
   Update the `SECRET_KEY` in `server/.env` to a secure random value (32+ chars), for example via `openssl rand -hex 32`.
3. Run the helper script to install dependencies:
   ```bash
   ./scripts/setup-dev.sh
   ```
   The script creates a Python virtual environment, installs backend dependencies, and installs frontend packages. Feel free to inspect it before running.

## Backend (FastAPI)

```bash
source .venv/bin/activate
uvicorn server.app.main:app --reload --reload-dir server/app
```

- API served at `http://localhost:8000`
- Health check endpoint: `GET /healthz`

## Frontend (React + Vite + Tailwind)

```bash
cd web
npm run dev
```

- Dev server runs at `http://localhost:5173`
- Tailwind configuration located in `web/tailwind.config.js`

## Firmware (ESP-IDF)

```bash
cd firmware
idf.py set-target esp32
idf.py build
```

- Scaffold prints a log line from `app_main`
- Requires ESP-IDF environment to be initialized (`. ./export.sh`)

## Database Setup

```bash
createdb bunkercolab_dev
psql bunkercolab_dev
```

- Update `server/.env` with your local credentials
- Run migrations (to be added in future stories)

## Verifying the Environment

1. Confirm backend starts without errors (`uvicorn server.app.main:app --reload --reload-dir server/app`).
2. Confirm frontend dev server runs (`npm run dev`).
3. Confirm firmware builds (`idf.py build`).
4. Validate PostgreSQL connectivity (`psql bunkercolab_dev`).

Document any platform-specific issues in the story debug log or new docs as they arise.

## Docker Local Development (Backend + Database)

The repository also includes a Docker setup for running the FastAPI backend and PostgreSQL together.

1. Copy the Docker environment template:
   ```bash
   cp server/.env.docker.example server/.env.docker
   ```
   Set a strong `SECRET_KEY` in `server/.env.docker` before starting the containers.
2. Build and launch the stack:
   ```bash
   docker compose up --build
   ```
   This starts:
   - `db`: PostgreSQL 15 with credentials `bunker / bunker`
   - `backend`: FastAPI app running on `http://localhost:8000`
3. On first start, Alembic migrations run automatically. Hot reload is enabled; code changes under `server/app` take effect without rebuilding.
4. Stop services when finished:
   ```bash
   docker compose down
   ```

The `postgres_data` volume retains database state between runs. Remove it with `docker compose down -v` if you need a clean slate.
