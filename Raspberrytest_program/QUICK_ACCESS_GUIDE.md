# Raspberry Pi Monitor - Quick Access

**Pi IP:** `192.168.1.187`
**User:** `bunker`
**Password:** (ask Jeff)

---

## Access Commands

### 1. SSH Into Pi
```bash
ssh bunker@192.168.1.187
```

### 2. View Main Dashboard
```bash
/opt/bunker-monitor/dashboard.sh
```

### 3. View Relay Analytics
```bash
/opt/bunker-monitor/relay_analytics.sh
```

### 4. Check Service Status
```bash
sudo systemctl status pi-monitor
```

### 5. View Live Logs
```bash
sudo journalctl -u pi-monitor -f
```
(Press Ctrl+C to exit)

---

## Database Location

Database file: `/var/log/bunker/bunker_monitor.db`

---

**For detailed documentation, see other files in this directory.**
