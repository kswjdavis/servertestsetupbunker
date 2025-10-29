# ESP32 Long-Term Monitoring - Deployment Summary

**Date:** October 29, 2025
**System:** Raspberry Pi 3B+ + ESP32 DevKitC
**Purpose:** 30-day reliability and uptime testing
**Status:** ✅ Fully Operational

---

## 🎯 What You Can Now Track

### ✅ Enhanced Monitoring Capabilities

Your Raspberry Pi is now set up to track **everything** needed for a month-long reliability test:

#### 1. **ESP32 Telemetry** (Real-time Metrics)
- **Free Heap Memory** - Detect memory leaks
- **WiFi RSSI** - Track signal strength
- **Countdown Timer** - Dead-man timer status
- **Uptime** - Track time between reboots

#### 2. **Reboot Detection** (Failure Tracking)
- **Boot Events** - ESP32 startup detection
- **Reset Reasons** - Why it rebooted (power, watchdog, crash)
- **Uptime Before Reboot** - MTBF calculation
- **Watchdog Count** - How many watchdog resets

#### 3. **Network Failures** (Connectivity Issues)
- **HTTP Errors** - Failed server connections
- **TLS Failures** - SSL certificate issues
- **DNS Failures** - Network resolution problems
- **Error Messages** - Full diagnostic info

#### 4. **Relay Operations** (Fan Control)
- **State Changes** - Every time fans turn on/off
- **Trigger Reason** - Server command vs fail-safe
- **Duration** - How long in each state
- **Failure Detection** - Relay stuck or not responding

#### 5. **GPIO State Tracking** (Hardware Verification)
- **Pin 17 (Relay)** - Physical relay state
- **Pin 27 (LED)** - Identification LED blinks
- **Transition Count** - Total state changes

#### 6. **System Health** (Pi Monitoring)
- **CPU Temperature** - Thermal tracking
- **Memory Usage** - RAM consumption
- **Disk Space** - Storage tracking
- **WiFi Signal** - Connection quality
- **Load Average** - System load

---

## 📊 Dashboard Access

### View Current Status
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh'
```

This shows:
- Test duration
- Current status (connected/disconnected)
- Data collected (record counts)
- ESP32 health (heap, uptime)
- Reboot history
- Network failure log
- Relay operation timeline
- Error summary
- Pi health stats
- Uptime percentage
- Most active components

### Export Data for Analysis
```bash
# Export all telemetry
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM esp32_telemetry;"' > esp32_health.csv

# Export all reboots
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM esp32_reboots;"' > reboots.csv

# Export all network failures
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM network_failures;"' > failures.csv

# Export all relay operations
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM relay_operations;"' > relay_timeline.csv
```

---

## 🔍 Key Metrics You'll Get After 30 Days

### 1. **Reliability Metrics**
- **Uptime %** - How often was ESP32 connected and operational?
- **MTBF** - Mean Time Between Failures (average uptime before reboot)
- **Total Reboots** - How many times did ESP32 restart?
- **Reboot Reasons** - Power loss? Watchdog? Crash?

### 2. **Network Reliability**
- **Connection Success Rate** - % of successful HTTP requests
- **Network Outages** - Count and duration
- **Longest Outage** - Maximum downtime period
- **Recovery Time** - How long to reconnect after failure?

### 3. **Memory Stability**
- **Heap Trend** - Is memory decreasing over time? (leak detection)
- **Minimum Heap** - Lowest memory ever reached
- **Average Heap** - Typical memory usage
- **Memory Warnings** - Any low-memory events?

### 4. **Relay Performance**
- **Total Switch Count** - How many times fans turned on/off
- **Time OFF** - Total hours fans were stopped (energy savings)
- **Fail-Safe Activations** - Times dead-man timer expired
- **Switching Reliability** - Any stuck relay events?

### 5. **Power & Performance**
- **CPU Frequency** - Power management working?
- **Watchdog Triggers** - Any firmware hangs?
- **Average Response Time** - HTTP latency
- **Performance Degradation** - Any slowdown over time?

---

## 📈 Daily Monitoring Routine

### Quick Check (30 seconds)
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh | head -30'
```

Look for:
- ✅ Current Status: Connected + GPIO Active
- ✅ Uptime %: Should be >95% after first few days
- ❌ New Reboots: Should be zero
- ❌ Network Failures: Count should be stable

### Weekly Deep Dive (5 minutes)
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh' > weekly_report_$(date +%Y%m%d).txt
```

Review:
1. Total reboots (should be 0 or very low)
2. Network failure count (trend over time)
3. Heap memory (check for decline)
4. Pi temperature (should be <50°C)
5. Error patterns (any new errors?)

### Monthly Report (15 minutes)
```bash
# Export all data
ssh bunker@192.168.1.187 'cd /var/log/bunker && tar czf ~/bunker-data-$(date +%Y%m%d).tar.gz *.db *.jsonl'
scp bunker@192.168.1.187:~/bunker-data-*.tar.gz ~/Desktop/

# Generate final report
ssh bunker@192.168.1.187 '/opt/bunker-monitor/dashboard.sh' > FINAL_REPORT.txt
```

---

## 🎯 Success Criteria

After 30 days, you should see:

### ✅ Excellent (Production Ready)
- **Uptime:** >99%
- **Reboots:** 0-1 total
- **Network Success Rate:** >95%
- **Heap:** Stable (no decline)
- **Relay Switches:** Thousands with 100% reliability

### ⚠️ Good (Minor Issues)
- **Uptime:** 95-99%
- **Reboots:** 2-5 total
- **Network Success Rate:** 90-95%
- **Heap:** Slight decline (<10%)
- **Relay:** 1-2 stuck events

### ❌ Needs Improvement
- **Uptime:** <95%
- **Reboots:** >5 total
- **Network Success Rate:** <90%
- **Heap:** Declining >10%
- **Relay:** Multiple failures

---

## 🐛 Known Issues & Workarounds

### 1. SSL Certificate Errors (OTA Updates)
**Status:** Expected, non-critical
**Message:** `Failed to verify certificate`
**Impact:** OTA updates won't work, but status reporting works fine
**Solution:** Use self-signed cert or disable OTA for POC

### 2. Dead-Man Timer Expiration During Setup
**Status:** Expected during testing
**Message:** `Dead-man timer expired - entering fail-safe`
**Impact:** Relay stays ON (fail-safe mode)
**Solution:** Normal - timer resets when server responds

### 3. Service Restarts Show Low Uptime
**Status:** Expected during initial setup
**Why:** We restarted the service multiple times during configuration
**Solution:** Uptime % will normalize after 24+ hours of uninterrupted operation

---

## 📂 Files & Locations

### On Raspberry Pi
- **Monitor Code:** `/opt/bunker-monitor/pi_monitor.py`
- **Configuration:** `/etc/bunker-monitor.yaml`
- **Database:** `/var/log/bunker/bunker_monitor.db`
- **Raw Logs:** `/var/log/bunker/esp32-serial-*.jsonl`
- **Dashboard:** `/opt/bunker-monitor/dashboard.sh`
- **Service:** `/etc/systemd/system/pi-monitor.service`

### On Your Mac
- **Setup Guide:** `pitest/README.md`
- **Monitoring Queries:** `pitest/MONITORING_QUERIES.md`
- **Enhancement Plan:** `pitest/LONG_TERM_MONITORING_ENHANCEMENTS.md`
- **This Summary:** `pitest/DEPLOYMENT_SUMMARY.md`

---

## 🚀 Running the Test

### Start 30-Day Test
1. ✅ Pi is already running and collecting data
2. ✅ All tables created and working
3. ✅ Dashboard ready for daily checks
4. **Action Required:** Leave it running uninterrupted for 30 days

### Daily Checklist
- [ ] Run dashboard to verify system is up
- [ ] Check for new reboots (should be none)
- [ ] Verify uptime % is increasing
- [ ] Note any unusual errors

### Weekly Checklist
- [ ] Export weekly report
- [ ] Check heap trend (memory leak?)
- [ ] Review error patterns
- [ ] Verify Pi temperature is normal
- [ ] Check disk space (should have >200GB free)

### Monthly Checklist
- [ ] Export all data (CSV + database backup)
- [ ] Generate final report with dashboard
- [ ] Calculate key metrics:
  - Total uptime %
  - MTBF (hours between failures)
  - Network success rate
  - Total energy saved (fan OFF time)
- [ ] Create summary for stakeholders

---

## 💡 Pro Tips

### 1. Bookmark the Dashboard Command
Add to your shell config (~/.bashrc or ~/.zshrc):
```bash
alias esp32status='ssh bunker@192.168.1.187 /opt/bunker-monitor/dashboard.sh'
```

Then just run: `esp32status`

### 2. Set Up Daily Email Reports (Optional)
On the Pi, add to crontab:
```bash
# Run dashboard daily at 8am and email results
0 8 * * * /opt/bunker-monitor/dashboard.sh | mail -s "ESP32 Daily Report" your@email.com
```

### 3. Monitor Disk Space
```bash
ssh bunker@192.168.1.187 'df -h /var/log/bunker'
```

Should have >200GB free. Logs rotate automatically after 14 days.

### 4. Quick Telemetry Check
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "
SELECT recorded_at, free_heap_bytes
FROM esp32_telemetry
ORDER BY recorded_at DESC LIMIT 10;
"'
```

### 5. Find When Last Reboot Occurred
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "
SELECT * FROM esp32_reboots ORDER BY detected_at DESC LIMIT 1;
"'
```

---

## 🎓 What Each Table Tells You

| Table | Purpose | Key Insights |
|-------|---------|-------------|
| `serial_logs` | Every ESP32 message | Complete audit trail, debug issues |
| `gpio_events` | Hardware state changes | Physical verification of relay |
| `system_metrics` | Pi health | Detect Pi hardware issues |
| `heartbeats` | Service status | Monitor availability |
| `esp32_telemetry` | ESP32 metrics | Memory, signal, timer status |
| `esp32_reboots` | Failure events | Reliability, MTBF |
| `network_failures` | Connectivity issues | Network reliability |
| `relay_operations` | Fan control | Energy savings, fail-safe events |

---

## ✅ System Status

**Current Configuration:**
- ✅ Pi monitoring service running
- ✅ ESP32 connected and reporting
- ✅ GPIO monitoring active
- ✅ Enhanced metrics parsing enabled
- ✅ All 8 database tables created
- ✅ Dashboard script deployed
- ✅ Data collection verified

**Ready for long-term testing!**

---

## 📞 Support

**Docs:**
- Main README: `pitest/README.md`
- Query Examples: `pitest/MONITORING_QUERIES.md`
- Enhancement Details: `pitest/LONG_TERM_MONITORING_ENHANCEMENTS.md`

**Quick Access:**
```bash
# SSH to Pi
ssh bunker@192.168.1.187

# View live logs
sudo journalctl -u pi-monitor -f

# Check service status
sudo systemctl status pi-monitor

# Restart service (if needed)
sudo systemctl restart pi-monitor
```

---

**Test Started:** October 29, 2025
**Expected Completion:** November 29, 2025 (30 days)
**Next Review:** November 5, 2025 (weekly check)
