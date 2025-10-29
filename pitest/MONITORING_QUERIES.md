# ESP32 Monitoring System - Data Reference

**Last Updated:** October 29, 2025
**Database:** `/var/log/bunker/bunker_monitor.db`
**Raw Logs:** `/var/log/bunker/esp32-serial-*.jsonl`

---

## 📊 What We're Logging

### 1. Serial Logs (ESP32 Console Output)
**Table:** `serial_logs`
**Records:** 300+ messages
**Format:** Parsed ESP-IDF log lines

**Fields:**
- `recorded_at` - Timestamp when Pi received the message
- `level` - Log level (I=Info, W=Warning, E=Error, D=Debug, V=Verbose)
- `tag` - ESP-IDF component name (e.g., "main", "http_client", "deadman_timer")
- `message` - The actual log message
- `raw_line` - Original ESP-IDF formatted line

**Example Output:**
```
recorded_at                 level  tag               message
--------------------------  -----  ----------------  --------------------------------------
2025-10-29T14:03:45+00:00Z  I      http_client       HTTP Status = 200, content_length = 142
2025-10-29T14:03:45+00:00Z  I      main              Server decision: shutdown_allowed=false
2025-10-29T14:03:45+00:00Z  I      deadman_timer     Dead-man timer reset
2025-10-29T14:03:45+00:00Z  I      relay_controller  Relay: ON (fans running)
```

**Current Stats:**
- Info messages: 236 (79%)
- Debug messages: 21 (7%)
- Verbose messages: 15 (5%)
- Error messages: 14 (5%)
- Warning messages: 2 (<1%)

---

### 2. GPIO Events (Hardware State Changes)
**Table:** `gpio_events`
**Records:** 588 state transitions
**Purpose:** Track relay and LED activity

**Fields:**
- `recorded_at` - Timestamp of state change
- `pin` - BCM pin number (17=relay, 27=LED)
- `state` - Current state (0=LOW/off, 1=HIGH/on)
- `source` - Human-readable name ("relay" or "identify_led")

**Example Output:**
```
recorded_at                 pin  state  source
--------------------------  ---  -----  ------------
2025-10-29T14:04:33+00:00Z  27   1      identify_led
2025-10-29T14:04:33+00:00Z  27   0      identify_led
2025-10-29T14:04:32+00:00Z  27   1      identify_led
```

**Current Stats:**
- LED blinks: 588 transitions (294 on, 294 off)
- Relay changes: 1 transition
- Average blink rate: ~10 blinks/minute (identification flashing)

**Use Cases:**
- Verify relay is switching when expected
- Count how many times fans turned on/off
- Detect if LED identification is working
- Calculate duty cycle of relay operation

---

### 3. System Metrics (Raspberry Pi Health)
**Table:** `system_metrics`
**Records:** 46 samples (1 per minute)
**Purpose:** Monitor Pi hardware health

**Fields:**
- `recorded_at` - Sample timestamp
- `cpu_temp_c` - CPU temperature in Celsius
- `load_1m` - 1-minute load average
- `mem_used_percent` - Memory usage percentage
- `disk_free_mb` - Free disk space in MB
- `wifi_rssi_dbm` - WiFi signal strength (dBm, more negative = weaker)
- `uptime_seconds` - System uptime

**Example Output:**
```
recorded_at                 cpu_temp_c  load_1m  mem_used  disk_free    wifi_rssi
--------------------------  ----------  -------  --------  -----------  ---------
2025-10-29T14:03:45+00:00Z  40.78       0.04     19.5%     227077 MB    -59 dBm
2025-10-29T14:02:45+00:00Z  41.32       0.12     19.5%     227078 MB    -59 dBm
2025-10-29T14:01:45+00:00Z  42.39       0.17     19.5%     227078 MB    -60 dBm
```

**Current Stats:**
- CPU Temp: 32-48°C (avg: 39°C)
- WiFi Signal: -59 to -76 dBm (avg: -64 dBm, good)
- Memory: ~19% used consistently
- Disk: 227 GB free
- Load: 0.04-1.0 (very light)

**Signal Strength Guide:**
- -30 to -50 dBm: Excellent
- -50 to -60 dBm: Good (your range)
- -60 to -70 dBm: Fair
- -70 to -80 dBm: Weak
- Below -80 dBm: Very weak

---

### 4. Heartbeats (Service Health)
**Table:** `heartbeats`
**Records:** 46 beats (1 per minute)
**Purpose:** Track service health and connectivity

**Fields:**
- `recorded_at` - Heartbeat timestamp
- `serial_connected` - Is ESP32 serial connected? (1=yes, 0=no)
- `gpio_ok` - Is GPIO monitoring active? (1=yes, 0=no)
- `notes` - Error description if any issues

**Example Output:**
```
recorded_at                 serial_connected  gpio_ok  notes
--------------------------  ----------------  -------  -------------------------
2025-10-29T14:03:45+00:00Z  1                 1        (healthy)
2025-10-29T13:59:45+00:00Z  0                 1        serial_disconnected
2025-10-29T13:57:36+00:00Z  0                 0        serial_disconnected gpio_unavailable
```

**Current Status:**
- Last 4 heartbeats: ✅ All healthy (serial + GPIO working)
- Service uptime: 42 minutes
- No current issues

---

## 🔍 Useful Queries

### Check ESP32 Errors
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT recorded_at, tag, message
FROM serial_logs
WHERE level=\"E\"
ORDER BY recorded_at DESC
LIMIT 20;
"'
```

### Count Messages by Component
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT tag, COUNT(*) as messages
FROM serial_logs
WHERE tag IS NOT NULL
GROUP BY tag
ORDER BY messages DESC;
"'
```

### Relay Activity Timeline
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT recorded_at, state,
  CASE WHEN state=1 THEN \"Fans ON\" ELSE \"Fans OFF\" END as status
FROM gpio_events
WHERE source=\"relay\"
ORDER BY recorded_at DESC;
"'
```

### LED Flash Pattern Analysis
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT
  DATE(recorded_at) as date,
  COUNT(*) as total_transitions,
  COUNT(*)/2 as blink_count
FROM gpio_events
WHERE source=\"identify_led\"
GROUP BY DATE(recorded_at);
"'
```

### System Health Over Time
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT
  recorded_at,
  cpu_temp_c as \"CPU°C\",
  mem_used_percent as \"Mem%\",
  wifi_rssi_dbm as \"WiFi\"
FROM system_metrics
ORDER BY recorded_at DESC
LIMIT 20;
"'
```

### Find Server Communication Issues
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT recorded_at, message
FROM serial_logs
WHERE tag=\"http_client\"
  AND (level=\"E\" OR level=\"W\" OR message LIKE \"%fail%\" OR message LIKE \"%error%\")
ORDER BY recorded_at DESC;
"'
```

### Dead-Man Timer Resets
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT recorded_at, message
FROM serial_logs
WHERE tag=\"deadman_timer\"
ORDER BY recorded_at DESC
LIMIT 20;
"'
```

### Service Downtime Analysis
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT
  recorded_at,
  CASE WHEN serial_connected=1 THEN \"✓\" ELSE \"✗\" END as serial,
  CASE WHEN gpio_ok=1 THEN \"✓\" ELSE \"✗\" END as gpio,
  notes
FROM heartbeats
ORDER BY recorded_at DESC
LIMIT 30;
"'
```

### Export to CSV
```bash
# Export serial logs
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "
SELECT * FROM serial_logs;
"' > ~/Desktop/esp32_logs.csv

# Export system metrics
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "
SELECT * FROM system_metrics;
"' > ~/Desktop/pi_health.csv

# Export GPIO events
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "
SELECT * FROM gpio_events;
"' > ~/Desktop/gpio_activity.csv
```

---

## 📁 Raw JSONL Logs

In addition to SQLite, all serial data is stored in raw JSONL files:

**Location:** `/var/log/bunker/esp32-serial-YYYYMMDD.jsonl`

**Format:**
```json
{"ts": "2025-10-29T14:04:46+00:00Z", "level": "I", "tag": "deadman_timer", "msg": "Dead-man timer reset", "line": "I (426598) deadman_timer: Dead-man timer reset"}
```

**Benefits:**
- Easy to parse with `jq` or Python
- Can process with text tools (`grep`, `awk`)
- Rotates daily automatically
- Compressed after 14 days

**Example Commands:**
```bash
# View latest entries
ssh bunker@192.168.1.187 'tail -20 /var/log/bunker/esp32-serial-*.jsonl'

# Find all errors
ssh bunker@192.168.1.187 'grep "\"level\": \"E\"" /var/log/bunker/esp32-serial-*.jsonl'

# Count messages by tag using jq
ssh bunker@192.168.1.187 'cat /var/log/bunker/esp32-serial-*.jsonl | jq -r .tag | sort | uniq -c | sort -rn'
```

---

## 🎯 Monitoring Dashboard Commands

### Quick Status Check
```bash
ssh bunker@192.168.1.187 '
echo "=== SERVICE STATUS ==="
sudo systemctl status pi-monitor | grep Active

echo -e "\n=== LATEST HEARTBEAT ==="
sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT * FROM heartbeats ORDER BY recorded_at DESC LIMIT 1;
"

echo -e "\n=== SYSTEM HEALTH ==="
sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT cpu_temp_c as \"CPU°C\", mem_used_percent as \"Mem%\",
       disk_free_mb/1024 as \"Disk_GB\", wifi_rssi_dbm as \"WiFi\"
FROM system_metrics ORDER BY recorded_at DESC LIMIT 1;
"

echo -e "\n=== RECORD COUNTS ==="
sqlite3 -header -column /var/log/bunker/bunker_monitor.db "
SELECT
  (SELECT COUNT(*) FROM serial_logs) as serial_logs,
  (SELECT COUNT(*) FROM gpio_events) as gpio_events,
  (SELECT COUNT(*) FROM system_metrics) as metrics,
  (SELECT COUNT(*) FROM heartbeats) as heartbeats;
"
'
```

### Real-Time Log Tail
```bash
# Watch ESP32 logs in real-time
ssh bunker@192.168.1.187 'sudo journalctl -u pi-monitor -f'
```

### Database Stats
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "
SELECT
  \"Database\" as metric,
  ROUND(page_count * page_size / 1024.0 / 1024.0, 2) || \" MB\" as value
FROM pragma_page_count(), pragma_page_size()
UNION ALL
SELECT \"Serial logs\", COUNT(*) FROM serial_logs
UNION ALL
SELECT \"GPIO events\", COUNT(*) FROM gpio_events
UNION ALL
SELECT \"System metrics\", COUNT(*) FROM system_metrics
UNION ALL
SELECT \"Heartbeats\", COUNT(*) FROM heartbeats;
"'
```

---

## 🚨 Current Issues

### SSL Certificate Errors (Non-Critical)
The ESP32 OTA updater can't verify the server's SSL certificate. This is expected for self-signed certificates and doesn't affect normal operation.

**Recent errors:**
- `esp-x509-crt-bundle: Failed to verify certificate`
- `esp-tls: Failed to open new connection`
- Frequency: Every 5-10 minutes (OTA check interval)

**Impact:** None - Status reporting to server works fine over HTTPS

---

## 📞 Quick Access

**SSH to Pi:**
```bash
ssh bunker@192.168.1.187
```

**Database path:**
```
/var/log/bunker/bunker_monitor.db
```

**Service name:**
```
pi-monitor
```

**Common commands:**
```bash
sudo systemctl status pi-monitor    # Check service status
sudo systemctl restart pi-monitor   # Restart service
sudo journalctl -u pi-monitor -f    # Live logs
```
