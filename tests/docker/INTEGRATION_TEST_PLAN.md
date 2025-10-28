# Integration Test Plan - Docker Environment

## Objective
Validate all deployment scripts in a controlled Docker environment that simulates a fresh Ubuntu 24.04 DigitalOcean droplet before production deployment.

## Test Environment
- **OS**: Ubuntu 24.04 LTS (Docker)
- **Database**: PostgreSQL 16
- **Web Server**: Nginx
- **Python**: 3.12+
- **User**: bunkercolab (with sudo)

## Test Sequence

### Phase 1: Database Setup ✓
**Script**: `scripts/setup-db.sh`

**Expected Outcomes:**
- PostgreSQL user `bunkercolab_user` created
- Database `bunkercolab` created with correct ownership
- Permissions granted correctly
- Password NOT displayed in output (security check)

**Success Criteria:**
- Script exits with code 0
- Can connect to database with credentials
- No errors in output

---

### Phase 2: Environment Configuration ✓
**Script**: Manual `.env.production` creation

**Expected Outcomes:**
- File created with all required variables
- Secret key generated (32+ bytes)
- Database URL formatted correctly
- File permissions set to 600 (readable only by owner)

**Success Criteria:**
- `.env.production` exists
- Contains all required keys from `.env.production.example`
- File permissions correct (`-rw-------`)

---

### Phase 3: Backend Deployment ✓
**Script**: `scripts/deploy-server.sh`

**Expected Outcomes:**
- Python virtual environment created in `server/venv`
- Dependencies installed from `requirements.txt`
- Alembic migrations applied successfully
- Systemd service file installed to `/etc/systemd/system/bunkercolab.service`
- Service started automatically

**Success Criteria:**
- Script exits with code 0
- Venv directory exists with correct structure
- `systemctl status bunkercolab` shows "active (running)"
- No migration errors
- Service accessible on localhost:8000

---

### Phase 4: Health Check Validation ✓
**Test**: HTTP health endpoint

**Expected Outcomes:**
- `curl http://localhost:8000/healthz` returns `{"status":"ok"}`
- Response code 200
- Response time < 1 second

**Success Criteria:**
- Health check returns expected JSON
- No connection errors
- Service responding correctly

---

### Phase 5: Frontend Build ✓
**Script**: `scripts/build-web.sh`

**Expected Outcomes:**
- npm dependencies installed
- Vite production build completes
- Assets deployed to `/var/www/bunkercolab`
- Files owned by `www-data:www-data`
- No path validation errors (safety check passes)

**Success Criteria:**
- Script exits with code 0
- `dist/` directory created
- Files copied to nginx root
- File ownership correct

---

### Phase 6: Rollback Test (Optional) ✓
**Script**: `scripts/rollback.sh`

**Expected Outcomes:**
- Git ref validation works
- Confirmation prompt appears
- Repository resets to specified commit
- Service restarts (if not `--no-restart`)

**Success Criteria:**
- Script validates git ref before reset
- User prompted for confirmation
- No data loss
- Service recovers after rollback

---

## Validation Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Database Connection | Success | `psql -U bunkercolab_user -d bunkercolab -c "SELECT 1"` |
| Backend Service Status | Active | `systemctl status bunkercolab` |
| Health Endpoint | 200 OK | `curl -f http://localhost:8000/healthz` |
| API Docs Available | 200 OK | `curl -f http://localhost:8000/docs` |
| Migration Status | Up-to-date | `alembic current` |
| File Permissions | Correct | Check `.env.production` is 600 |

---

## Known Limitations (Docker vs Real Droplet)

1. **Systemd**: May behave differently in container (requires privileged mode)
2. **SSL**: Let's Encrypt not tested (requires real domain)
3. **Network**: Container network ≠ public internet
4. **DNS**: Domain resolution not tested
5. **Email**: SMTP not configured (if needed)

---

## Exit Criteria

**PASS Conditions:**
- ✅ All scripts execute without errors
- ✅ Database accessible and migrations applied
- ✅ Backend service running and responsive
- ✅ Health endpoint returns correct response
- ✅ No security issues (passwords not exposed, permissions correct)

**FAIL Conditions:**
- ❌ Any script exits with non-zero code
- ❌ Service fails to start
- ❌ Database connection fails
- ❌ Health endpoint unreachable
- ❌ Permissions errors

---

## Post-Test Actions

**On SUCCESS:**
1. Document test results in story QA section
2. Update AC10 status to "VALIDATED (Docker)"
3. Update quality gate to reflect testing
4. Recommend story for "Done"
5. Prepare production deployment plan

**On FAILURE:**
1. Capture all error logs
2. Identify root cause
3. Fix scripts/configs
4. Re-run BATS tests
5. Retry integration test
6. Document findings

---

## Test Execution

```bash
# Start environment
cd tests/docker
docker-compose -f docker-compose.test.yml up -d

# Run automated test
docker exec -it bunkercolab-test-droplet bash /home/bunkercolab/Bunkercolab/tests/docker/test-deployment.sh

# Manual validation (if needed)
docker exec -it bunkercolab-test-droplet bash

# Cleanup
docker-compose -f docker-compose.test.yml down
```

---

**Test Coordinator**: Quinn (Test Architect)
**Date**: 2025-10-27
**Environment**: Docker (Ubuntu 24.04)
**Objective**: AC10 validation before production deployment
