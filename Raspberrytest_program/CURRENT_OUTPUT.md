# ESP32 Monitoring System - Current Output & Status

**Last Updated:** October 29, 2025, 8:29 AM MDT
**Status:** ✅ Ready for 30-Day Testing

---

## 📊 Current Dashboard Output

### Test Duration
- **Started:** October 29, 2025 @ 1:50 PM UTC
- **Current Runtime:** ~38 minutes
- **Uptime:** 50.7% (affected by setup restarts - will normalize)

### Current Status
- ✅ **Serial:** Connected
- ✅ **GPIO:** Active
- ✅ **Service:** Running smoothly

### Data Being Collected

| Metric | Records | Rate |
|--------|---------|------|
| Serial Logs | 716 | ~19/minute |
| GPIO Events | 3,285 | ~86/minute (LED blinks) |
| Pi Health | 71 | 1/minute |
| Heartbeats | 71 | 1/minute |
| **Telemetry** | 13 | 1/minute |
| **Reboots** | 0 | N/A |
| **Network Failures** | 10 | ~2 every 5 min (OTA attempts) |
| **Relay Operations** | 1 | Only on actual state changes |

---

## ✅ What's Working Perfectly

### 1. **Heap Memory Tracking**
```
Free heap: 208,392 - 208,944 bytes
Stable range (no memory leak detected)
```

### 2. **Relay State Change Detection**
```
Only 1 operation logged (actual state change from fail-safe → server control)
No more duplicate records
```

### 3. **Network Failure Tracking**
```
10 SSL certificate errors logged (expected - OTA update attempts)
All from esp_https_ota component trying self-signed cert
Non-critical - status reporting works fine
```

### 4. **Reboot Detection**
```
0 reboots since monitoring started
ESP32 has been rock solid
```

### 5. **GPIO Hardware Monitoring**
```
3,285 LED state changes captured
Proves hardware monitoring is working
LED identification flash pattern working
```

### 6. **Pi Health Tracking**
```
CPU: 32.2°C - 47.8°C (avg 39.7°C) ✅
Memory: 19.1% used ✅
WiFi: -62 dBm average (good signal) ✅
Disk: 227 GB free ✅
```

---

## ⚠️ Known Limitations

### 1. **Limited Telemetry Fields**
**Current:**
- ✅ Free heap bytes
- ❌ WiFi RSSI (not in serial logs)
- ❌ Countdown timer (not in serial logs)
- ❌ Uptime (not in serial logs)

**Why:**
The ESP32 sends these values to the server in the HTTP POST body, but doesn't log them to the serial console in a parseable format.

**Impact:**
- Can't track WiFi signal strength over time from ESP32 perspective
- Can't detect uptime discontinuities for reboot detection
- Can't track countdown timer status changes

**Workaround:**
- WiFi signal: Use Pi's perspective (system_metrics.wifi_rssi_dbm)
- Uptime: Detect reboots via boot messages
- Countdown timer: Infer from server decision messages

### 2. **SSL Certificate Errors (Expected)**
**What:**
```
Failed to verify certificate (from OTA update checks)
```

**Why:**
Production server uses self-signed SSL certificate. ESP32 OTA updater can't verify it.

**Impact:**
- OTA firmware updates won't work
- Shows up as "network failures" in dashboard
- Creates noise in error logs

**Is this a problem?**
No - for POC testing:
- Status reporting works fine (uses same HTTPS)
- Dead-man timer works fine
- Relay control works fine
- OTA is optional for this test

### 3. **Initial Uptime % is Low**
**Current:** 50.7%

**Why:**
We restarted the monitoring service 4-5 times during setup and configuration.

**Will it improve?**
Yes - after 24 hours of uninterrupted operation, this will normalize to >95%.

---

## 🎯 What You Can Track Over 30 Days

### ✅ Fully Trackable

1. **Reliability**
   - Total reboots
   - Reboot reasons (via boot messages)
   - Service uptime %

2. **Memory Stability**
   - Heap usage trend
   - Minimum heap reached
   - Memory leak detection

3. **Relay Performance**
   - Actual state changes
   - Fail-safe activations
   - Server control vs fail-safe ratio

4. **Network Reliability**
   - HTTP connection attempts
   - Failure rate
   - Error patterns

5. **Pi Health**
   - CPU temperature trends
   - WiFi signal quality
   - System load
   - Disk usage

6. **GPIO Verification**
   - Physical relay state tracking
   - LED blink counting
   - Hardware verification

### ⚠️ Partially Trackable

1. **MTBF (Mean Time Between Failures)**
   - Can detect reboots via boot messages
   - Can't calculate exact uptime between reboots without uptime values
   - **Workaround:** Use heartbeat gaps to estimate

2. **ESP32 WiFi Signal Strength**
   - Not in telemetry table
   - **Workaround:** Use Pi's WiFi RSSI as proxy (they're on same network)

3. **Dead-Man Timer Expiration Events**
   - Can detect via "timer expired" error messages
   - Can infer from server decision changes
   - **Workaround:** Parse main component messages for timer status

### ❌ Not Currently Trackable

1. **ESP32 Uptime Tracking**
   - ESP32 doesn't log uptime to serial console
   - Would need firmware change to add this

2. **Countdown Timer Real-Time Status**
   - ESP32 doesn't log timer countdown to serial
   - Would need firmware change to add this

3. **OTA Update Success/Failure**
   - SSL cert issue prevents OTA entirely
   - Would need proper SSL cert or firmware change

---

## 📈 Metrics You'll Get After 30 Days

### High Confidence Metrics

| Metric | Source | Confidence |
|--------|--------|-----------|
| Total reboots | Boot message detection | ✅ High |
| Heap stability | Telemetry table | ✅ High |
| Relay state changes | Relay operations table | ✅ High |
| Network failure rate | Network failures table | ✅ High |
| Pi health trends | System metrics table | ✅ High |
| GPIO verification | GPIO events table | ✅ High |
| Error patterns | Serial logs by level | ✅ High |
| Component activity | Serial logs by tag | ✅ High |

### Medium Confidence Metrics

| Metric | Source | Confidence |
|--------|--------|-----------|
| MTBF | Heartbeat gaps | ⚠️ Medium |
| Uptime % | Heartbeats serial_connected | ⚠️ Medium |
| Timer expirations | Error message parsing | ⚠️ Medium |
| Recovery time | Heartbeat transitions | ⚠️ Medium |

---

## 🔧 Recommended Enhancements (Optional)

If you want more detailed metrics, consider these firmware changes:

### 1. Add Uptime to Serial Logs
```c
// In main status report loop
ESP_LOGI(TAG, "Uptime: %lu seconds", uptime_seconds);
```

This would enable:
- Precise MTBF calculation
- Reboot detection via uptime discontinuity
- Runtime verification

### 2. Add Countdown Timer to Serial Logs
```c
// After timer operations
ESP_LOGI(TAG, "Countdown timer: %d seconds remaining", timer_remaining);
```

This would enable:
- Timer expiration prediction
- Server communication gap detection
- Fail-safe activation forecasting

### 3. Add WiFi RSSI to Serial Logs
```c
// In status report
ESP_LOGI(TAG, "WiFi RSSI: %d dBm", wifi_rssi);
```

This would enable:
- ESP32 perspective on signal strength
- Correlation with connection failures
- WiFi degradation detection

**BUT:** These are optional. The current monitoring is sufficient for 30-day reliability testing.

---

## 🎯 Test Goals vs Current Capabilities

| Goal | Can We Track It? | Method |
|------|------------------|--------|
| Overall uptime % | ✅ Yes | Heartbeat analysis |
| Number of reboots | ✅ Yes | Boot message detection |
| Memory leaks | ✅ Yes | Heap trend analysis |
| Relay reliability | ✅ Yes | State change tracking |
| Network stability | ✅ Yes | Failure rate calculation |
| Fail-safe activations | ✅ Yes | Error message + relay analysis |
| Energy savings (fan OFF time) | ⚠️ Partial | Relay state durations |
| MTBF | ⚠️ Estimated | Heartbeat gap analysis |
| ESP32 uptime | ❌ No | Need firmware change |
| Timer countdown | ❌ No | Need firmware change |

---

## 📊 Daily Check - What to Look For

### Green Flags (Everything Good)
```
✅ Uptime %: Increasing daily
✅ Reboots: 0 (or very low)
✅ Heap: Stable ~208KB
✅ Relay ops: Few actual changes
✅ Network failures: Only SSL cert errors
✅ Pi temp: <50°C
```

### Yellow Flags (Watch Closely)
```
⚠️ Uptime %: Not improving
⚠️ Reboots: 1-2 total
⚠️ Heap: Slowly decreasing
⚠️ Network failures: Increasing
⚠️ Pi temp: 50-60°C
```

### Red Flags (Action Needed)
```
❌ Uptime %: Decreasing
❌ Reboots: Multiple per day
❌ Heap: Rapidly decreasing
❌ Relay ops: Multiple fail-safe activations
❌ Pi temp: >60°C
```

---

## 🚀 Ready to Begin

**Current Status:**
- ✅ All monitoring services running
- ✅ All database tables created
- ✅ Enhanced metrics parsing active
- ✅ Dashboard ready for daily checks
- ✅ Data collection verified
- ✅ Duplicate relay records fixed
- ✅ Network failures properly tracked

**What You Have:**
- 8 database tables collecting data
- Real-time dashboard script
- Export tools for CSV analysis
- Comprehensive documentation

**What You Can Do:**
- Daily: Check dashboard (30 seconds)
- Weekly: Export data and review trends
- Monthly: Generate final report

**Limitations Understood:**
- No ESP32 uptime tracking
- No countdown timer tracking
- SSL cert errors expected
- Initial uptime % is low (will improve)

---

## ✅ Final Pre-Test Checklist

- [x] Pi monitoring service running
- [x] ESP32 connected and reporting
- [x] GPIO monitoring active
- [x] All 8 tables collecting data
- [x] Dashboard script working
- [x] Relay deduplication fixed
- [x] Documentation complete
- [x] Limitations understood

**You're ready to start the 30-day test! 🎉**

---

**Next Action:** Leave it running uninterrupted for 30 days, checking the dashboard daily.

**Quick Check Command:**
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh | head -50'
```

**Weekly Report:**
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh' > weekly_$(date +%Y%m%d).txt
```
