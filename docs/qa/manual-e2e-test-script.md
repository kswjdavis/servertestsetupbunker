# Manual E2E Test Script - Story 5.9
**Test Date:** 2025-10-29
**Tester:** Jeff Davis + Sarah (PO)
**System URL:** https://206.189.210.203
**Status:** In Progress

---

## Pre-Test Setup

### 1. Verify System Accessibility
- [ ] Navigate to: https://206.189.210.203
- [ ] Accept self-signed certificate warning
- [ ] Confirm page loads: "Bunkercolab Dashboard"
- [ ] Backend health check: https://206.189.210.203/healthz should return `{"status":"ok"}`

### 2. Create Test User Account
**Why:** We need an authenticated user to test the full system

**Steps:**
1. Open API docs: https://206.189.210.203/docs
2. Find `POST /api/v1/auth/register` endpoint
3. Click "Try it out"
4. Use this test user:
```json
{
  "email": "test-e2e@bunkercolab.com",
  "password": "TestPass123!",
  "full_name": "E2E Test User",
  "role": "admin"
}
```
5. Click "Execute"
6. **Expected:** 201 Created response
7. **Record result:** [ ] PASS / [ ] FAIL
8. **Notes:** ___________________________________________

---

## E2E Scenario 1: Complete Device Lifecycle
**User Story 5.9 AC2:** End-to-end user scenarios tested successfully

### Test 1.1: User Login
1. Navigate to: https://206.189.210.203
2. You should see a login form
3. Enter credentials:
   - Email: `test-e2e@bunkercolab.com`
   - Password: `TestPass123!`
4. Click "Login" button
5. **Expected:** Redirect to dashboard, see navigation menu
6. **Result:** [ ] PASS / [ ] FAIL
7. **Screenshot location:** ___________________________________________
8. **Notes:** ___________________________________________

### Test 1.2: Create Bunker
**Location:** Main Dashboard or Bunkers page

1. Look for "Add Bunker" or "Create Bunker" button
2. Click to open form
3. Fill in test bunker details:
   - **Name:** Test Bunker E2E-001
   - **Latitude:** 41.8781 (Chicago area)
   - **Longitude:** -87.6298
   - **Orientation:** 90 (degrees)
   - **Fan Count:** 8
   - **Wind Threshold:** 10 mph
4. Click "Save" or "Create"
5. **Expected:**
   - Success message appears
   - New bunker appears in list/map
   - Bunker shows "No devices" or "0 devices online"
6. **Result:** [ ] PASS / [ ] FAIL
7. **Bunker ID created:** ___________________________________________
8. **Notes:** ___________________________________________

### Test 1.3: Provision Device
**Prerequisites:** Bunker created in Test 1.2

1. Navigate to the bunker detail page (click on the bunker)
2. Look for "Provision Device" or "Add Device" button
3. Click to open provisioning wizard
4. Fill in device details:
   - **Device Name:** ESP32-E2E-001
   - **MAC Address:** AA:BB:CC:DD:EE:01 (test MAC)
   - **Bunker:** Select "Test Bunker E2E-001"
5. Click "Provision" or "Create Device"
6. **Expected:**
   - Success message
   - Auth token displayed (UUID format)
   - Device appears in device list
   - Status shows "Offline" or "Disconnected"
7. **Result:** [ ] PASS / [ ] FAIL
8. **Auth Token:** ___________________________________________
9. **Notes:** ___________________________________________

### Test 1.4: View Device List
1. Navigate to "Devices" page
2. **Expected:**
   - See device "ESP32-E2E-001"
   - Status: Offline
   - Associated bunker: Test Bunker E2E-001
   - Last seen: "Never" or empty
3. **Result:** [ ] PASS / [ ] FAIL
4. **Notes:** ___________________________________________

### Test 1.5: Simulate Device Status Report (API)
**Why:** We don't have physical ESP32 hardware, so we'll simulate status reports via API

**Use API Docs:** https://206.189.210.203/docs

1. Find `POST /api/v1/control/status` endpoint
2. Click "Try it out"
3. Need to authenticate:
   - Click the lock icon 🔒 next to the endpoint
   - Enter bearer token from device provisioning (Test 1.3)
   - Format: `Bearer <auth_token>`
4. Send test status:
```json
{
  "fan_status": "OFF",
  "dead_man_timer_active": false,
  "wifi_rssi": -55,
  "heap_free": 150000,
  "uptime_seconds": 300,
  "firmware_version": "1.0.0-test"
}
```
5. Click "Execute"
6. **Expected:** 200 OK response
7. **Result:** [ ] PASS / [ ] FAIL
8. **Notes:** ___________________________________________

### Test 1.6: Verify Device Shows Online
1. Return to Devices page or Dashboard
2. Refresh page
3. **Expected:**
   - Device status: "Online" or "Connected"
   - Last seen: recent timestamp
   - Fan status: "OFF"
4. **Result:** [ ] PASS / [ ] FAIL
5. **Notes:** ___________________________________________

### Test 1.7: View Energy Savings (if available)
1. Navigate to System Health Dashboard or Bunker Detail
2. Look for energy savings display
3. **Expected:**
   - Energy savings widget visible
   - Shows hours saved, kWh saved, cost savings
   - Values may be zero (device just connected)
4. **Result:** [ ] PASS / [ ] FAIL / [ ] FEATURE NOT VISIBLE
5. **Notes:** ___________________________________________

---

## E2E Scenario 2: Emergency Controls
**User Story 5.9 AC2, AC3:** Emergency response and fail-safe behavior

### Test 2.1: Emergency ON - Single Bunker
1. Navigate to bunker detail page (Test Bunker E2E-001)
2. Find "Emergency ON" button (usually red, prominent)
3. Click "Emergency ON"
4. **Expected:**
   - Confirmation dialog appears
   - After confirming, success message
   - Emergency indicator appears on bunker
5. **Result:** [ ] PASS / [ ] FAIL
6. **Notes:** ___________________________________________

### Test 2.2: Verify Emergency Status via API
1. Send another status report via `POST /api/v1/control/status` (see Test 1.5)
2. **Expected response includes:**
```json
{
  "command": "TURN_ON",
  "reason": "emergency_mode"
}
```
3. **Result:** [ ] PASS / [ ] FAIL
4. **Notes:** ___________________________________________

### Test 2.3: Clear Emergency Mode
1. Return to bunker detail page
2. Find "Clear Emergency" or "Resume Normal" button
3. Click to clear emergency mode
4. **Expected:**
   - Success message
   - Emergency indicator removed
   - Next status report should return normal control logic
5. **Result:** [ ] PASS / [ ] FAIL
6. **Notes:** ___________________________________________

### Test 2.4: Emergency ON All (Global)
1. Navigate to main dashboard or settings
2. Find "Emergency ON All" or global emergency button
3. Click button
4. **Expected:**
   - Confirmation dialog
   - All bunkers marked as emergency
   - Success message
5. **Result:** [ ] PASS / [ ] FAIL
6. **Notes:** ___________________________________________

---

## E2E Scenario 3: Configuration Management
**User Story 5.9 AC2:** Configuration changes propagate correctly

### Test 3.1: Change Global Wind Threshold
1. Navigate to "Settings" or "Global Config" page
2. Find "Wind Threshold" setting
3. Current value: _____ mph
4. Change to: **15 mph**
5. Click "Save"
6. **Expected:** Success message
7. **Result:** [ ] PASS / [ ] FAIL
8. **Notes:** ___________________________________________

### Test 3.2: Verify Threshold Change via API
1. Use API docs: `GET /api/v1/config` (or similar endpoint)
2. Retrieve global config
3. **Expected:** `wind_threshold: 15`
4. **Result:** [ ] PASS / [ ] FAIL
5. **Notes:** ___________________________________________

### Test 3.3: Per-Bunker Configuration Override (if available)
1. Navigate to Test Bunker E2E-001 detail page
2. Look for "Override Settings" or "Configuration" section
3. Set bunker-specific wind threshold: **12 mph**
4. Click "Save"
5. **Expected:**
   - Success message
   - Bunker now uses 12 mph instead of global 15 mph
6. **Result:** [ ] PASS / [ ] FAIL / [ ] FEATURE NOT AVAILABLE
7. **Notes:** ___________________________________________

### Test 3.4: Time Window Override (if available)
**Feature:** Story 4.6 - Scheduled ON/OFF windows

1. Navigate to Time Windows or Schedule page
2. Click "Add Override"
3. Create test override:
   - **Bunker:** Test Bunker E2E-001
   - **Start Time:** Current time + 2 minutes
   - **End Time:** Current time + 10 minutes
   - **Override Type:** Force ON
4. Click "Save"
5. **Expected:**
   - Override appears in list
   - Shows as "Upcoming" or "Scheduled"
6. Wait 2 minutes, refresh page
7. **Expected:**
   - Override now shows "Active"
   - Bunker control respects override
8. **Result:** [ ] PASS / [ ] FAIL / [ ] FEATURE NOT AVAILABLE
9. **Notes:** ___________________________________________

---

## E2E Scenario 4: Weather Integration
**User Story 2.4:** Weather data integration

### Test 4.1: View Current Weather
1. Navigate to Dashboard or Settings
2. Look for weather widget/display
3. **Expected:**
   - Current wind speed displayed
   - Current wind direction displayed
   - Temperature (optional)
   - Last update timestamp
4. **Result:** [ ] PASS / [ ] FAIL
5. **Current weather shown:** ___________________________________________
6. **Notes:** ___________________________________________

### Test 4.2: Weather Data via API
1. API docs: `GET /api/v1/weather/current`
2. Authenticate with user token (from login)
3. Execute request
4. **Expected response:**
```json
{
  "wind_speed_mph": <number>,
  "wind_direction_degrees": <number>,
  "temperature_f": <number>,
  "timestamp": "<ISO timestamp>"
}
```
5. **Result:** [ ] PASS / [ ] FAIL
6. **Notes:** ___________________________________________

### Test 4.3: Control Logic Decision (Simulated)
**Goal:** Verify fans turn ON when wind is favorable

**Prerequisites:**
- Global wind threshold: 15 mph (from Test 3.1)
- Bunker orientation: 90° (from Test 1.2)

1. Check current wind direction via weather API (Test 4.2)
2. Send device status with favorable wind (wind from opposite direction of bunker):
   - If bunker faces 90° (East), favorable wind is from West (270°)
3. Use `POST /api/v1/control/status` with:
```json
{
  "fan_status": "OFF",
  "dead_man_timer_active": false,
  "wifi_rssi": -55,
  "heap_free": 150000,
  "uptime_seconds": 600,
  "firmware_version": "1.0.0-test"
}
```
4. **Expected response:**
   - If wind speed > 15 mph AND wind direction favorable: `"command": "TURN_ON"`
   - Otherwise: `"command": "TURN_OFF"` or `"command": "NO_CHANGE"`
5. **Result:** [ ] PASS / [ ] FAIL / [ ] INCONCLUSIVE (no favorable wind)
6. **Notes:** ___________________________________________

---

## Real-Time Updates Testing
**User Story 3.8:** Real-time polling

### Test 5.1: Dashboard Auto-Refresh
1. Keep dashboard open
2. In another tab, send device status via API (Test 1.5)
3. Wait 5-10 seconds
4. **Expected:** Dashboard updates without manual refresh
5. **Result:** [ ] PASS / [ ] FAIL
6. **Polling interval observed:** ___________________________________________
7. **Notes:** ___________________________________________

---

## Responsive Design Testing
**User Story 3.9:** Responsive layout

### Test 6.1: Mobile View (Narrow Screen)
1. Resize browser to ~375px width (iPhone size)
2. Navigate through:
   - Dashboard
   - Device list
   - Bunker detail
   - Settings
3. **Expected:**
   - No horizontal scrolling
   - Buttons/forms usable
   - Text readable
   - Navigation menu adapts (hamburger menu?)
4. **Result:** [ ] PASS / [ ] FAIL
5. **Notes:** ___________________________________________

### Test 6.2: Tablet View (Medium Screen)
1. Resize browser to ~768px width (iPad size)
2. Verify layouts adapt correctly
3. **Result:** [ ] PASS / [ ] FAIL
4. **Notes:** ___________________________________________

---

## System Stability Tests

### Test 7.1: Backend Health Check
1. Every 5 minutes, check: https://206.189.210.203/healthz
2. **Expected:** Always returns `{"status":"ok"}`
3. **Duration:** Run for 30 minutes minimum
4. **Results:**
   - Check 1 (T+0): [ ] PASS / [ ] FAIL
   - Check 2 (T+5): [ ] PASS / [ ] FAIL
   - Check 3 (T+10): [ ] PASS / [ ] FAIL
   - Check 4 (T+15): [ ] PASS / [ ] FAIL
   - Check 5 (T+20): [ ] PASS / [ ] FAIL
   - Check 6 (T+25): [ ] PASS / [ ] FAIL
   - Check 7 (T+30): [ ] PASS / [ ] FAIL

### Test 7.2: Multiple Rapid API Calls
**Goal:** Verify system handles load without errors

1. Send 10 rapid status reports in succession (via API)
2. **Expected:** All return 200 OK
3. **Result:** [ ] PASS / [ ] FAIL
4. **Notes:** ___________________________________________

---

## Cleanup & Teardown

### Test 8.1: Delete Device
1. Navigate to device list
2. Find ESP32-E2E-001
3. Click "Delete" or "Remove"
4. Confirm deletion
5. **Expected:** Device removed from list
6. **Result:** [ ] PASS / [ ] FAIL

### Test 8.2: Delete Bunker
1. Navigate to bunker list
2. Find Test Bunker E2E-001
3. Click "Delete" or "Remove"
4. Confirm deletion
5. **Expected:** Bunker removed from list/map
6. **Result:** [ ] PASS / [ ] FAIL

---

## Test Summary

**Total Tests Executed:** ______ / 40
**Tests Passed:** ______
**Tests Failed:** ______
**Tests Inconclusive:** ______
**Features Not Available:** ______

**Critical Issues Found:** ______
**High Priority Issues:** ______
**Medium Priority Issues:** ______
**Low Priority Issues:** ______

**Overall Assessment:** [ ] PASS / [ ] PASS WITH ISSUES / [ ] FAIL

**Tester Sign-off:** _____________________ Date: _________

**Product Owner Sign-off:** _____________________ Date: _________

---

## Notes & Observations

(Add any additional observations, screenshots, or context here)
