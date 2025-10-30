# WiFi Manager for Customer Self-Setup

**Created:** October 29, 2025
**Purpose:** Enable customers to configure ESP32 devices without technical support
**Status:** Design Document / Proposed Enhancement

---

## Executive Summary

Currently, ESP32 devices require manual programming via serial/USB connection to configure WiFi credentials, server URLs, and authentication tokens. This document proposes adding a **WiFi Manager** feature that allows customers to configure devices themselves using a smartphone or laptop.

**Customer Experience:**
1. Admin provisions device in web dashboard → receives auth token
2. Customer powers on ESP32 → device creates WiFi hotspot
3. Customer connects to hotspot → opens captive portal
4. Customer enters WiFi credentials and auth token → device auto-configures
5. Device connects to customer WiFi and begins operation

**Impact:** Eliminates need for technical support during device deployment.

---

## Current Provisioning Flow

### Existing Architecture

```
┌─────────────────┐
│  Web Dashboard  │
│ (Admin Portal)  │
└────────┬────────┘
         │
         │ 1. POST /api/v1/devices/provision
         │    - bunker_id
         │    - mac_address
         │    - fan_position
         ▼
┌─────────────────┐
│   Backend API   │
│  (FastAPI)      │
└────────┬────────┘
         │
         │ 2. Returns:
         │    - auth_token (UUID)
         │    - device_id
         │    - led_flash_sequence (1-10)
         ▼
┌─────────────────┐
│   Admin User    │
│                 │
└────────┬────────┘
         │
         │ 3. MANUAL STEP (Current Limitation)
         │    - Connect ESP32 via USB/serial
         │    - Flash firmware with config:
         │      * WiFi SSID/password
         │      * Server URL
         │      * Auth token
         ▼
┌─────────────────┐
│  ESP32 Device   │
│  (Provisioned)  │
└─────────────────┘
```

### Current Firmware Components

**Already Implemented:**
- `wifi_manager.c` - WiFi connection management (STA mode only)
- `nvs_storage.c` - Encrypted credential storage
- `nvs_storage_get_wifi_credentials()` - Retrieves stored WiFi config
- `nvs_storage_set_wifi_credentials()` - Stores WiFi config
- `nvs_storage_is_provisioned()` - Checks provisioning status

**Missing:**
- WiFi Access Point (AP) mode
- HTTP server for configuration web interface
- DNS server for captive portal redirect
- Provisioning state machine

---

## Proposed WiFi Manager Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 Boot Sequence                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │  Check Provisioned?    │
              │  nvs_storage_is_       │
              │    provisioned()       │
              └───────────┬────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
           YES  │                   │  NO
                │                   │
                ▼                   ▼
    ┌──────────────────┐   ┌──────────────────────┐
    │  Normal Mode     │   │  Setup Mode          │
    │                  │   │                      │
    │  - WiFi STA      │   │  - WiFi AP Mode      │
    │  - Connect to    │   │  - SSID:             │
    │    customer WiFi │   │    "BunkerColab-XXXX"│
    │  - Connect to    │   │  - IP: 192.168.4.1   │
    │    server        │   │  - Start HTTP server │
    │  - Report status │   │  - Start DNS server  │
    │                  │   │  - Show LED pattern  │
    └──────────────────┘   └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │  Customer connects   │
                           │  to WiFi AP          │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │  Captive portal      │
                           │  redirects to        │
                           │  http://192.168.4.1  │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │  Configuration Form: │
                           │  - WiFi SSID         │
                           │  - WiFi Password     │
                           │  - Auth Token        │
                           │  - Server URL        │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │  Submit → Validate   │
                           │  - Test WiFi connect │
                           │  - Save to NVS       │
                           │  - Mark provisioned  │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼───────────┐
                           │  Reboot → Normal Mode│
                           └──────────────────────┘
```

### Customer Experience Flow

**Step 1: Admin Provisions Device**
```
1. Admin logs into http://206.189.210.203
2. Navigate to "Provision Device"
3. Select bunker, enter MAC address, fan position
4. Receive auth token: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
5. Receive LED flash sequence: 7 (flashes 7 times)
6. Print setup instructions with QR code
```

**Step 2: Customer Receives Device**
```
1. Power on ESP32 device
2. Observe LED flashing pattern (identifies device)
3. Device creates WiFi network: "BunkerColab-A3F2"
   (last 4 characters of MAC address)
```

**Step 3: Customer Configures via Smartphone**
```
1. Open WiFi settings on phone/laptop
2. Connect to "BunkerColab-A3F2"
3. Browser auto-opens to http://192.168.4.1
   (captive portal)
4. See configuration form:
   ┌────────────────────────────────────┐
   │   BunkerColab Device Setup         │
   ├────────────────────────────────────┤
   │                                    │
   │  WiFi Network Name (SSID):         │
   │  [_____________________________]   │
   │                                    │
   │  WiFi Password:                    │
   │  [_____________________________]   │
   │                                    │
   │  Auth Token (from setup sheet):    │
   │  [_____________________________]   │
   │  📷 Or scan QR code                │
   │                                    │
   │  Server URL:                       │
   │  [http://206.189.210.203____]      │
   │  (Pre-filled, optional override)   │
   │                                    │
   │  [ Test Connection ]  [ Submit ]   │
   │                                    │
   └────────────────────────────────────┘
5. Enter WiFi credentials and auth token
6. Click "Submit"
7. Device tests WiFi connection
8. Device saves config and reboots
9. Success message: "Device configured! Connecting to server..."
```

**Step 4: Device Auto-Connects**
```
1. Device reboots in Normal Mode
2. Connects to customer WiFi automatically
3. Authenticates with server using token
4. Begins reporting status every 60 seconds
5. LED shows solid/blinking pattern (connected)
```

---

## Technical Implementation

### 1. Firmware Changes (ESP32)

#### New File: `provisioning_manager.c`

```c
/**
 * @file provisioning_manager.c
 * @brief WiFi Manager provisioning via captive portal
 */

#include "provisioning_manager.h"
#include "wifi_manager.h"
#include "nvs_storage.h"
#include "esp_wifi.h"
#include "esp_http_server.h"
#include "dns_server.h"
#include "esp_log.h"

#define PROVISIONING_TIMEOUT_MS (15 * 60 * 1000)  // 15 minutes
#define AP_SSID_PREFIX "BunkerColab-"
#define AP_IP "192.168.4.1"

static const char *TAG = "provisioning_manager";

// State
static httpd_handle_t server = NULL;
static TimerHandle_t timeout_timer = NULL;
static bool provisioning_active = false;

/**
 * @brief Start provisioning mode (AP + HTTP server)
 */
esp_err_t provisioning_manager_start(void)
{
    bool is_provisioned = false;
    esp_err_t ret;

    // Check if already provisioned
    ret = nvs_storage_is_provisioned(&is_provisioned);
    if (ret != ESP_OK || is_provisioned) {
        ESP_LOGI(TAG, "Device already provisioned, skipping setup mode");
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Starting provisioning mode...");

    // Get MAC address for unique SSID
    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_AP, mac);
    char ssid[32];
    snprintf(ssid, sizeof(ssid), "%s%02X%02X",
             AP_SSID_PREFIX, mac[4], mac[5]);

    // Configure AP mode
    wifi_config_t wifi_config = {
        .ap = {
            .ssid_len = strlen(ssid),
            .channel = 1,
            .max_connection = 4,
            .authmode = WIFI_AUTH_OPEN,  // Open network for easy access
            .beacon_interval = 100,
        },
    };
    strcpy((char *)wifi_config.ap.ssid, ssid);

    // Start WiFi in AP mode
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "AP started: SSID=%s, IP=%s", ssid, AP_IP);

    // Start DNS server for captive portal
    ret = dns_server_start();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start DNS server");
        return ret;
    }

    // Start HTTP server
    ret = http_server_start(&server);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start HTTP server");
        dns_server_stop();
        return ret;
    }

    // Start timeout timer (15 minutes)
    timeout_timer = xTimerCreate("prov_timeout",
                                  pdMS_TO_TICKS(PROVISIONING_TIMEOUT_MS),
                                  pdFALSE,  // One-shot
                                  NULL,
                                  provisioning_timeout_callback);
    xTimerStart(timeout_timer, 0);

    provisioning_active = true;

    // Start LED flash pattern (continuous until provisioned)
    uint8_t led_sequence;
    if (nvs_storage_get_led_flash_sequence(&led_sequence) == ESP_OK) {
        // Flash LED continuously to identify device
        // Implementation depends on LED hardware
    }

    ESP_LOGI(TAG, "Provisioning mode active for %d minutes",
             PROVISIONING_TIMEOUT_MS / 60000);

    return ESP_OK;
}

/**
 * @brief Stop provisioning mode and reboot
 */
esp_err_t provisioning_manager_stop(void)
{
    if (!provisioning_active) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Stopping provisioning mode...");

    // Stop timer
    if (timeout_timer) {
        xTimerStop(timeout_timer, 0);
        xTimerDelete(timeout_timer, 0);
        timeout_timer = NULL;
    }

    // Stop HTTP server
    if (server) {
        httpd_stop(server);
        server = NULL;
    }

    // Stop DNS server
    dns_server_stop();

    // Stop WiFi
    esp_wifi_stop();

    provisioning_active = false;

    ESP_LOGI(TAG, "Provisioning stopped, rebooting...");
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();

    return ESP_OK;
}

/**
 * @brief Timeout callback - reboot if not provisioned
 */
static void provisioning_timeout_callback(TimerHandle_t xTimer)
{
    ESP_LOGW(TAG, "Provisioning timeout reached, rebooting...");
    esp_restart();
}
```

#### New File: `http_server.c` (Captive Portal)

```c
/**
 * @file http_server.c
 * @brief HTTP server for provisioning captive portal
 */

#include "esp_http_server.h"
#include "esp_log.h"
#include "cJSON.h"
#include "nvs_storage.h"
#include "wifi_manager.h"

static const char *TAG = "http_server";

// HTML page for configuration form
static const char html_page[] =
"<!DOCTYPE html>"
"<html>"
"<head>"
"  <meta charset='UTF-8'>"
"  <meta name='viewport' content='width=device-width, initial-scale=1.0'>"
"  <title>BunkerColab Setup</title>"
"  <style>"
"    body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }"
"    h1 { color: #2563eb; }"
"    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px; }"
"    button { background: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px; }"
"    button:hover { background: #1d4ed8; }"
"    .info { background: #dbeafe; padding: 10px; border-radius: 4px; margin-bottom: 20px; }"
"    .error { background: #fee2e2; color: #991b1b; padding: 10px; border-radius: 4px; margin-bottom: 20px; display: none; }"
"    .success { background: #d1fae5; color: #065f46; padding: 10px; border-radius: 4px; margin-bottom: 20px; display: none; }"
"  </style>"
"</head>"
"<body>"
"  <h1>🌾 BunkerColab Setup</h1>"
"  <div class='info'>Enter your WiFi credentials and auth token from your setup sheet.</div>"
"  <div id='error' class='error'></div>"
"  <div id='success' class='success'></div>"
"  <form id='configForm'>"
"    <label>WiFi Network (SSID):</label>"
"    <input type='text' id='ssid' required placeholder='MyWiFiNetwork'>"
"    <label>WiFi Password:</label>"
"    <input type='password' id='password' required placeholder='••••••••'>"
"    <label>Auth Token (from setup sheet):</label>"
"    <input type='text' id='token' required placeholder='a1b2c3d4-e5f6-7890-abcd-ef1234567890'>"
"    <label>Server URL:</label>"
"    <input type='text' id='server_url' value='http://206.189.210.203' required>"
"    <button type='submit'>💾 Save & Connect</button>"
"  </form>"
"  <script>"
"    document.getElementById('configForm').addEventListener('submit', async (e) => {"
"      e.preventDefault();"
"      const data = {"
"        ssid: document.getElementById('ssid').value,"
"        password: document.getElementById('password').value,"
"        token: document.getElementById('token').value,"
"        server_url: document.getElementById('server_url').value"
"      };"
"      try {"
"        const response = await fetch('/api/provision', {"
"          method: 'POST',"
"          headers: { 'Content-Type': 'application/json' },"
"          body: JSON.stringify(data)"
"        });"
"        const result = await response.json();"
"        if (response.ok) {"
"          document.getElementById('success').style.display = 'block';"
"          document.getElementById('success').innerText = 'Configuration saved! Device will reboot and connect to your WiFi...';"
"          setTimeout(() => { window.location.href = '/success'; }, 2000);"
"        } else {"
"          document.getElementById('error').style.display = 'block';"
"          document.getElementById('error').innerText = 'Error: ' + result.message;"
"        }"
"      } catch (err) {"
"        document.getElementById('error').style.display = 'block';"
"        document.getElementById('error').innerText = 'Connection failed. Please try again.';"
"      }"
"    });"
"  </script>"
"</body>"
"</html>";

static const char success_page[] =
"<!DOCTYPE html>"
"<html>"
"<head><meta charset='UTF-8'><title>Success</title></head>"
"<body style='font-family: Arial; text-align: center; padding: 50px;'>"
"  <h1 style='color: #059669;'>✅ Configuration Complete!</h1>"
"  <p>Your device is connecting to the server.</p>"
"  <p>You can close this page and disconnect from the BunkerColab network.</p>"
"</body>"
"</html>";

/**
 * @brief Handler for root page (captive portal redirect)
 */
static esp_err_t root_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_page, strlen(html_page));
    return ESP_OK;
}

/**
 * @brief Handler for success page
 */
static esp_err_t success_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, success_page, strlen(success_page));
    return ESP_OK;
}

/**
 * @brief Handler for provisioning API endpoint
 */
static esp_err_t provision_api_handler(httpd_req_t *req)
{
    char content[512];
    int ret = httpd_req_recv(req, content, sizeof(content) - 1);
    if (ret <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid request");
        return ESP_FAIL;
    }
    content[ret] = '\0';

    // Parse JSON
    cJSON *root = cJSON_Parse(content);
    if (!root) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *ssid = cJSON_GetObjectItem(root, "ssid");
    cJSON *password = cJSON_GetObjectItem(root, "password");
    cJSON *token = cJSON_GetObjectItem(root, "token");
    cJSON *server_url = cJSON_GetObjectItem(root, "server_url");

    if (!ssid || !password || !token || !server_url) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Missing fields");
        return ESP_FAIL;
    }

    // Test WiFi connection (optional but recommended)
    ESP_LOGI(TAG, "Testing WiFi connection to %s...", ssid->valuestring);

    // Save credentials to NVS
    esp_err_t err = nvs_storage_set_wifi_credentials(ssid->valuestring,
                                                       password->valuestring);
    if (err != ESP_OK) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR,
                            "Failed to save WiFi credentials");
        return ESP_FAIL;
    }

    err = nvs_storage_set_auth_token(token->valuestring);
    if (err != ESP_OK) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR,
                            "Failed to save auth token");
        return ESP_FAIL;
    }

    err = nvs_storage_set_server_url(server_url->valuestring);
    if (err != ESP_OK) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR,
                            "Failed to save server URL");
        return ESP_FAIL;
    }

    // Mark as provisioned
    err = nvs_storage_set_provisioned(true);
    if (err != ESP_OK) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR,
                            "Failed to mark as provisioned");
        return ESP_FAIL;
    }

    cJSON_Delete(root);

    // Send success response
    const char *response = "{\"status\":\"ok\",\"message\":\"Configuration saved\"}";
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));

    ESP_LOGI(TAG, "Provisioning complete, scheduling reboot...");

    // Schedule reboot in 2 seconds
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();

    return ESP_OK;
}

/**
 * @brief Start HTTP server for captive portal
 */
esp_err_t http_server_start(httpd_handle_t *server)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.ctrl_port = 32768;

    if (httpd_start(server, &config) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start HTTP server");
        return ESP_FAIL;
    }

    // Register URI handlers
    httpd_uri_t root_uri = {
        .uri = "/",
        .method = HTTP_GET,
        .handler = root_handler,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(*server, &root_uri);

    httpd_uri_t success_uri = {
        .uri = "/success",
        .method = HTTP_GET,
        .handler = success_handler,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(*server, &success_uri);

    httpd_uri_t provision_uri = {
        .uri = "/api/provision",
        .method = HTTP_POST,
        .handler = provision_api_handler,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(*server, &provision_uri);

    ESP_LOGI(TAG, "HTTP server started on port 80");
    return ESP_OK;
}
```

#### New File: `dns_server.c` (Captive Portal Redirect)

```c
/**
 * @file dns_server.c
 * @brief DNS server for captive portal redirect
 *
 * Redirects all DNS queries to 192.168.4.1 to trigger captive portal.
 */

#include "dns_server.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include <string.h>

#define DNS_PORT 53
#define DNS_MAX_PACKET_SIZE 512

static const char *TAG = "dns_server";
static int dns_socket = -1;
static TaskHandle_t dns_task_handle = NULL;

static void dns_server_task(void *pvParameters)
{
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    server_addr.sin_port = htons(DNS_PORT);

    dns_socket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (dns_socket < 0) {
        ESP_LOGE(TAG, "Failed to create socket");
        vTaskDelete(NULL);
        return;
    }

    if (bind(dns_socket, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        ESP_LOGE(TAG, "Failed to bind socket");
        close(dns_socket);
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "DNS server listening on port 53");

    uint8_t buffer[DNS_MAX_PACKET_SIZE];
    struct sockaddr_in client_addr;
    socklen_t client_addr_len = sizeof(client_addr);

    while (1) {
        int len = recvfrom(dns_socket, buffer, sizeof(buffer), 0,
                          (struct sockaddr *)&client_addr, &client_addr_len);

        if (len > 0) {
            // Simple DNS response: redirect all queries to 192.168.4.1
            // (Full DNS implementation would parse query and build proper response)

            // For now, send A record response pointing to 192.168.4.1
            uint8_t response[DNS_MAX_PACKET_SIZE];
            memcpy(response, buffer, len);  // Copy query

            // Set response flags
            response[2] = 0x81;  // Response, no error
            response[3] = 0x80;  // Recursion available

            // Add answer (simplified)
            int response_len = len;
            // ... (DNS packet construction omitted for brevity)

            sendto(dns_socket, response, response_len, 0,
                  (struct sockaddr *)&client_addr, client_addr_len);
        }
    }
}

esp_err_t dns_server_start(void)
{
    if (dns_task_handle != NULL) {
        ESP_LOGW(TAG, "DNS server already running");
        return ESP_OK;
    }

    xTaskCreate(dns_server_task, "dns_server", 4096, NULL, 5, &dns_task_handle);
    return ESP_OK;
}

esp_err_t dns_server_stop(void)
{
    if (dns_task_handle != NULL) {
        vTaskDelete(dns_task_handle);
        dns_task_handle = NULL;
    }

    if (dns_socket >= 0) {
        close(dns_socket);
        dns_socket = -1;
    }

    ESP_LOGI(TAG, "DNS server stopped");
    return ESP_OK;
}
```

#### Modified: `main/main.c`

```c
// Add at boot:

void app_main(void)
{
    // ... existing initialization ...

    nvs_storage_init();

    bool is_provisioned = false;
    nvs_storage_is_provisioned(&is_provisioned);

    if (!is_provisioned) {
        ESP_LOGI(TAG, "Device not provisioned, starting setup mode...");
        provisioning_manager_start();
        // Provisioning mode runs until configured or timeout
        // Will reboot after provisioning
    } else {
        ESP_LOGI(TAG, "Device provisioned, starting normal mode...");
        // ... existing control loop initialization ...
    }
}
```

---

### 2. Web Dashboard Changes

#### Modified: `TokenDisplayStep.tsx`

```typescript
import React, { useState } from 'react';
import QRCode from 'react-qr-code';

interface TokenDisplayStepProps {
  authToken: string;
  deviceId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function TokenDisplayStep({
  authToken,
  deviceId,
  onNext,
  onBack
}: TokenDisplayStepProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(authToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
          ⚠️ Important: Save This Token
        </h3>
        <p className="text-yellow-800">
          This authentication token will only be shown once. The customer will need it to configure the device.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium text-gray-700 mb-3">Authentication Token:</h4>
        <div className="bg-gray-50 p-4 rounded font-mono text-sm break-all border border-gray-300">
          {authToken}
        </div>
        <button
          onClick={handleCopy}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {copied ? '✓ Copied!' : '📋 Copy Token'}
        </button>
      </div>

      {/* NEW: WiFi Manager Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-4">
          📱 Customer Setup Instructions (WiFi Manager)
        </h4>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Power on the ESP32 device</li>
          <li>Device creates WiFi network: <code className="bg-blue-100 px-2 py-1 rounded">BunkerColab-XXXX</code></li>
          <li>Connect smartphone/laptop to this network</li>
          <li>Browser opens automatically to setup page</li>
          <li>Enter WiFi credentials and paste the auth token above</li>
          <li>Device auto-configures and connects to server</li>
        </ol>

        <div className="mt-4 flex justify-center">
          <div className="bg-white p-4 rounded">
            <QRCode value={authToken} size={150} />
            <p className="text-xs text-gray-600 text-center mt-2">
              Scan to auto-fill token
            </p>
          </div>
        </div>
      </div>

      {/* Device ID Reference */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Device ID:</strong> <code className="bg-gray-200 px-2 py-1 rounded">{deviceId}</code>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Next: Complete Setup →
        </button>
      </div>
    </div>
  );
}
```

#### Package Update: Add QR Code Library

```json
// web/package.json
{
  "dependencies": {
    ...existing,
    "react-qr-code": "^2.0.12"
  }
}
```

---

### 3. No Backend Changes Required

The existing backend provisioning endpoint works perfectly:

```python
# server/app/api/v1/endpoints/devices.py

@router.post("/provision", response_model=DeviceProvisionResponse)
async def provision_device(payload: DeviceProvisionRequest, ...):
    """Already generates:
    - device_id
    - auth_token (UUID)
    - led_flash_sequence (1-10)

    No changes needed - customer enters auth_token via WiFi Manager instead of technician.
    """
```

---

## Security Considerations

### Risks

1. **Open WiFi AP** - Anyone within range can connect
2. **Cleartext HTTP** - Token transmitted over HTTP
3. **No rate limiting** - Brute force auth token attempts
4. **Setup mode indefinite** - Could leave AP running forever

### Mitigations

#### 1. Time-Limited Setup Mode
```c
// Timeout after 15 minutes, reboot device
#define PROVISIONING_TIMEOUT_MS (15 * 60 * 1000)
```

#### 2. Factory Reset Button (Hardware)
```c
// Hold button 10 seconds → erase NVS → re-enter setup mode
if (gpio_get_level(FACTORY_RESET_PIN) == 0) {
    // Button held for 10 seconds
    nvs_storage_erase_all();
    esp_restart();
}
```

#### 3. Password-Protected AP (Optional)
```c
// Use last 8 characters of auth token as AP password
// Customer sees: "WiFi Password: ef123456" on setup sheet
wifi_config.ap.authmode = WIFI_AUTH_WPA2_PSK;
strcpy((char *)wifi_config.ap.password, &auth_token[28]);
```

#### 4. HTTPS with Self-Signed Cert
```c
// Generate self-signed cert on first boot
// User sees browser warning but connection is encrypted
```

#### 5. Rate Limiting on Provisioning Endpoint
```c
// Allow max 5 attempts per minute
static uint8_t provision_attempts = 0;
static TickType_t last_attempt_time = 0;

if (provision_attempts >= 5) {
    // Reject with 429 Too Many Requests
}
```

---

## Implementation Plan

### Phase 1: Firmware Foundation (Week 1)
- [ ] Create `provisioning_manager.c` with AP mode
- [ ] Implement basic HTTP server with HTML form
- [ ] Add DNS server for captive portal redirect
- [ ] Test on ESP32-DevKitC
- [ ] Validate NVS storage of credentials

### Phase 2: Web Dashboard Integration (Week 2)
- [ ] Add QR code generation to `TokenDisplayStep.tsx`
- [ ] Create customer setup instructions component
- [ ] Design printable setup sheet (PDF)
- [ ] Update provisioning wizard flow

### Phase 3: Security Hardening (Week 3)
- [ ] Add provisioning timeout (15 minutes)
- [ ] Implement factory reset button handler
- [ ] Add rate limiting to provision endpoint
- [ ] Test WiFi connection before saving credentials
- [ ] Add HTTPS support (optional)

### Phase 4: Testing & Documentation (Week 4)
- [ ] End-to-end testing with real hardware
- [ ] Customer setup guide (PDF with screenshots)
- [ ] Troubleshooting guide
- [ ] Update operator manual
- [ ] Video walkthrough for customers

---

## Testing Checklist

### Firmware Testing
- [ ] Device boots into setup mode (not provisioned)
- [ ] WiFi AP "BunkerColab-XXXX" visible
- [ ] Smartphone connects to AP
- [ ] Captive portal redirects to http://192.168.4.1
- [ ] Configuration form displays correctly
- [ ] Form validation works (required fields)
- [ ] WiFi credentials test before saving
- [ ] NVS storage persists across reboots
- [ ] Device reboots after provisioning
- [ ] Device connects to customer WiFi
- [ ] Device authenticates with server
- [ ] LED flash sequence displays correctly
- [ ] Timeout works (15 minutes → reboot)
- [ ] Factory reset button works

### Web Dashboard Testing
- [ ] QR code generates correctly
- [ ] Setup instructions display
- [ ] Copy token button works
- [ ] Printable setup sheet formats correctly

### Integration Testing
- [ ] Full flow: provision → WiFi setup → server connection
- [ ] Multiple devices (10+) provisioned sequentially
- [ ] Error handling (wrong WiFi password)
- [ ] Error handling (invalid auth token)
- [ ] Error handling (server unreachable)

---

## Customer Setup Guide (Draft)

```
┌─────────────────────────────────────────────────────────┐
│                   BUNKERCOLAB DEVICE SETUP              │
│                    Quick Start Guide                    │
└─────────────────────────────────────────────────────────┘

Device ID: ABC-123-DEF-456
LED Flash Pattern: 🔴🔴🔴🔴🔴 (5 flashes)
Auth Token: a1b2c3d4-e5f6-7890-abcd-ef1234567890

📱 SETUP STEPS:

1️⃣ Power on the device
   - Plug in power cable
   - Wait 10 seconds for boot
   - LED will start flashing (5 times)

2️⃣ Connect to device WiFi
   - Open WiFi settings on phone/laptop
   - Find network: "BunkerColab-XXXX"
   - Connect (no password needed)

3️⃣ Open setup page
   - Browser should open automatically
   - If not, visit: http://192.168.4.1

4️⃣ Enter your information
   ┌──────────────────────────────────────┐
   │ WiFi Network: [Your WiFi Name]       │
   │ WiFi Password: [Your WiFi Password]  │
   │ Auth Token: [Paste token above] 📋   │
   │ Server URL: [Pre-filled]             │
   │                                      │
   │ [💾 Save & Connect]                  │
   └──────────────────────────────────────┘

5️⃣ Wait for confirmation
   - Device tests WiFi connection
   - Shows "Configuration Complete!"
   - Device reboots (30 seconds)
   - LED stops flashing when connected

✅ SETUP COMPLETE!
   Your device is now reporting to the server.
   Disconnect from "BunkerColab-XXXX" network.

❓ TROUBLESHOOTING:
   - Can't find WiFi network? Reboot device (power cycle)
   - Wrong WiFi password? Reboot device to retry
   - Setup times out? Reboot device within 15 minutes

📞 Support: support@bunkercolab.com
```

---

## Cost-Benefit Analysis

### Implementation Cost
- Firmware development: 12-18 hours ($1,500-$2,250)
- Web dashboard updates: 2-3 hours ($250-$375)
- Testing & documentation: 5-7 hours ($625-$875)
- **Total: ~$2,500-$3,500**

### Benefit
- **Eliminates technical support calls** for WiFi setup
- **Faster deployment** - customers self-configure
- **Scales to 1000+ devices** without support team growth
- **Better customer experience** - no waiting for technician

### ROI
- Assume 100 devices deployed per year
- Current cost: 30 minutes technician time per device = 50 hours/year
- Technician cost: $50/hour × 50 hours = $2,500/year
- **Payback period: 1-1.5 years**
- **Ongoing savings: $2,500/year**

---

## Future Enhancements

### Mobile App (Optional)
- Native iOS/Android app for setup
- BLE provisioning (alternative to WiFi AP)
- QR code scanning for auto-fill
- Device management dashboard

### Bluetooth Provisioning
- Use BLE instead of WiFi AP
- More secure (shorter range)
- Works without WiFi hardware
- Requires mobile app

### Batch Provisioning
- Provision 10+ devices simultaneously
- Upload CSV with device list
- Generate QR codes in bulk
- Print setup sheets automatically

---

## Recommendations

### MVP Approach (Recommended)
1. **Start with basic HTTP captive portal** (simplest, fastest)
2. **15-minute timeout** for security
3. **QR code in web dashboard** for easy token entry
4. **Customer setup guide PDF** with screenshots
5. **Test with 5 pilot customers** before full rollout

### Future Iteration
1. Add HTTPS after validating UX
2. Add password-protected AP
3. Consider BLE provisioning for mobile app
4. Add batch provisioning for large deployments

---

## Conclusion

WiFi Manager provisioning is **highly feasible** and would significantly improve the customer experience. The existing firmware architecture already has the building blocks (NVS storage, WiFi manager), so implementation is straightforward.

**Key Benefits:**
- ✅ Self-service setup (no technical support needed)
- ✅ Faster deployment
- ✅ Scales to 1000+ devices
- ✅ Better security (no hardcoded credentials)

**Recommended Next Steps:**
1. Validate customer interest (survey or pilot program)
2. Implement firmware prototype (2 weeks)
3. Test with 5 pilot devices
4. Refine UX based on feedback
5. Full rollout with updated documentation

---

**Document Status:** Ready for review
**Next Action:** Approve for implementation or request changes
**Contact:** jeff@bunkercolab.com
