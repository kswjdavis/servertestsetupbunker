# Hardware Test Procedure - Story 2.3: Hardware Watchdog

**Story:** ESP32 Hardware Watchdog Implementation
**Tester:** Quinn (Test Architect)
**Date:** 2025-10-24
**Hardware:** ESP32-D0WD (MAC: 84:0d:8e:e6:5b:38)
**Firmware:** Story 2.3 implementation with watchdog_manager component

---

## Test Objectives

Validate all 10 acceptance criteria for hardware watchdog implementation:

1. ✓ Task watchdog timer (TWDT) enabled for critical tasks
2. ✓ Watchdog timeout set to 60 seconds
3. ✓ Main control loop task subscribes to watchdog
4. ✓ Status reporting task subscribes to watchdog
5. ✓ Each task calls `esp_task_wdt_reset()` regularly (every 30s max)
6. **✓ If task doesn't reset watchdog, system reboots automatically** (CRITICAL P0)
7. ✓ Watchdog reset logged during boot sequence
8. ✓ Panic handler configured to reboot (not halt)
9. **✓ After watchdog reboot, relay initializes to ON (fail-safe)** (CRITICAL P0)
10. ✓ Watchdog reset count tracked across reboots (RTC memory)

---

## Prerequisites

- ESP32 connected to `/dev/cu.usbserial-130`
- Firmware flashed successfully
- Serial monitor available (terminal session)
- Server at http://206.189.210.203 accessible

---

## Phase 1: Normal Operation Validation

### Test 1.1: Boot Sequence & Initialization (AC 1, 2, 7, 10)

**Procedure:**
1. Open serial monitor: `idf.py -p /dev/cu.usbserial-130 monitor`
2. Press reset button on ESP32
3. Observe boot logs

**Expected Logs:**
```
I (XXX) watchdog_manager: Watchdog reset count: 0
```

**Success Criteria:**
- [ ] Watchdog manager initializes without errors
- [ ] Reset count logged (should be 0 on first power-on)
- [ ] No "Device rebooted due to watchdog reset" message (normal boot)

**AC Coverage:** AC 1, 2, 7, 10

---

### Test 1.2: Task Subscription (AC 3, 4)

**Expected Logs:**
```
I (XXX) watchdog_manager: Task subscribed to watchdog: control_loop
I (XXX) watchdog_manager: Task subscribed to watchdog: status_report
```

**Success Criteria:**
- [ ] Control loop task subscribes successfully
- [ ] Status reporting task subscribes successfully
- [ ] No subscription errors

**AC Coverage:** AC 3, 4

---

### Test 1.3: Normal Watchdog Feeding (AC 5)

**Procedure:**
1. Monitor logs for 2-3 minutes during normal operation
2. Observe that NO watchdog timeout warnings appear
3. System continues running normally

**Expected Behavior:**
- Tasks feed watchdog every ≤30 seconds (via `watchdog_delay_with_feed()` or explicit `watchdog_manager_feed()`)
- No watchdog timeout triggers
- System stable, relay state controlled normally

**Success Criteria:**
- [ ] No watchdog timeout messages for 2+ minutes
- [ ] System operates normally (WiFi connected, server communication working)
- [ ] Relay responds to server commands

**AC Coverage:** AC 5

---

## Phase 2: Watchdog Timeout Trigger Test (CRITICAL)

### Test 2.1: Simulate Firmware Hang (AC 6, 9) - **P0 CRITICAL**

**⚠️ WARNING:** This test will intentionally crash the device. Ensure you're ready to observe the reboot sequence.

**Procedure:**

**Option A: Code Modification (Recommended)**
1. Temporarily modify `firmware/main/main.c` - comment out watchdog feed calls in control_loop_task:
   ```c
   // Comment out this line around line 156:
   // watchdog_delay_with_feed(pdMS_TO_TICKS(1000));

   // Replace with normal delay (no watchdog feed):
   vTaskDelay(pdMS_TO_TICKS(1000));
   ```
2. Flash modified firmware: `idf.py -p /dev/cu.usbserial-130 flash`
3. Start monitor: `idf.py -p /dev/cu.usbserial-130 monitor`
4. Wait 60+ seconds

**Option B: GDB Breakpoint (If available)**
1. Pause task execution via debugger
2. Wait 60+ seconds

**Expected Sequence:**

**T=0s:** Normal operation
```
I (XXX) main: Control loop task started
I (XXX) watchdog_manager: Task subscribed to watchdog: control_loop
```

**T=60s:** Watchdog timeout triggers
```
E (60XXX) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:
E (60XXX) task_wdt:  - control_loop (CPU 0)
E (60XXX) task_wdt: Tasks currently running:
E (60XXX) task_wdt: CPU 0: <task_name>
E (60XXX) task_wdt: CPU 1: <task_name>
E (60XXX) task_wdt: Aborting.
```

**T=60s+:** System reboots
```
ESP-ROM:esp32-20200XXX
Build:XXX
rst:0xXX (TG0WDT_SYS_RESET),boot:0xXX (...)
```

**T=61s:** Boot after watchdog reset
```
I (XXX) cpu_start: Starting scheduler on APP CPU.
I (XXX) watchdog_manager: Device rebooted due to watchdog reset
I (XXX) watchdog_manager: Watchdog reset count: 1
I (XXX) relay_controller: Relay controller initialized (GPIO 2)
I (XXX) relay_controller: Fail-safe default: fans ON (normally-closed relay)
I (XXX) main: Watchdog reboot detected - relay reinitialized to fail-safe ON state
```

**Success Criteria:**
- [ ] Watchdog triggers after ~60 seconds of no feeding
- [ ] System reboots automatically (not halts)
- [ ] Boot logs show "Device rebooted due to watchdog reset"
- [ ] Watchdog reset count increments to 1
- [ ] **CRITICAL:** Relay initializes to ON state (fail-safe)
- [ ] **CRITICAL:** Log confirms "Watchdog reboot detected - relay reinitialized to fail-safe ON state"

**AC Coverage:** AC 6, 9 (BOTH P0 CRITICAL)

---

### Test 2.2: RTC Memory Persistence (AC 10)

**Procedure:**
1. After Test 2.1 completes (watchdog reset count = 1)
2. Trigger another watchdog reset (repeat Test 2.1 or use different method)
3. Observe reset count increments

**Expected Logs:**
```
I (XXX) watchdog_manager: Device rebooted due to watchdog reset
I (XXX) watchdog_manager: Watchdog reset count: 2
```

**Success Criteria:**
- [ ] Reset count persists across reboots (RTC_DATA_ATTR working)
- [ ] Reset count increments correctly (1 → 2 → 3...)
- [ ] Counter survives watchdog reboots (but NOT power cycles)

**AC Coverage:** AC 10

---

### Test 2.3: Multiple Watchdog Resets Warning (AC 10)

**Procedure:**
1. Trigger watchdog resets until count reaches 6
2. Observe warning message

**Expected Logs:**
```
E (XXX) watchdog_manager: ⚠ Multiple watchdog resets detected - possible persistent issue
```

**Success Criteria:**
- [ ] Warning appears when count > 5
- [ ] Indicates potential persistent firmware issue

**AC Coverage:** AC 10

---

## Phase 3: Panic Handler Configuration (AC 8)

### Test 3.1: Verify Panic Reboot Behavior

**Procedure:**
1. Check `firmware/sdkconfig` for panic handler settings:
   ```
   CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT=y
   ```
2. Observe Test 2.1 behavior (system reboots, not halts)

**Success Criteria:**
- [ ] CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT=y in sdkconfig
- [ ] System reboots on watchdog timeout (confirmed in Test 2.1)
- [ ] System does NOT halt or enter panic handler loop

**AC Coverage:** AC 8

---

## Phase 4: Recovery & Normal Operation

### Test 4.1: Restore Normal Operation

**Procedure:**
1. Revert code changes from Test 2.1 (restore watchdog feeding)
2. Reflash firmware
3. Observe normal operation resumes
4. Monitor for 2-3 minutes

**Expected Behavior:**
- System boots normally
- Both tasks subscribe to watchdog
- No further watchdog timeouts
- Reset count preserved from previous tests

**Success Criteria:**
- [ ] Normal operation restored
- [ ] No watchdog timeouts during 2-3 minute observation
- [ ] Reset count remains from previous tests (RTC memory intact)

---

## Test Results Template

### Phase 1: Normal Operation
- [ ] Test 1.1: Boot & Initialization - PASS / FAIL / BLOCKED
- [ ] Test 1.2: Task Subscription - PASS / FAIL / BLOCKED
- [ ] Test 1.3: Normal Feeding - PASS / FAIL / BLOCKED

### Phase 2: Watchdog Timeout (CRITICAL)
- [ ] Test 2.1: Firmware Hang Trigger - PASS / FAIL / BLOCKED
- [ ] Test 2.2: RTC Memory Persistence - PASS / FAIL / BLOCKED
- [ ] Test 2.3: Multiple Reset Warning - PASS / FAIL / BLOCKED

### Phase 3: Panic Handler
- [ ] Test 3.1: Panic Reboot Config - PASS / FAIL / BLOCKED

### Phase 4: Recovery
- [ ] Test 4.1: Normal Operation Restored - PASS / FAIL / BLOCKED

---

## Acceptance Criteria Validation Summary

| AC | Description | Test | Status |
|----|-------------|------|--------|
| 1  | TWDT enabled for critical tasks | 1.1, 1.2 | ⬜ |
| 2  | Watchdog timeout = 60 seconds | 1.1, 2.1 | ⬜ |
| 3  | Control loop subscribes | 1.2 | ⬜ |
| 4  | Status reporting subscribes | 1.2 | ⬜ |
| 5  | Tasks reset watchdog every 30s | 1.3 | ⬜ |
| 6  | **System reboots if not fed** (P0) | **2.1** | ⬜ |
| 7  | Watchdog reset logged on boot | 1.1, 2.1 | ⬜ |
| 8  | Panic handler reboots (not halts) | 3.1 | ⬜ |
| 9  | **Relay initializes to ON after reboot** (P0) | **2.1** | ⬜ |
| 10 | Reset count tracked in RTC memory | 1.1, 2.2, 2.3 | ⬜ |

---

## Critical Success Criteria (Must Pass for Production)

1. ✅ **AC 6:** Watchdog triggers reboot after 60s timeout
2. ✅ **AC 9:** Relay defaults to ON (fail-safe) after watchdog reboot
3. ✅ System automatically recovers from firmware hangs
4. ✅ No manual intervention required for recovery

**These are P0 (Priority 0) - MUST work for production deployment.**

---

## Notes & Observations

**Log Capture:**
- Save all serial monitor output to file for analysis
- Timestamp critical events (timeout trigger, reboot, relay initialization)

**Known Issues:**
- Monitor mode requires TTY (cannot run in background)
- RTC memory resets on power cycle (expected behavior)
- Dead-man timer set to 30s (should be 300s for production)

---

## Post-Test Actions

After all tests complete:
1. ✅ Restore watchdog feeding in code (undo Test 2.1 modifications)
2. ✅ Restore dead-man timer to 300 seconds (production value)
3. ✅ Reflash production firmware
4. ✅ Document all findings in hardware validation report
5. ✅ Update Story 2.3 QA Results section
6. ✅ Create quality gate decision (PASS/CONCERNS/FAIL)

---

**Test Conductor:** ____________________
**Date Completed:** ____________________
**Overall Result:** PASS / CONCERNS / FAIL / BLOCKED
