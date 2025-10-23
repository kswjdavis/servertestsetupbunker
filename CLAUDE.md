# Claude Code Session Context

**Project:** Bunkercolab - Grain Bunker Fan Control System
**Last Updated:** October 23, 2025
**Current Sprint:** Epic 1 - Foundation & Device Communication

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

### ✅ Completed Stories

**Story 1.1: Project Scaffolding (Ready for Review)**
- FastAPI health endpoint: `/api/healthz`
- React + Vite scaffolding
- Deployed to production: http://206.189.210.203
- All 10 acceptance criteria verified on live server

**Story 1.2: Database Schema and Migrations (Ready for Review)**
- 8 tables created and deployed to production
- Alembic migrations configured (async SQLAlchemy 2.0)
- Repository pattern implemented (6 repositories)
- Migration ID: `78c833ebcaf5_initial_schema...`
- All 12 acceptance criteria completed

**Firmware (Epic 1 Stories 1.5-1.8) - Merged from worktree:**
- WiFi manager with reconnection strategy
- HTTPS client with TLS validation
- NVS storage for credentials
- Status reporting every 60 seconds
- See: `firmware/docs/EPIC1_ACCEPTANCE_CRITERIA.md`

### 🚧 Next Stories

**Story 1.3:** User Authentication APIs (Not Started)
**Story 1.4:** Device Provisioning APIs (Not Started)

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
- FastAPI: `systemctl status bunkercolab-api`
- Nginx: `systemctl status nginx`
- PostgreSQL: `systemctl status postgresql`

**Endpoints:**
- Health: http://206.189.210.203/api/healthz
- API: http://206.189.210.203/api/

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
- **Commits:** Descriptive, include context and "why"
- **Co-authoring:** All commits co-authored with Claude
- **Deployment:** Push triggers manual deployment via rsync

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
  'systemctl restart bunkercolab-api'
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
  'journalctl -u bunkercolab-api -f'

# Nginx logs
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 \
  'tail -f /var/log/nginx/error.log'
```

---

## Important Notes

### Database Password Change
**Old:** `Bunker1!` (had special character issues with shell escaping)
**New:** `Bunker123` (simpler, no escaping needed)
**Updated in:** Production `.env`, this documentation

### Git History Context
- **Commit 65cb282:** Added DROPLET_ACCESS.md
- **Commit 0e0890b:** Story 1.2 status → Ready for Review
- **Commit 26a22d8:** Story 1.2 complete implementation
- **Commit 3f32237:** Merged firmware from epic-1-foundation worktree
- **Commit 781d001:** Updated Ubuntu 22.04 → 24.04 LTS

### Worktree Cleanup (Completed)
- **Issue:** Two developers worked on 1.1 (main branch + worktree)
- **Resolution:** Selectively merged firmware from `epic-1-foundation` branch
- **Status:** Worktree removed, branch deleted, clean history maintained

---

## Testing

### Live Server Tests (Story 1.1)
```bash
# Health check
curl http://206.189.210.203/api/healthz

# Should return: {"status":"ok"}
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
# Check logs
journalctl -u bunkercolab-api -n 50

# Common issues:
# - Missing .env file
# - Database connection failed
# - Import errors (missing dependencies)
```

---

## Next Session Checklist

When resuming work:
1. ✅ Read this CLAUDE.md file
2. ✅ Check current story status in `docs/stories/`
3. ✅ Review last 3-5 git commits: `git log --oneline -5`
4. ✅ Verify production health: `curl http://206.189.210.203/api/healthz`
5. ✅ Load BMAD config if using agents: `.bmad-core/core-config.yaml`
6. ✅ Check for any uncommitted changes: `git status`

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
