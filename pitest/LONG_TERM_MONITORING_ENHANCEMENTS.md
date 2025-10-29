# Long-Term ESP32 Monitoring Enhancements

**Purpose:** Track ESP32 reliability over 30+ days of continuous operation
**Goal:** Identify all failures, calculate uptime/downtime, detect patterns

---

## Current Monitoring Status

### ✅ What We're Already Tracking

#### 1. Serial Logs (All ESP32 Output)
- **Data:** Every ESP-IDF log message (I/W/E/D/V levels)
- **Covers:** HTTP requests, timer resets, relay state, boot messages, errors
- **Components:** main, http_client, deadman_timer, relay_controller, watchdog_manager, wifi_manager, etc.
- **Usage:** Can grep for specific errors, patterns, component activity

#### 2. GPIO Events (Hardware State Changes)
- **Data:** Every pin state transition (HIGH/LOW)
- **Covers:** Relay switching (fans on/off), LED identification blinks
- **Usage:** Verify relay is physically switching, count state changes

#### 3. System Metrics (Pi Health - every 60s)
- **Data:** CPU temp, load, memory, disk, WiFi signal, uptime
- **Usage:** Detect Pi hardware issues, WiFi degradation

#### 4. Heartbeats (Service Health - every 60s)
- **Data:** Is serial connected? Is GPIO working? Any errors?
- **Usage:** Track monitoring service availability

---

## ⚠️ Missing Critical Metrics for Long-Term Testing

### 1. **ESP32 Reboot/Crash Tracking**
**Problem:** We're logging boot messages but not parsing them into a reboot events table.

**What We Need:**
- Reboot event table with timestamps
- Last reset reason (power loss, watchdog, panic, software reset)
- Uptime before reboot
- Count of total reboots over test period

**Implementation:**
- Parse bootloader messages for reset reason
- Track watchdog reset count from serial logs
- Detect uptime discontinuities (uptime decreasing = reboot)

### 2. **Network Failure Tracking**
**Problem:** We log HTTP errors but don't aggregate them or calculate downtime.

**What We Need:**
- HTTP failure events table
- WiFi disconnect/reconnect events
- Total time unable to reach server
- Consecutive failure counts

**Implementation:**
- Parse HTTP connection errors
- Parse WiFi connection status messages
- Calculate time between successful HTTP POSTs

### 3. **Dead-Man Timer Expiration Events**
**Problem:** We track timer resets but not if it ever expires (critical failure).

**What We Need:**
- Timer expiration events (fans forced ON)
- Cause of expiration (network loss, server down, auth failure)
- Duration of relay forced-ON periods

**Implementation:**
- Detect "timer expired" messages
- Track relay state changes correlated with timer events

### 4. **Memory Leak Detection**
**Problem:** We log free heap but don't track trends.

**What We Need:**
- Heap usage over time graph
- Alert if heap consistently decreasing
- Minimum heap ever reached

**Implementation:**
- Parse "Free heap: X bytes" messages into metrics table
- Calculate heap trend (regression over time)
- Alert threshold for low memory

### 5. **Relay Operation Analytics**
**Problem:** We track GPIO events but not operational metrics.

**What We Need:**
- Total time fans were OFF (energy savings)
- Number of relay switches
- Relay switching failures (expected vs actual)
- % uptime with server control vs fail-safe mode

**Implementation:**
- Calculate duration between relay state changes
- Sum total OFF time
- Compare against server "shutdown_allowed" commands

### 6. **Server Communication Analytics**
**Problem:** We log status reports but don't measure reliability.

**What We Need:**
- Total HTTP requests sent
- Success rate percentage
- Average response time
- Longest outage period

**Implementation:**
- Count HTTP POST messages
- Count HTTP 200 responses
- Measure time between successful communications

### 7. **Error Pattern Analysis**
**Problem:** Errors are logged but not categorized or counted.

**What We Need:**
- Error frequency by type
- Error clustering (multiple errors in short time = incident)
- Top 10 most common errors
- Error resolution time (error → recovery)

**Implementation:**
- Group errors by message pattern
- Detect error bursts (5+ errors in 1 minute)
- Track time to next successful operation after error

---

## 📊 Proposed New Database Tables

### `esp32_reboots` Table
```sql
CREATE TABLE IF NOT EXISTS esp32_reboots (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    reset_reason TEXT,
    uptime_before_reboot INTEGER,
    watchdog_reset_count INTEGER,
    notes TEXT
);
```

### `network_failures` Table
```sql
CREATE TABLE IF NOT EXISTS network_failures (
    id INTEGER PRIMARY KEY,
    failure_start TEXT NOT NULL,
    failure_end TEXT,
    failure_type TEXT NOT NULL,  -- 'http_error', 'wifi_disconnect', 'dns_failure'
    error_message TEXT,
    duration_seconds INTEGER
);
```

### `relay_operations` Table
```sql
CREATE TABLE IF NOT EXISTS relay_operations (
    id INTEGER PRIMARY KEY,
    state_change_at TEXT NOT NULL,
    new_state INTEGER NOT NULL,  -- 0=OFF, 1=ON
    triggered_by TEXT,  -- 'server_command', 'timer_expiry', 'boot', 'emergency'
    duration_in_state INTEGER  -- calculated on next state change
);
```

### `esp32_telemetry` Table
```sql
CREATE TABLE IF NOT EXISTS esp32_telemetry (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    free_heap_bytes INTEGER,
    wifi_rssi INTEGER,
    cpu_freq_mhz INTEGER,
    countdown_timer_remaining INTEGER,
    uptime_seconds INTEGER
);
```

### `incidents` Table
```sql
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY,
    incident_start TEXT NOT NULL,
    incident_end TEXT,
    incident_type TEXT NOT NULL,  -- 'reboot', 'network_outage', 'timer_expiry', 'relay_failure'
    severity TEXT,  -- 'critical', 'warning', 'info'
    description TEXT,
    resolved INTEGER DEFAULT 0
);
```

---

## 🔧 Enhanced Parsing Logic Needed

### 1. Reboot Detection
**Parse these patterns:**
```
I (XXX) boot: ESP-IDF ... starting up
I (XXX) cpu_start: Pro cpu up
I (XXX) watchdog_manager: Watchdog reset count: N
```

**Action:** When uptime jumps from high → low, create reboot event

### 2. Network Failure Detection
**Parse these patterns:**
```
E (XXX) esp-tls: Failed to open new connection
E (XXX) HTTP_CLIENT: Connection failed
I (XXX) http_client: HTTP Status = 200  ← success
```

**Action:** Track time between failures and successes

### 3. Heap Tracking
**Parse this pattern:**
```
I (XXX) main: Free heap: 208396 bytes
```

**Action:** Extract heap value, store in telemetry table every status report

### 4. Timer Expiration Detection
**Parse this pattern:**
```
W (XXX) deadman_timer: Timer expired! Forcing relay ON
```

**Action:** Create incident, start tracking forced-ON period

### 5. Relay State Tracking
**Correlate:**
- GPIO pin 17 state changes
- "Relay: ON/OFF" messages from relay_controller
- Server "shutdown_allowed" decisions

**Action:** Build timeline of relay operation with causation

---

## 📈 Analytics Queries Needed

### Uptime Calculation
```sql
-- Calculate total uptime percentage
SELECT
    ROUND(100.0 * SUM(CASE WHEN serial_connected=1 THEN 1 ELSE 0 END) / COUNT(*), 2) as uptime_pct,
    COUNT(*) as total_heartbeats,
    SUM(CASE WHEN serial_connected=0 THEN 1 ELSE 0 END) as downtime_periods
FROM heartbeats;
```

### Failure Rate
```sql
-- Calculate failures per day
SELECT
    DATE(recorded_at) as date,
    COUNT(*) as failures
FROM network_failures
GROUP BY DATE(recorded_at)
ORDER BY date;
```

### Energy Savings
```sql
-- Calculate total time fans were OFF
SELECT
    SUM(duration_in_state) / 3600.0 as hours_off,
    COUNT(*) as off_cycles
FROM relay_operations
WHERE new_state = 0;
```

### MTBF (Mean Time Between Failures)
```sql
-- Calculate average time between reboots
SELECT
    AVG(uptime_before_reboot) / 3600.0 as avg_hours_between_reboots
FROM esp32_reboots;
```

### Error Frequency
```sql
-- Top 10 most common errors
SELECT
    tag,
    SUBSTR(message, 1, 50) as error_pattern,
    COUNT(*) as occurrences
FROM serial_logs
WHERE level = 'E'
GROUP BY tag, error_pattern
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 🎯 Implementation Priority

### Phase 1: Critical Tracking (Immediate)
1. ✅ **Reboot Detection** - Detect when ESP32 restarts
2. ✅ **Heap Monitoring** - Track memory trends
3. ✅ **Network Failure Tracking** - Count HTTP failures
4. ✅ **Relay Operation Timeline** - Track fan on/off durations

### Phase 2: Analytics (Week 1)
5. **Uptime/Downtime Calculator** - % availability over time
6. **MTBF Calculator** - Average time between failures
7. **Error Pattern Analyzer** - Identify most common issues
8. **Daily Summary Reporter** - Automated daily stats

### Phase 3: Alerting (Week 2)
9. **Anomaly Detection** - Detect unusual patterns
10. **Threshold Alerts** - Alert on critical conditions
11. **Trend Analysis** - Detect degradation over time
12. **Weekly Report Generator** - Summary of test progress

---

## 🚀 Recommended Next Steps

1. **Enhance Pi Monitor Script**
   - Add new table creation
   - Add parsing for reboot events, heap values, relay triggers
   - Add incident detection logic

2. **Create Analytics Dashboard**
   - Single command to show current test status
   - Uptime %, error rate, reboot count, etc.
   - Generate daily/weekly reports

3. **Add Automated Reporting**
   - Daily summary email/file
   - Alert on critical events (reboot, extended outage)
   - Weekly trend analysis

4. **Create Export Tools**
   - Export timeline of all events
   - Generate graphs of key metrics
   - Produce final test report

---

## 📊 Expected Outputs After 30 Days

### Summary Report Should Include:
- **Uptime:** X% availability over 30 days
- **Reboots:** N total reboots, reasons, MTBF = X hours
- **Network:** Y% success rate, Z outages, longest outage = X minutes
- **Relay:** Total OFF time = X hours (energy saved = $Y)
- **Errors:** Top 10 errors by frequency
- **Performance:** Heap trend, WiFi signal trend, response time trend
- **Incidents:** Critical events timeline with resolution times

### Deliverables:
1. CSV exports of all metrics
2. Timeline visualization of key events
3. Executive summary with KPIs
4. Detailed failure analysis report
5. Recommendations for production deployment

---

## 💡 Questions to Answer

After 30 days, we should be able to answer:

1. **Reliability:** What's the actual uptime? How often does it fail?
2. **Failure Modes:** What causes reboots? Network? Crashes? Power?
3. **Network Resilience:** How well does it handle WiFi outages?
4. **Memory Stability:** Is there a memory leak? Does heap decrease over time?
5. **Relay Operation:** How many times did fans switch? Any stuck relays?
6. **Server Communication:** Success rate? Average latency? Retry behavior?
7. **Energy Savings:** Total hours fans were OFF? Cost savings?
8. **Critical Failures:** Did dead-man timer ever expire? Why?
9. **Recovery:** How long to recover from failures? Automatic?
10. **Degradation:** Any performance degradation over 30 days?

---

## 🔍 Current Gaps Summary

| Metric | Currently Tracked? | Needs Enhancement? |
|--------|-------------------|--------------------|
| Serial logs | ✅ Yes | ✅ Add parsing |
| GPIO events | ✅ Yes | ✅ Add analytics |
| Pi health | ✅ Yes | ✅ OK as-is |
| Service health | ✅ Yes | ✅ OK as-is |
| Reboots | ⚠️ Partial | ✅ Need table |
| Network failures | ⚠️ Logged only | ✅ Need aggregation |
| Heap trends | ⚠️ Logged only | ✅ Need parsing |
| Relay timeline | ⚠️ Events only | ✅ Need durations |
| Error patterns | ⚠️ Logged only | ✅ Need analysis |
| Uptime % | ❌ No | ✅ Need calculator |
| MTBF | ❌ No | ✅ Need calculator |
| Energy savings | ❌ No | ✅ Need calculator |

---

**Next:** Enhance pi_monitor.py to add new tables and parsing logic
