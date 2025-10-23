# 6. WiFi Provisioning Manager

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html
- **Header File:** `wifi_provisioning/manager.h`

## Purpose
Provides APIs for provisioning WiFi credentials to ESP32 devices via SoftAP or BLE transport.

## Key Features
- SoftAP (Access Point) transport
- BLE GATT server transport
- Security modes: Security 0 (plaintext), Security 1 (X25519 + AES-CTR), Security 2 (SRP6a + AES-GCM)
- Unified provisioning manager API
- Event-driven workflow
- Custom endpoint support

## Important Note: Captive Portal

**The official WiFi provisioning manager does NOT include built-in captive portal functionality.** For captive portal support, you will need:

1. Use community components from ESP Component Registry:
   - `achimpieters/esp32-captive_portal` (v1.0.4)

2. Implement custom DNS/HTTP server on top of SoftAP provisioning

3. Use AT command framework (for AT-based applications)

## Core API Functions

```c
// Initialization
esp_err_t wifi_prov_mgr_init(wifi_prov_mgr_config_t config);
esp_err_t wifi_prov_mgr_deinit(void);

// State Management
bool wifi_prov_mgr_is_provisioned(void);
esp_err_t wifi_prov_mgr_start_provisioning(wifi_prov_security_t security,
                                           const char *pop,
                                           const char *service_name,
                                           const char *service_key);
void wifi_prov_mgr_stop_provisioning(void);

// Event Handling
esp_err_t wifi_prov_mgr_register_event_handler(esp_event_handler_t event_handler);
esp_err_t wifi_prov_mgr_unregister_event_handler(esp_event_handler_t event_handler);
```

## SoftAP Scheme Configuration

```c
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

void start_provisioning(void) {
    // Initialize provisioning manager
    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_softap,
        .scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE
    };

    ESP_ERROR_CHECK(wifi_prov_mgr_init(config));

    // Check if device is already provisioned
    bool provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&provisioned));

    if (!provisioned) {
        ESP_LOGI(TAG, "Starting provisioning");

        // Start SoftAP provisioning
        // Security 1 with proof-of-possession
        const char *pop = "abcd1234";  // Proof of possession
        const char *ssid = "PROV_DEVICE_001";
        const char *password = "provision";

        ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
            WIFI_PROV_SECURITY_1,
            pop,
            ssid,
            password
        ));
    } else {
        ESP_LOGI(TAG, "Already provisioned, starting WiFi");
        wifi_prov_mgr_deinit();
        // Connect to WiFi...
    }
}
```

## Provisioning Events

```c
static void prov_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data) {
    switch (event_id) {
        case WIFI_PROV_START:
            ESP_LOGI(TAG, "Provisioning started");
            break;

        case WIFI_PROV_CRED_RECV:
            wifi_sta_config_t *wifi_sta_cfg = (wifi_sta_config_t *)event_data;
            ESP_LOGI(TAG, "Received WiFi credentials - SSID:%s",
                     (const char *)wifi_sta_cfg->ssid);
            break;

        case WIFI_PROV_CRED_FAIL:
            wifi_prov_sta_fail_reason_t *reason = (wifi_prov_sta_fail_reason_t *)event_data;
            ESP_LOGE(TAG, "Provisioning failed: %s",
                     (*reason == WIFI_PROV_STA_AUTH_ERROR) ? "Auth failed" : "AP not found");
            break;

        case WIFI_PROV_CRED_SUCCESS:
            ESP_LOGI(TAG, "Provisioning successful");
            break;

        case WIFI_PROV_END:
            ESP_LOGI(TAG, "Provisioning end");
            wifi_prov_mgr_deinit();
            break;

        default:
            break;
    }
}
```

## Security Modes

1. **Security 0 (WIFI_PROV_SECURITY_0)** - Plaintext (development only)
2. **Security 1 (WIFI_PROV_SECURITY_1)** - X25519 key exchange + AES-CTR encryption
3. **Security 2 (WIFI_PROV_SECURITY_2)** - SRP6a authentication + AES-GCM encryption (recommended)

## mDNS Service Discovery

Enable mDNS for automatic device discovery:

```c
#include "mdns.h"

void start_mdns(void) {
    ESP_ERROR_CHECK(mdns_init());
    ESP_ERROR_CHECK(mdns_hostname_set("esp32-device"));
    ESP_ERROR_CHECK(mdns_instance_name_set("ESP32 Grain Fan Controller"));

    // Advertise provisioning service
    ESP_ERROR_CHECK(mdns_service_add(NULL, "_esp_wifi_prov", "_tcp", 80, NULL, 0));
}
```

## Captive Portal Alternative (Community Component)

For captive portal functionality, consider the `esp32-captive_portal` component:

```yaml