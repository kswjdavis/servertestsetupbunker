# Raspberry Pi 3B+ Monitoring Image Plan

This document captures the design for a headless Raspberry Pi 3B+ image that
monitors an ESP32 DevKitC running the Bunkercolab firmware. The goal is to log
long‑term reliability data (serial output, relay/LED GPIO state, and Pi system
health) while remaining recoverable after power loss and reachable over SSH.

## Hardware Overview

- **Pi board:** Raspberry Pi 3B+ (64‑bit Raspberry Pi OS Lite)
- **Monitored device:** ESP32 DevKitC flashed with the Bunkercolab firmware  
  - Relay control output → `GPIO4` (ESP32)  
  - Identification LED → `GPIO5` (ESP32)  
  - USB serial console (115200 8‑N‑1)
- **Physical links:**
  - USB A→micro‑B cable between Pi and ESP32 (power + serial)
  - Logic monitoring jumpers (tie grounds together):  
    - ESP32 `GPIO4` → Pi `GPIO17` (physical pin 11) via 1 kΩ series resistor  
    - ESP32 `GPIO5` → Pi `GPIO27` (physical pin 13) via 1 kΩ series resistor  
    - ESP32 GND → Pi GND (physical pin 6)
- **Wi‑Fi:** Pi joins SSID `Arkgow` with passphrase `Lifeteam10`; DHCP assumed.

## Software Components

1. **Base image**
   - Raspberry Pi OS Lite (64‑bit)  
   - Preseed `/etc/wpa_supplicant/wpa_supplicant.conf` with target SSID  
   - Drop empty `/boot/ssh` file to enable SSH on first boot  
   - Optional: user account `bunker` with sudo (password or SSH key injected)

2. **Monitoring service (`pi_monitor.py`)**
   - Python 3.11 (system) + virtualenv
   - Dependencies: `pyserial`, `gpiozero`, `psutil`, `pyyaml`
   - Responsibilities:
     - Tail `/dev/serial/by-id/` for ESP32 serial stream, timestamp each line,
       parse ESP-IDF log metadata (level/tag/message), store raw line
     - Watch Pi GPIO 17/27 for relay/LED edges, record state transitions
     - Collect Pi health metrics (CPU temp, load, memory, disk, Wi‑Fi RSSI)
     - Persist structured records into SQLite database
     - Mirror raw serial text into rotating JSONL log files
     - Emit periodic heartbeat records so outages are obvious

3. **systemd integration**
   - Unit `bunker-monitor.service` runs monitor inside the venv on boot
   - `Restart=always`, `RestartSec=5` for rapid recovery
   - `After=network-online.target dev-serial0.device`

4. **Log retention**
   - `logrotate` policy for `/var/log/bunker/*.log` (daily rotate, keep 14, compress)
   - SQLite vacuum + copy script (daily cron) to prevent unbounded growth

5. **SSH access**
   - Standard OpenSSH server with `bunker` user in `ssh` and `gpio` groups
   - Users retrieve data over SSH/SFTP (`/var/log/bunker` and SQLite DB)

## Data Model

SQLite database stored at `/var/log/bunker/bunker_monitor.db`:

```sql
CREATE TABLE serial_logs (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,        -- ISO8601 UTC
    level TEXT,                       -- E/W/I/D
    tag TEXT,
    message TEXT,
    raw_line TEXT NOT NULL
);

CREATE TABLE gpio_events (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    pin INTEGER NOT NULL,
    state INTEGER NOT NULL,           -- 0=low, 1=high
    source TEXT NOT NULL              -- "relay" or "identify_led"
);

CREATE TABLE system_metrics (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    cpu_temp_c REAL,
    load_1m REAL,
    mem_used_percent REAL,
    disk_free_mb REAL,
    wifi_rssi_dbm INTEGER,
    uptime_seconds INTEGER
);

CREATE TABLE heartbeats (
    id INTEGER PRIMARY KEY,
    recorded_at TEXT NOT NULL,
    serial_connected INTEGER NOT NULL,
    gpio_ok INTEGER NOT NULL,
    notes TEXT
);
```

## Bootstrapping Steps

1. **Image prep (workstation)**
   - Download Raspberry Pi OS Lite (64‑bit)
   - Use Raspberry Pi Imager or `dd` to flash microSD
   - Mount boot partition, add `wpa_supplicant.conf`, `ssh` flag, optional
     `userconf` or `authorized_keys`
   - Optionally add `firstboot.sh` to bootstrap packages and scripts

2. **Initial Pi configuration**
   - Boot Pi with Ethernet (optional) or rely on Wi‑Fi config
   - `sudo raspi-config nonint do_i2c 1` (optional), ensure timezone/locale set
   - `sudo apt update && sudo apt install -y python3-venv python3-pip \
       python3-gpiozero python3-serial python3-psutil sqlite3 logrotate git`
   - `sudo useradd -m bunker` (if not pre-created), add to `dialout`, `gpio`, `adm`

3. **Deploy monitor**
   - Copy repo directory `scripts/pi-monitor` to Pi (e.g., `/opt/bunker-monitor`)
   - `python3 -m venv /opt/bunker-monitor/.venv`
   - `source .venv/bin/activate && pip install -r requirements.txt`
   - Copy `pi_monitor_config.yaml` to `/etc/bunker-monitor.yaml`, adjust serial path,
     wifi interface, retention thresholds
   - Install systemd unit + logrotate file; enable service

4. **Validation**
   - `sudo systemctl status bunker-monitor` → should show running
   - Check `/var/log/bunker/esp32-serial-*.jsonl` for streaming logs
   - Verify SQLite tables populate (`sqlite3 /var/log/bunker/bunker_monitor.db 'SELECT * FROM heartbeats ORDER BY recorded_at DESC LIMIT 5;'`)

## Failure/Recovery Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Pi loses power | systemd restarts monitor automatically on boot; heartbeat gap visible |
| ESP32 unplugged | Serial worker reports disconnect; heartbeat notes flag serial_connected=0 until device returns |
| Wi‑Fi drop | Monitor continues logging locally; SSH unavailable until Wi-Fi recovers |
| Storage fills | logrotate + retention keep footprint bounded; warnings emitted when disk_free_mb < threshold |

## Access & Data Retrieval

- SSH into Pi (`ssh bunker@bunker-monitor.local` or via IP)
- Raw serial logs: `/var/log/bunker/esp32-serial-YYYYMMDD.jsonl`
- Structured data: `/var/log/bunker/bunker_monitor.db`
- Export sample metrics:
  ```bash
  sqlite3 /var/log/bunker/bunker_monitor.db \
      "SELECT recorded_at, message FROM serial_logs WHERE level='E' ORDER BY recorded_at DESC LIMIT 20;"
  ```

## Next Implementation Steps

1. Commit monitoring script, service, and configs (`scripts/pi-monitor/`)
2. Provide flashing checklist and first-boot bootstrap script
3. Optionally wrap `pi_monitor.py` with CLI for replay/analysis

