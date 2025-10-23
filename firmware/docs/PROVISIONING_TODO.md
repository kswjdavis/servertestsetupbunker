# WiFi Provisioning Component - Implementation Plan

## Status

🔄 **DEFERRED** - Core Epic 1 functionality complete, provisioning to be implemented in next iteration

## Overview

The WiFi Provisioning component enables user-friendly device configuration via:
1. Access Point (AP) mode
2. Captive portal with web interface
3. WiFi network scanning and selection
4. Secure credential storage

## Functional Requirements

From Epic 1 (FR11):
- ESP32 supports WiFi configuration via provisioning wizard (AP mode with captive portal)

## Current Status

### ✅ Implemented

- NVS storage for WiFi credentials (encrypted)
- Manual configuration via NVS API
- WiFi connection management
- Backend provisioning API client

### ⏳ Pending Implementation

1. **AP Mode Setup**
   - Start ESP32 in Access Point mode
   - SSID: `BUNKER_FAN_{MAC_ADDRESS}`
   - Security: WPA2 with configurable password or open (first-time only)

2. **Captive Portal**
   - DNS hijacking to redirect all HTTP requests
   - Lightweight web server for configuration interface
   - Mobile-friendly HTML/CSS/JS interface

3. **WiFi Scanning**
   - Scan and display available networks
   - Show SSID, signal strength, and security type
   - Filter out weak signals (RSSI < -80 dBm)

4. **Configuration Flow**
   ```
   User connects to BUNKER_FAN_XXX AP
   ↓
   Browser auto-opens captive portal
   ↓
   User selects WiFi network from scan results
   ↓
   User enters WiFi password
   ↓
   User enters/confirms device ID
   ↓
   Device stores credentials in NVS
   ↓
   Device attempts connection to cloud
   ↓
   Device provisions with backend (gets auth token)
   ↓
   Device switches to station mode
   ↓
   LED indicates success/failure
   ```

5. **Timeout & Recovery**
   - Exit AP mode after 15 minutes if not configured
   - Hardware button press (GPIO0) re-enters provisioning
   - Factory reset via long button press (10 seconds)

## Technical Design

### Component Structure

```
components/provisioning/
├── CMakeLists.txt
├── include/
│   └── provisioning.h
├── src/
│   ├── provisioning.c
│   ├── captive_portal.c
│   ├── web_server.c
│   └── html_pages.c
└── test/
    └── test_provisioning.c
```

### API Design

```c
// provisioning.h

typedef enum {
    PROV_STATE_IDLE,
    PROV_STATE_AP_STARTED,
    PROV_STATE_WAITING_CONFIG,
    PROV_STATE_CONNECTING,
    PROV_STATE_SUCCESS,
    PROV_STATE_FAILED,
    PROV_STATE_TIMEOUT
} provisioning_state_t;

typedef struct {
    char ssid[32];
    char password[64];
    char device_id[64];
} provisioning_config_t;

typedef void (*provisioning_callback_t)(provisioning_state_t state, void *ctx);

// Initialize provisioning component
esp_err_t provisioning_init(void);

// Start provisioning mode (AP mode)
esp_err_t provisioning_start(provisioning_callback_t callback, void *ctx);

// Stop provisioning and return to normal operation
esp_err_t provisioning_stop(void);

// Get current provisioning state
provisioning_state_t provisioning_get_state(void);

// Check if device has been provisioned
bool provisioning_is_complete(void);
```

### Security Considerations

1. **WPA2 Protected AP** (after first setup)
   - Generate random password on first boot
   - Display password on serial console
   - Store AP password in NVS

2. **HTTPS for Web Interface** (optional)
   - Self-signed certificate for captive portal
   - Warn user about certificate if HTTPS used

3. **Input Validation**
   - Validate SSID length (1-32 chars)
   - Validate password length (8-64 chars for WPA2)
   - Sanitize all user input (prevent injection)

4. **Credential Protection**
   - Never transmit credentials in plain HTTP
   - Use POST (not GET) for sensitive data
   - Clear credentials from memory after storage

### Web Interface Design

#### Landing Page (index.html)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bunkercolab Device Setup</title>
    <style>
        /* Mobile-first responsive CSS */
        body { font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
        .network { border: 1px solid #ccc; padding: 10px; margin: 10px 0; cursor: pointer; }
        .network:hover { background: #f0f0f0; }
        button { width: 100%; padding: 12px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>🌾 Bunkercolab Setup</h1>
    <p>Select your WiFi network:</p>
    <div id="networks">
        <!-- Populated via JavaScript -->
    </div>
    <div id="config-form" style="display:none;">
        <h2>Configure WiFi</h2>
        <form id="wifi-form">
            <label>SSID: <span id="selected-ssid"></span></label><br>
            <label>Password: <input type="password" id="password" required></label><br>
            <label>Device ID: <input type="text" id="device-id" value="BUNKER_FAN_001"></label><br>
            <button type="submit">Connect</button>
        </form>
    </div>
    <div id="status"></div>
    <script src="/app.js"></script>
</body>
</html>
```

#### JavaScript (app.js)

```javascript
// Scan and display networks
async function loadNetworks() {
    const resp = await fetch('/api/scan');
    const networks = await resp.json();
    const div = document.getElementById('networks');
    div.innerHTML = networks.map(n =>
        `<div class="network" onclick="selectNetwork('${n.ssid}')">
            <strong>${n.ssid}</strong> (${n.rssi} dBm) ${n.auth}
        </div>`
    ).join('');
}

function selectNetwork(ssid) {
    document.getElementById('selected-ssid').textContent = ssid;
    document.getElementById('config-form').style.display = 'block';
}

document.getElementById('wifi-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        ssid: document.getElementById('selected-ssid').textContent,
        password: document.getElementById('password').value,
        device_id: document.getElementById('device-id').value
    };

    const resp = await fetch('/api/configure', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });

    if (resp.ok) {
        document.getElementById('status').innerHTML =
            '<p style="color:green">✓ Configuration saved! Connecting...</p>';
    } else {
        document.getElementById('status').innerHTML =
            '<p style="color:red">✗ Configuration failed. Try again.</p>';
    }
};

loadNetworks();
```

### REST API Endpoints (Captive Portal)

```
GET  /                    - Serve landing page
GET  /app.js              - Serve JavaScript
GET  /api/scan            - Scan WiFi networks, return JSON
POST /api/configure       - Accept WiFi config, store in NVS
GET  /api/status          - Get connection status
```

## Implementation Tasks

### Phase 1: Basic AP Mode (2-3 days)

- [ ] Create provisioning component structure
- [ ] Implement AP mode initialization
- [ ] Generate unique AP SSID with MAC address
- [ ] Test AP mode with mobile device connection

### Phase 2: Web Server & Captive Portal (3-4 days)

- [ ] Integrate ESP-IDF HTTP server
- [ ] Implement DNS hijacking for captive portal
- [ ] Serve static HTML/CSS/JS files
- [ ] Test captive portal auto-open on iOS/Android

### Phase 3: WiFi Scanning & Configuration (2-3 days)

- [ ] Implement WiFi scan API endpoint
- [ ] Implement configuration POST endpoint
- [ ] Validate and store credentials in NVS
- [ ] Test end-to-end configuration flow

### Phase 4: Backend Integration (2 days)

- [ ] Integrate with backend provisioning API
- [ ] Request and store auth token
- [ ] Handle provisioning errors gracefully
- [ ] Test with actual backend server

### Phase 5: UX & Polish (2 days)

- [ ] Add LED status indicators
- [ ] Implement timeout and auto-exit
- [ ] Add factory reset via button
- [ ] Create user documentation

### Phase 6: Testing (2-3 days)

- [ ] Unit tests for provisioning state machine
- [ ] Integration tests with real WiFi networks
- [ ] Security testing (input validation, credential protection)
- [ ] User acceptance testing with non-technical users

**Total Estimated Time:** 13-17 days

## Alternative Approaches

### Option 1: ESP-IDF Built-in Provisioning (Recommended)

Use `wifi_provisioning` component from ESP-IDF:
- Supports BLE and SoftAP transports
- Built-in security (X25519 key exchange + AES-CTR)
- Requires companion mobile app (iOS/Android)
- **Pros:** Secure, well-tested, less code to maintain
- **Cons:** Requires mobile app development

Reference: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html

### Option 2: Third-Party Captive Portal Component

Use existing component from ESP Component Registry:
- Example: `achimpieters/esp32-captive_portal`
- **Pros:** Faster implementation, community-tested
- **Cons:** May need customization, security review required

### Option 3: Custom Captive Portal (Current Plan)

Build custom web-based captive portal:
- **Pros:** Full control, no external dependencies, works in browser
- **Cons:** More code to maintain, security review critical

## Testing Requirements

### Unit Tests

- [ ] Test AP mode initialization
- [ ] Test SSID generation with MAC address
- [ ] Test configuration validation
- [ ] Test NVS storage/retrieval
- [ ] Test state machine transitions

### Integration Tests

- [ ] Test captive portal auto-open (iOS/Android)
- [ ] Test WiFi scan and display
- [ ] Test configuration submission
- [ ] Test backend provisioning API call
- [ ] Test timeout and error recovery

### Security Tests

- [ ] Test input validation (SQL injection, XSS)
- [ ] Test credential encryption in NVS
- [ ] Test HTTPS for sensitive endpoints (if used)
- [ ] Test factory reset clears credentials

### User Acceptance Tests

- [ ] Non-technical user can complete setup
- [ ] Setup completes in <5 minutes
- [ ] Clear error messages for failures
- [ ] LED indicators are intuitive

## Dependencies

- ESP-IDF HTTP Server component
- DNS server for captive portal redirection
- WiFi provisioning manager (optional)
- Backend provisioning API endpoint

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Captive portal doesn't auto-open | Medium | Provide IP address on LED/serial, test on multiple devices |
| DNS hijacking fails on some devices | Medium | Implement mDNS fallback (setup.local) |
| Users forget AP password | Low | Print password on serial console, support factory reset |
| Configuration timeout confuses users | Low | Clear visual feedback (LED patterns, web page updates) |

## References

- ESP-IDF WiFi Provisioning: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html
- ESP-IDF HTTP Server: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_server.html
- Captive Portal Best Practices: https://en.wikipedia.org/wiki/Captive_portal

---

**Status:** Planning complete, ready for implementation
**Priority:** Medium (core functionality works without provisioning, but UX suffers)
**Estimated Effort:** 2-3 weeks for full implementation and testing

**Generated with Claude Code**
