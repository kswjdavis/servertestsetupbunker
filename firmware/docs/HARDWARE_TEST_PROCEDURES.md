# ESP32 Control Loop Hardware Test Procedures

**Document Version:** 1.0
**Last Updated:** 2025-10-24
**Story:** 2.7 ESP32 Complete Control Loop Integration
**Purpose:** Hardware validation procedures for AC9 (24-hour stability) and integration test scenarios

---

## Overview

This document provides step-by-step procedures for validating the ESP32 control loop on physical hardware. These tests verify acceptance criteria that cannot be validated through host-based unit tests alone.

**Test Environment Requirements:**
- ESP32 development board with relay control capability
- USB cable for serial monitoring and power
- WiFi network access
- Access to production server at 206.189.210.203
- Serial terminal (screen, minicom, or ESP-IDF monitor)
- Test duration: 24-48 hours for stability testing

---

## Test 1: 24-Hour Stability Test (AC9 - CRITICAL)

**Acceptance Criterion:** Continuous operation for 24+ hours verified in bench test

**Objective:** Verify zero watchdog resets, stable memory usage, no spurious relay transitions, and proper WiFi reconnection over extended operation.

### Prerequisites
- [ ] ESP32 flashed with latest firmware build
- [ ] Device provisioned with valid auth token
- [ ] Production server running and accessible
- [ ] Serial monitor ready to capture logs
- [ ] Power supply stable (USB or external 5V)

### Procedure

#### Step 1: Initial Setup
```bash
# Flash firmware
cd firmware
source ~/esp/esp-idf/export.sh
idf.py build
idf.py -p /dev/cu.usbserial-130 flash

# Start serial monitor and save logs
idf.py -p /dev/cu.usbserial-130 monitor | tee stability_test_$(date +%Y%m%d_%H%M%S).log
```

#### Step 2: Record Baseline Metrics (T=0)
At startup, capture:
- [ ] **Free heap memory** (look for log: "Free heap: XXXXX bytes")
- [ ] **WiFi connection time** (time from boot to "WiFi connected")
- [ ] **Initial relay state** (should be ON/fail-safe until first server decision)
- [ ] **Authentication success** (look for "Device authenticated successfully")
- [ ] **First status report timestamp**

**Expected Initial State:**
```
Relay: ON (fail-safe)
WiFi: Connected within 30 seconds
Auth: Successful within 60 seconds
Heap: ~250,000 - 280,000 bytes free (ESP32 WROOM-32)
Deadman Timer: Armed at 300 seconds
```

#### Step 3: Monitor Operation (T=0 to T=24h)
Check logs every 4 hours and record:

| Time | Free Heap | WiFi Status | Relay State | Watchdog Resets | Notes |
|------|-----------|-------------|-------------|-----------------|-------|
| 0h   |           | Connected   | ON          | 0               | Baseline |
| 4h   |           |             |             |                 |       |
| 8h   |           |             |             |                 |       |
| 12h  |           |             |             |                 |       |
| 16h  |           |             |             |                 |       |
| 20h  |           |             |             |                 |       |
| 24h  |           |             |             |                 |       |

**Automated Monitoring Script:**
```bash
# Run in separate terminal to extract key metrics
tail -f stability_test_*.log | grep -E "(Free heap|Watchdog reset|relay_set|WiFi connected|WiFi disconnected)"
```

#### Step 4: Success Criteria Validation
After 24 hours, verify:
- [ ] **Zero watchdog resets** (grep log for "Watchdog reset detected" - should be 0 occurrences)
- [ ] **Stable heap memory** (free heap should not decrease more than 5% from baseline)
- [ ] **No memory leaks** (heap should stabilize after initial allocations)
- [ ] **Proper WiFi reconnection** (any disconnects should auto-reconnect within 60s)
- [ ] **Relay transitions match server decisions** (no spurious ON/OFF cycles)
- [ ] **Deadman timer resets correctly** (timer never expires during normal operation)
- [ ] **Status reports every 60 seconds** (1440 reports total over 24h)

### Analysis Commands
```bash
# Count watchdog resets (should be 0)
grep -c "Watchdog reset detected" stability_test_*.log

# Count status reports (should be ~1440 for 24h)
grep -c "Sending status report" stability_test_*.log

# Check for memory leaks
grep "Free heap" stability_test_*.log | awk '{print $NF}' | sort -n | head -20
grep "Free heap" stability_test_*.log | awk '{print $NF}' | sort -n | tail -20

# Count WiFi disconnects
grep -c "WiFi disconnected" stability_test_*.log

# Verify relay state changes
grep "relay_set" stability_test_*.log | tail -50
```

### Pass/Fail Criteria
**PASS:** All criteria met
**FAIL:** Any watchdog reset, memory leak >5%, or unexpected relay behavior
**REVIEW:** WiFi disconnects >10 times (investigate network stability)

---

## Test 2: WiFi Disconnect Recovery (AC6, AC8)

**Acceptance Criteria:**
- AC6: WiFi disconnect triggers relay_force_on() after dead-man expires
- AC8: System recovers automatically after transient failures

**Objective:** Verify fail-safe activation during WiFi loss and proper recovery on reconnection.

### Prerequisites
- [ ] ESP32 running with stable WiFi connection
- [ ] Access to WiFi router to disable/enable network
- [ ] Serial monitor capturing logs

### Procedure

#### Step 1: Establish Baseline Operation
1. Verify device is operational:
   - [ ] WiFi connected
   - [ ] Status reports sent successfully
   - [ ] Relay state controlled by server (cycling ON/OFF based on wind conditions)
   - [ ] Deadman timer resetting every 60 seconds

2. Record current state:
   - Relay state: ________ (ON/OFF)
   - Last status report timestamp: ________
   - Free heap: ________ bytes

#### Step 2: Simulate WiFi Disconnect
1. **Disable WiFi network** (turn off router or block MAC address)
2. **Start timer** - record exact time of disconnect
3. **Monitor logs** for expected sequence:

**Expected Log Sequence:**
```
T+0s:   "WiFi disconnected" (ESP detects disconnect)
T+0s:   "Status report failed: WiFi not connected" (reports stop)
T+0-300s: Deadman timer counting down
T+300s: "Dead-man timer expired!" (timer expires)
T+300s: "Relay forced ON (fail-safe activated)" (relay_force_on called)
```

4. **Verify fail-safe activation:**
   - [ ] Relay forced ON within 300 seconds of WiFi disconnect
   - [ ] Log shows "Relay forced ON (fail-safe activated)"
   - [ ] Subsequent status reports fail silently (no crashes)

#### Step 3: Restore WiFi and Verify Recovery
1. **Re-enable WiFi network**
2. **Monitor logs** for recovery sequence:

**Expected Recovery Sequence:**
```
T+0s:   "WiFi connected" (reconnection detected)
T+0-30s: "Device authenticated successfully" (auth token still valid)
T+0-60s: "Sending status report" (status reporting resumes)
T+60s:  "Server decision: shutdown_allowed=false" (expected due to fail-safe)
T+60s:  "Relay already ON, no change needed" (relay stays locked ON)
```

3. **Verify recovery:**
   - [ ] WiFi reconnects automatically within 60 seconds
   - [ ] Authentication succeeds (token persisted in NVS)
   - [ ] Status reports resume
   - [ ] Relay remains locked ON (fail-safe cannot clear without reboot)

#### Step 4: Full Recovery Test (Reboot Required)
Since fail-safe locks relay ON permanently, test full recovery:
1. **Reboot device** (press RESET button or power cycle)
2. **Verify clean startup:**
   - [ ] WiFi connects
   - [ ] Device authenticates
   - [ ] Relay starts in fail-safe ON state
   - [ ] First server decision applied correctly
   - [ ] System resumes normal operation

### Pass/Fail Criteria
**PASS:**
- Fail-safe activates within 300s of WiFi loss
- WiFi reconnects automatically when network returns
- Status reporting resumes after reconnection
- Relay stays locked ON after fail-safe activation

**FAIL:**
- Watchdog reset during WiFi disconnect
- Fail-safe not triggered after 300s
- WiFi does not reconnect automatically
- Device crashes or reboots

---

## Test 3: Authentication Failure Recovery (AC8)

**Acceptance Criterion:** System recovers automatically after transient failures

**Objective:** Verify fail-safe activation on HTTP 401 and proper handling of authentication errors.

### Prerequisites
- [ ] ESP32 running with valid auth token
- [ ] Access to production database to invalidate token
- [ ] Serial monitor capturing logs

### Procedure

#### Step 1: Establish Baseline
1. Verify normal operation:
   - [ ] Status reports successful (HTTP 200)
   - [ ] Relay controlled by server decisions
   - [ ] Authentication state: VALID

#### Step 2: Invalidate Auth Token
On production server, invalidate the device's auth token:
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203
su - postgres -c "psql -d bunkercolab"

-- Find device by MAC address
SELECT id, mac_address, auth_token FROM devices WHERE mac_address = 'XX:XX:XX:XX:XX:XX';

-- Invalidate token (change it to a random UUID)
UPDATE devices SET auth_token = gen_random_uuid() WHERE id = <device_id>;
\q
```

#### Step 3: Monitor Authentication Failure
Watch logs for expected sequence:

**Expected Log Sequence:**
```
T+0s:   "Sending status report" (attempt with old token)
T+0s:   "Status report failed: HTTP 401 Unauthorized" (server rejects)
T+0s:   "Authentication failed - entering fail-safe mode"
T+0s:   "Relay forced ON (fail-safe activated)" (relay_force_on called)
T+0s:   "Clearing invalid auth token from NVS"
T+60s+: No further status report attempts (authentication_failed flag set)
```

**Verify fail-safe activation:**
- [ ] HTTP 401 detected immediately
- [ ] Relay forced ON within 1 second
- [ ] Invalid token cleared from NVS
- [ ] Status reports stop (no retry loop)
- [ ] Device does not crash or reboot

#### Step 4: Verify Re-Provisioning Required
Since authentication failed, device should require re-provisioning:
1. **Check NVS storage:**
   - Auth token should be cleared
   - WiFi credentials should remain (NVS not wiped)
2. **Attempt manual re-provision:**
   - Device needs new auth token from server
   - Relay remains locked ON until successful re-auth

### Pass/Fail Criteria
**PASS:**
- HTTP 401 triggers fail-safe immediately
- Relay locked ON permanently
- Invalid token cleared from NVS
- No crashes or watchdog resets
- Status reports stop (no retry spam)

**FAIL:**
- Fail-safe not activated on 401
- Device crashes or reboots
- Continuous retry loop (server spam)
- Token not cleared from NVS

---

## Test 4: Server Shutdown Decisions (AC3, AC4)

**Acceptance Criteria:**
- AC3: Server shutdown_allowed=true triggers timer reset and relay_set_off()
- AC4: Server shutdown_allowed=false triggers relay_set_on() immediately

**Objective:** Verify relay control responds correctly to server decisions.

### Prerequisites
- [ ] ESP32 operational with server communication
- [ ] Access to production server database
- [ ] Serial monitor capturing logs

### Procedure

#### Test 4A: Shutdown Allowed (Fans OFF)
1. Set server to allow shutdown:
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203
su - postgres -c "psql -d bunkercolab"

-- Simulate favorable wind conditions (allow shutdown)
UPDATE weather_data SET wind_speed_kph = 5.0, wind_direction_degrees = 90;
-- This should result in shutdown_allowed=true in server logic
```

2. Monitor logs for response:
```
"Server decision: shutdown_allowed=true, reset_countdown=true"
"Resetting dead-man timer to 300 seconds"
"Relay set OFF (energy saving mode)"
```

3. Verify:
   - [ ] Relay turns OFF within 60 seconds
   - [ ] Deadman timer reset to 300 seconds
   - [ ] Free heap stable (no memory leak)

#### Test 4B: Shutdown Denied (Fans ON)
1. Set server to deny shutdown:
```bash
-- Simulate unfavorable conditions (deny shutdown)
UPDATE weather_data SET wind_speed_kph = 25.0, wind_direction_degrees = 180;
-- This should result in shutdown_allowed=false
```

2. Monitor logs for response:
```
"Server decision: shutdown_allowed=false, reset_countdown=true"
"Resetting dead-man timer to 300 seconds"
"Relay set ON (server directive)"
```

3. Verify:
   - [ ] Relay turns ON within 60 seconds
   - [ ] Deadman timer reset to 300 seconds
   - [ ] Transition logged clearly

### Pass/Fail Criteria
**PASS:**
- Relay state matches server decision within 60s
- Timer resets on both true/false decisions
- Transitions logged clearly
- No unexpected state changes

**FAIL:**
- Relay does not respond to server decision
- Timer not reset when reset_countdown=true
- Watchdog reset during transition

---

## Test 5: Deadman Timer Expiration (AC5)

**Acceptance Criterion:** Timer expiration triggers relay_force_on()

**Objective:** Verify fail-safe activation when timer expires naturally (no server communication).

### Procedure

#### Step 1: Prevent Timer Resets
Block status reports to server:
```bash
# On production server, temporarily block port 80/443 from device IP
iptables -A INPUT -s <device_IP> -p tcp --dport 80 -j DROP
iptables -A INPUT -s <device_IP> -p tcp --dport 443 -j DROP
```

OR disconnect WiFi (see Test 2)

#### Step 2: Monitor Timer Countdown
Watch logs every 60 seconds:
```
T+0s:   "Dead-man timer: 300 seconds remaining"
T+60s:  "Dead-man timer: 240 seconds remaining"
T+120s: "Dead-man timer: 180 seconds remaining"
T+180s: "Dead-man timer: 120 seconds remaining"
T+240s: "Dead-man timer: 60 seconds remaining"
T+300s: "Dead-man timer expired!"
T+300s: "Relay forced ON (fail-safe activated)"
```

#### Step 3: Verify Fail-Safe Activation
- [ ] Timer expires at exactly 300 seconds
- [ ] relay_force_on() called immediately
- [ ] Relay locked ON permanently
- [ ] Subsequent timer updates show "Relay locked ON" state

### Pass/Fail Criteria
**PASS:** Timer expires at 300s, relay forced ON, relay stays locked
**FAIL:** Timer does not expire, relay not forced ON, or watchdog reset

---

## Test Execution Checklist

Before marking Story 2.7 as "Done", complete:

- [ ] **Test 1:** 24-hour stability test PASSED (AC9 - CRITICAL)
- [ ] **Test 2:** WiFi disconnect recovery PASSED (AC6, AC8)
- [ ] **Test 3:** Authentication failure recovery PASSED (AC8)
- [ ] **Test 4:** Server shutdown decisions PASSED (AC3, AC4)
- [ ] **Test 5:** Deadman timer expiration PASSED (AC5)
- [ ] All test logs saved to `firmware/tests/logs/`
- [ ] Test results documented in story completion notes
- [ ] No watchdog resets in any test
- [ ] No memory leaks detected
- [ ] All fail-safe scenarios verified

---

## Log Analysis Tools

### Extract Key Metrics
```bash
# Memory usage over time
grep "Free heap" stability_test_*.log | \
  awk '{print NR, $NF}' | \
  gnuplot -e "set terminal png; set output 'heap.png'; plot '-' with lines"

# Status report success rate
total=$(grep -c "Sending status report" stability_test_*.log)
success=$(grep -c "Status report sent successfully" stability_test_*.log)
echo "Success rate: $((success * 100 / total))%"

# Relay state transitions
grep "relay_set\|relay_force" stability_test_*.log | \
  awk '{print $1, $2, $0}' > relay_transitions.log
```

### Common Issues and Resolutions

| Issue | Log Signature | Root Cause | Resolution |
|-------|---------------|------------|------------|
| Watchdog reset | "Watchdog reset detected" | Task blocked >5s | Check for blocking I/O, add watchdog feeds |
| Memory leak | Free heap decreasing | malloc without free | Review allocations in HTTP client |
| WiFi no reconnect | "WiFi disconnected" without "connected" | WiFi manager stuck | Check retry logic, add timeout |
| Spurious relay changes | relay_set_on/off without server decision | Race condition | Review control loop synchronization |

---

## Appendix: Hardware Setup Diagram

```
┌─────────────────────────────────────────┐
│  ESP32 Development Board                │
│  ┌────────────────────────────────────┐ │
│  │ USB Serial (Monitoring & Power)    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  GPIO Pins:                             │
│  ├─ GPIO 2: LED indicator               │
│  ├─ GPIO 4: Relay control (active HIGH) │
│  └─ GND: Common ground                  │
└─────────────────────────────────────────┘
         │
         │ WiFi (2.4GHz)
         ↓
   WiFi Router ──→ Internet ──→ Production Server
                                 206.189.210.203
```

---

**Document End**

For questions or issues during hardware testing, consult:
- Story 2.7: `docs/stories/2.7.esp32-complete-control-loop.md`
- Control loop source: `firmware/main/main.c`
- Component tests: `firmware/tests/`
