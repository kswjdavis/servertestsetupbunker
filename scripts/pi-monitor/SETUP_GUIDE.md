# Raspberry Pi ESP32 Monitoring Setup - Complete Guide

**Setup Date:** October 28, 2025
**System:** Raspberry Pi 3B+ with 256GB SD card
**Status:** ✅ Fully configured and operational (awaiting ESP32 connection)

---

## System Credentials

### SSH Access
- **IP Address:** `192.168.1.187`
- **Hostname:** `raspberrypi.local`
- **Username:** `bunker`
- **Password:** `bunker`
- **SSH Key:** Already configured (passwordless access from your Mac)

### WiFi Configuration
- **Network SSID:** `Arkgow`
- **WiFi Password:** `Lifeteam10`

---

## Quick Start - Accessing the Pi

### From Your Mac

**SSH Connection (passwordless - recommended):**
```bash
ssh bunker@192.168.1.187
```

**SSH Connection (with password):**
```bash
ssh bunker@192.168.1.187
# When prompted, enter password: bunker
```

**Using hostname instead of IP:**
```bash
ssh bunker@raspberrypi.local
```

---

## System Information

### Network Configuration
- **Hostname:** `raspberrypi.local`
- **IP Address:** `192.168.1.187` (DHCP)
- **WiFi Network:** `Arkgow`
- **WiFi Signal:** -74 dBm (good strength)

### User Accounts
- **Primary User:** `bunker`
- **Password:** `bunker`
- **Groups:** sudo, dialout, gpio, adm
- **SSH Access:** Passwordless (SSH key configured) + password backup

### Operating System
- **OS:** Raspberry Pi OS Lite (64-bit) - Bookworm
- **Version:** October 2025 release (2025-10-01)
- **Kernel:** 6.12.47+rpt-rpi-v8
- **Storage:** 238 GB total, 227 GB free

---

## Monitoring Service

### Service Management

**Check Status:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl status pi-monitor'
```

**View Live Logs:**
```bash
ssh bunker@192.168.1.187 'sudo journalctl -u pi-monitor -f'
```

**Restart Service:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl restart pi-monitor'
```

**Stop Service:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl stop pi-monitor'
```

**Start Service:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl start pi-monitor'
```

### Service Details
- **Service Name:** `pi-monitor.service`
- **Auto-start:** Enabled (starts on boot)
- **Working Directory:** `/opt/bunker-monitor`
- **Virtual Environment:** `/opt/bunker-monitor/.venv`
- **Config File:** `/etc/bunker-monitor.yaml`
- **Log Directory:** `/var/log/bunker`

---

## Database Access

### SQLite Database

**Location:** `/var/log/bunker/bunker_monitor.db`

**Access from Mac:**
```bash
# Copy database to local machine
scp bunker@192.168.1.187:/var/log/bunker/bunker_monitor.db ~/Desktop/

# Or access directly via SSH
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT * FROM heartbeats ORDER BY recorded_at DESC LIMIT 5;"'
```

**Interactive SQL Session:**
```bash
ssh bunker@192.168.1.187
sqlite3 /var/log/bunker/bunker_monitor.db

# SQLite commands:
.tables                    # List all tables
.schema serial_logs        # Show table structure
SELECT * FROM heartbeats LIMIT 10;
SELECT * FROM system_metrics ORDER BY recorded_at DESC LIMIT 5;
.quit
```

### Database Tables

1. **serial_logs** - ESP32 console output
   - Columns: id, recorded_at, level, tag, message, raw_line

2. **gpio_events** - Relay and LED state changes
   - Columns: id, recorded_at, pin, state, source

3. **system_metrics** - Raspberry Pi health data
   - Columns: id, recorded_at, cpu_temp_c, load_1m, mem_used_percent, disk_free_mb, wifi_rssi_dbm, uptime_seconds

4. **heartbeats** - Service health checks (every 60 seconds)
   - Columns: id, recorded_at, serial_connected, gpio_ok, notes

---

## System Health Monitoring

### Current System Metrics

**CPU Temperature:** 40.78°C (normal)
**Load Average:** 0.41
**Memory Usage:** 19.7%
**Disk Free:** 227 GB
**WiFi Signal:** -74 dBm
**Uptime:** Running since boot

### Check System Health
```bash
# CPU temperature
ssh bunker@192.168.1.187 'vcgencmd measure_temp'

# Memory usage
ssh bunker@192.168.1.187 'free -h'

# Disk usage
ssh bunker@192.168.1.187 'df -h'

# WiFi signal strength
ssh bunker@192.168.1.187 'iwconfig wlan0 | grep Signal'

# View latest metrics from database
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT * FROM system_metrics ORDER BY recorded_at DESC LIMIT 1;"'
```

---

## ESP32 Connection (When Ready)

### Hardware Setup

**Required:**
- ESP32 DevKitC board
- **USB data cable** (NOT charge-only)
- 3x jumper wires (if monitoring GPIO)
- 2x 1kΩ resistors (recommended but optional)

**Connections:**
```
ESP32 DevKitC        Raspberry Pi 3B+      Notes
------------------   -------------------    ----------------------------------
USB (micro-B)  ----> Pi USB port           Must use DATA cable, not charge-only
GPIO4 (relay)  ----> GPIO17 (pin 11)       Via 1kΩ resistor (optional)
GPIO5 (LED)    ----> GPIO27 (pin 13)       Via 1kΩ resistor (optional)
GND            ----> GND (pin 6)            Common ground required
```

**GPIO Pin Mapping:**
- Pi GPIO17 (physical pin 11) → ESP32 GPIO4 (relay control)
- Pi GPIO27 (physical pin 13) → ESP32 GPIO5 (identification LED)
- Pi GND (physical pin 6) → ESP32 GND

### Verify ESP32 Detection

**After plugging in ESP32:**
```bash
# Check for USB device
ssh bunker@192.168.1.187 'lsusb | grep -i esp'

# Check for serial device
ssh bunker@192.168.1.187 'ls -la /dev/serial/by-id/'

# Watch kernel messages for USB events
ssh bunker@192.168.1.187 'sudo dmesg | tail -20 | grep -i usb'

# Check service logs
ssh bunker@192.168.1.187 'sudo journalctl -u pi-monitor -n 20'
```

**Expected Output:**
- Service logs should show "Serial device detected" instead of "No serial device matched"
- `lsusb` should show Espressif device
- `/dev/serial/by-id/` should contain ESP32 device entry

### Verify Data Collection

**Check for ESP32 logs:**
```bash
# View recent serial logs
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT COUNT(*) FROM serial_logs;"'

# View latest ESP32 log entries
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT recorded_at, level, tag, message FROM serial_logs ORDER BY recorded_at DESC LIMIT 10;"'

# Check raw log files
ssh bunker@192.168.1.187 'ls -lh /var/log/bunker/esp32-serial-*.jsonl'
```

**Check GPIO events:**
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT * FROM gpio_events ORDER BY recorded_at DESC LIMIT 10;"'
```

---

## Configuration Files

### Main Configuration
**Location:** `/etc/bunker-monitor.yaml`

**Key Settings:**
- Serial device glob: `/dev/serial/by-id/*ESP32*`
- Baud rate: 115200
- GPIO pins: Relay=17, LED=27
- Log directory: `/var/log/bunker`
- Database: `/var/log/bunker/bunker_monitor.db`

**Edit Configuration:**
```bash
ssh bunker@192.168.1.187 'sudo nano /etc/bunker-monitor.yaml'
# After editing, restart service:
ssh bunker@192.168.1.187 'sudo systemctl restart pi-monitor'
```

### Service File
**Location:** `/etc/systemd/system/pi-monitor.service`

**To edit:**
```bash
ssh bunker@192.168.1.187 'sudo nano /etc/systemd/system/pi-monitor.service'
# After editing:
ssh bunker@192.168.1.187 'sudo systemctl daemon-reload && sudo systemctl restart pi-monitor'
```

### Log Rotation
**Location:** `/etc/logrotate.d/bunker-monitor`

Logs rotate daily, keep 14 days, compressed.

---

## Troubleshooting

### Service Not Running

**Check status:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl status pi-monitor'
```

**View errors:**
```bash
ssh bunker@192.168.1.187 'sudo journalctl -u pi-monitor -n 50'
```

**Restart service:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl restart pi-monitor'
```

### ESP32 Not Detected

**Common causes:**
1. **Charge-only USB cable** - Get a proper data cable
2. **ESP32 not powered** - Check for LED on ESP32
3. **Wrong USB port** - Try different ports on the Pi
4. **ESP32 not flashed** - Flash firmware to ESP32 first

**Verify cable is data-capable:**
```bash
# Plug ESP32 into your Mac
ls /dev/cu.usb*
# Should show: /dev/cu.usbserial-XXXXX (or similar)
```

### GPIO Errors

**If you see "Failed to initialize GPIO":**
```bash
# Check user is in gpio group
ssh bunker@192.168.1.187 'groups bunker'
# Should include: gpio

# If not, add user:
ssh bunker@192.168.1.187 'sudo usermod -aG gpio bunker'
# Then restart service
```

### Database Issues

**Check database integrity:**
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "PRAGMA integrity_check;"'
```

**Backup database:**
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db ".backup /tmp/bunker_backup.db"'
scp bunker@192.168.1.187:/tmp/bunker_backup.db ~/Desktop/
```

### WiFi Connection Issues

**Check WiFi status:**
```bash
ssh bunker@192.168.1.187 'iwconfig wlan0'
```

**Reconnect to WiFi:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl restart NetworkManager'
```

### Pi Not Responding

**If SSH hangs or Pi unreachable:**
1. Check network connection (ping 192.168.1.187)
2. Check router DHCP - IP might have changed
3. Power cycle the Pi (unplug/replug)
4. Connect monitor/keyboard to see console

---

## Data Export Examples

### Export All Data to CSV

**System metrics:**
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM system_metrics;" > /tmp/metrics.csv'
scp bunker@192.168.1.187:/tmp/metrics.csv ~/Desktop/
```

**Serial logs:**
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "SELECT * FROM serial_logs WHERE level=\"E\";" > /tmp/errors.csv'
scp bunker@192.168.1.187:/tmp/errors.csv ~/Desktop/
```

### Query Examples

**Find all error messages:**
```sql
SELECT recorded_at, tag, message
FROM serial_logs
WHERE level='E'
ORDER BY recorded_at DESC
LIMIT 50;
```

**Count relay state changes:**
```sql
SELECT source, state, COUNT(*) as count
FROM gpio_events
WHERE source='relay'
GROUP BY state;
```

**Average CPU temperature over last hour:**
```sql
SELECT AVG(cpu_temp_c) as avg_temp,
       MIN(cpu_temp_c) as min_temp,
       MAX(cpu_temp_c) as max_temp
FROM system_metrics
WHERE recorded_at > datetime('now', '-1 hour');
```

---

## Maintenance

### Update System Packages

```bash
ssh bunker@192.168.1.187 'sudo apt update && sudo apt upgrade -y'
```

### Update Monitoring Code

```bash
# From your Mac, in Bunkercolab directory:
cd /Users/jeffdavis/AmericanAgrionics/Bunkercolab
rsync -av scripts/pi-monitor/ bunker@192.168.1.187:/opt/bunker-monitor/
ssh bunker@192.168.1.187 'sudo systemctl restart pi-monitor'
```

### Clean Up Old Logs

```bash
# Remove logs older than 30 days
ssh bunker@192.168.1.187 'find /var/log/bunker -name "*.jsonl" -mtime +30 -delete'

# Vacuum database (reclaim space)
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "VACUUM;"'
```

---

## Backup & Recovery

### Full System Backup

**Backup database and logs:**
```bash
# Create backup directory
mkdir -p ~/Desktop/pi-backup-$(date +%Y%m%d)

# Copy database
scp bunker@192.168.1.187:/var/log/bunker/bunker_monitor.db ~/Desktop/pi-backup-$(date +%Y%m%d)/

# Copy log files
scp bunker@192.168.1.187:/var/log/bunker/*.jsonl ~/Desktop/pi-backup-$(date +%Y%m%d)/

# Copy configuration
scp bunker@192.168.1.187:/etc/bunker-monitor.yaml ~/Desktop/pi-backup-$(date +%Y%m%d)/
```

### SD Card Backup (Full Image)

**From Mac:**
```bash
# Insert SD card in Mac
diskutil list  # Find disk number (e.g., disk14)

# Unmount
diskutil unmountDisk /dev/disk14

# Create backup image (takes 10-30 minutes)
sudo dd if=/dev/rdisk14 of=~/Desktop/pi-backup-$(date +%Y%m%d).img bs=4m

# Compress to save space
gzip ~/Desktop/pi-backup-*.img
```

**Restore from backup:**
```bash
gunzip ~/Desktop/pi-backup-*.img.gz
sudo dd if=~/Desktop/pi-backup-*.img of=/dev/rdisk14 bs=4m
```

---

## Quick Reference Commands

### Essential Commands
```bash
# SSH into Pi (passwordless)
ssh bunker@192.168.1.187

# SSH with password if needed
ssh bunker@192.168.1.187
# Password: bunker

# Check service status
sudo systemctl status pi-monitor

# View live logs
sudo journalctl -u pi-monitor -f

# Query database
sqlite3 /var/log/bunker/bunker_monitor.db

# Restart service
sudo systemctl restart pi-monitor

# Check for ESP32
lsusb | grep -i esp
ls /dev/serial/by-id/

# System health
vcgencmd measure_temp
free -h
df -h
```

### File Locations
- **Monitor code:** `/opt/bunker-monitor/`
- **Configuration:** `/etc/bunker-monitor.yaml`
- **Service file:** `/etc/systemd/system/pi-monitor.service`
- **Log rotation:** `/etc/logrotate.d/bunker-monitor`
- **Database:** `/var/log/bunker/bunker_monitor.db`
- **Raw logs:** `/var/log/bunker/esp32-serial-*.jsonl`

---

## Copying Files Between Mac and Pi

### Copy Files TO Pi
```bash
# Copy a single file
scp /path/to/local/file bunker@192.168.1.187:/remote/path/

# Copy a directory
rsync -av /local/directory/ bunker@192.168.1.187:/remote/directory/

# Copy monitoring scripts
rsync -av /Users/jeffdavis/AmericanAgrionics/Bunkercolab/scripts/pi-monitor/ bunker@192.168.1.187:/opt/bunker-monitor/
```

### Copy Files FROM Pi
```bash
# Copy a single file
scp bunker@192.168.1.187:/remote/file /local/path/

# Copy database to Desktop
scp bunker@192.168.1.187:/var/log/bunker/bunker_monitor.db ~/Desktop/

# Copy all logs
scp bunker@192.168.1.187:/var/log/bunker/*.jsonl ~/Desktop/pi-logs/
```

---

## Next Steps

1. ✅ Raspberry Pi fully configured
2. ✅ Monitoring service running
3. ✅ Database collecting system metrics
4. ⏳ **Get USB data cable** (not charge-only)
5. ⏳ **Connect ESP32** to Pi via USB
6. ⏳ **Verify detection** and data collection
7. ⏳ **Connect GPIO wires** (optional - for relay/LED monitoring)

---

## Support & Documentation

**Related Documentation:**
- Hardware design: `docs/raspi-monitoring.md`
- Monitor code: `scripts/pi-monitor/README.md`
- Firmware procedures: `firmware/docs/HARDWARE_TEST_PROCEDURES.md`

**Common Issues:**
- ESP32 not detected → Check USB cable is data-capable
- GPIO errors → Check user is in gpio group
- Service crashes → Check logs with `journalctl -u pi-monitor`
- High CPU → Check for infinite loops in monitor code

---

## System Summary

**Raspberry Pi Credentials:**
- IP: `192.168.1.187`
- Hostname: `raspberrypi.local`
- User: `bunker`
- Password: `bunker`
- WiFi: `Arkgow` / `Lifeteam10`

**Quick Connect:**
```bash
ssh bunker@192.168.1.187
```

**Monitor Status:**
```bash
ssh bunker@192.168.1.187 'sudo systemctl status pi-monitor'
```

---

**Last Updated:** October 28, 2025
**Setup By:** Claude Code Assistant
**System Status:** ✅ Operational (awaiting ESP32 data cable)
