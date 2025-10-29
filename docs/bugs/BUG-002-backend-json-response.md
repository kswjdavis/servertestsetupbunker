# BUG-002: Backend Returns Malformed JSON Response

**Date Discovered:** October 28, 2025
**Discovered By:** James (Dev Agent) during Story 2.11 validation
**Severity:** MEDIUM (Device functional, but response parsing fails)
**Status:** IDENTIFIED - Backend Work Required

---

## Summary

The backend server at `http://206.189.210.203/api/v1/control/status` returns HTTP 200 OK but:
1. Response JSON cannot be parsed by firmware
2. Missing expected control fields (shutdown_allowed, reset_countdown, server_time)

---

## Firmware Logs

```
I (67727) http_client: HTTP Status = 200, content_length = 124
I (67731) http_client: Status reported successfully (HTTP 200)
W (67731) http_client: Failed to parse server response JSON
I (67733) main: Status accepted by server (HTTP 200)
W (67738) main: Server response missing expected control fields
```

---

## Expected Response Format

According to `firmware/main/http_client.c` lines 207-223, the firmware expects:

```json
{
  "shutdown_allowed": true|false,
  "reset_countdown": true|false,
  "server_time": "2025-10-28T17:28:25Z"
}
```

---

## Current Behavior

- Backend returns 124 bytes
- JSON parsing fails in `cJSON_Parse(response.body)`
- Device continues operating (fail-safe behavior)
- Status reports continue every 60 seconds

---

## Impact

- ⚠️ **Device cannot receive shutdown commands** from server
- ⚠️ **Dead-man timer cannot be reset remotely**
- ⚠️ **Server time synchronization not working**
- ✅ **Device remains operational** (fail-safe keeps fans ON)

---

## Root Cause Analysis

Likely causes:
1. Backend `DeviceStatus` model not updated with new telemetry fields
2. Backend not returning proper JSON structure
3. Backend database migration not applied (Story 2.11 Phase 5 backend tasks)

---

## Required Backend Changes

1. **Update `server/app/models/device_status.py`:**
   - Add: `free_heap_bytes` (Integer, nullable)
   - Add: `wifi_ps_mode` (SmallInteger, nullable)
   - Add: `cpu_freq_mhz` (SmallInteger, nullable)
   - Add: `watchdog_reset_count` (SmallInteger, nullable)
   - Add: `last_reset_reason` (String(20), nullable)

2. **Create database migration:**
   ```bash
   cd server
   alembic revision --autogenerate -m "Add power and health metrics"
   alembic upgrade head
   ```

3. **Fix response format in `/api/v1/control/status` endpoint:**
   - Must return valid JSON with expected fields
   - Include shutdown_allowed, reset_countdown, server_time

---

## Workaround

Device operates in fail-safe mode:
- Fans remain ON (safe default)
- Status reports continue
- No remote control capability

---

## Validation

After backend fix, verify:
- [ ] Firmware parses JSON successfully (no warning logs)
- [ ] All telemetry fields stored in database
- [ ] Shutdown commands work
- [ ] Dead-man timer reset works
- [ ] Server time field present

---

## Related Stories

- Story 2.11: Power Management (Phase 5 backend tasks incomplete)
- Story 2.7: ESP32 Complete Control Loop (control decision logic)

---

## Files Affected

**Backend:**
- `server/app/models/device_status.py`
- `server/app/repositories/device_status_repo.py`
- `server/alembic/versions/` (new migration needed)
- API endpoint implementation

**Firmware** (no changes needed):
- `firmware/main/http_client.c` (JSON parsing correct)
