# Raspberry Pi ESP32 Monitor - Package Index

**Version:** 1.0
**Date:** October 29, 2025
**Purpose:** Complete setup package for ESP32 long-term monitoring

---

## 🚀 START HERE

👉 **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** - Complete setup guide (start here!)

---

## 📁 File Descriptions

### Setup & Configuration Files

| File | Purpose | When to Use |
|------|---------|-------------|
| **SETUP_INSTRUCTIONS.md** | Master setup guide with 5-step quick start | Start here for new setup |
| **README.md** | Quick reference and overview | Quick lookup |
| **wpa_supplicant.conf.template** | WiFi credentials template | Edit before flashing SD card |

### Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| **DEPLOYMENT_SUMMARY.md** | Technical deployment details | Understanding the architecture |
| **CURRENT_OUTPUT.md** | What's tracked, limitations, current status | Understanding capabilities |
| **MONITORING_QUERIES.md** | SQL query examples for data analysis | Querying the database |
| **RELAY_CYCLING_TRACKING.md** | Relay duration and cycling documentation | Understanding relay analytics |

### Scripts Directory (pi-monitor/)

| File | Purpose | Location on Pi |
|------|---------|----------------|
| **pi_monitor.py** | Main monitoring daemon (Python) | `/opt/bunker-monitor/pi_monitor.py` |
| **dashboard.sh** | Comprehensive monitoring dashboard | `/opt/bunker-monitor/dashboard.sh` |
| **relay_analytics.sh** | Relay cycling and duration analytics | `/opt/bunker-monitor/relay_analytics.sh` |
| **pi-monitor.service** | Systemd service unit file | `/etc/systemd/system/pi-monitor.service` |
| **pi_monitor_config.yaml** | Configuration template | `/etc/bunker-monitor.yaml` |
| **requirements.txt** | Python dependencies | `/opt/bunker-monitor/requirements.txt` |
| **firstboot.sh** | Automated setup script | Run once during setup |
| **logrotate.conf** | Log rotation configuration | `/etc/logrotate.d/pi-monitor` |
| **README.md** | Pi-monitor specific documentation | Reference |
| **SETUP_GUIDE.md** | Detailed step-by-step Pi setup | Follow during setup |

---

## 🎯 Usage Workflows

### First-Time Setup
1. Read **SETUP_INSTRUCTIONS.md** (master guide)
2. Edit **wpa_supplicant.conf.template** (WiFi setup)
3. Follow **pi-monitor/SETUP_GUIDE.md** (detailed steps)
4. Verify with **dashboard.sh**

### Daily Monitoring
1. SSH to Pi: `ssh bunker@<pi-ip>`
2. Run: `/opt/bunker-monitor/dashboard.sh`
3. Check: `/opt/bunker-monitor/relay_analytics.sh`

### Data Analysis
1. Reference: **MONITORING_QUERIES.md** (query examples)
2. Reference: **RELAY_CYCLING_TRACKING.md** (cycling metrics)
3. Export data to CSV for external analysis

### Troubleshooting
1. Check: **CURRENT_OUTPUT.md** (known limitations)
2. Check: **SETUP_INSTRUCTIONS.md** (troubleshooting section)
3. Review: `sudo journalctl -u pi-monitor -n 50`

---

## 📊 What Gets Monitored

### Hardware
- ESP32 serial output (115200 baud)
- GPIO pins (relay + LED)
- Pi system health (temp, memory, WiFi)

### Software
- Heap memory (leak detection)
- Reboots (stability tracking)
- Network failures (connectivity)
- Relay operations (cycling + duration)

### Long-Term Metrics
- Uptime percentage
- Memory stability
- Energy savings
- Failure patterns

---

## 🔧 Quick Commands Reference

```bash
# View dashboard
/opt/bunker-monitor/dashboard.sh

# View relay analytics
/opt/bunker-monitor/relay_analytics.sh

# Check service status
sudo systemctl status pi-monitor

# View live logs
sudo journalctl -u pi-monitor -f

# Export relay data
sqlite3 -header -csv /var/log/bunker/bunker_monitor.db \
  "SELECT * FROM relay_operations;" > relay_data.csv
```

---

## 📦 Package Completeness

This package includes:
- ✅ All setup scripts and configuration files
- ✅ Python monitoring daemon
- ✅ Dashboard and analytics scripts
- ✅ Complete documentation
- ✅ Troubleshooting guides
- ✅ Query examples
- ✅ Success criteria

**Everything needed for a complete ESP32 monitoring station.**

---

## 🎓 Learning Path

### Beginner
1. **SETUP_INSTRUCTIONS.md** - Get started
2. **README.md** - Quick reference
3. **dashboard.sh** - See what's being tracked

### Intermediate
1. **CURRENT_OUTPUT.md** - Understand capabilities
2. **MONITORING_QUERIES.md** - Custom queries
3. **RELAY_CYCLING_TRACKING.md** - Relay analytics

### Advanced
1. **DEPLOYMENT_SUMMARY.md** - Technical details
2. **pi_monitor.py** - Source code
3. Custom SQL queries for specific analysis

---

**Version History:**
- v1.0 (Oct 29, 2025) - Initial release with complete monitoring suite
