# Hardware E2E Testing Infrastructure

Comprehensive end-to-end testing framework that validates the complete BunkerColab system: ESP32 firmware, Raspberry Pi monitoring, backend API, and React UI.

## Overview

This testing infrastructure orchestrates:
- **Puppeteer**: UI automation and validation
- **Raspberry Pi**: ESP32 hardware monitoring (serial, GPIO, relay states)
- **Docker**: Backend server logs and health monitoring
- **PostgreSQL**: Database validation and query verification

## Prerequisites

### Hardware Setup
1. **Raspberry Pi 3B+** with Raspbian Lite
   - Pi monitor service installed (`scripts/pi-monitor/`)
   - SSH access configured
   - GPIO pins connected to ESP32:
     - GPIO 4 (ESP32) → BCM 17 (Pi) - Relay state
     - GPIO 5 (ESP32) → BCM 27 (Pi) - LED state
     - USB connection for serial communication

2. **ESP32-DevKitC** with production firmware
   - WiFi credentials provisioned
   - Device registered and authenticated with backend
   - Relay and LED wired to output pins

### Software Requirements
- Node.js 18+ (for Puppeteer tests)
- Docker + Docker Compose (for backend)
- `jq` command-line JSON processor
- SSH client with key-based authentication to Pi

## Installation

### 1. Install Dependencies
```bash
cd pitest
npm install
```

### 2. Configure Test Settings
Edit `config/hardware-test-config.json`:

```json
{
  "raspberryPi": {
    "host": "bunker-pi.local",  // Update to your Pi hostname/IP
    "user": "bunker",
    "sshKeyPath": "~/.ssh/id_rsa"
  },
  "esp32": {
    "macAddress": "XX:XX:XX:XX:XX:XX"  // Update to your ESP32 MAC
  },
  "testCredentials": {
    "username": "e2e_test_user",
    "password": "TestPass123!"
  }
}
```

### 3. Test SSH Connection to Pi
```bash
ssh bunker@bunker-pi.local
# Should connect without password prompt
```

### 4. Verify Pi Monitor Service
```bash
ssh bunker@bunker-pi.local 'systemctl status pi-monitor'
# Should show: active (running)
```

## Usage

### Run Complete Hardware E2E Test Suite
```bash
cd pitest
npm run test:hardware
```

This will execute:
- Test Suite A: Device Lifecycle (~30 min)
- Test Suite B: Weather-Based Control (~20 min)
- Test Suite C: Emergency Controls (~15 min)
- Test Suite D: Fail-Safe Scenarios (manual steps)

### Run Individual Test Suites
The main orchestrator runs all suites, but you can modify `e2e-hardware-comprehensive.js` to comment out specific suites during development.

### Query Pi Database Directly
```bash
./pi-queries.sh get_relay_events 10 30  # Last 10 relay events in last 30 min
./pi-queries.sh get_serial_logs "Dead-man" 20  # Last 20 logs matching pattern
./pi-queries.sh get_telemetry 5  # Last 5 telemetry records
./pi-queries.sh get_system_status  # Full system status summary
```

### Collect Backend Logs
```bash
./collect-server-logs.sh get_logs_since 30m  # Last 30 minutes
./collect-server-logs.sh analyze_logs 1h  # Analyze patterns
./collect-server-logs.sh collect_test_run_logs "my-test" 30m  # Save to evidence dir
```

## Test Suites

### Suite A: Complete Device Lifecycle
**Duration:** ~30 minutes
**Validates:**
- Backend health and API availability
- Device provisioning workflow via UI
- 10 consecutive status report cycles
- Real-time UI updates reflecting hardware state

**Manual Steps:** None - fully automated

### Suite B: Weather-Based Control Logic
**Duration:** ~20 minutes
**Validates:**
- Weather API integration
- Wind threshold adjustment via UI
- Relay response to control decision changes
- Backend decision logging

**Manual Steps:** None - fully automated

### Suite C: Emergency Controls E2E
**Duration:** ~15 minutes
**Validates:**
- Emergency ON trigger via UI
- Response time measurement (UI click → GPIO change)
- Relay state persistence
- Backend emergency flag propagation

**Key Metrics:**
- Target response time: <60 seconds
- Measured: UI click timestamp to Pi GPIO event timestamp

**Manual Steps:** None - fully automated

### Suite D: Fail-Safe Scenarios
**Duration:** Variable (requires manual intervention)
**Validates:**
- WiFi disconnect → Dead-man timer → Relay forced ON
- Backend shutdown → Status report failure → Fail-safe activation
- Database failure → Graceful degradation

**Manual Steps:** **YES** - Requires controlled failure injection

**Note:** These tests are documented in `firmware/docs/HARDWARE_TEST_PROCEDURES.md` and should be run separately with careful monitoring.

## Test Evidence

All test runs generate evidence in `test-evidence/` directory:

### Automatically Collected
- **Screenshots**: All UI states during test execution
- **Backend Logs**: Filtered service logs with error analysis
- **Pi Database Snapshot**: Complete SQLite DB export
- **Test Report**: Markdown report with all results and metrics

### Evidence File Naming
```
test-evidence/
├── A2-devices-page.png
├── C1-emergency-before.png
├── final_comprehensive_backend_20250429_143022.log
├── final_comprehensive_errors_20250429_143022.log
├── pi-monitor-20250429_143500.db
└── E2E-Hardware-Test-Report-2025-04-29T14-35-00-000Z.md
```

## Helper Scripts

### Pi Query Helper (`pi-queries.sh`)
Provides functions to query Pi monitoring database via SSH.

**Key Functions:**
- `get_relay_events [limit] [since_minutes]` - Relay state changes
- `get_serial_logs <pattern> [limit] [since_minutes]` - ESP32 serial output
- `get_telemetry [limit]` - ESP32 health metrics
- `get_watchdog_resets [since_minutes]` - Watchdog reset events
- `get_gpio_events [pin] [limit] [since_minutes]` - GPIO state changes
- `wait_for_gpio_change <pin> <state> [timeout]` - Poll for state change
- `get_system_status` - Comprehensive status summary

**Example:**
```bash
# Wait for relay pin to go HIGH (timeout 65s)
./pi-queries.sh wait_for_gpio_change 17 1 65

# Get last 5 serial logs containing "Server decision"
./pi-queries.sh get_serial_logs "Server decision" 5 10
```

### Docker Log Collector (`collect-server-logs.sh`)
Captures and analyzes backend service logs.

**Key Functions:**
- `get_logs_since [since] [output_file]` - Logs since time
- `filter_device_logs <mac> [input]` - Device-specific logs
- `filter_endpoint_logs <endpoint> [input]` - API endpoint logs
- `get_error_logs [since]` - Error logs only
- `collect_test_run_logs <test_name> [since]` - Full test evidence
- `analyze_logs [since]` - Pattern analysis and summary

**Example:**
```bash
# Collect all logs for a test run
./collect-server-logs.sh collect_test_run_logs "emergency-test" 15m

# Analyze patterns in last hour
./collect-server-logs.sh analyze_logs 1h

# Monitor logs in real-time for device
./collect-server-logs.sh monitor_logs "AA:BB:CC:DD:EE:FF"
```

## Configuration

### Test Settings (`config/hardware-test-config.json`)

```json
{
  "testSettings": {
    "statusReportInterval": 60,        // Expected interval between reports
    "deadmanTimerDuration": 300,       // Fail-safe timer duration (5 min)
    "relayResponseTimeout": 60,        // Max time for relay response
    "maxWaitForGpioEvent": 65,         // GPIO event polling timeout
    "evidenceDir": "./test-evidence",  // Evidence collection directory
    "screenshotDir": "./screenshots"   // Screenshot directory
  }
}
```

Modify these values if your system has different timing requirements.

## Troubleshooting

### SSH Connection Fails
```bash
# Test SSH connection manually
ssh bunker@bunker-pi.local

# If fails, check:
# 1. Pi is powered on and network accessible
# 2. SSH keys are properly configured
# 3. Hostname resolution working (try IP address instead)
```

### Pi Database Not Accessible
```bash
# Verify pi-monitor service is running
ssh bunker@bunker-pi.local 'systemctl status pi-monitor'

# Check database file exists
ssh bunker@bunker-pi.local 'ls -lh /var/log/bunker/bunker_monitor.db'

# Test direct query
ssh bunker@bunker-pi.local 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT COUNT(*) FROM serial_logs;"'
```

### Backend Service Unreachable
```bash
# Check Docker services
docker ps | grep bunkercolab

# Check backend health
curl http://206.189.210.203/healthz

# View backend logs
docker logs bunkercolab-backend-1 --tail 50
```

### Test Timeouts
If tests timeout waiting for GPIO events:
1. Check ESP32 is powered and connected to WiFi
2. Verify device is authenticated with backend
3. Check relay wiring between ESP32 and Pi
4. Review Pi serial logs for errors: `./pi-queries.sh get_serial_logs "error" 20`

### No Relay Events Detected
```bash
# Check GPIO monitoring is working
./pi-queries.sh get_gpio_events 17 20 5

# If empty, verify:
# 1. GPIO wiring: ESP32 GPIO4 → Pi BCM17
# 2. Pi monitor service: systemctl status pi-monitor
# 3. GPIO pins enabled in pi_monitor_config.yaml
```

## Performance Benchmarks

**Expected Metrics (from successful test runs):**
- Emergency ON response time: 35-55 seconds
- Status report interval: 60 seconds ±2 seconds
- Relay state change propagation: <5 seconds
- UI real-time update latency: 3-5 seconds

**System Stability:**
- Watchdog resets during testing: 0
- Network failure rate: <2%
- Memory heap variation: ±5%

## Test Report

After each run, a comprehensive test report is generated:
```
docs/qa/E2E-Hardware-Test-Report-[timestamp].md
```

The report includes:
- Test suite results with pass/fail status
- Performance metrics and response times
- Evidence file links (screenshots, logs, database)
- Quality gate assessment
- Recommendations for production deployment

## Integration with CI/CD

For automated testing in CI/CD:

1. **Headless Mode**: Set `headless: true` in Puppeteer launch options
2. **SSH Keys**: Configure CI runner with SSH keys to Pi
3. **Hardware Availability**: Ensure dedicated Pi + ESP32 hardware for CI
4. **Timeout Extension**: Some tests take 10+ minutes, adjust CI timeout limits
5. **Artifact Collection**: Upload test-evidence/ directory as CI artifacts

## Related Documentation

- **Hardware Test Procedures**: `firmware/docs/HARDWARE_TEST_PROCEDURES.md`
- **Pi Monitor Setup**: `scripts/pi-monitor/README.md`
- **Story 5.9 Acceptance**: `docs/stories/5.9.final-poc-acceptance-testing.md`
- **Deployment Guide**: `docs/deployment-guide.md`
- **OTA Update Procedure**: `docs/ota-update-procedure.md`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Pi serial logs for hardware errors
3. Check Docker backend logs for API errors
4. Consult related documentation
5. Create bug report in `docs/bugs/BUG-XXX.md`

---

**Last Updated:** 2025-10-29
**Maintained By:** Development Team
