# ESP-IDF Framework Documentation Research
## Grain Bunker Fan Control System - IoT Controller Implementation

**Document Version:** 1.0
**ESP-IDF Target Version:** 5.x (5.5.1 stable)
**Last Updated:** October 21, 2025
**Prepared for:** Jeff (ESP32 Firmware Developer)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [ESP-IDF Version Information](#esp-idf-version-information)
3. [Component Documentation](#component-documentation)
   - [ESP HTTP Client (HTTPS/REST API)](#1-esp-http-client-httpsrest-api)
   - [ESP-TLS (TLS/SSL Support)](#2-esp-tls-tlsssl-support)
   - [cJSON (JSON Parsing)](#3-cjson-json-parsing)
   - [NVS (Non-Volatile Storage)](#4-nvs-non-volatile-storage)
   - [Watchdog Timers](#5-watchdog-timers)
   - [WiFi Provisioning Manager](#6-wifi-provisioning-manager)
   - [SNTP (Time Synchronization)](#7-sntp-time-synchronization)
   - [ESP Timer (Software Timers)](#8-esp-timer-software-timers)
   - [GPIO Control](#9-gpio-control)
   - [Unit Testing Framework](#10-unit-testing-framework)
4. [Security Best Practices](#security-best-practices)
5. [Configuration Reference](#configuration-reference)
6. [Example Code Patterns](#example-code-patterns)
7. [Migration Considerations](#migration-considerations)
8. [References](#references)

---

## Executive Summary

This document provides comprehensive ESP-IDF framework documentation for implementing the grain bunker fan control system on ESP32-DevKitC-VIE hardware. All information is sourced from official Espressif documentation (ESP-IDF v5.5.1 stable) and verified GitHub repositories.

**Key Findings:**
- ESP-IDF 5.x provides all required components for the IoT control system
- HTTPS/TLS support is production-ready with certificate bundle for server verification
- Hardware and software watchdog timers enable fail-safe operation
- NVS provides secure credential storage for WiFi and authentication tokens
- Official WiFi provisioning manager requires custom captive portal integration
- Unity framework is the official testing tool (not Catch)

**Critical Security Requirement:** All TLS connections MUST configure server verification via certificate bundle, custom CA certificate, or global CA store. Connections without verification will fail by default in ESP-IDF 5.x.

---

## ESP-IDF Version Information

### Recommended Version
**ESP-IDF v5.5.1 (stable)** - Released 2025
- Stable release with long-term support
- Full documentation available
- Compatible with ESP32-DevKitC-VIE

### Official Documentation Base URL
```
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/
```

### GitHub Repository
```
https://github.com/espressif/esp-idf
```

### Version-Specific Considerations

ESP-IDF 5.0 introduced major breaking changes from 4.x:
- CMake minimum version increased to 3.16
- Component dependencies must be explicitly declared
- 64-bit `time_t` prevents Y2K38 overflow (valid until 2104)
- Python 3.6 support removed
- mbedTLS is now the official TLS stack (OpenSSL deprecated)
- Component REQUIRES must specify PRIVATE/PUBLIC/INTERFACE

**Migration Guide:**
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/index.html

---

## Component Documentation

## 1. ESP HTTP Client (HTTPS/REST API)

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html
- **Header File:** `esp_http_client/include/esp_http_client.h`
- **Example Code:** `examples/protocols/esp_http_client/main/esp_http_client_example.c`

### Purpose
Provides HTTP/HTTPS client functionality for RESTful API communication with cloud server, supporting TLS encryption, authentication, and various HTTP methods.

### Key Features
- Full HTTPS/TLS support with server certificate verification
- Basic and Digest authentication
- Custom header management (for authentication tokens)
- Persistent connections for multiple requests
- Asynchronous/non-blocking mode
- Chunked transfer encoding
- Automatic redirect handling
- HTTP/2 via ALPN negotiation

### Core API Functions

#### Initialization & Cleanup
```c
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *config);
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t client);
```

#### Request Execution
```c
// Blocking/non-blocking complete HTTP transaction
esp_err_t esp_http_client_perform(esp_http_client_handle_t client);

// Low-level stream operations
esp_err_t esp_http_client_open(esp_http_client_handle_t client, int write_len);
int esp_http_client_write(esp_http_client_handle_t client, const char *buffer, int len);
int esp_http_client_fetch_headers(esp_http_client_handle_t client);
int esp_http_client_read(esp_http_client_handle_t client, char *buffer, int len);
esp_err_t esp_http_client_close(esp_http_client_handle_t client);
```

#### Header Management
```c
esp_err_t esp_http_client_set_header(esp_http_client_handle_t client,
                                     const char *key, const char *value);
esp_err_t esp_http_client_get_header(esp_http_client_handle_t client,
                                     const char *key, char **value);
esp_err_t esp_http_client_delete_header(esp_http_client_handle_t client,
                                        const char *key);
```

#### Response Handling
```c
int esp_http_client_get_status_code(esp_http_client_handle_t client);
int64_t esp_http_client_get_content_length(esp_http_client_handle_t client);
bool esp_http_client_is_chunked_response(esp_http_client_handle_t client);
bool esp_http_client_is_complete_data_received(esp_http_client_handle_t client);
```

### Configuration Structure

```c
typedef struct {
    const char *url;                    // Full URL (overrides host/port/path)
    const char *host;                   // Server hostname
    int port;                           // Server port (default 80/443)
    const char *path;                   // Request path
    const char *query;                  // Query string

    // Authentication
    const char *username;               // Username for authentication
    const char *password;               // Password for authentication
    esp_http_client_auth_type_t auth_type; // HTTP_AUTH_TYPE_BASIC or DIGEST

    // TLS/SSL Configuration
    const char *cert_pem;               // Server CA certificate (PEM format)
    size_t cert_len;                    // Certificate length
    const char *client_cert_pem;        // Client certificate for mutual TLS
    const char *client_key_pem;         // Client private key
    esp_http_client_tls_version_t tls_version; // TLS 1.2, 1.3, or unspecified
    esp_err_t (*crt_bundle_attach)(void *conf); // Certificate bundle attach function
    bool use_global_ca_store;           // Use global CA store
    bool skip_cert_common_name_check;   // Skip CN verification (insecure!)

    // HTTP Configuration
    esp_http_client_method_t method;    // GET, POST, PUT, DELETE, etc.
    int timeout_ms;                     // Network timeout (default 5000ms)
    bool disable_auto_redirect;         // Manual redirect handling
    int max_redirection_count;          // Maximum redirects (default 10)

    // Buffers
    int buffer_size;                    // RX buffer size (default 512)
    int buffer_size_tx;                 // TX buffer size (default 512)

    // Event Handling
    http_event_handle_cb event_handler; // Event callback function
    void *user_data;                    // User context pointer

    // Advanced
    bool is_async;                      // Non-blocking mode (HTTPS only)
    bool keep_alive_enable;             // TCP keepalive
    int keep_alive_idle;                // Keepalive idle time (seconds)
    int keep_alive_interval;            // Keepalive interval (seconds)
    int keep_alive_count;               // Keepalive probe count

} esp_http_client_config_t;
```

### HTTPS with Certificate Bundle (RECOMMENDED)

```c
#include "esp_http_client.h"
#include "esp_crt_bundle.h"

static void https_rest_request(void) {
    esp_http_client_config_t config = {
        .url = "https://api.example.com/v1/devices/status",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,  // Mozilla CA bundle
        .event_handler = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    // Add authentication token header
    esp_http_client_set_header(client, "Authorization", "Bearer YOUR_TOKEN");
    esp_http_client_set_header(client, "Content-Type", "application/json");

    // Set POST data
    const char *post_data = "{\"status\":\"online\",\"uptime\":12345}";
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    // Execute request
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTPS Status = %d", status_code);
    } else {
        ESP_LOGE(TAG, "HTTPS request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
}
```

### Authentication Token in Header

```c
// Method 1: Set header directly
esp_http_client_set_header(client, "Authorization", "Bearer abc123xyz");

// Method 2: Configure in initialization
char auth_header[128];
snprintf(auth_header, sizeof(auth_header), "Bearer %s", auth_token);
esp_http_client_set_header(client, "Authorization", auth_header);
```

### Event Handler Pattern

```c
esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    static char *output_buffer = NULL;
    static int output_len = 0;

    switch(evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGE(TAG, "HTTP_EVENT_ERROR");
            break;

        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGI(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;

        case HTTP_EVENT_HEADERS_SENT:
            ESP_LOGI(TAG, "HTTP_EVENT_HEADERS_SENT");
            break;

        case HTTP_EVENT_ON_HEADER:
            ESP_LOGI(TAG, "Header: %s: %s", evt->header_key, evt->header_value);
            break;

        case HTTP_EVENT_ON_DATA:
            // Accumulate response data
            if (!esp_http_client_is_chunked_response(evt->client)) {
                if (output_buffer == NULL) {
                    output_buffer = malloc(esp_http_client_get_content_length(evt->client));
                    output_len = 0;
                }
                memcpy(output_buffer + output_len, evt->data, evt->data_len);
                output_len += evt->data_len;
            }
            break;

        case HTTP_EVENT_ON_FINISH:
            ESP_LOGI(TAG, "HTTP_EVENT_ON_FINISH");
            if (output_buffer != NULL) {
                // Process complete response
                ESP_LOGI(TAG, "Response: %.*s", output_len, output_buffer);
                free(output_buffer);
                output_buffer = NULL;
            }
            output_len = 0;
            break;

        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGI(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
    }
    return ESP_OK;
}
```

### Error Codes
- `ESP_OK` - Success
- `ESP_ERR_HTTP_CONNECT` - Connection failed
- `ESP_ERR_HTTP_WRITE_DATA` - Failed to write data
- `ESP_ERR_HTTP_FETCH_HEADER` - Failed to fetch headers
- `ESP_ERR_HTTP_EAGAIN` - Timeout (async mode)
- `ESP_ERR_HTTP_CONNECTION_CLOSED` - Connection closed by server

### Best Practices for IoT Control System

1. **Always use HTTPS with certificate verification** - Use `crt_bundle_attach` for production
2. **Set reasonable timeouts** - 10-30 seconds for cloud API calls
3. **Implement retry logic** - Handle transient network failures
4. **Use persistent connections** - Reuse same client handle for multiple requests
5. **Monitor content length** - Validate complete response received
6. **Free resources** - Always call `esp_http_client_cleanup()`

### Configuration Requirements (menuconfig)
```
Component config → ESP HTTP client → Enable HTTPS (CONFIG_ESP_HTTP_CLIENT_ENABLE_HTTPS)
Component config → mbedTLS → Certificate Bundle → Enable (CONFIG_MBEDTLS_CERTIFICATE_BUNDLE)
```

---

## 2. ESP-TLS (TLS/SSL Support)

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_tls.html
- **Security Overview:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/security.html
- **Header File:** `esp-tls/esp_tls.h`

### Purpose
Provides TLS/SSL abstraction layer for secure communications, integrated with ESP HTTP Client for HTTPS connections.

### Key Features
- TLS 1.2 and TLS 1.3 support
- Server certificate verification
- Client certificate authentication (mutual TLS)
- Pre-shared keys (PSK)
- Session resumption
- ALPN (Application-Layer Protocol Negotiation)
- SNI (Server Name Indication)

### Server Verification Methods

ESP-TLS requires ONE of the following verification methods (mandatory in ESP-IDF 5.x):

1. **CA Certificate Buffer** - Provide CA cert in PEM format
2. **Global CA Store** - Use shared CA store across connections
3. **Certificate Bundle** - Mozilla NSS root certificate bundle (RECOMMENDED)
4. **Pre-Shared Keys** - PSK-based authentication

**CRITICAL:** If no verification method is configured, TLS connection setup will return a fatal error by default. This prevents insecure connections.

### Certificate Bundle Configuration

The ESP x509 Certificate Bundle provides Mozilla's NSS root certificate store (130+ certificates) for server verification.

**Enable in menuconfig:**
```
Component config → mbedTLS → Enable mbedTLS certificate bundle
Component config → mbedTLS → Default certificate bundle → Default - Most common certificates
```

**Usage with ESP HTTP Client:**
```c
#include "esp_crt_bundle.h"

esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .crt_bundle_attach = esp_crt_bundle_attach,
};
```

### Custom CA Certificate

```c
extern const char server_root_cert_pem_start[] asm("_binary_server_cert_pem_start");

esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .cert_pem = server_root_cert_pem_start,
};
```

Embed certificate in firmware:
```cmake
# CMakeLists.txt
target_add_binary_data(app_name.elf "certs/server_cert.pem" TEXT)
```

### TLS Version Selection

```c
esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .tls_version = ESP_HTTP_CLIENT_TLS_VER_TLS_1_2,  // Force TLS 1.2
    .crt_bundle_attach = esp_crt_bundle_attach,
};
```

Options:
- `ESP_HTTP_CLIENT_TLS_VER_ANY` - Negotiate highest version
- `ESP_HTTP_CLIENT_TLS_VER_TLS_1_2` - TLS 1.2 only
- `ESP_HTTP_CLIENT_TLS_VER_TLS_1_3` - TLS 1.3 only

### Time Synchronization Requirement

**IMPORTANT:** Certificate validation requires accurate system time. Enable SNTP before making HTTPS connections.

```
Component config → mbedTLS → Enable use of time/date → Enable
```

### Security Best Practices

1. **Always verify server certificates** - Use certificate bundle or custom CA
2. **Keep certificates updated** - Bundle updates via OTA firmware updates
3. **Use TLS 1.2 minimum** - TLS 1.0/1.1 are deprecated
4. **Enable SNTP time sync** - Required for certificate expiration validation
5. **Avoid `skip_cert_common_name_check`** - Only for testing, never production

---

## 3. cJSON (JSON Parsing)

### Official Documentation
- **GitHub README:** https://github.com/espressif/esp-idf/blob/master/components/json/README
- **Component Path:** `components/json/`
- **Header File:** `cJSON/cJSON.h`

### Purpose
Lightweight JSON parser and generator for handling API request/response payloads.

### Key Features
- Parse JSON strings to C structures
- Generate JSON strings from C structures
- Support for objects, arrays, strings, numbers, booleans, null
- Single-file implementation
- Minimal memory footprint

### Core API Functions

#### Parsing
```c
cJSON *cJSON_Parse(const char *value);
void cJSON_Delete(cJSON *item);
```

#### Object Access
```c
cJSON *cJSON_GetObjectItem(const cJSON *object, const char *string);
char *cJSON_GetStringValue(const cJSON *item);
double cJSON_GetNumberValue(const cJSON *item);
```

#### Type Checking
```c
cJSON_bool cJSON_IsObject(const cJSON *item);
cJSON_bool cJSON_IsString(const cJSON *item);
cJSON_bool cJSON_IsNumber(const cJSON *item);
cJSON_bool cJSON_IsBool(const cJSON *item);
```

#### Creating JSON
```c
cJSON *cJSON_CreateObject(void);
cJSON *cJSON_CreateArray(void);
cJSON *cJSON_CreateString(const char *string);
cJSON *cJSON_CreateNumber(double num);
cJSON *cJSON_CreateBool(cJSON_bool boolean);

void cJSON_AddItemToObject(cJSON *object, const char *string, cJSON *item);
void cJSON_AddItemToArray(cJSON *array, cJSON *item);
```

#### Serialization
```c
char *cJSON_Print(const cJSON *item);          // Formatted output
char *cJSON_PrintUnformatted(const cJSON *item); // Compact output
void cJSON_free(void *object);                 // Free printed string
```

### Example: Parsing API Response

```c
#include "cJSON.h"

void parse_api_response(const char *json_string) {
    cJSON *root = cJSON_Parse(json_string);

    if (root == NULL) {
        const char *error_ptr = cJSON_GetErrorPtr();
        ESP_LOGE(TAG, "JSON parse error before: %s", error_ptr);
        return;
    }

    // Extract values
    cJSON *command = cJSON_GetObjectItem(root, "command");
    if (cJSON_IsString(command)) {
        ESP_LOGI(TAG, "Command: %s", cJSON_GetStringValue(command));
    }

    cJSON *timeout = cJSON_GetObjectItem(root, "timeout");
    if (cJSON_IsNumber(timeout)) {
        int timeout_sec = (int)cJSON_GetNumberValue(timeout);
        ESP_LOGI(TAG, "Timeout: %d seconds", timeout_sec);
    }

    cJSON *enabled = cJSON_GetObjectItem(root, "shutdown_allowed");
    if (cJSON_IsBool(enabled)) {
        bool is_enabled = cJSON_IsTrue(enabled);
        ESP_LOGI(TAG, "Shutdown allowed: %s", is_enabled ? "true" : "false");
    }

    cJSON_Delete(root);  // CRITICAL: Free memory
}
```

### Example: Creating API Request

```c
char* create_status_request(int uptime, const char *state, int rssi) {
    cJSON *root = cJSON_CreateObject();

    cJSON_AddStringToObject(root, "device_id", "esp32-001");
    cJSON_AddNumberToObject(root, "uptime", uptime);
    cJSON_AddStringToObject(root, "state", state);
    cJSON_AddNumberToObject(root, "rssi", rssi);

    // Nested object
    cJSON *location = cJSON_CreateObject();
    cJSON_AddStringToObject(location, "bunker_id", "bunker-1");
    cJSON_AddNumberToObject(location, "fan_position", 1);
    cJSON_AddItemToObject(root, "location", location);

    // Convert to string (caller must free)
    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    return json_string;  // Remember to cJSON_free(json_string) after use
}
```

### Memory Management Best Practices

1. **Always delete parsed JSON** - Call `cJSON_Delete(root)` after parsing
2. **Free printed strings** - Use `cJSON_free()` not stdlib `free()`
3. **Check for NULL** - Parsing can fail on malformed JSON
4. **Limit buffer sizes** - Allocate sufficient space for JSON strings

### Error Handling

```c
cJSON *root = cJSON_Parse(json_string);
if (root == NULL) {
    const char *error_ptr = cJSON_GetErrorPtr();
    if (error_ptr != NULL) {
        ESP_LOGE(TAG, "Error before: %s", error_ptr);
    }
    return;
}
```

### Configuration Requirements
No special menuconfig required - included by default in ESP-IDF.

---

## 4. NVS (Non-Volatile Storage)

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_flash.html
- **Header File:** `nvs_flash/include/nvs_flash.h`, `nvs.h`

### Purpose
Store key-value pairs in flash memory for persistent data (WiFi credentials, authentication tokens, device configuration).

### Key Features
- Key-value pair storage in flash
- Wear leveling by design
- Namespace support for organization
- Type-safe APIs (string, integer, blob)
- Encryption support (tied to flash encryption)
- Atomic operations with commit

### Core API Functions

#### Initialization
```c
esp_err_t nvs_flash_init(void);
esp_err_t nvs_flash_erase(void);
```

#### Handle Management
```c
esp_err_t nvs_open(const char *namespace, nvs_open_mode_t open_mode, nvs_handle_t *out_handle);
void nvs_close(nvs_handle_t handle);
esp_err_t nvs_commit(nvs_handle_t handle);
```

#### String Operations
```c
esp_err_t nvs_set_str(nvs_handle_t handle, const char *key, const char *value);
esp_err_t nvs_get_str(nvs_handle_t handle, const char *key, char *out_value, size_t *length);
```

#### Integer Operations
```c
esp_err_t nvs_set_i32(nvs_handle_t handle, const char *key, int32_t value);
esp_err_t nvs_get_i32(nvs_handle_t handle, const char *key, int32_t *out_value);
esp_err_t nvs_set_u32(nvs_handle_t handle, const char *key, uint32_t value);
esp_err_t nvs_get_u32(nvs_handle_t handle, const char *key, uint32_t *out_value);
```

#### Blob Operations
```c
esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *value, size_t length);
esp_err_t nvs_get_blob(nvs_handle_t handle, const char *key, void *out_value, size_t *length);
```

#### Key Management
```c
esp_err_t nvs_erase_key(nvs_handle_t handle, const char *key);
esp_err_t nvs_erase_all(nvs_handle_t handle);
```

### String Storage Limits
- Maximum string length: **4000 bytes** (including null terminator)
- Strings must be null-terminated
- Storage requires contiguous space in same NVS page

### Example: Store WiFi Credentials

```c
#include "nvs_flash.h"
#include "nvs.h"

esp_err_t save_wifi_credentials(const char *ssid, const char *password) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    // Open NVS namespace
    err = nvs_open("wifi_config", NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error opening NVS: %s", esp_err_to_name(err));
        return err;
    }

    // Write SSID
    err = nvs_set_str(nvs_handle, "ssid", ssid);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write SSID: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Write password
    err = nvs_set_str(nvs_handle, "password", password);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write password: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Commit changes to flash
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit: %s", esp_err_to_name(err));
    }

    nvs_close(nvs_handle);
    return err;
}
```

### Example: Retrieve WiFi Credentials

```c
esp_err_t load_wifi_credentials(char *ssid, size_t ssid_len,
                                 char *password, size_t pass_len) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("wifi_config", NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    // Read SSID
    size_t required_size = ssid_len;
    err = nvs_get_str(nvs_handle, "ssid", ssid, &required_size);
    if (err != ESP_OK) {
        nvs_close(nvs_handle);
        return err;
    }

    // Read password
    required_size = pass_len;
    err = nvs_get_str(nvs_handle, "password", password, &required_size);

    nvs_close(nvs_handle);
    return err;
}
```

### Example: Store Authentication Token

```c
esp_err_t save_auth_token(const char *token) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("device_config", NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) return err;

    err = nvs_set_str(nvs_handle, "auth_token", token);
    if (err == ESP_OK) {
        err = nvs_commit(nvs_handle);
    }

    nvs_close(nvs_handle);
    return err;
}

esp_err_t load_auth_token(char *token, size_t token_len) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("device_config", NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) return err;

    size_t required_size = token_len;
    err = nvs_get_str(nvs_handle, "auth_token", token, &required_size);

    nvs_close(nvs_handle);
    return err;
}
```

### Error Codes
- `ESP_OK` - Success
- `ESP_ERR_NVS_NOT_FOUND` - Key doesn't exist
- `ESP_ERR_NVS_NOT_ENOUGH_SPACE` - Insufficient storage
- `ESP_ERR_NVS_INVALID_LENGTH` - Buffer too small
- `ESP_ERR_NVS_VALUE_TOO_LONG` - String exceeds 4000 bytes
- `ESP_ERR_NVS_READ_ONLY` - Attempt to write to read-only handle

### RAM Usage Estimation
- Each 1 MB of NVS partition: **22 KB RAM**
- Each 1000 keys: **5.5 KB RAM**

### Best Practices

1. **Use namespaces** - Organize credentials by component ("wifi_config", "device_config")
2. **Always commit** - Changes aren't persisted until `nvs_commit()`
3. **Close handles** - Free resources with `nvs_close()`
4. **Handle errors** - Check for `ESP_ERR_NVS_NOT_FOUND` on first boot
5. **Query size first** - Call with NULL buffer to get required length
6. **Enable encryption** - Use NVS encryption for sensitive credentials
7. **Avoid large blobs** - Use FAT filesystem for data >4KB

### Initialization in app_main()

```c
void app_main(void) {
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Continue with application...
}
```

---

## 5. Watchdog Timers

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/wdts.html
- **Header Files:** `esp_task_wdt.h`, `esp_int_wdt.h`

### Purpose
Monitor task execution and interrupt handling to detect software hangs and trigger system recovery or panic.

### Watchdog Types

ESP32 provides three watchdog mechanisms:

1. **Hardware Watchdog Timer** - Low-level hardware timer (automatically configured)
2. **Interrupt Watchdog Timer (IWDT)** - Monitors interrupt handlers and task switching
3. **Task Watchdog Timer (TWDT)** - Monitors task execution and idle tasks

### Task Watchdog Timer (TWDT)

The TWDT monitors tasks to ensure they execute periodically without blocking. Critical for fail-safe operation.

#### Core API Functions

```c
// Initialization
esp_err_t esp_task_wdt_init(const esp_task_wdt_config_t *config);
esp_err_t esp_task_wdt_reconfigure(const esp_task_wdt_config_t *config);
esp_err_t esp_task_wdt_deinit(void);

// Task Subscription
esp_err_t esp_task_wdt_add(TaskHandle_t handle);
esp_err_t esp_task_wdt_delete(TaskHandle_t handle);
esp_err_t esp_task_wdt_reset(void);

// User-Level Monitoring
esp_err_t esp_task_wdt_add_user(const char *name, esp_task_wdt_user_handle_t *handle_ret);
esp_err_t esp_task_wdt_reset_user(esp_task_wdt_user_handle_t handle);
esp_err_t esp_task_wdt_delete_user(esp_task_wdt_user_handle_t handle);
```

#### Configuration Structure

```c
typedef struct {
    uint32_t timeout_ms;        // Watchdog timeout in milliseconds
    bool trigger_panic;         // Trigger panic on timeout (vs. print warning)
} esp_task_wdt_config_t;
```

### Example: Initialize and Use TWDT

```c
#include "esp_task_wdt.h"

#define TWDT_TIMEOUT_S 10  // 10 second timeout

void init_watchdog(void) {
    esp_task_wdt_config_t twdt_config = {
        .timeout_ms = TWDT_TIMEOUT_S * 1000,
        .trigger_panic = true,  // Trigger panic on timeout for fail-safe
    };

    ESP_ERROR_CHECK(esp_task_wdt_init(&twdt_config));
    ESP_LOGI(TAG, "Task watchdog initialized with %d second timeout", TWDT_TIMEOUT_S);
}

void monitor_task(void *pvParameters) {
    // Subscribe this task to watchdog
    ESP_ERROR_CHECK(esp_task_wdt_add(NULL));  // NULL = current task

    while (1) {
        // Do work...
        perform_critical_operations();

        // Reset watchdog to indicate task is alive
        esp_task_wdt_reset();

        vTaskDelay(pdMS_TO_TICKS(5000));  // 5 second delay
    }

    // Unsubscribe before task exits
    esp_task_wdt_delete(NULL);
}
```

### Example: User-Level Watchdog for Code Sections

```c
void complex_operation_with_watchdog(void) {
    esp_task_wdt_user_handle_t wdt_user_handle;

    // Subscribe code section to watchdog
    ESP_ERROR_CHECK(esp_task_wdt_add_user("complex_op", &wdt_user_handle));

    // Phase 1: Network request
    make_http_request();
    esp_task_wdt_reset_user(wdt_user_handle);

    // Phase 2: Data processing
    process_response_data();
    esp_task_wdt_reset_user(wdt_user_handle);

    // Phase 3: Update state
    update_system_state();
    esp_task_wdt_reset_user(wdt_user_handle);

    // Unsubscribe when done
    ESP_ERROR_CHECK(esp_task_wdt_delete_user(wdt_user_handle));
}
```

### Interrupt Watchdog Timer (IWDT)

Monitors interrupt handlers to detect if task switching is blocked. Automatically enabled in ESP-IDF.

**Configuration (menuconfig):**
```
Component config → ESP System Settings → Interrupt watchdog timeout (ms)
```

### Configuration Options (menuconfig)

```
Component config → ESP System Settings:
  - Initialize Task Watchdog Timer on startup (CONFIG_ESP_TASK_WDT_INIT)
  - Task Watchdog timeout period (seconds) (CONFIG_ESP_TASK_WDT_TIMEOUT_S)
  - Watch CPU0 Idle Task (CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU0)
  - Watch CPU1 Idle Task (CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU1)
  - Invoke panic handler on Task Watchdog timeout (CONFIG_ESP_TASK_WDT_PANIC)

  - Interrupt watchdog timeout (ms) (CONFIG_ESP_INT_WDT_TIMEOUT_MS)
```

### Best Practices for Safety-Critical Applications

1. **Enable panic on timeout** - Set `trigger_panic = true` for fail-safe behavior
2. **Set appropriate timeout** - Long enough for normal operation, short enough to detect hangs
3. **Reset periodically** - Call `esp_task_wdt_reset()` in all monitored tasks
4. **Monitor critical tasks** - Subscribe all safety-critical tasks to TWDT
5. **Keep ISRs short** - Interrupt watchdog triggers if ISRs block task switching
6. **Increase timeout before flash ops** - Large flash erases can exceed normal timeout
7. **Use user handles** - Monitor specific code sections with user-level watchdog

### Debugging Notes

- **JTAG/OpenOCD** automatically disables hardware watchdog during debugging
- **Print warnings** - Set `trigger_panic = false` for development to log instead of panic
- **Watchdog dumps** - ESP-IDF logs which tasks failed to reset watchdog

### Integration with Dead-Man Timer

The hardware watchdog provides an additional fail-safe layer:

```c
// Software timer triggers relay ON after 5 minutes
// Hardware watchdog resets system after 10 seconds of no task activity
// Combined: ensures system recovery even if software timer fails
```

---

## 6. WiFi Provisioning Manager

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html
- **Header File:** `wifi_provisioning/manager.h`

### Purpose
Provides APIs for provisioning WiFi credentials to ESP32 devices via SoftAP or BLE transport.

### Key Features
- SoftAP (Access Point) transport
- BLE GATT server transport
- Security modes: Security 0 (plaintext), Security 1 (X25519 + AES-CTR), Security 2 (SRP6a + AES-GCM)
- Unified provisioning manager API
- Event-driven workflow
- Custom endpoint support

### Important Note: Captive Portal

**The official WiFi provisioning manager does NOT include built-in captive portal functionality.** For captive portal support, you will need:

1. Use community components from ESP Component Registry:
   - `achimpieters/esp32-captive_portal` (v1.0.4)

2. Implement custom DNS/HTTP server on top of SoftAP provisioning

3. Use AT command framework (for AT-based applications)

### Core API Functions

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

### SoftAP Scheme Configuration

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

### Provisioning Events

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

### Security Modes

1. **Security 0 (WIFI_PROV_SECURITY_0)** - Plaintext (development only)
2. **Security 1 (WIFI_PROV_SECURITY_1)** - X25519 key exchange + AES-CTR encryption
3. **Security 2 (WIFI_PROV_SECURITY_2)** - SRP6a authentication + AES-GCM encryption (recommended)

### mDNS Service Discovery

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

### Captive Portal Alternative (Community Component)

For captive portal functionality, consider the `esp32-captive_portal` component:

```yaml
# idf_component.yml
dependencies:
  achimpieters/esp32-captive_portal:
    version: "^1.0.4"
```

Features:
- DNS hijacking for captive portal
- WiFi configuration web interface
- Network scanning
- mDNS support

### Best Practices

1. **Use Security 2** - Strongest security for production
2. **Implement provisioning reset** - Allow users to re-provision via button press
3. **Store provisioned flag** - Use NVS to track provisioning state
4. **Timeout provisioning** - Auto-stop after time limit to save power
5. **LED indicators** - Visual feedback during provisioning process

### Example: Complete Provisioning Flow

```c
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data);
static void prov_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data);

void init_wifi_provisioning(void) {
    // Initialize WiFi
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    // Register event handlers
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID,
                                               &prov_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                               &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                               &wifi_event_handler, NULL));

    // Initialize provisioning manager
    wifi_prov_mgr_config_t config = {
        .scheme = wifi_prov_scheme_softap,
        .scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE
    };
    ESP_ERROR_CHECK(wifi_prov_mgr_init(config));

    // Check provisioning state
    bool provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&provisioned));

    if (!provisioned) {
        // Start provisioning
        char service_name[32];
        snprintf(service_name, sizeof(service_name), "PROV_%s", get_device_id());

        ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
            WIFI_PROV_SECURITY_1,
            "abcd1234",      // Proof of possession
            service_name,
            "provision123"   // SoftAP password
        ));
    } else {
        // Already provisioned, connect to WiFi
        ESP_LOGI(TAG, "Already provisioned, starting WiFi");
        wifi_prov_mgr_deinit();
        esp_wifi_set_mode(WIFI_MODE_STA);
        esp_wifi_start();
    }
}
```

### Configuration Requirements (menuconfig)

No specific menuconfig required - WiFi provisioning is included by default.

---

## 7. SNTP (Time Synchronization)

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/system_time.html
- **Example:** `examples/protocols/sntp/`
- **Header File:** `esp_sntp.h`

### Purpose
Synchronize system time with NTP servers for accurate timekeeping, required for TLS certificate validation and timer management.

### Key Features
- SNTP client for time synchronization
- Multiple NTP server support
- Automatic periodic updates
- Smooth or immediate time adjustment
- Sync notification callbacks
- 64-bit time_t (valid until 2104)

### Core API Functions

```c
// Initialization (modern thread-safe API)
esp_err_t esp_netif_sntp_init(const esp_sntp_config_t *config);
esp_err_t esp_netif_sntp_deinit(void);

// Synchronization
esp_err_t esp_netif_sntp_sync_wait(TickType_t timeout_ticks);
esp_sntp_sync_status_t esp_netif_sntp_get_sync_status(void);

// Legacy lwIP API (not thread-safe)
void esp_sntp_setoperatingmode(esp_sntp_operatingmode_t operating_mode);
void esp_sntp_setservername(uint8_t idx, const char *server);
void esp_sntp_init(void);
void esp_sntp_stop(void);
```

### Synchronization Modes

1. **Immediate Mode (SNTP_SYNC_MODE_IMMED)** - Default, updates time instantly via `settimeofday()`
2. **Smooth Mode (SNTP_SYNC_MODE_SMOOTH)** - Gradual adjustment via `adjtime()`, switches to immediate if difference >35 minutes

### Example: Initialize SNTP

```c
#include "esp_sntp.h"
#include "esp_netif_sntp.h"

void time_sync_notification_cb(struct timeval *tv) {
    ESP_LOGI(TAG, "Time synchronized with NTP server");
}

void initialize_sntp(void) {
    ESP_LOGI(TAG, "Initializing SNTP");

    // Modern thread-safe API (ESP-IDF 5.x)
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    config.sync_cb = time_sync_notification_cb;  // Notification callback
    config.smooth_sync = false;  // Use immediate mode

    esp_netif_sntp_init(&config);

    ESP_LOGI(TAG, "Waiting for system time to be set...");
}
```

### Example: Wait for Time Sync

```c
void wait_for_time_sync(void) {
    // Wait up to 10 seconds for time synchronization
    if (esp_netif_sntp_sync_wait(pdMS_TO_TICKS(10000)) != ESP_OK) {
        ESP_LOGW(TAG, "Failed to sync time within 10 seconds");
    } else {
        time_t now = 0;
        struct tm timeinfo = {0};
        time(&now);
        localtime_r(&now, &timeinfo);

        char strftime_buf[64];
        strftime(strftime_buf, sizeof(strftime_buf), "%c", &timeinfo);
        ESP_LOGI(TAG, "Current time: %s", strftime_buf);
    }
}
```

### Example: Legacy lwIP API

```c
void initialize_sntp_legacy(void) {
    ESP_LOGI(TAG, "Initializing SNTP (legacy API)");

    esp_sntp_setoperatingmode(ESP_SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_setservername(1, "time.nist.gov");

    // Set callback
    sntp_set_time_sync_notification_cb(time_sync_notification_cb);

    esp_sntp_init();
}
```

### Multiple NTP Servers

```c
esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG_MULTIPLE(2,
    ESP_SNTP_SERVER_LIST("pool.ntp.org", "time.google.com")
);
esp_netif_sntp_init(&config);
```

### Sync Status Checking

```c
esp_sntp_sync_status_t status = esp_netif_sntp_get_sync_status();

switch (status) {
    case SNTP_SYNC_STATUS_RESET:
        ESP_LOGI(TAG, "SNTP not initialized");
        break;
    case SNTP_SYNC_STATUS_COMPLETED:
        ESP_LOGI(TAG, "Time synchronized");
        break;
    case SNTP_SYNC_STATUS_IN_PROGRESS:
        ESP_LOGI(TAG, "Time sync in progress");
        break;
}
```

### Configuration Options

#### Update Interval
```
Component config → LWIP → SNTP → Request interval to update time (ms)
Default: 3600000 (1 hour)
```

#### Smooth Sync
Enable smooth time adjustment in config:
```c
config.smooth_sync = true;
```

### Integration with Dead-Man Timer

SNTP time synchronization is critical for accurate timer management:

```c
void app_main(void) {
    // 1. Initialize WiFi and connect
    init_wifi();

    // 2. Initialize SNTP (requires WiFi connection)
    initialize_sntp();
    wait_for_time_sync();

    // 3. Now safe to use timers with accurate time
    init_deadman_timer();
}
```

### Timezone Configuration

```c
#include <time.h>

void set_timezone(void) {
    // Set timezone to Central Time (US)
    setenv("TZ", "CST6CDT,M3.2.0,M11.1.0", 1);
    tzset();

    // Or UTC
    setenv("TZ", "UTC0", 1);
    tzset();
}
```

### Best Practices

1. **Initialize after WiFi** - SNTP requires network connectivity
2. **Wait for first sync** - Use `esp_netif_sntp_sync_wait()` before critical operations
3. **Use multiple servers** - Redundancy for reliability
4. **Enable sync callback** - Monitor sync events
5. **Set timezone** - Configure local timezone if needed
6. **Check sync status** - Verify time is valid before TLS connections
7. **Minimum update interval** - Per RFC 4330, use ≥15 seconds

### Time Overflow Considerations

ESP-IDF 5.x uses 64-bit `time_t`:
- Valid range: 1970 to ~2104
- No Y2K38 problem
- SNTP/NTP timestamps follow RFC 2030 conventions

### Configuration Requirements (menuconfig)

```
Component config → LWIP:
  - Enable SNTP
  - Request interval to update time (ms): 3600000

Component config → mbedTLS:
  - Enable use of time/date (required for TLS certificate validation)
```

---

## 8. ESP Timer (Software Timers)

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_timer.html
- **Header File:** `esp_timer.h`

### Purpose
High-resolution software timers with microsecond precision for delayed and periodic actions, including dead-man countdown timer implementation.

### Key Features
- Microsecond resolution timers
- One-shot and periodic timer modes
- Task or ISR dispatch methods
- Callback-based execution
- Light sleep integration
- Automatic clock frequency adjustment

### Timer Types

1. **One-shot timers** - Execute callback once upon expiration, then stop
2. **Periodic timers** - Automatically restart after each expiration until manually stopped

### Dispatch Methods

1. **ESP_TIMER_TASK** (default) - Callbacks dispatched from high-priority ESP Timer task
   - Serialize callback execution
   - Safe for non-time-critical operations
   - Can use blocking operations

2. **ESP_TIMER_ISR** - Callbacks executed directly from interrupt handler
   - Lower latency (~microseconds)
   - Must be non-blocking, no printf, no malloc
   - Use for time-critical operations only

### Core API Functions

```c
// Timer Lifecycle
esp_err_t esp_timer_create(const esp_timer_create_args_t *args, esp_timer_handle_t *out_handle);
esp_err_t esp_timer_start_once(esp_timer_handle_t timer, uint64_t timeout_us);
esp_err_t esp_timer_start_periodic(esp_timer_handle_t timer, uint64_t period_us);
esp_err_t esp_timer_stop(esp_timer_handle_t timer);
esp_err_t esp_timer_restart(esp_timer_handle_t timer, uint64_t timeout_us);
esp_err_t esp_timer_delete(esp_timer_handle_t timer);

// Timer Inspection
bool esp_timer_is_active(esp_timer_handle_t timer);
uint64_t esp_timer_get_period(esp_timer_handle_t timer);
uint64_t esp_timer_get_expiry_time(esp_timer_handle_t timer);

// Time Acquisition
int64_t esp_timer_get_time(void);  // Microseconds since initialization
int64_t esp_timer_get_next_alarm(void);

// Debugging
esp_err_t esp_timer_dump(FILE *stream);
```

### Configuration Structure

```c
typedef struct {
    esp_timer_cb_t callback;           // Timer callback function
    void *arg;                         // Argument passed to callback
    esp_timer_dispatch_t dispatch_method;  // ESP_TIMER_TASK or ESP_TIMER_ISR
    const char *name;                  // Timer name for debugging
    bool skip_unhandled_events;        // Skip missed events (periodic only)
} esp_timer_create_args_t;
```

### Example: Dead-Man Countdown Timer (5 Minutes)

```c
#include "esp_timer.h"

#define DEADMAN_TIMEOUT_US (5 * 60 * 1000000ULL)  // 5 minutes in microseconds

static esp_timer_handle_t deadman_timer;
static bool shutdown_allowed = false;

// Callback executed when timer expires
static void deadman_timeout_callback(void *arg) {
    ESP_LOGW(TAG, "Dead-man timer expired! Activating fail-safe: FANS ON");

    // Turn fans ON (relay to ON state)
    gpio_set_level(RELAY_GPIO, RELAY_ON);
    shutdown_allowed = false;

    // Optional: trigger system recovery
}

void init_deadman_timer(void) {
    const esp_timer_create_args_t timer_args = {
        .callback = &deadman_timeout_callback,
        .arg = NULL,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "deadman_timer",
        .skip_unhandled_events = false
    };

    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &deadman_timer));
    ESP_LOGI(TAG, "Dead-man timer created (5 minute timeout)");
}

// Reset timer when "shutdown allowed" command received from server
void reset_deadman_timer(void) {
    if (esp_timer_is_active(deadman_timer)) {
        ESP_ERROR_CHECK(esp_timer_restart(deadman_timer, DEADMAN_TIMEOUT_US));
    } else {
        ESP_ERROR_CHECK(esp_timer_start_once(deadman_timer, DEADMAN_TIMEOUT_US));
    }

    shutdown_allowed = true;
    ESP_LOGI(TAG, "Dead-man timer reset - shutdown allowed for 5 minutes");
}

// Stop timer and activate fail-safe
void stop_deadman_timer(void) {
    if (esp_timer_is_active(deadman_timer)) {
        ESP_ERROR_CHECK(esp_timer_stop(deadman_timer));
    }

    // Activate fail-safe: fans ON
    gpio_set_level(RELAY_GPIO, RELAY_ON);
    shutdown_allowed = false;

    ESP_LOGI(TAG, "Dead-man timer stopped - fail-safe activated");
}
```

### Example: Periodic Status Report Timer

```c
#define STATUS_REPORT_INTERVAL_US (60 * 1000000ULL)  // 1 minute

static esp_timer_handle_t status_timer;

static void status_report_callback(void *arg) {
    ESP_LOGI(TAG, "Sending periodic status report to server");
    send_status_to_server();
}

void init_status_timer(void) {
    const esp_timer_create_args_t timer_args = {
        .callback = &status_report_callback,
        .name = "status_timer",
        .dispatch_method = ESP_TIMER_TASK
    };

    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &status_timer));
    ESP_ERROR_CHECK(esp_timer_start_periodic(status_timer, STATUS_REPORT_INTERVAL_US));

    ESP_LOGI(TAG, "Status report timer started (1 minute interval)");
}
```

### Accuracy Characteristics

**Minimum practical timeouts (ESP32 @ 240 MHz):**
- One-shot timers: ~20 microseconds
- Periodic timers: ~50 microseconds

Lower CPU frequencies increase minimum timeouts. For sub-microsecond precision, use hardware timers (GPTimer, RMT).

### Timer Precision

```c
// Get current time in microseconds
int64_t start_time = esp_timer_get_time();

// ... perform operation ...

int64_t end_time = esp_timer_get_time();
int64_t elapsed_us = end_time - start_time;

ESP_LOGI(TAG, "Operation took %lld microseconds", elapsed_us);
```

### Light Sleep Integration

During light sleep:
- ESP Timer suspends operation
- RTC tracks elapsed time
- On wakeup, counter advances automatically
- Missed callbacks execute immediately

For periodic timers, enable `skip_unhandled_events` to retain only one callback:

```c
esp_timer_create_args_t timer_args = {
    .callback = callback_func,
    .skip_unhandled_events = true,  // Skip missed events during sleep
};
```

### Debugging

Enable profiling in menuconfig:
```
Component config → ESP Timer → Enable esp_timer profiling features
```

Print timer statistics:
```c
#include <stdio.h>

esp_timer_dump(stdout);  // Prints all active timers with stats
```

Output example:
```
timer         period      alarm       times_armed times_triggered times_skipped
deadman_timer 5000000     1234567890  10          9               0
status_timer  60000000    1234560000  50          50              0
```

### Best Practices

1. **Use task dispatch for most cases** - ISR dispatch only when necessary
2. **Keep callbacks short** - Offload work to tasks via queues
3. **Check timer state** - Use `esp_timer_is_active()` before stop/restart
4. **Handle expiration properly** - Implement fail-safe logic in callbacks
5. **Monitor timer drift** - Use profiling for time-critical applications
6. **Stop timers before delete** - Ensure timer is stopped before deletion
7. **Use descriptive names** - Helps debugging with `esp_timer_dump()`

### Integration Example: Complete Dead-Man System

```c
typedef enum {
    STATE_FANS_ON,
    STATE_FANS_OFF_ALLOWED,
    STATE_FANS_OFF_ACTIVE
} system_state_t;

static system_state_t current_state = STATE_FANS_ON;
static esp_timer_handle_t deadman_timer;

void deadman_expired_callback(void *arg) {
    ESP_LOGW(TAG, "Dead-man timer expired - activating fail-safe");
    activate_failsafe();
}

void activate_failsafe(void) {
    current_state = STATE_FANS_ON;
    gpio_set_level(RELAY_GPIO, RELAY_ON);  // Fans ON
    shutdown_allowed = false;
}

void handle_shutdown_allowed_command(void) {
    // Reset 5-minute countdown timer
    if (esp_timer_is_active(deadman_timer)) {
        esp_timer_restart(deadman_timer, DEADMAN_TIMEOUT_US);
    } else {
        esp_timer_start_once(deadman_timer, DEADMAN_TIMEOUT_US);
    }

    current_state = STATE_FANS_OFF_ALLOWED;

    // Turn fans OFF (only if conditions permit)
    if (check_local_conditions_safe()) {
        gpio_set_level(RELAY_GPIO, RELAY_OFF);
        current_state = STATE_FANS_OFF_ACTIVE;
        ESP_LOGI(TAG, "Fans OFF - countdown active");
    }
}

void handle_connection_lost(void) {
    ESP_LOGW(TAG, "Connection lost - stopping timer and activating fail-safe");

    if (esp_timer_is_active(deadman_timer)) {
        esp_timer_stop(deadman_timer);
    }

    activate_failsafe();
}
```

---

## 9. GPIO Control

### Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html
- **Header File:** `driver/gpio.h`
- **Example:** `examples/peripherals/gpio/generic_gpio/`

### Purpose
Control GPIO pins for digital output (relay, LED) and input (buttons), with interrupt support.

### Key Features
- Digital input/output control
- Internal pull-up/pull-down resistors
- Configurable drive strength
- Edge and level interrupts
- Per-pin interrupt handlers
- Output enable/disable

### Core API Functions

#### Configuration
```c
esp_err_t gpio_config(const gpio_config_t *pGPIOConfig);
esp_err_t gpio_set_direction(gpio_num_t gpio_num, gpio_mode_t mode);
esp_err_t gpio_set_pull_mode(gpio_num_t gpio_num, gpio_pull_mode_t pull);
esp_err_t gpio_set_drive_capability(gpio_num_t gpio_num, gpio_drive_cap_t strength);
```

#### Digital I/O
```c
esp_err_t gpio_set_level(gpio_num_t gpio_num, uint32_t level);
int gpio_get_level(gpio_num_t gpio_num);
```

#### Interrupts
```c
esp_err_t gpio_set_intr_type(gpio_num_t gpio_num, gpio_int_type_t intr_type);
esp_err_t gpio_install_isr_service(int intr_alloc_flags);
esp_err_t gpio_isr_handler_add(gpio_num_t gpio_num, gpio_isr_t isr_handler, void *args);
esp_err_t gpio_isr_handler_remove(gpio_num_t gpio_num);
```

### GPIO Modes

```c
typedef enum {
    GPIO_MODE_DISABLE,           // GPIO disabled
    GPIO_MODE_INPUT,             // Input only
    GPIO_MODE_OUTPUT,            // Output only
    GPIO_MODE_OUTPUT_OD,         // Output open-drain
    GPIO_MODE_INPUT_OUTPUT_OD,   // Input/output open-drain
    GPIO_MODE_INPUT_OUTPUT       // Input/output (push-pull)
} gpio_mode_t;
```

### Pull Modes

```c
typedef enum {
    GPIO_PULLUP_ONLY,        // Pull-up enabled
    GPIO_PULLDOWN_ONLY,      // Pull-down enabled
    GPIO_PULLUP_PULLDOWN,    // Both enabled
    GPIO_FLOATING            // No pull resistors
} gpio_pull_mode_t;
```

### Drive Capability

```c
typedef enum {
    GPIO_DRIVE_CAP_0,  // Weakest (~5mA)
    GPIO_DRIVE_CAP_1,  // Stronger (~10mA)
    GPIO_DRIVE_CAP_2,  // Even stronger (~20mA)
    GPIO_DRIVE_CAP_3   // Strongest (~40mA)
} gpio_drive_cap_t;
```

### Example: Relay Control (Normally Closed)

```c
#include "driver/gpio.h"

#define RELAY_GPIO     GPIO_NUM_2
#define RELAY_ON       0  // Active LOW for normally-closed relay
#define RELAY_OFF      1  // Fans OFF when relay is de-energized

void init_relay_gpio(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << RELAY_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    ESP_ERROR_CHECK(gpio_config(&io_conf));

    // Initialize to safe state: FANS ON
    gpio_set_level(RELAY_GPIO, RELAY_ON);

    ESP_LOGI(TAG, "Relay GPIO initialized - fail-safe state (FANS ON)");
}

void set_fans_state(bool fans_on) {
    if (fans_on) {
        gpio_set_level(RELAY_GPIO, RELAY_ON);
        ESP_LOGI(TAG, "Fans turned ON");
    } else {
        gpio_set_level(RELAY_GPIO, RELAY_OFF);
        ESP_LOGI(TAG, "Fans turned OFF");
    }
}
```

### Example: LED Status Indicator

```c
#define LED_GPIO       GPIO_NUM_4
#define LED_ON         1
#define LED_OFF        0

void init_status_led(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    ESP_ERROR_CHECK(gpio_config(&io_conf));
    gpio_set_level(LED_GPIO, LED_OFF);
}

void blink_led(int count) {
    for (int i = 0; i < count; i++) {
        gpio_set_level(LED_GPIO, LED_ON);
        vTaskDelay(pdMS_TO_TICKS(200));
        gpio_set_level(LED_GPIO, LED_OFF);
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

// LED identification: flash pattern based on device ID
void flash_device_id(int device_id) {
    ESP_LOGI(TAG, "Flashing device ID: %d", device_id);

    for (int i = 0; i < device_id; i++) {
        gpio_set_level(LED_GPIO, LED_ON);
        vTaskDelay(pdMS_TO_TICKS(300));
        gpio_set_level(LED_GPIO, LED_OFF);
        vTaskDelay(pdMS_TO_TICKS(500));
    }

    vTaskDelay(pdMS_TO_TICKS(2000));  // 2 second pause between sequences
}
```

### Example: Button Input with Interrupt

```c
#define BUTTON_GPIO    GPIO_NUM_0

static QueueHandle_t gpio_evt_queue = NULL;

static void IRAM_ATTR button_isr_handler(void *arg) {
    uint32_t gpio_num = (uint32_t)arg;
    xQueueSendFromISR(gpio_evt_queue, &gpio_num, NULL);
}

void init_button_gpio(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << BUTTON_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,  // Enable internal pull-up
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_NEGEDGE  // Trigger on falling edge
    };

    ESP_ERROR_CHECK(gpio_config(&io_conf));

    // Create queue for GPIO events
    gpio_evt_queue = xQueueCreate(10, sizeof(uint32_t));

    // Install ISR service
    ESP_ERROR_CHECK(gpio_install_isr_service(0));

    // Attach interrupt handler
    ESP_ERROR_CHECK(gpio_isr_handler_add(BUTTON_GPIO, button_isr_handler,
                                         (void *)BUTTON_GPIO));
}

void button_task(void *arg) {
    uint32_t io_num;

    while (1) {
        if (xQueueReceive(gpio_evt_queue, &io_num, portMAX_DELAY)) {
            ESP_LOGI(TAG, "Button pressed on GPIO %d", io_num);

            // Debounce: wait and check state
            vTaskDelay(pdMS_TO_TICKS(50));
            if (gpio_get_level(io_num) == 0) {
                // Button still pressed - handle event
                handle_button_press();
            }
        }
    }
}
```

### Configuration Structure

```c
typedef struct {
    uint64_t pin_bit_mask;        // Bitmask of pins to configure
    gpio_mode_t mode;             // GPIO mode (input/output)
    gpio_pullup_t pull_up_en;     // Pull-up enable
    gpio_pulldown_t pull_down_en; // Pull-down enable
    gpio_int_type_t intr_type;    // Interrupt type
} gpio_config_t;
```

### Interrupt Types

```c
GPIO_INTR_DISABLE      // Disable interrupt
GPIO_INTR_POSEDGE      // Rising edge
GPIO_INTR_NEGEDGE      // Falling edge
GPIO_INTR_ANYEDGE      // Both edges
GPIO_INTR_LOW_LEVEL    // Low level
GPIO_INTR_HIGH_LEVEL   // High level
```

### Best Practices for Relay Control

1. **Fail-safe initialization** - Always initialize to safe state (FANS ON)
2. **Use normally-closed relay** - Fans ON when relay is de-energized
3. **Disable pull resistors** - For relay outputs (external driver handles logic)
4. **Set drive strength** - Adjust based on relay driver circuit
5. **Atomic state changes** - Use `gpio_set_level()` for thread-safe operation
6. **Monitor state** - Log all relay state changes for debugging

### Normally-Closed Relay Pattern

For fail-safe operation with normally-closed relays:

```c
// Relay control logic:
// - GPIO LOW (0) = Relay energized = Normally-closed contacts OPEN = Fans ON
// - GPIO HIGH (1) = Relay de-energized = Normally-closed contacts CLOSED = Fans OFF (power cut)

// Initialize to fail-safe state
gpio_set_level(RELAY_GPIO, 0);  // Fans ON by default

// Turn fans OFF only when conditions permit
if (shutdown_allowed && safe_to_shutdown()) {
    gpio_set_level(RELAY_GPIO, 1);  // Fans OFF
}

// Any failure returns to GPIO LOW or relay loses power -> Fans ON
```

### GPIO Pin Restrictions (ESP32)

- **GPIO 0** - Bootstrapping pin, pulled up, connected to boot button
- **GPIO 2** - Bootstrapping pin, connected to LED
- **GPIO 5** - Bootstrapping pin (VSPI SS)
- **GPIO 12** - Bootstrapping pin, sets flash voltage
- **GPIO 15** - Bootstrapping pin, pulled up
- **GPIO 34-39** - Input only, no pull-up/pull-down

**Recommended for relays:** GPIO 2, 4, 16, 17, 18, 19, 21, 22, 23

### ISR Considerations

For ISR callbacks:
- Mark ISR functions with `IRAM_ATTR` attribute
- Keep ISR short and non-blocking
- Use queues to communicate with tasks
- No printf, malloc, or blocking operations in ISR

---

## 10. Unit Testing Framework

### Official Documentation
- **API Guide:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html
- **Example:** `examples/system/unit_test/`
- **Framework:** Unity (not Catch)

### Purpose
Test ESP32 firmware logic on target hardware using the Unity test framework integrated with ESP-IDF.

### Key Features
- Unity test framework (C-based)
- Target-based testing on ESP32
- Linux host-based testing (with mocks)
- CMock for mocking support
- Test discovery and execution
- Serial output for results

### Unity Test Framework

ESP-IDF uses **Unity** as the official unit test framework. Unity is a lightweight C testing framework designed for embedded systems.

**Important:** ESP-IDF does NOT use Catch framework. Catch is C++ only.

### Test File Structure

Tests are placed in the `test` subdirectory of components:

```
my_component/
├── CMakeLists.txt
├── include/
│   └── my_component.h
├── my_component.c
└── test/
    ├── CMakeLists.txt
    └── test_my_component.c
```

### Example: Basic Unity Test

```c
// test/test_deadman_timer.c
#include "unity.h"
#include "esp_timer.h"
#include "deadman_timer.h"

// Setup function (runs before each test)
void setUp(void) {
    init_deadman_timer();
}

// Teardown function (runs after each test)
void tearDown(void) {
    cleanup_deadman_timer();
}

// Test case: Timer initialization
TEST_CASE("Deadman timer initializes correctly", "[deadman]") {
    // Arrange
    esp_timer_handle_t timer = get_deadman_timer_handle();

    // Assert
    TEST_ASSERT_NOT_NULL(timer);
    TEST_ASSERT_FALSE(esp_timer_is_active(timer));
}

// Test case: Timer reset
TEST_CASE("Deadman timer resets on command", "[deadman]") {
    // Arrange
    reset_deadman_timer();

    // Act
    bool is_active = esp_timer_is_active(get_deadman_timer_handle());

    // Assert
    TEST_ASSERT_TRUE(is_active);
}

// Test case: Timer expiration triggers failsafe
TEST_CASE("Deadman timer expiration activates failsafe", "[deadman]") {
    // Arrange
    reset_deadman_timer();

    // Act
    // Wait for timer expiration (or manually trigger callback)
    simulate_timer_expiration();

    // Assert
    TEST_ASSERT_EQUAL(RELAY_ON, get_relay_state());
    TEST_ASSERT_FALSE(is_shutdown_allowed());
}

// Test case: Connection loss stops timer
TEST_CASE("Connection loss stops timer and activates failsafe", "[deadman]") {
    // Arrange
    reset_deadman_timer();
    TEST_ASSERT_TRUE(esp_timer_is_active(get_deadman_timer_handle()));

    // Act
    handle_connection_lost();

    // Assert
    TEST_ASSERT_FALSE(esp_timer_is_active(get_deadman_timer_handle()));
    TEST_ASSERT_EQUAL(RELAY_ON, get_relay_state());
}
```

### Unity Assertion Macros

```c
// Boolean
TEST_ASSERT_TRUE(condition);
TEST_ASSERT_FALSE(condition);
TEST_ASSERT(condition);

// Equality
TEST_ASSERT_EQUAL(expected, actual);
TEST_ASSERT_EQUAL_INT(expected, actual);
TEST_ASSERT_EQUAL_STRING(expected, actual);
TEST_ASSERT_EQUAL_MEMORY(expected, actual, length);

// Pointers
TEST_ASSERT_NULL(pointer);
TEST_ASSERT_NOT_NULL(pointer);

// Ranges
TEST_ASSERT_LESS_THAN(threshold, actual);
TEST_ASSERT_GREATER_THAN(threshold, actual);
TEST_ASSERT_INT_WITHIN(delta, expected, actual);

// Floating Point
TEST_ASSERT_EQUAL_FLOAT(expected, actual);
TEST_ASSERT_FLOAT_WITHIN(delta, expected, actual);

// Messages
TEST_ASSERT_EQUAL_MESSAGE(expected, actual, "Custom message");
TEST_FAIL_MESSAGE("Failure message");
```

### Test Organization with Tags

```c
TEST_CASE("Fast unit test", "[unit][fast]") {
    // Fast test
}

TEST_CASE("Integration test requiring WiFi", "[integration][wifi]") {
    // Integration test
}

TEST_CASE("Slow stress test", "[stress][slow]") {
    // Stress test
}
```

Run specific tags:
```bash
idf.py test --tags="unit,fast"
```

### CMakeLists.txt for Test Component

```cmake
# test/CMakeLists.txt
idf_component_register(
    SRC_DIRS "."
    INCLUDE_DIRS "."
    REQUIRES unity my_component
)
```

### Example: Testing JSON Parsing

```c
#include "unity.h"
#include "cJSON.h"
#include "api_parser.h"

TEST_CASE("Parse shutdown allowed command", "[json][api]") {
    // Arrange
    const char *json_str = "{\"command\":\"shutdown_allowed\",\"timeout\":300}";

    // Act
    cJSON *root = cJSON_Parse(json_str);
    const char *command = parse_command(root);
    int timeout = parse_timeout(root);

    // Assert
    TEST_ASSERT_NOT_NULL(root);
    TEST_ASSERT_EQUAL_STRING("shutdown_allowed", command);
    TEST_ASSERT_EQUAL_INT(300, timeout);

    // Cleanup
    cJSON_Delete(root);
}

TEST_CASE("Handle malformed JSON gracefully", "[json][api]") {
    // Arrange
    const char *bad_json = "{invalid json";

    // Act
    cJSON *root = cJSON_Parse(bad_json);

    // Assert
    TEST_ASSERT_NULL(root);
}
```

### Example: Testing NVS Operations

```c
#include "unity.h"
#include "nvs_flash.h"
#include "nvs.h"

static nvs_handle_t test_handle;

void setUp(void) {
    // Erase NVS partition for clean test
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
}

void tearDown(void) {
    nvs_flash_deinit();
}

TEST_CASE("NVS stores and retrieves WiFi credentials", "[nvs]") {
    // Arrange
    const char *test_ssid = "TestNetwork";
    const char *test_password = "TestPassword123";

    // Act - Store
    esp_err_t err = save_wifi_credentials(test_ssid, test_password);
    TEST_ASSERT_EQUAL(ESP_OK, err);

    // Act - Retrieve
    char ssid[32] = {0};
    char password[64] = {0};
    err = load_wifi_credentials(ssid, sizeof(ssid), password, sizeof(password));

    // Assert
    TEST_ASSERT_EQUAL(ESP_OK, err);
    TEST_ASSERT_EQUAL_STRING(test_ssid, ssid);
    TEST_ASSERT_EQUAL_STRING(test_password, password);
}
```

### Running Tests

#### Build and Flash Tests
```bash
cd firmware
idf.py build
idf.py flash monitor
```

#### Run Specific Tests
```bash
# Run all tests
idf.py test

# Run tests with specific tag
idf.py test --tags="unit"

# Run single test by name
idf.py test --filter="Deadman timer initializes correctly"
```

#### Serial Monitor Output
```
Running Deadman timer initializes correctly...OK
Running Deadman timer resets on command...OK
Running Deadman timer expiration activates failsafe...OK
-----------------------
3 Tests 0 Failures 0 Ignored
OK
```

### Best Practices

1. **Test safety-critical logic** - Prioritize dead-man timer, watchdog, fail-safe behavior
2. **Keep tests isolated** - Each test should run independently
3. **Use setUp/tearDown** - Initialize/cleanup resources for each test
4. **Test error paths** - Verify error handling (malformed JSON, NVS failures)
5. **Tag tests appropriately** - Organize by speed ([fast], [slow]), type ([unit], [integration])
6. **Mock external dependencies** - Use CMock for WiFi, HTTP client when needed
7. **Verify fail-safe states** - Ensure relay defaults to FANS ON on any error

### CMock for Mocking

ESP-IDF integrates CMock for creating mocks:

```c
// Mock HTTP client for testing without network
#include "mock_esp_http_client.h"

TEST_CASE("Handle HTTP connection failure", "[http][mock]") {
    // Setup mock
    esp_http_client_perform_ExpectAndReturn(client, ESP_ERR_HTTP_CONNECT);

    // Act
    esp_err_t err = attempt_server_connection();

    // Assert
    TEST_ASSERT_EQUAL(ESP_ERR_HTTP_CONNECT, err);
    TEST_ASSERT_EQUAL(RELAY_ON, get_relay_state());  // Fail-safe activated
}
```

### Configuration Requirements (menuconfig)

```
Component config → Unity unit testing library:
  - Support for float/double
  - Colorize test output
  - Include ESP-IDF test registration
```

---

## Security Best Practices

### TLS/HTTPS Security

1. **Always verify server certificates**
   ```c
   esp_http_client_config_t config = {
       .url = "https://api.example.com",
       .crt_bundle_attach = esp_crt_bundle_attach,  // REQUIRED
   };
   ```

2. **Never skip certificate verification**
   ```c
   // NEVER do this in production:
   config.skip_cert_common_name_check = true;  // INSECURE!
   ```

3. **Use TLS 1.2 minimum**
   ```c
   config.tls_version = ESP_HTTP_CLIENT_TLS_VER_TLS_1_2;
   ```

4. **Enable time synchronization**
   - Certificate validation requires accurate system time
   - Initialize SNTP before HTTPS connections
   - Enable `CONFIG_MBEDTLS_HAVE_TIME_DATE`

5. **Keep certificates updated**
   - Update certificate bundle via OTA firmware updates
   - Monitor Espressif security advisories

### Credential Storage

1. **Use NVS encryption**
   ```
   Component config → NVS → Enable NVS encryption
   Requires Flash Encryption to be enabled
   ```

2. **Separate namespaces**
   ```c
   nvs_open("wifi_config", NVS_READWRITE, &handle);  // WiFi credentials
   nvs_open("device_config", NVS_READWRITE, &handle); // Auth tokens
   ```

3. **Never hardcode credentials**
   - Store via provisioning wizard
   - Use NVS for persistent storage
   - Wipe NVS on factory reset

### Firmware Security

1. **Enable Secure Boot**
   ```
   Security features → Enable hardware Secure Boot in bootloader
   ```

2. **Enable Flash Encryption**
   ```
   Security features → Enable flash encryption on boot
   ```

3. **OTA Updates over HTTPS only**
   ```c
   esp_https_ota_config_t ota_config = {
       .http_config = {
           .url = "https://firmware.example.com/latest.bin",
           .crt_bundle_attach = esp_crt_bundle_attach,
       },
   };
   ```

4. **Anti-rollback protection**
   ```
   Security features → Enable app anti-rollback support
   ```

### Network Security

1. **Use WPA2/WPA3 for WiFi**
   ```c
   wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
   ```

2. **Validate all API responses**
   ```c
   cJSON *root = cJSON_Parse(response);
   if (root == NULL) {
       ESP_LOGE(TAG, "Invalid JSON response");
       return ESP_FAIL;
   }
   ```

3. **Implement rate limiting**
   - Limit API request frequency
   - Handle 429 (Too Many Requests) responses

4. **Use authentication tokens**
   ```c
   esp_http_client_set_header(client, "Authorization", "Bearer TOKEN");
   ```

### Fail-Safe Security

1. **Default to safe state**
   - Relay initialization: FANS ON
   - Any error condition: FANS ON
   - Power loss: Normally-closed relay ensures FANS ON

2. **Validate all inputs**
   - Check JSON structure before parsing
   - Validate timer values before use
   - Verify GPIO states after setting

3. **Monitor watchdog**
   - Enable panic on watchdog timeout
   - Log all watchdog resets

4. **Secure provisioning**
   - Use Security 2 for WiFi provisioning
   - Implement proof-of-possession
   - Timeout provisioning mode after 10 minutes

---

## Configuration Reference

### Critical menuconfig Options

#### HTTP Client
```
Component config → ESP HTTP client:
  ☑ Enable HTTPS (CONFIG_ESP_HTTP_CLIENT_ENABLE_HTTPS)
  Buffer size: 512 bytes
  TX buffer size: 512 bytes
```

#### TLS/Certificate Bundle
```
Component config → mbedTLS:
  ☑ Enable mbedTLS certificate bundle
  Certificate bundle → Default (Most common certificates)
  ☑ Enable use of time/date
  TLS Version → TLS 1.2 minimum
```

#### WiFi
```
Component config → Wi-Fi:
  WiFi IRAM speed optimization: Yes
  WiFi RX IRAM speed optimization: Yes
  WiFi Static RX buffer number: 10
  WiFi Dynamic RX buffer number: 32
```

#### LWIP/SNTP
```
Component config → LWIP:
  ☑ Enable SNTP
  Request interval: 3600000 (1 hour)
  Number of servers: 2
```

#### Task Watchdog
```
Component config → ESP System Settings:
  ☑ Initialize Task Watchdog Timer on startup
  Timeout period: 5-10 seconds
  ☑ Watch CPU0 Idle Task
  ☑ Invoke panic handler on timeout

  Interrupt watchdog timeout: 300-1000 ms
```

#### NVS
```
Component config → NVS:
  ☑ Enable NVS encryption (requires Flash Encryption)
```

#### Logging
```
Component config → Log output:
  Default log level: Info
  ☑ Use ANSI terminal colors
```

### Flash Partitions

For OTA updates and NVS, configure partitions:

```csv
# partitions.csv
# Name,   Type, SubType, Offset,  Size, Flags
nvs,      data, nvs,     0x9000,  0x6000,
phy_init, data, phy,     0xf000,  0x1000,
factory,  app,  factory, 0x10000, 1M,
```

---

## Example Code Patterns

### Complete Initialization Sequence

```c
void app_main(void) {
    ESP_LOGI(TAG, "Grain Bunker Fan Controller Starting...");

    // 1. Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Initialize fail-safe GPIO (FANS ON)
    init_relay_gpio();
    init_status_led();

    // 3. Initialize watchdog timer
    init_task_watchdog();

    // 4. Initialize WiFi and connect
    init_wifi();
    wait_for_wifi_connection();

    // 5. Initialize SNTP for accurate time
    initialize_sntp();
    wait_for_time_sync();

    // 6. Initialize dead-man timer
    init_deadman_timer();

    // 7. Start main control loop
    xTaskCreate(control_task, "control_task", 4096, NULL, 5, NULL);

    ESP_LOGI(TAG, "Initialization complete - entering main loop");
}
```

### WiFi Connection with Retry Logic

```c
#define WIFI_MAXIMUM_RETRY 5
static int s_retry_num = 0;
static EventGroupHandle_t s_wifi_event_group;

static void event_handler(void* arg, esp_event_base_t event_base,
                         int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < WIFI_MAXIMUM_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Retry WiFi connection (%d/%d)", s_retry_num, WIFI_MAXIMUM_RETRY);
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGE(TAG, "WiFi connection failed");
            // Activate fail-safe
            activate_failsafe();
        }

    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}
```

### HTTPS API Request with Authentication

```c
esp_err_t send_status_to_server(void) {
    char auth_token[128];
    load_auth_token(auth_token, sizeof(auth_token));

    // Create JSON payload
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "device_id", get_device_id());
    cJSON_AddNumberToObject(root, "uptime", esp_timer_get_time() / 1000000);
    cJSON_AddStringToObject(root, "state", get_relay_state() == RELAY_ON ? "fans_on" : "fans_off");
    cJSON_AddNumberToObject(root, "rssi", get_wifi_rssi());

    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    // Configure HTTPS client
    esp_http_client_config_t config = {
        .url = "https://api.example.com/v1/devices/status",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .event_handler = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    // Set headers
    char auth_header[256];
    snprintf(auth_header, sizeof(auth_header), "Bearer %s", auth_token);
    esp_http_client_set_header(client, "Authorization", auth_header);
    esp_http_client_set_header(client, "Content-Type", "application/json");

    // Set POST data
    esp_http_client_set_post_field(client, json_string, strlen(json_string));

    // Execute request
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "Status report sent, HTTP %d", status_code);

        if (status_code == 200) {
            // Success
        } else {
            ESP_LOGW(TAG, "Server returned non-200 status");
        }
    } else {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        // Don't activate fail-safe for transient errors
    }

    cJSON_free(json_string);
    esp_http_client_cleanup(client);

    return err;
}
```

### Control Loop with Dead-Man Timer

```c
void control_task(void *pvParameters) {
    // Subscribe to task watchdog
    esp_task_wdt_add(NULL);

    while (1) {
        // Reset task watchdog
        esp_task_wdt_reset();

        // Check WiFi connection
        if (!is_wifi_connected()) {
            ESP_LOGW(TAG, "WiFi disconnected - activating fail-safe");
            activate_failsafe();
            vTaskDelay(pdMS_TO_TICKS(30000));  // Wait 30s before retry
            continue;
        }

        // Poll server for shutdown command
        esp_err_t err = poll_server_for_command();

        if (err == ESP_OK) {
            // Check if "shutdown allowed" received
            if (is_shutdown_command_active()) {
                reset_deadman_timer();  // Reset 5-minute countdown

                // Turn fans OFF if local conditions safe
                if (check_local_conditions_safe()) {
                    set_fans_state(false);
                }
            }
        } else {
            ESP_LOGE(TAG, "Server communication failed");
            // Transient error - keep existing state
        }

        // Send status report every 60 seconds
        static uint32_t last_status_time = 0;
        uint32_t now = esp_timer_get_time() / 1000000;
        if (now - last_status_time >= 60) {
            send_status_to_server();
            last_status_time = now;
        }

        // Main loop runs every 60 seconds
        vTaskDelay(pdMS_TO_TICKS(60000));
    }
}
```

---

## Migration Considerations

### ESP-IDF 5.0 Breaking Changes

If migrating from ESP-IDF 4.x to 5.x:

1. **CMake minimum version**
   - Requires CMake 3.16+
   - Update build environment

2. **Component dependencies**
   - Must explicitly declare all dependencies
   - Use REQUIRES/PRIV_REQUIRES in CMakeLists.txt

3. **mbedTLS is default**
   - OpenSSL support deprecated
   - Update to esp-tls or mbedTLS APIs

4. **Time handling**
   - 64-bit time_t (no Y2K38 issue)
   - Update time-related code if needed

5. **Build system**
   - Component registration changes
   - Update CMakeLists.txt syntax

### Official Migration Guide
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/index.html

---

## References

### Official Documentation
- **ESP-IDF Programming Guide (v5.5.1):** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/
- **ESP-IDF GitHub Repository:** https://github.com/espressif/esp-idf
- **ESP-IDF API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/
- **ESP Component Registry:** https://components.espressif.com/

### Security
- **ESP32 Security Overview:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/security.html
- **Espressif Security Advisories:** https://github.com/espressif/esp-idf/security/advisories

### Examples
- **ESP-IDF Examples:** https://github.com/espressif/esp-idf/tree/master/examples
- **HTTP Client Example:** https://github.com/espressif/esp-idf/tree/master/examples/protocols/esp_http_client
- **WiFi Station Example:** https://github.com/espressif/esp-idf/tree/master/examples/wifi/getting_started/station
- **SNTP Example:** https://github.com/espressif/esp-idf/tree/master/examples/protocols/sntp

### Community Resources
- **ESP32 Forum:** https://esp32.com/
- **ESP-IDF Component Registry:** https://components.espressif.com/

### Project-Specific
- **PRD Document:** `/Users/jeffdavis/AmericanAgrionics/Bunkercolab/docs/prd.md`
- **Architecture Document:** `/Users/jeffdavis/AmericanAgrionics/Bunkercolab/docs/architecture.md`

---

## Document Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-21 | 1.0 | Initial comprehensive research document | Claude (Framework Documentation Researcher) |

---

**End of Document**
