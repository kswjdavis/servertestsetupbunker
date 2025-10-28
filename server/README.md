# Bunker Colab FastAPI Backend

Backend service that exposes REST APIs for bunker management, weather integration, device control logic, and operator authentication.

## Prerequisites
- Python 3.10 or later
- PostgreSQL 14+ running locally or accessible remotely
- Virtualenv or similar environment manager

## Local Development
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # populate secrets before running
alembic upgrade head
uvicorn app.main:app --reload
```

- API root: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Tasks & Scripts
- `alembic upgrade head` — apply database migrations.
- `pytest` — run unit and integration tests under `tests/`.
- `python seed_test_user.py` — create a demo operator account (optional).

## Deployment Notes
- Production settings load from `.env.production`.
- The deployment guide (`docs/deployment-guide.md`) installs a systemd unit and proxies through Nginx.
- Configure weather service keys (`WEATHER_*`) and device token expiry as part of the deployment checklist.
