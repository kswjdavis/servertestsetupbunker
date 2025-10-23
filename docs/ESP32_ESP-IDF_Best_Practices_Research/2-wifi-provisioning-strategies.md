# 2. WiFi Provisioning Strategies

## Recommended Approach for Industrial IoT

**ESP-IDF WiFi Provisioning Manager** (Official API)
- Supports both SoftAP and BLE transport
- Built-in security with X25519 key exchange and AES-CTR encryption
- Proof of Possession (PoP) authentication

## Implementation Options

### Option 1: Official WiFi Provisioning with Security 1 (RECOMMENDED)

```c
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

// Initialize provisioning with Security 1
wifi_prov_mgr_config_t config = {
    .scheme = wifi_prov_scheme_softap,
    .scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE
};

wifi_prov_mgr_init(config);

// Security 1: X25519 key exchange + AES-CTR encryption
wifi_prov_security_t security = WIFI_PROV_SECURITY_1;
const char *pop = "abcd1234"; // Proof of Possession
const char *service_name = "BUNKER_FAN_";
```

**Security Levels:**
- **Security 1:** X25519 key exchange + authentication + AES-CTR encryption (REQUIRED for production)
- **Security 0:** Plain text (NEVER use in production)

### Option 2: Captive Portal with Custom Web Interface

Third-party components available for complete captive portal solutions:
- DNS hijacking for automatic redirection
- WiFi network scanning
- Web-based credential entry
- mDNS support (.local domains)

**Component Example:**
```
achimpieters/esp32-captive_portal (ESP Component Registry)
```

## Secure Credential Storage

After provisioning, WiFi credentials are stored in NVS:
- Default partition: "nvs"
- Enable NVS encryption when Flash Encryption is enabled
- WiFi driver automatically stores SSID and passphrase

## Best Practices

1. **Always use Security 1** for WiFi provisioning in production
2. **Implement timeout logic** - exit provisioning mode after X minutes
3. **Provide fallback mechanism** - hardware reset button to re-enter provisioning
4. **Store provisioning state** - track whether device has been provisioned
5. **Support re-provisioning** - allow credentials to be updated
6. **Visual feedback** - use LED patterns to indicate provisioning mode

## Official Documentation
- WiFi Provisioning: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html

---
