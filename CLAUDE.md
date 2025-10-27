# Claude Code Session Context

**Project:** Bunkercolab - Grain Bunker Fan Control System
**Last Updated:** October 24, 2025
**Current Sprint:** Epic 2 - Control & Safety Systems

---

## Project Overview

ESP32-based automated fan control system for grain storage bunkers. Fans activate based on wind direction and speed to optimize grain drying and prevent spoilage.

**Tech Stack:**
- **Backend:** Python 3.12, FastAPI 0.119.1, PostgreSQL 16, SQLAlchemy 2.0 (async)
- **Frontend:** React 18+, TypeScript 5.x, Vite 5.x, Tailwind CSS 3.x
- **Firmware:** ESP-IDF 5.x, C/C++, ESP32
- **Infrastructure:** Ubuntu 24.04 LTS, Nginx, Digital Ocean

---

## Quick Start

### Essential Documents (Read These First)
1. **docs/prd.md** - Product requirements (v4)
2. **docs/architecture.md** - System architecture (v4)
3. **DROPLET_ACCESS.md** - Server access credentials
4. **.bmad-core/core-config.yaml** - BMAD agent configuration
5. **docs/stories/** - User stories with acceptance criteria

### Repository Structure
```
Bunkercolab/
├── server/              # FastAPI backend
│   ├── app/
│   │   ├── core/       # Database, config
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── repositories/  # Data access layer
│   │   └── main.py     # FastAPI app entry
│   ├── alembic/        # Database migrations
│   └── requirements.txt
├── firmware/           # ESP32 C code
│   ├── main/          # Source code
│   ├── docs/          # Firmware documentation
│   └── partitions.csv # Flash layout
├── web/               # React frontend
├── docs/              # Documentation
│   ├── stories/       # User stories
│   └── architecture.md
├── scripts/           # Deployment scripts
└── SSH_Key/.ssh/      # Server SSH keys
```

---

## Current Progress

### ✅ Completed Stories (Epic 1)

**Story 1.1: Project Scaffolding (Done)**
- FastAPI health endpoint: `/healthz`
- React + Vite scaffolding
- Deployed to production: http://206.189.210.203
- All 10 acceptance criteria verified on live server

**Story 1.2: Database Schema and Migrations (Done)**
- 8 tables created and deployed to production
- Alembic migrations configured (async SQLAlchemy 2.0)
- Repository pattern implemented (6 repositories)
- Migration ID: `78c833ebcaf5_initial_schema...`
- All 12 acceptance criteria completed

**Story 1.3: User Authentication APIs (Done)**
- User registration and login endpoints
- JWT token authentication
- Password hashing with bcrypt
- Role-based access control (admin/operator/viewer)

**Firmware (Epic 1 Stories 1.5-1.8) - Done:**
- WiFi manager with reconnection strategy
- HTTPS client with TLS validation
- NVS storage for credentials
- Status reporting every 60 seconds
- See: `firmware/docs/EPIC1_ACCEPTANCE_CRITERIA.md`

### 🚧 In Progress (Epic 2)

**Story 2.1: Dead Man Timer (Done)**
**Story 2.2: Relay Controller (In Progress)**
**Story 2.3: Hardware Watchdog (In Progress)**
**Story 2.4: Weather API Integration (In Progress)**

---

## Production Server

**IP:** `206.189.210.203`
**SSH:** `ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203`

**Database:**
- Name: `bunkercolab`
- User: `bunkercolab_user`
- Password: `Bunker123`
- All tables created and ready

**Services:**
- FastAPI: `systemctl status bunkercolab`
- Nginx: `systemctl status nginx`
- PostgreSQL: `systemctl status postgresql`

**Endpoints:**
- Health: http://206.189.210.203/healthz
- API v1: http://206.189.210.203/api/v1/
- API Docs: http://206.189.210.203/docs
- ReDoc: http://206.189.210.203/redoc

**Available API Endpoints (v1):**
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login (returns JWT token)
- `POST /api/v1/devices/provision` - Device provisioning
- `POST /api/v1/control/status` - Device status reporting (used by ESP32)
- `GET /api/v1/weather/current` - Current weather data (requires authentication)

---

## Database Schema (Story 1.2)

**Tables:**
1. **users** - Authentication (bcrypt), roles (admin/operator/viewer)
2. **bunkers** - GPS coords, orientation, fan_count, wind_threshold
3. **devices** - ESP32 controllers, auth_token (UUID), mac_address
4. **device_status** - Real-time telemetry (singleton per device, upsert)
5. **time_window_overrides** - Scheduled ON/OFF overrides
6. **weather_data** - Current weather cache (wind speed/direction)
7. **global_config** - System singleton (id=1)
8. **alembic_version** - Migration tracking

**Models Location:** `server/app/models/`
**Repositories Location:** `server/app/repositories/`

---

## Key Conventions & Patterns

### BMAD Method
- **Always load:** `.bmad-core/core-config.yaml` for agent configuration
- **Agents available:** Developer (James), Architect (Sarah), Security (Marcus)
- **Command:** `/BMad:agents:dev` to activate developer agent

### Code Style
- **Python:** Black formatter, type hints required, async/await patterns
- **TypeScript:** Strict mode, functional components, no `any` types
- **C/ESP32:** ESP-IDF style guide, FreeRTOS patterns

### Git Workflow
- **Main branch:** Stable, deployable code
- **Current branch:** Jeff (feature branch for Epic 2 work)
- **Commits:** Descriptive, include context and "why"
- **Co-authoring:** All commits co-authored with Claude
- **Deployment:** Push triggers manual deployment via rsync

### Current Git Status
Working on feature branch `Jeff` with Epic 2 stories in progress. Modified files include:
- Relay controller implementation (firmware)
- Hardware watchdog (firmware)
- Weather service integration (server)
- Story documentation updates

### Story Status Values
- "Backlog" → "Ready for Dev" → "In Progress" → "Ready for Review" → "Done"

---

## Common Tasks

### Deploy Backend to Production
```bash
# From server/ directory
rsync -avz -e "ssh -i ../SSH_Key/.ssh/deploy_key" \
  --exclude '.git' --exclude 'venv' --exclude '__pycache__' \
  ./ root@206.189.210.203:/home/bunkercolab/Bunkercolab/server/

ssh -i ../SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'systemctl restart bunkercolab'
```

### Run Database Migration
```bash
# Locally (connects to production DB)
cd server
source venv/bin/activate
export DATABASE_URL="postgresql+asyncpg://bunkercolab_user:Bunker123@206.189.210.203/bunkercolab"
alembic upgrade head

# Or on production
ssh -i ../SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'cd /home/bunkercolab/Bunkercolab/server && \
   source venv/bin/activate && \
   alembic upgrade head'
```

### Create New Migration
```bash
cd server
source venv/bin/activate
alembic revision --autogenerate -m "Description"
```

### Access Production Database
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'su - postgres -c "psql -d bunkercolab"'
```

### Check Service Logs
```bash
# FastAPI logs
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'journalctl -u bunkercolab -f'

# Nginx logs
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'tail -f /var/log/nginx/error.log'
```

---

## Important Notes

### Service Name Correction
**Correct service name:** `bunkercolab` (NOT `bunkercolab-api`)
- Use: `systemctl status bunkercolab`
- Use: `systemctl restart bunkercolab`
- Use: `journalctl -u bunkercolab -f`

### Endpoint Path Correction
**Health check endpoint:** `/healthz` (NOT `/api/healthz`)
- The health endpoint is at root level
- All API endpoints use `/api/v1/` prefix
- API documentation is at `/docs` and `/redoc`

### Database Password Change
**Old:** `Bunker1!` (had special character issues with shell escaping)
**New:** `Bunker123` (simpler, no escaping needed)
**Updated in:** Production `.env`, this documentation

### Git History Context
- **Commit a4974ec:** Story 2.1 complete
- **Commit 6fd81c3:** Epic 1 Complete
- **Commit 4e98dc3:** Starting own Branch (Jeff branch)
- **Commit 049ad32:** Story 1.3 completion
- **Commit b33628e:** Add CLAUDE.md - AI session context document
- **Commit 65cb282:** Added DROPLET_ACCESS.md
- **Commit 0e0890b:** Story 1.2 status → Ready for Review
- **Commit 26a22d8:** Story 1.2 complete implementation

### Worktree Cleanup (Completed)
- **Issue:** Two developers worked on 1.1 (main branch + worktree)
- **Resolution:** Selectively merged firmware from `epic-1-foundation` branch
- **Status:** Worktree removed, branch deleted, clean history maintained

---

## Testing

### Live Server Tests
```bash
# Health check
curl http://206.189.210.203/healthz
# Should return: {"status":"ok"}

# API documentation (interactive web interface)
open http://206.189.210.203/docs
# Or for text-based access:
curl -s http://206.189.210.203/openapi.json | python3 -m json.tool | less

# Check service status
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'systemctl status bunkercolab'
```

### Database Schema Verification
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'su - postgres -c "psql -d bunkercolab -c \"\\dt\""'

# Should show 8 tables
```

---

## Troubleshooting

### Cannot Connect to Production DB Locally
- PostgreSQL port 5432 is closed externally (security)
- Must SSH into droplet to access database
- Or use SSH tunnel: `ssh -L 5432:localhost:5432 -i SSH_Key/.ssh/deploy_key root@206.189.210.203`

### Alembic Migration Fails
- Ensure DATABASE_URL environment variable is set
- Check user has GRANT ALL privileges on schema public
- Verify greenlet and asyncpg are installed

### FastAPI Service Not Starting
```bash
# Check logs (run on production server)
journalctl -u bunkercolab -n 50

# Common issues:
# - Missing .env file
# - Database connection failed
# - Import errors (missing dependencies)

# Restart service
systemctl restart bunkercolab
systemctl status bunkercolab
```

---

## Next Session Checklist

When resuming work:
1. ✅ Read this CLAUDE.md file
2. ✅ Check current story status in `docs/stories/`
3. ✅ Review last 3-5 git commits: `git log --oneline -5`
4. ✅ Verify production health: `curl http://206.189.210.203/healthz`
5. ✅ Check service status: `ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'systemctl status bunkercolab'`
6. ✅ Load BMAD config if using agents: `.bmad-core/core-config.yaml`
7. ✅ Check for any uncommitted changes: `git status`

---

## Contact & Resources

**Repository:** https://github.com/wlivsey/bunker-blow
**Digital Ocean:** 206.189.210.203
**Documentation Hub:** `docs/` directory

**Key Files to Reference:**
- `docs/prd.md` - Product requirements
- `docs/architecture.md` - Technical architecture
- `DROPLET_ACCESS.md` - Server credentials
- `firmware/docs/EPIC1_ACCEPTANCE_CRITERIA.md` - Firmware status

---

**🤖 This file is maintained by Claude Code**
**Purpose:** Provide context for future AI assistant sessions
**Update:** After completing major features or changing infrastructure
