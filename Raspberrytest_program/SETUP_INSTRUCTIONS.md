# Raspberry Pi ESP32 Monitor - Complete Setup Package

**Last Updated:** October 29, 2025
**Purpose:** Long-term reliability testing and monitoring of ESP32 firmware

---

## 📦 Package Contents

This directory contains everything needed to set up a Raspberry Pi as a monitoring station for ESP32 devices running the Bunkercolab firmware.

### Directory Structure

```
Raspberrytest_program/
├── SETUP_INSTRUCTIONS.md          ← You are here (start here!)
├── README.md                       ← Quick start guide
├── wpa_supplicant.conf.template   ← WiFi configuration template
├── DEPLOYMENT_SUMMARY.md          ← Detailed deployment guide
├── CURRENT_OUTPUT.md              ← What's being tracked and limitations
├── MONITORING_QUERIES.md          ← SQL query examples
├── RELAY_CYCLING_TRACKING.md      ← Relay duration tracking documentation
└── pi-monitor/                    ← Scripts to copy to Raspberry Pi
    ├── pi_monitor.py              ← Main monitoring daemon
    ├── dashboard.sh               ← Comprehensive dashboard
    ├── relay_analytics.sh         ← Relay cycling analytics
    ├── pi-monitor.service         ← Systemd service file
    ├── pi_monitor_config.yaml     ← Configuration template
    ├── requirements.txt           ← Python dependencies
    ├── firstboot.sh               ← First-time setup script
    ├── logrotate.conf             ← Log rotation config
    ├── README.md                  ← Pi-monitor specific docs
    └── SETUP_GUIDE.md             ← Detailed Pi setup steps
```

---

## 🚀 Quick Start (5 Steps)

### 1. **Prepare SD Card**
   - Flash Raspberry Pi OS Lite (64-bit) to SD card
   - Edit `wpa_supplicant.conf.template` with your WiFi credentials
   - Save as `wpa_supplicant.conf` (remove .template)
   - Copy to SD card `/boot/` directory
   - Enable SSH: create empty file named `ssh` in `/boot/`

### 2. **Boot Raspberry Pi**
   - Insert SD card and power on
   - Wait 2 minutes for first boot
   - Find Pi IP address (check router or use `sudo nmap -sn 192.168.1.0/24`)

### 3. **SSH and Initial Setup**
   ```bash
   # Default credentials: pi / raspberry
   ssh pi@<raspberry-pi-ip>

   # Change default password
   passwd

   # Update system
   sudo apt-get update && sudo apt-get upgrade -y
   ```

### 4. **Copy Files to Pi**
   ```bash
   # From your Mac, in this directory
   scp -r pi-monitor pi@<raspberry-pi-ip>:/tmp/

   # SSH into Pi
   ssh pi@<raspberry-pi-ip>

   # Run setup script
   cd /tmp/pi-monitor
   chmod +x firstboot.sh
   sudo ./firstboot.sh
   ```

### 5. **Connect ESP32 and Verify**
   ```bash
   # Connect ESP32 via USB

   # Check monitoring service
   sudo systemctl status pi-monitor

   # View dashboard
   /opt/bunker-monitor/dashboard.sh
   ```

---

## 📚 Documentation Guide

### For First-Time Setup
1. **Start here:** `README.md` (quick overview)
2. **Detailed steps:** `pi-monitor/SETUP_GUIDE.md` (complete walkthrough)
3. **WiFi setup:** `wpa_supplicant.conf.template` (edit with your network)

### For Understanding the System
1. **What's tracked:** `CURRENT_OUTPUT.md` (current capabilities and limitations)
2. **Deployment details:** `DEPLOYMENT_SUMMARY.md` (technical deployment info)
3. **Relay tracking:** `RELAY_CYCLING_TRACKING.md` (fan cycling and energy savings)

### For Daily Monitoring
1. **Dashboard:** SSH into Pi and run `/opt/bunker-monitor/dashboard.sh`
2. **Relay analytics:** `/opt/bunker-monitor/relay_analytics.sh`
3. **Query examples:** `MONITORING_QUERIES.md` (custom SQL queries)

---

## 🎯 What This System Monitors

### Hardware Monitoring
- ✅ Serial log parsing (ESP-IDF log format)
- ✅ GPIO state monitoring (relay on pin 17, LED on pin 27)
- ✅ Pi system health (CPU temp, memory, WiFi signal, disk space)

### ESP32 Telemetry
- ✅ Free heap memory (memory leak detection)
- ✅ Reboot detection (via boot messages)
- ✅ Network failures (HTTP/TLS errors)
- ✅ Component activity (by ESP-IDF tag)

### Relay Operations
- ✅ State change tracking (ON/OFF transitions)
- ✅ Duration measurement (how long each state lasted)
- ✅ 5-minute bucket grouping (cycling pattern analysis)
- ✅ Energy savings calculation (fan OFF time × 1.5kW × $0.12/kWh)

### Long-Term Metrics
- ✅ Total uptime percentage
- ✅ Reboot count and reasons
- ✅ Memory stability trends
- ✅ Network reliability
- ✅ Fail-safe activation tracking

---

## 🔧 Hardware Requirements

### Raspberry Pi
- **Model:** Raspberry Pi 3B+ or newer
- **RAM:** 512MB minimum (1GB+ recommended)
- **SD Card:** 8GB minimum (32GB+ recommended for long-term logging)
- **Power:** 5V 2.5A power supply
- **Network:** WiFi or Ethernet

### ESP32
- **Board:** ESP32-DevKitC or compatible
- **Firmware:** Bunkercolab firmware (from main project)
- **Connection:** USB cable (ESP32 to Pi)
- **GPIO:** Relay on pin 17, LED on pin 27 (for hardware verification)

---

## 📊 Database Schema

The monitoring system creates a SQLite database at `/var/log/bunker/bunker_monitor.db` with 8 tables:

1. **serial_logs** - All ESP32 serial output
2. **gpio_events** - Hardware state changes
3. **system_metrics** - Pi health data
4. **heartbeats** - Service connectivity tracking
5. **esp32_telemetry** - Heap, WiFi, uptime
6. **esp32_reboots** - Reboot events
7. **network_failures** - HTTP/TLS errors
8. **relay_operations** - Fan state changes with durations

See `MONITORING_QUERIES.md` for SQL query examples.

---

## 🚨 Troubleshooting

### ESP32 Not Detected
```bash
# Check USB devices
ls -la /dev/serial/by-id/

# Should see something like:
# usb-Silicon_Labs_CP2102N_USB_to_UART_Bridge_Controller_*

# If not detected:
sudo apt-get install -y usbutils
lsusb
```

### GPIO Errors
```bash
# Install missing GPIO library
sudo apt-get install -y swig liblgpio-dev
source /opt/bunker-monitor/.venv/bin/activate
pip install lgpio

# Restart service
sudo systemctl restart pi-monitor
```

### Service Not Starting
```bash
# Check logs
sudo journalctl -u pi-monitor -n 50

# Common issues:
# - Missing Python dependencies
# - Wrong USB device pattern in config
# - Permissions issue
```

### No Data Being Collected
```bash
# Check database exists
ls -lh /var/log/bunker/bunker_monitor.db

# Check record count
sqlite3 /var/log/bunker/bunker_monitor.db "SELECT COUNT(*) FROM serial_logs;"

# View live logs
sudo journalctl -u pi-monitor -f
```

---

## 📈 Success Metrics (After 30 Days)

### Excellent Performance
- Energy Savings: 30-50% (fans OFF 30-50% of time)
- Average Cycle Duration: 30-90 minutes
- Cycling Frequency: 10-20 changes/day
- Fail-Safe Activations: <5% of changes
- Uptime: >95%
- Reboots: <3 total
- Memory: Stable (no leaks)

### Good Performance
- Energy Savings: 20-30%
- Average Cycle Duration: 15-60 minutes
- Cycling Frequency: 20-30 changes/day
- Fail-Safe Activations: <10% of changes

### Needs Investigation
- Energy Savings: <20%
- Average Cycle Duration: <10 minutes
- Cycling Frequency: >40 changes/day
- Fail-Safe Activations: >20% of changes

---

## 🔐 Security Notes

### Default Credentials
- **Raspberry Pi:** User `pi`, password `raspberry` (change immediately!)
- **SSH:** Enabled by default for setup (consider disabling after setup)

### Recommendations
1. Change default Pi password immediately
2. Use SSH keys instead of password authentication
3. Keep Pi on isolated network or behind firewall
4. Regular `apt-get update && apt-get upgrade`

---

## 📞 Support

### Documentation Files
- `CURRENT_OUTPUT.md` - Current capabilities and limitations
- `DEPLOYMENT_SUMMARY.md` - Technical deployment details
- `MONITORING_QUERIES.md` - Database query examples
- `RELAY_CYCLING_TRACKING.md` - Relay tracking documentation
- `pi-monitor/SETUP_GUIDE.md` - Detailed setup walkthrough

### Useful Commands

**Check service status:**
```bash
sudo systemctl status pi-monitor
```

**View dashboard:**
```bash
/opt/bunker-monitor/dashboard.sh
```

**View relay analytics:**
```bash
/opt/bunker-monitor/relay_analytics.sh
```

**Check live logs:**
```bash
sudo journalctl -u pi-monitor -f
```

**Export data to CSV:**
```bash
sqlite3 -header -csv /var/log/bunker/bunker_monitor.db \
  "SELECT * FROM relay_operations;" > relay_data.csv
```

---

## ✅ Pre-Deployment Checklist

- [ ] SD card flashed with Raspberry Pi OS Lite
- [ ] WiFi credentials configured in `wpa_supplicant.conf`
- [ ] SSH enabled (empty `ssh` file in `/boot/`)
- [ ] Pi powered on and connected to network
- [ ] Default password changed
- [ ] System updated (`apt-get update && upgrade`)
- [ ] Files copied to Pi (`scp -r pi-monitor ...`)
- [ ] Setup script executed (`sudo ./firstboot.sh`)
- [ ] ESP32 connected via USB
- [ ] Service running (`systemctl status pi-monitor`)
- [ ] Database collecting data (check dashboard)

---

**Ready to begin 30-day testing!** 🎉

For questions or issues, refer to the documentation files included in this package.
