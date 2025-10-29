# Raspberry Pi ESP32 Monitoring Stack

This folder packages everything needed to turn a Raspberry Pi 3B+ into a long‑term
monitoring node for the Bunkercolab ESP32 DevKitC firmware. The Pi captures USB
serial logs, watches key GPIO signals, records its own health, and keeps running
after power interruptions.

## Feature Summary

- Auto-connects to Wi‑Fi SSID `Arkgow` (credentials embedded during imaging)
- Captures ESP-IDF serial logs at 115200 baud and stores both raw and parsed records
- Monitors ESP32 relay (`GPIO4`) and identification LED (`GPIO5`) via Pi GPIO 17/27
- Persists telemetry in SQLite for structured queries and JSONL files for raw text
- Collects Pi health metrics (CPU temp, load, RAM, disk, Wi‑Fi RSSI, uptime)
- systemd service restarts on failure and at boot; logrotate limits disk usage
- SSH/SFTP access to retrieve data without interrupting the monitor

## Repository Contents

| File | Purpose |
| ---- | ------- |
| `pi_monitor.py` | Main monitoring daemon (Python 3.11+) |
| `pi_monitor_config.yaml` | Config template (serial device, GPIO pins, log paths) |
| `requirements.txt` | Python dependencies for virtualenv |
| `pi-monitor.service` | systemd unit to auto-start the daemon |
| `logrotate.conf` | Log rotation policy for `/var/log/bunker/*.log` |
| `firstboot.sh` | Optional bootstrap script to run on first boot |

## High-Level Setup Flow

1. **Prepare the OS image**
   - Flash Raspberry Pi OS Lite (64‑bit) to microSD
   - Add `wpa_supplicant.conf` with SSID `Arkgow` / passphrase `Lifeteam10`
   - Create empty `ssh` file to enable SSH
   - Optionally copy `firstboot.sh` to `/boot/` to automate package installs

2. **Initial Pi configuration**
   ```bash
   sudo useradd -m bunker
   sudo usermod -aG sudo,dialout,gpio,adm bunker
   sudo apt update
   sudo apt install -y python3-venv python3-pip python3-gpiozero python3-serial \
       python3-psutil sqlite3 logrotate iw rfkill
   ```

3. **Deploy the monitor**
   ```bash
   sudo mkdir -p /opt/bunker-monitor
   sudo chown bunker:bunker /opt/bunker-monitor
   rsync -av scripts/pi-monitor/ bunker@<pi-host>:/opt/bunker-monitor/

   ssh bunker@<pi-host> '
     cd /opt/bunker-monitor &&
     python3 -m venv .venv &&
     source .venv/bin/activate &&
     pip install -r requirements.txt
   '
   ```

4. **Configure runtime**
   ```bash
   sudo cp /opt/bunker-monitor/pi-monitor.service /etc/systemd/system/
   sudo cp /opt/bunker-monitor/logrotate.conf /etc/logrotate.d/bunker-monitor
   sudo install -o root -g root -m 640 /opt/bunker-monitor/pi_monitor_config.yaml \
       /etc/bunker-monitor.yaml

   sudo systemctl daemon-reload
   sudo systemctl enable --now pi-monitor.service
   ```

5. **Verify operations**
   ```bash
   sudo systemctl status pi-monitor
   sudo journalctl -u pi-monitor -f
   ls /var/log/bunker/
   sqlite3 /var/log/bunker/bunker_monitor.db 'SELECT COUNT(*) FROM serial_logs;'
   ```

## Hardware Connections

```
ESP32 DevKitC        Raspberry Pi 3B+      Notes
------------------   -------------------    ----------------------------------
GPIO4 (relay)  ----> GPIO17 (pin 11)  --+   1 kΩ resistor inline; shared ground
GPIO5 (LED)    ----> GPIO27 (pin 13)  --+   1 kΩ resistor inline
GND            ----- GND (pin 6)           Common reference
USB (console)  ----- Pi USB port           Provides power + serial logs
```

The Pi reads these lines as digital inputs with internal pull-downs disabled.
Maintain 3.3 V logic only; never feed 5 V into Pi GPIO pins.

## Serial Expectations

ESP-IDF logging format is `I (1027) tag: message`. The monitor parses the leading
letter (`E/W/I/D/V`), timestamp ticks, and tag when present. Unstructured lines
are still stored verbatim. The script rotates raw JSONL files daily and mirrors
records into the SQLite `serial_logs` table for filtering.

## Accessing Data

- Raw serial text: `/var/log/bunker/esp32-serial-YYYYMMDD.jsonl`
- Structured DB: `/var/log/bunker/bunker_monitor.db`
- GPIO edges: `SELECT * FROM gpio_events ORDER BY recorded_at DESC;`
- Health metrics: `SELECT * FROM system_metrics WHERE wifi_rssi_dbm IS NOT NULL;`

Copy logs via `scp` or mount over SSHFS as needed.

## References

- `docs/raspi-monitoring.md` – full design rationale
- `firmware/docs/HARDWARE_TEST_PROCEDURES.md` – target metrics logged via serial

