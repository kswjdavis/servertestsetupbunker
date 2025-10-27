# Epic 2 Reliability Review - Critical Findings

**Document Type:** Quality Assurance Review
**Review Date:** 2025-10-25
**Reviewer:** Quinn (Test Architect)
**Scope:** Epic 2 (Stories 2.1-2.9) - Control & Safety Systems
**Target Audience:** Product Owner, Technical Leadership

---

## Executive Summary

A comprehensive reliability review of Epic 2 firmware has identified **4 significant issues** that require attention before production deployment. One issue is a **production blocker** (HTTP/HTTPS mismatch), while three others represent important quality and operational improvements.

### Critical Findings Overview

| Issue | Severity | Production Blocker? | Estimated Fix |
|-------|----------|---------------------|---------------|
| 1. HTTP vs HTTPS Configuration Mismatch | **HIGH** | ✅ **YES** | 1 hour |
| 2. Power Management Disabled | **HIGH** | ⚠️ Conditional | 4-6 hours |
| 3. Incomplete Watchdog Coverage | **MEDIUM** | ❌ No | 2-3 hours |
| 4. Incomplete Power/Health Telemetry | **MEDIUM** | ❌ No | 2-3 hours |

**Recommendation:** Fix Issue #1 immediately. Address Issues #2-4 based on deployment scenario and operational requirements.

---

## Issue #1: HTTP vs HTTPS Configuration Mismatch 🚨

### Severity: **HIGH** - Production Blocker

### The Problem

The test configuration file contains hardcoded credentials that create a **critical security and functionality mismatch**:

**File:** `firmware/main/test_config.h`

```c
#define TEST_WIFI_SSID      "Davis"
#define TEST_WIFI_PASSWORD  "jeffmary"
#define TEST_SERVER_URL     "http://206.189.210.203"  // ← Plain HTTP
#define TEST_AUTH_TOKEN     "1bc580a0-5be2-4b83-99f6-e8e08a29a334"
#define ENABLE_TEST_MODE    1
```

**Why This Fails:**
1. Test config specifies `http://` (plain HTTP)
2. HTTP client code **always** configures SSL transport (`HTTP_TRANSPORT_OVER_SSL`)
3. SSL client attempting to connect to plain HTTP endpoint = **connection failure**
4. **Real production credentials checked into version control** (WiFi password, auth token)

### Impact

- **Security Violation:** Violates PRD requirement for HTTPS with certificate validation (docs/prd.md:53-54)
- **Connection Failure:** Test mode firmware cannot connect to production server (SSL handshake on HTTP port fails)
- **Credential Exposure:** Live WiFi password and authentication token committed to repository
- **Production Risk:** Test mode accidentally enabled in production builds would expose credentials

### Evidence

**HTTP Client Configuration** (`firmware/main/http_client.c:476`):
```c
esp_http_client_config_t config = {
    .url = url,  // Contains http:// from test config
    .transport_type = HTTP_TRANSPORT_OVER_SSL,  // ← Forces SSL!
    .crt_bundle_attach = esp_crt_bundle_attach,
    // ... SSL configured but URL is HTTP
};
```

**Observed During Testing:**
- Hardware validation sessions today successfully connected because we used NVS provisioning with correct HTTPS URL
- If `ENABLE_TEST_MODE` had been active, connection would have failed

### Recommended Fix

**Option 1 (PREFERRED): Remove test_config.h entirely**
```bash
# Delete the file
git rm firmware/main/test_config.h

# Update main.c to remove test mode logic
# Use only NVS provisioning for all configurations
```

**Option 2: Fix the URL (if test mode is needed)**
```c
// Change to HTTPS:
#define TEST_SERVER_URL     "https://206.189.210.203"

// Use non-production credentials:
#define TEST_AUTH_TOKEN     "test-device-token-not-real"
```

**Option 3: Make test mode more secure**
```c
// Read from environment variables at compile time:
#ifndef TEST_SERVER_URL
#error "TEST_SERVER_URL must be defined via -DTEST_SERVER_URL=..."
#endif

// Never commit credentials to repository
```

### Priority: **CRITICAL - Must fix before production deployment**

---

## Issue #2: Power Management Disabled ⚡

### Severity: **HIGH** - Conditional Blocker

### The Problem

ESP32 power management is completely disabled, causing the device to run at **full power continuously**:

**Current Configuration** (`firmware/sdkconfig:1041`):
```
# CONFIG_PM_ENABLE is not set
```

**WiFi Manager** (`firmware/main/wifi_manager.c:65-123`):
- Never calls `esp_wifi_set_ps()` to enable modem sleep
- Never configures `esp_pm_configure()` for frequency scaling
- WiFi radio stays on at full power 24/7

### Impact

**Power Consumption:**
- **Current:** ~200mA continuous (full power, 240MHz CPU, WiFi always on)
- **With PM:** ~20-50mA average (modem sleep, frequency scaling, light sleep)
- **Difference:** **10x higher power consumption than necessary**

**Deployment Scenarios:**

| Deployment Type | Impact | Priority |
|----------------|--------|----------|
| **Mains/Grid Power** | Low - electricity cost negligible | Medium |
| **Solar + Battery Backup** | High - drains backup battery faster | High |
| **Solar Only (no grid)** | Critical - may not sustain 24/7 operation | Critical |
| **Battery Only** | Critical - short runtime | Critical |

### Evidence

**Research Documentation:** `docs/ESP32_ESP-IDF_Best_Practices_Research/13-power-optimization.md:21-75,185-194`
- Recommends modem-sleep for WiFi applications
- Suggests frequency scaling (240MHz → 80MHz when idle)
- Espressif examples show 5-10x power reduction with PM enabled

**Official ESP-IDF Guide** (referenced in review):
- Confirms `CONFIG_PM_ENABLE` required for power management
- Recommends `esp_pm_configure()` for dynamic frequency scaling
- WiFi modem sleep reduces average current by 50-80%

### Recommended Fix

**Step 1: Enable Power Management in sdkconfig**
```bash
# Run menuconfig
cd firmware
idf.py menuconfig

# Navigate to: Component config → Power Management
# Enable: [*] Support for power management
# Save and exit
```

**Step 2: Configure WiFi Modem Sleep** (`firmware/main/wifi_manager.c`)
```c
// After esp_wifi_start() in wifi_manager_init():
esp_err_t err = esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
if (err != ESP_OK) {
    ESP_LOGW(TAG, "Failed to enable WiFi power save: %s", esp_err_to_name(err));
} else {
    ESP_LOGI(TAG, "WiFi modem sleep enabled");
}
```

**Step 3: Configure Dynamic Frequency Scaling** (`firmware/main/main.c`)
```c
#include "esp_pm.h"

// In app_main() after NVS init:
esp_pm_config_esp32_t pm_config = {
    .max_freq_mhz = 240,  // Full speed when active
    .min_freq_mhz = 80,   // Scale down when idle (saves ~50% power)
    .light_sleep_enable = true
};
esp_err_t err = esp_pm_configure(&pm_config);
if (err == ESP_OK) {
    ESP_LOGI(TAG, "Power management configured: 80-240MHz dynamic scaling");
} else {
    ESP_LOGW(TAG, "Power management config failed: %s", esp_err_to_name(err));
}
```

### Expected Results

**Power Savings:**
- WiFi modem sleep: -50% average current (~100mA → ~50mA)
- Frequency scaling: Additional -30% when idle
- Light sleep during delays: Up to -80% during idle periods

**Battery Life Example:**
- 10,000mAh battery @ 200mA = 50 hours
- 10,000mAh battery @ 30mA = **333 hours (13.9 days)**

### Priority: **HIGH for solar/battery deployments, MEDIUM for mains power**

---

## Issue #3: Incomplete Watchdog Coverage 🐕

### Severity: **MEDIUM** - Safety Enhancement

### The Problem

The Task Watchdog Timer (TWDT) only monitors the main control loop, leaving other critical subsystems unmonitored:

**Current Configuration** (`firmware/main/watchdog_manager.c:45-58`):
```c
const esp_task_wdt_config_t config = {
    .timeout_ms = WATCHDOG_TIMEOUT_SECONDS * 1000,
    .idle_core_mask = 0,  // ← Idle tasks NOT monitored
    .trigger_panic = true,
};
```

**Tasks Monitored:**
- ✅ `control_loop_task` (main control logic)

**Tasks NOT Monitored:**
- ❌ WiFi stack tasks
- ❌ Idle tasks (both CPU cores)
- ❌ Dead-man timer (passive component, no task)

### Impact

**Risk Scenario: WiFi Stack Hangs**
1. WiFi driver encounters bug and hangs
2. Control loop continues running normally
3. Watchdog sees control loop alive → no timeout
4. **Result:** System appears operational but cannot communicate (zombie state)

**Risk Scenario: Idle Task Starvation**
1. High-priority task runs indefinitely
2. Idle task never runs (FreeRTOS health indicator)
3. Watchdog doesn't monitor idle tasks
4. **Result:** System degradation goes undetected

### Evidence

**ESP-IDF Documentation** (referenced in review):
- Recommends monitoring idle tasks for complete coverage
- `idle_core_mask` parameter specifically designed for this purpose
- Espressif examples show `(1 << 0) | (1 << 1)` for both cores

**Research Documentation:** `docs/ESP32_ESP-IDF_Best_Practices_Research/4-watchdog-timers-and-dead-man-timer.md:12-90`
- Recommends monitoring all critical workers
- Idle task monitoring catches scheduler issues

### Recommended Fix

**Update Watchdog Configuration** (`firmware/main/watchdog_manager.c`)
```c
const esp_task_wdt_config_t config = {
    .timeout_ms = WATCHDOG_TIMEOUT_SECONDS * 1000,
    .idle_core_mask = (1 << 0) | (1 << 1),  // ← Monitor both cores
    .trigger_panic = true,
};

ESP_LOGI(TAG, "Watchdog initialized: timeout=%ds, monitoring control loop + idle tasks",
         WATCHDOG_TIMEOUT_SECONDS);
```

**Optional: Monitor WiFi Task** (if you have custom WiFi event handler task)
```c
// In WiFi manager's custom event handler task (if exists):
watchdog_manager_subscribe_current_task("wifi_events");
```

### Expected Results

**Improved Failure Detection:**
- System reboots if WiFi stack hangs (network recovery)
- System reboots if scheduler becomes unbalanced (catches CPU hogging)
- More comprehensive health monitoring

**Trade-off:**
- Slightly more watchdog triggers during legitimate heavy processing
- Requires tuning timeout if adding more monitored tasks

### Priority: **MEDIUM - Recommended for production, not blocking**

---

## Issue #4: Incomplete Power/Health Telemetry 📊

### Severity: **MEDIUM** - Operational Visibility

### The Problem

Status reports to the server contain basic metrics but omit critical power and health indicators needed for:
- 24-hour endurance test validation
- Remote power optimization verification
- Production health monitoring

**Current Status Report** (`firmware/main/main.c:274-280`):
```c
device_status_t status = {
    .relay_state = relay_get_state(),
    .uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000),
    .wifi_rssi = (int32_t)wifi_manager_get_rssi(),
    .countdown_timer_remaining = deadman_timer_get_remaining(),
    .firmware_version = FIRMWARE_VERSION,
};
```

**Only Logged Locally:** `"Free heap: %u bytes"` (line 322)

**Missing Metrics:**
- ❌ WiFi power save mode status (modem sleep enabled/disabled)
- ❌ CPU frequency (for power optimization validation)
- ❌ Free heap size (logged locally but not sent to server)
- ❌ Watchdog reset count (for reliability trending)
- ❌ Last reset reason (power cycle vs watchdog vs crash)

### Impact

**Testing:**
- Cannot validate power optimization in 24-hour tests
- Hardware test procedures expect these metrics (firmware/docs/HARDWARE_TEST_PROCEDURES.md:24-119)
- Research doc recommends logging PS mode and CPU frequency (docs/ESP32_ESP-IDF_Best_Practices_Research/13-power-optimization.md:161-180)

**Production:**
- Cannot remotely verify power management is working
- Harder to diagnose field issues (no historical health data)
- Cannot detect memory leaks over time
- Cannot track device reliability (reset counts)

### Recommended Fix

**Step 1: Expand device_status_t struct** (`firmware/main/device_status.h` or similar)
```c
typedef struct {
    // Existing fields
    const char *relay_state;
    uint32_t uptime_seconds;
    int32_t wifi_rssi;
    uint32_t countdown_timer_remaining;
    const char *firmware_version;

    // NEW: Power/health metrics
    uint32_t free_heap_bytes;        // Memory health
    uint8_t wifi_ps_mode;            // 0=none, 1=min_modem, 2=max_modem
    uint16_t cpu_freq_mhz;           // Current CPU frequency
    uint8_t watchdog_reset_count;    // From RTC memory
    const char *last_reset_reason;   // "POWERON", "WATCHDOG", "SW_RESET", etc.
} device_status_t;
```

**Step 2: Populate new fields** (`firmware/main/main.c`)
```c
device_status_t status = {
    // Existing...
    .relay_state = relay_get_state(),
    .uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000),
    .wifi_rssi = (int32_t)wifi_manager_get_rssi(),
    .countdown_timer_remaining = deadman_timer_get_remaining(),
    .firmware_version = FIRMWARE_VERSION,

    // NEW:
    .free_heap_bytes = esp_get_free_heap_size(),
    .wifi_ps_mode = wifi_manager_get_ps_mode(),  // New function
    .cpu_freq_mhz = (uint16_t)(esp_clk_cpu_freq() / 1000000),
    .watchdog_reset_count = watchdog_manager_get_reset_count(),  // From RTC memory
    .last_reset_reason = get_reset_reason_string(),  // New function
};
```

**Step 3: Add helper functions**
```c
// In wifi_manager.c:
uint8_t wifi_manager_get_ps_mode(void) {
    wifi_ps_type_t ps_type;
    esp_wifi_get_ps(&ps_type);
    return (uint8_t)ps_type;
}

// In watchdog_manager.c:
uint8_t watchdog_manager_get_reset_count(void) {
    return s_watchdog_reset_count;  // Already tracked in RTC memory
}

// In main.c or new file:
const char* get_reset_reason_string(void) {
    esp_reset_reason_t reason = esp_reset_reason();
    switch (reason) {
        case ESP_RST_POWERON:   return "POWERON";
        case ESP_RST_SW:        return "SOFTWARE";
        case ESP_RST_PANIC:     return "PANIC";
        case ESP_RST_INT_WDT:   return "INT_WATCHDOG";
        case ESP_RST_TASK_WDT:  return "TASK_WATCHDOG";
        case ESP_RST_WDT:       return "WATCHDOG";
        case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
        case ESP_RST_BROWNOUT:  return "BROWNOUT";
        default:                return "UNKNOWN";
    }
}
```

**Step 4: Update backend schema** (`server/app/models/device_status.py`)
```python
class DeviceStatus(Base):
    # Existing columns...
    relay_state = Column(String(10))
    uptime_seconds = Column(Integer)
    wifi_rssi = Column(Integer)
    countdown_timer_remaining = Column(Integer)
    firmware_version = Column(String(50))

    # NEW columns:
    free_heap_bytes = Column(Integer, nullable=True)
    wifi_ps_mode = Column(SmallInteger, nullable=True)  # 0/1/2
    cpu_freq_mhz = Column(SmallInteger, nullable=True)
    watchdog_reset_count = Column(SmallInteger, nullable=True)
    last_reset_reason = Column(String(20), nullable=True)
```

**Step 5: Create database migration**
```bash
cd server
alembic revision --autogenerate -m "Add power and health metrics to device_status"
alembic upgrade head
```

### Expected Results

**Testing Benefits:**
- ✅ Validate power optimization remotely (check WiFi PS mode, CPU freq)
- ✅ Track memory stability over 24+ hours (heap trends)
- ✅ Certify watchdog reliability (reset count should stay 0 in production)

**Production Benefits:**
- ✅ Remote health monitoring dashboard
- ✅ Detect memory leaks early (heap decreasing over time)
- ✅ Track device reliability (reset reasons, reset frequency)
- ✅ Verify power management is active (WiFi PS mode = 1 or 2)

### Priority: **MEDIUM - Highly recommended for production operations**

---

## Implementation Plan

### Phase 1: Critical Fixes (MUST DO) - 1 hour

**Deliverable:** Production-ready security and connectivity

1. **Fix Issue #1: HTTP/HTTPS Mismatch**
   - [ ] Change `TEST_SERVER_URL` to `https://206.189.210.203` in test_config.h
   - [ ] OR delete test_config.h entirely and use only NVS provisioning
   - [ ] Test firmware connects successfully with HTTPS
   - [ ] Remove hardcoded credentials from version control
   - **Assignee:** Firmware Developer
   - **Verification:** Quinn (Hardware Test)

### Phase 2: Power Optimization (SHOULD DO) - 4-6 hours

**Deliverable:** 10x power consumption reduction for battery deployments

2. **Fix Issue #2: Enable Power Management**
   - [ ] Enable `CONFIG_PM_ENABLE` in sdkconfig
   - [ ] Add `esp_wifi_set_ps(WIFI_PS_MIN_MODEM)` to WiFi manager
   - [ ] Add `esp_pm_configure()` to main.c
   - [ ] Test power consumption with multimeter (expect <50mA average)
   - [ ] Validate WiFi stability with power management enabled
   - **Assignee:** Firmware Developer
   - **Verification:** Quinn (Hardware Power Test)

### Phase 3: Safety & Operations (RECOMMENDED) - 4-6 hours

**Deliverable:** Enhanced failure detection and operational visibility

3. **Fix Issue #3: Expand Watchdog Coverage**
   - [ ] Set `idle_core_mask = (1 << 0) | (1 << 1)` in watchdog config
   - [ ] Test watchdog triggers correctly with idle task starvation
   - **Assignee:** Firmware Developer
   - **Verification:** Quinn (Integration Test)

4. **Fix Issue #4: Add Power/Health Telemetry**
   - [ ] Expand `device_status_t` struct with new fields
   - [ ] Implement helper functions (get_ps_mode, get_reset_reason, etc.)
   - [ ] Update backend model and create migration
   - [ ] Test end-to-end data flow
   - [ ] Create monitoring dashboard queries
   - **Assignee:** Firmware Developer + Backend Developer
   - **Verification:** Quinn (E2E Test)

---

## Risk Assessment

### If Issues NOT Fixed

| Issue | Risk Level | Consequence |
|-------|-----------|-------------|
| **#1 (HTTP/HTTPS)** | **CRITICAL** | Production deployment will fail to connect. Security violation. Credentials exposed. |
| **#2 (Power Mgmt)** | **HIGH*** | Battery deployments may fail. 10x higher power consumption. (*conditional on deployment type) |
| **#3 (Watchdog)** | **MEDIUM** | Incomplete failure detection. WiFi hangs may go undetected. Longer downtime. |
| **#4 (Telemetry)** | **LOW** | Reduced operational visibility. Harder to diagnose issues. Cannot validate power optimization. |

### Deployment Recommendations by Scenario

**Scenario A: Mains Power Installation**
- Fix: #1 (required)
- Optional: #2 (nice to have), #3 (recommended), #4 (recommended)

**Scenario B: Solar + Battery Backup**
- Fix: #1 (required), #2 (required)
- Optional: #3 (recommended), #4 (highly recommended)

**Scenario C: Solar/Battery Only (Off-Grid)**
- Fix: #1 (required), #2 (required), #3 (required), #4 (highly recommended)

---

## Testing Requirements

### Acceptance Criteria for Fixes

**Issue #1 (HTTP/HTTPS):**
- [ ] Firmware connects successfully to `https://206.189.210.203`
- [ ] TLS certificate validation works
- [ ] No hardcoded credentials in repository
- [ ] Test mode disabled or removed from production builds

**Issue #2 (Power Management):**
- [ ] `CONFIG_PM_ENABLE=y` in sdkconfig
- [ ] WiFi modem sleep enabled (verified in logs)
- [ ] CPU frequency scaling active (verified in status reports)
- [ ] Power consumption measured <50mA average (hardware test)
- [ ] WiFi connectivity stable over 1+ hour

**Issue #3 (Watchdog Coverage):**
- [ ] Idle task monitoring enabled (both cores)
- [ ] Watchdog triggers on idle task starvation test
- [ ] All monitored tasks listed in boot logs

**Issue #4 (Power/Health Telemetry):**
- [ ] New fields present in status reports
- [ ] Backend receives and stores new metrics
- [ ] Database migration applied successfully
- [ ] Monitoring queries return expected data

---

## Conclusion

These reliability findings demonstrate **thorough technical review** and identify legitimate concerns. The issues range from critical security/functionality problems (Issue #1) to important operational improvements (Issues #2-4).

### Immediate Actions Required

1. **Product Owner Decision:** Prioritize Issue #1 fix immediately (1 hour fix, production blocker)
2. **Deployment Planning:** Determine deployment scenario (mains vs solar/battery) to prioritize Issue #2
3. **Sprint Planning:** Allocate 8-12 hours total for all fixes (1 + 4-6 + 2-3 + 2-3)

### Quality Assessment

**Positive:** Epic 2 implementation is otherwise excellent with comprehensive testing, good safety mechanisms, and solid architecture. These issues are addressable with focused engineering effort.

**Concern:** Issue #1 (HTTP/HTTPS mismatch) indicates test configuration needs better review process before production.

**Recommendation:** Implement all four fixes. Issues #1-2 are high priority, #3-4 are important for operational excellence.

---

**Document Owner:** Quinn (Test Architect)
**Next Review:** After fixes implemented
**Related Documents:**
- `docs/qa/gates/2.*.yml` (Individual story quality gates)
- `firmware/docs/HARDWARE_TEST_PROCEDURES.md` (Testing procedures)
- `docs/ESP32_ESP-IDF_Best_Practices_Research/` (Technical research)
