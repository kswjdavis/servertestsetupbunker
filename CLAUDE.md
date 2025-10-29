# Claude Code Session Context

**Project:** Bunkercolab - Grain Bunker Fan Control System
**Last Updated:** October 28, 2025
**Current Sprint:** Epic 5 - Deployment & Finalization (6/10 Done)

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
├── docs/              # Core documentation ONLY
│   ├── stories/       # User stories (47 total)
│   ├── qa/            # Final QA reports (Stories 5.6, 5.7, 5.9)
│   ├── bugs/          # Active bug tracking (BUG-001, BUG-002)
│   ├── architecture/  # Architecture subdocs
│   ├── prd.md         # Product requirements
│   ├── architecture.md # System architecture
│   ├── deployment-guide.md  # Deployment procedures
│   ├── ota-update-procedure.md  # OTA update instructions
│   ├── operator-manual.md
│   ├── troubleshooting-guide.md
│   ├── security-checklist.md
│   ├── known-limitations.md
│   └── future-enhancements.md
├── archive/           # ⚠️ DO NOT REFERENCE - Historical artifacts only
│   ├── research/      # ESP-IDF research documents
│   ├── qa-sessions/   # Session-specific QA reports
│   └── temp-reports/  # Temporary validation reports
├── scripts/           # Deployment scripts
└── SSH_Key/.ssh/      # Server SSH keys
```

### ⚠️ IMPORTANT: Archive Directory

**DO NOT reference files in the `archive/` directory in future sessions.**

The `archive/` directory contains 74 historical artifacts that were created during development but are NOT part of the core project documentation:
- ESP-IDF research documents (framework exploration - 51 files)
- QA session reports (hardware validation logs, test procedures - 17 files)
- Temporary reports (validation summaries, demo scripts - 6 files)

**Active documentation is ONLY in:**
- `docs/` - Core documentation (12 essential files)
- `docs/stories/` - User stories (47 story files)
- `docs/qa/` - Final QA reports (3 files: Stories 5.6, 5.7, 5.9)
- `docs/bugs/` - Active bug tracking (2 files: BUG-001, BUG-002 - reference for new bugs)
- `docs/architecture/` - Architecture subdocs (3 files)

**Operational Files (Always Active):**
- `docs/deployment-guide.md` - Server deployment procedures
- `docs/ota-update-procedure.md` - Firmware OTA update instructions
- `docs/bugs/` - Bug tracking directory (create new bugs here)

See `archive/README.md` for archive details.

---

## Current Progress

**Overall Project Status: 97.9% Complete (46/47 stories Done)**

### Epic Completion Summary

- **Epic 1 (Project Foundation):** 8/8 Done (100%) ✅
- **Epic 2 (Core Backend & Firmware):** 11/11 Done (100%) ✅
- **Epic 3 (Core UI):** 9/9 Done (100%) ✅
- **Epic 4 (Advanced UI):** 8/9 Done (89%) ✅ (8/8 implementation stories complete)
- **Epic 5 (Deployment & Finalization):** 9/10 Done (90%) ✅

**Only Story 5.9 (Final POC Acceptance Testing) remains in progress.**

All implementation work is complete. The project is ready for comprehensive E2E testing and stakeholder acceptance.

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

### ✅ Completed Stories (Epic 2) - Backend & Core Firmware

**Story 2.1: Dead Man Timer (Done)** ✅
- 5-minute countdown timer with fail-safe activation
- Hardware validated (99.7% timing accuracy)
- Thread-safe atomic operations with concurrent testing
- Quality Score: 100/100

**Story 2.2: Relay Controller (Done)** ✅
- GPIO-based relay control with normally-closed fail-safe design
- Critical fix: Relay unlock on server control restoration (remote deployment viable)
- Hardware validated (5+ lock/unlock cycles, 100% reliability)
- Quality Score: 98/100

**Story 2.3: Hardware Watchdog (Done)** ✅
- 60-second task watchdog with panic-on-expire
- RTC memory reset counter (persists across reboots)
- Hardware validated (autonomous recovery confirmed)
- AC9 waived with production monitoring plan
- Quality Score: 98/100

**Story 2.4: Weather API Integration (Done)** ✅
- Weather.gov API integration with 60-second polling
- Unit conversions (km/h → mph, °C → °F)
- Graceful degradation to cached data on API failure
- Comprehensive test coverage (9/9 tests passing)
- Quality Score: 100/100

**Story 2.5: Control Logic Engine (Done)** ✅
- Centralized shutdown decision logic
- Emergency mode, time window overrides, wind threshold checks
- Fail-safe defaults throughout
- 8 comprehensive unit tests
- Quality Score: 100/100

**Story 2.6: Bunker Management API (Done)** ✅
- Full CRUD operations for bunker configuration
- GPS validation, pagination, authorization enforcement
- 8 integration tests covering all scenarios
- Quality Score: 95/100

**Story 2.7: ESP32 Complete Control Loop (Done)** ✅
- Full integration: WiFi, timer, relay, server communication
- control_loop_logic extracted with 8 unit tests
- Hardware test procedures documented
- AC9 waived (hardware unavailable, deferred to production)
- Quality Score: 85/100

**Story 2.8: Fail-Safe Behavior Testing (Done)** ✅
- 7 failure scenarios validated (WiFi, server, auth, crash, power, DB)
- Auth fail-safe module with atomic latch
- Backend DB fail-safe exception handling
- Automated test matrix execution with log evidence
- Quality Score: 95/100

**Story 2.9: End-to-End Integration Test (Done)** ✅
- Full-stack integration test: auth → provisioning → status → decisions
- PostgreSQL compatibility enforced (critical fix)
- Weather staleness fail-safe path tested
- 60-cycle status report simulation
- Quality Score: 85/100 (production-ready)

**Story 2.10: Security & Configuration Fixes (Done)** ✅
- CRITICAL: Removed test_config.h with hardcoded credentials
- Enforced HTTPS connections (was HTTP, causing SSL mismatch)
- NVS provisioning now required (more secure)
- **Status:** Code complete, production blocker resolved
- Quality Score: 95/100

**Story 2.11: Power Management & Longevity (Done)** ✅
- WiFi modem sleep enabled (50% power reduction)
- CPU frequency scaling 80-240MHz (additional 30-50% savings)
- Enhanced watchdog coverage (idle task monitoring)
- Expanded telemetry (heap, CPU freq, PS mode, reset count)
- Backend migration completed, telemetry validated
- **Impact:** 10x power reduction (200mA → 20-50mA)
- Quality Score: 90/100

### ✅ Completed Stories (Epic 3) - Core UI

**All 9 Epic 3 stories completed** - React frontend with authentication, real-time dashboards, device management, and emergency controls.

Key Implementations:
- **Story 3.1:** React app setup with Router v6, AuthContext, Axios
- **Story 3.2:** Login/logout UI with form validation
- **Story 3.3:** Interactive map dashboard with Leaflet (3-second polling)
- **Story 3.4:** Device provisioning wizard (178 lines)
- **Story 3.5:** Device list management with 5-second polling
- **Story 3.6:** Emergency controls (570 lines across 4 components)
- **Story 3.7:** Global settings UI (11KB SettingsPage)
- **Story 3.8:** Real-time polling hook (usePoll - 29 lines)
- **Story 3.9:** Responsive layout with Tailwind (768px-1920px)

Total: 3,603+ lines of production-ready UI code

### ✅ Completed Stories (Epic 4) - Advanced UI

**All 8 implementation stories completed** - Advanced dashboards, visualizations, and bunker management features.

Key Implementations:
- **Story 4.1:** Bunker detail page with FanGrid and real-time updates (298 lines)
- **Story 4.2:** Wind visualization with SVG arrows and compass (455 lines)
- **Story 4.3:** Energy savings display with trend indicators (95 lines)
- **Story 4.4:** Full CRUD operations with GPS picker and compass (786 lines)
- **Story 4.5:** Per-bunker configuration overrides (353 lines)
- **Story 4.6:** Time window override scheduling (635 lines)
- **Story 4.7:** SVG fan layout with animations and accessibility (401 lines)
- **Story 4.8:** Bunker status summary dashboard with sorting (492 lines)

Total: 4,095+ lines of advanced UI features
**Story 4.9:** UI integration testing (manual testing phase)

### ✅ Completed Stories (Epic 5) - Deployment & Finalization

**Story 5.1: LED Flash Identification (Done)** ✅
- Hardware validated October 27, 2025
- LED flash patterns 1-10 confirmed on ESP32-DevKitC
- Flash timing: 200ms ON, 200ms OFF, 2-second pause
- Quality Score: 95/100

**Story 5.2: Deployment Guide Generator (Done)** ✅
- Print-friendly deployment guides with bunker layout diagrams
- HTML print version complete
- Print CSS optimized for 8.5x11" paper
- Quality Score: 90/100

**Story 5.3: System Health Dashboard (Done)** ✅
- Backend endpoint `/api/v1/system/health` implemented
- React dashboard with 10-second polling
- Export functionality (JSON/CSV)
- Complete with backend and frontend integration

**Story 5.4: Production Deployment Scripts (Done)** ✅
- Fresh droplet validated Oct 28, 2025
- 58 automated BATS tests (100% pass rate)
- All deployment scripts tested: deploy-server.sh, build-web.sh, setup-db.sh
- Security improvements: password handling, nginx headers, systemd hardening
- Quality Score: 100/100

**Story 5.5: ESP32 OTA Firmware Update (Done)** ✅
- ESP-IDF OTA updater with 24-hour polling
- Backend firmware upload endpoint (admin-only)
- UI firmware version display
- Note: Optional/stretch goal for POC - complete but not required

**Story 5.6: Security Hardening (Done)** ✅
- Comprehensive security audit completed Oct 28, 2025
- All 10 ACs validated including live rate limiting test
- Bcrypt password hashing, JWT validation, CORS enforcement
- No SQL injection, XSS, or log leakage issues found
- Security checklist created: `docs/security-checklist.md`
- Quality Score: 100/100

**Story 5.7: Performance Optimization (Done)** ✅
- Bundle size optimized
- Database indexing complete
- Load testing validated
- Lighthouse Performance: 89/100, Accessibility: 88/100
- No memory leaks detected

**Story 5.8: Documentation Finalization (Done)** ✅
- Operator manual created: `docs/operator-manual.md`
- Troubleshooting guide: `docs/troubleshooting-guide.md`
- Known limitations: `docs/known-limitations.md`
- Future enhancements: `docs/future-enhancements.md`
- Server and web README files updated
- Completed Oct 28, 2025

**Story 5.10: Energy Savings Aggregation (Done)** ✅
- DeviceRuntimeLog model implemented
- Aggregation in SystemHealthService
- Cost savings calculations with electricity rates
- Unit tests for edge cases and multi-bunker scenarios

### 📋 Remaining Story (Epic 5)

**Story 5.9: Final POC Acceptance Testing (In Progress)** ⏳
- Acceptance report created: `docs/qa/Story-5.9-Final-POC-Acceptance-Report.md`
- Status: 46/47 stories complete (97.9%)
- All implementation work finished
- Next steps: E2E testing → UAT → Sign-off

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
Working on feature branch `jeff-final-test` (created from main, merged with Jeff branch).
All Epic 1 and Epic 2 stories validated and complete.
Currently working on Epic 5 - Deployment & Finalization (6/10 Done).

**Recent Branch Activity:**
- Created `jeff-final-test` from main (safety branch for validation)
- Merged `Jeff` into `jeff-final-test` successfully
- Resolved tsconfig.tsbuildinfo conflict
- Updated story statuses: 5.4, 5.6, 5.8 to "Done"

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

### Git History Context (Recent Commits)
- **Commit 0bf860e:** Add *.tsbuildinfo to .gitignore (merge conflict prevention)
- **Commit 9411baa:** Merge Jeff into jeff-final-test (Epic 1 validation)
- **Commit 5c9d118:** Remove tracked firmware test object files
- **Commit bdec0f2:** Epic 5: Add documentation, tests, build artifacts cleanup
- **Commit 70c9531:** Merge story-5.4-ac10-validation into Jeff
- **Commit eb52b6b:** Fix: SystemD hardening and missing dependency (Story 5.4 AC10)
- **Commit b5f3dde:** QA: Complete AC10 validation and Story 5.6 security review
- **Commit 94715d3:** Story 5.2 completed (deployment guide generator)
- **Commit f7b2ba3:** Story 5.1 tested (LED flash hardware validation)
- **Commit 8d45c9c:** Epic 2 nearly complete (untested 5)
- **Commit e5358e5:** Security: Remove test_config.h (Story 2.10)
- **Commit 310cc59:** Full testing of Epic 2 complete
- **Commit 5820e5e:** Fix: Relay unlock on server control restoration (CRITICAL)
- **Commit 6fd81c3:** Epic 1 Complete

### Epic 2 Progress Summary (11 total stories)
**✅ ALL COMPLETE: 11/11 stories Done** (Validated Oct 28, 2025)
- Stories 2.1-2.11: All backend APIs, control logic, firmware components, integration tests
- Average Quality Score: 94/100
- Hardware validation completed for Stories 2.1, 2.2, 2.3, 2.8
- Stories 2.7, 2.9: AC9 waived (hardware unavailable, production monitoring planned)
- Stories 2.10, 2.11: Code complete, backend telemetry validated

**🎯 Epic 2 Status:** 100% COMPLETE ✅
- All core functionality implemented and tested
- Safety-critical features validated (fail-safe, watchdog, relay unlock)
- Production-ready code with comprehensive test coverage
- Security hardening and power management complete

### Epic 5 Progress Summary (10 total stories)
**✅ DONE: 6 stories** (Deployment & Security complete)
- Stories 5.1, 5.2, 5.4, 5.6, 5.8: All deployment scripts, security hardening, documentation
- Average Quality Score: 96/100
- Fresh droplet validation completed Oct 28, 2025
- Security audit completed with 100/100 score

**⏳ READY FOR REVIEW: 2 stories** (Dev complete, awaiting QA)
- Story 5.3: System Health Dashboard
- Story 5.5: ESP32 OTA Update (optional)

**📝 READY FOR DEV: 2 stories**
- Story 5.7: Performance Optimization
- Story 5.9: Final POC Acceptance Testing
- Story 5.10: Energy Savings Aggregation (Draft)

**🎯 Epic 5 Status:** 60% COMPLETE
- Critical deployment infrastructure validated
- Security hardening and documentation finished
- Performance optimization and final testing remain

### Story Validation Session (Oct 28, 2025)
**Objective:** Systematic validation of all Epic 1, 2, and 5 stories to ensure accurate status tracking

**Actions Taken:**
1. **Epic 1 Validation:** Confirmed all 8 stories Done (already validated)
2. **Epic 2 Validation:**
   - Validated all 11 stories complete (updated status from "9 Done, 2 Approved")
   - Stories 2.8, 2.9: Confirmed QA approved with hardware validation
   - Stories 2.10, 2.11: Updated status from "Approved" to "Done"
3. **Epic 5 Validation:**
   - Validated 4 completed stories: 5.1, 5.2, 5.4 (already Done)
   - Discovered 2 additional completed stories: 5.6, 5.8 (updated to "Done")
   - Identified 2 stories awaiting QA: 5.3, 5.5
   - Identified 3 remaining stories: 5.7, 5.9, 5.10

**Key Findings:**
- Epic 2 is 100% complete (all 11 stories Done)
- Epic 5 is 60% complete (6/10 stories Done)
- Overall project: 25/29 stories complete (86%)
- Stories 5.6 and 5.8 had completed work but status not updated

**Documentation Updates:**
- Updated Story 5.6 status: Ready for Dev → Done
- Updated Story 5.8 status: Ready for Dev → Done
- Updated Story 5.4 status: Ready for Review → Done
- Updated CLAUDE.md with accurate progress tracking

**Overall Project Status:**
- **Epic 1:** 8/8 Done (100%) ✅
- **Epic 2:** 11/11 Done (100%) ✅
- **Epic 5:** 6/10 Done (60%) ⚡

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
