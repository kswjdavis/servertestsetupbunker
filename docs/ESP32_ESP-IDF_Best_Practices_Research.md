# ESP32 Firmware Development Best Practices (2025)
## Comprehensive Research for Grain Bunker Fan Control System

**Last Updated:** October 21, 2025
**Framework:** ESP-IDF v5.5.1+
**Target Hardware:** ESP32-DevKitC-VIE
**Application:** Safety-critical grain bunker fan control with fail-safe design

---

## Table of Contents

1. [ESP-IDF Project Structure](#1-esp-idf-project-structure)
2. [WiFi Provisioning Strategies](#2-wifi-provisioning-strategies)
3. [HTTPS/TLS REST API Communication](#3-httpstls-rest-api-communication)
4. [Watchdog Timers and Dead-Man Timer](#4-watchdog-timers-and-dead-man-timer)
5. [FreeRTOS Task Management](#5-freertos-task-management)
6. [Non-Volatile Storage (NVS)](#6-non-volatile-storage-nvs)
7. [Fail-Safe Relay Control](#7-fail-safe-relay-control)
8. [LED Control for Device Identification](#8-led-control-for-device-identification)
9. [OTA Updates](#9-ota-updates)
10. [Testing Strategies](#10-testing-strategies)
11. [Error Handling](#11-error-handling)
12. [Logging Best Practices](#12-logging-best-practices)
13. [Power Optimization](#13-power-optimization)
14. [Common Pitfalls](#14-common-pitfalls)
15. [Security Considerations](#15-security-considerations)
16. [Resources and Examples](#16-resources-and-examples)

---

## 1. ESP-IDF Project Structure

### Recommended Directory Layout

```
bunker-control-firmware/
├── CMakeLists.txt                 # Top-level CMake configuration
├── sdkconfig                      # Project configuration (generated)
├── sdkconfig.defaults            # Default configuration values
├── partitions.csv                # Custom partition table
├── README.md
├── main/                         # Main application component
│   ├── CMakeLists.txt
│   ├── main.c
│   ├── Kconfig.projbuild        # Project-specific menu options
│   └── idf_component.yml        # Component dependencies
├── components/                   # Custom reusable components
│   ├── fan_control/
│   │   ├── CMakeLists.txt
│   │   ├── include/
│   │   │   └── fan_control.h
│   │   ├── src/
│   │   │   └── fan_control.c
│   │   └── test/               # Component-specific tests
│   ├── wifi_manager/
│   ├── api_client/
│   ├── safety_monitor/
│   └── led_controller/
├── docs/                        # Documentation
├── test/                        # Integration tests
└── tools/                       # Build and deployment scripts
```

### Key Principles

**Component-Based Architecture:**
- ESP-IDF projects are an amalgamation of components compiled into static libraries
- Each component should be modular and have clear interfaces
- Public headers go in `include/`, implementation in `src/`
- Use `idf_component.yml` for dependency management (ESP-IDF v4.1+)

**Configuration Management:**
- Use `sdkconfig.defaults` for version-controlled defaults
- Project-specific menu options via `Kconfig.projbuild`
- Never commit the auto-generated `sdkconfig` file
- Use `idf.py menuconfig` for interactive configuration

**Official Documentation:**
- Build System Guide: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html

---

## 2. WiFi Provisioning Strategies

### Recommended Approach for Industrial IoT

**ESP-IDF WiFi Provisioning Manager** (Official API)
- Supports both SoftAP and BLE transport
- Built-in security with X25519 key exchange and AES-CTR encryption
- Proof of Possession (PoP) authentication

### Implementation Options

#### Option 1: Official WiFi Provisioning with Security 1 (RECOMMENDED)

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

#### Option 2: Captive Portal with Custom Web Interface

Third-party components available for complete captive portal solutions:
- DNS hijacking for automatic redirection
- WiFi network scanning
- Web-based credential entry
- mDNS support (.local domains)

**Component Example:**
```
achimpieters/esp32-captive_portal (ESP Component Registry)
```

### Secure Credential Storage

After provisioning, WiFi credentials are stored in NVS:
- Default partition: "nvs"
- Enable NVS encryption when Flash Encryption is enabled
- WiFi driver automatically stores SSID and passphrase

### Best Practices

1. **Always use Security 1** for WiFi provisioning in production
2. **Implement timeout logic** - exit provisioning mode after X minutes
3. **Provide fallback mechanism** - hardware reset button to re-enter provisioning
4. **Store provisioning state** - track whether device has been provisioned
5. **Support re-provisioning** - allow credentials to be updated
6. **Visual feedback** - use LED patterns to indicate provisioning mode

### Official Documentation
- WiFi Provisioning: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/wifi_provisioning.html

---

## 3. HTTPS/TLS REST API Communication

### ESP HTTP Client (Official)

ESP-IDF provides `esp_http_client` with full HTTPS/TLS support using mbedTLS.

### Basic HTTPS Configuration

```c
#include "esp_http_client.h"
#include "esp_crt_bundle.h"

esp_http_client_config_t config = {
    .url = "https://api.example.com/v1/bunker/status",
    .transport_type = HTTP_TRANSPORT_OVER_SSL,
    .crt_bundle_attach = esp_crt_bundle_attach,  // Use certificate bundle
    .timeout_ms = 5000,
    .buffer_size = 1024,
    .buffer_size_tx = 1024,
};

esp_http_client_handle_t client = esp_http_client_init(&config);
```

### Certificate Verification Strategies

#### Strategy 1: ESP Certificate Bundle (RECOMMENDED)

The ESP x509 Certificate Bundle includes common root CA certificates:
- Automatically maintained by Espressif
- Minimal flash footprint
- Handles most public APIs

**Enable in menuconfig:**
```
Component config → ESP-TLS → Allow different endpoint's CA to be selected
```

#### Strategy 2: Custom CA Certificate

For private APIs or specific validation:

```c
extern const char server_cert_pem_start[] asm("_binary_server_cert_pem_start");

esp_http_client_config_t config = {
    .url = "https://api.private.com/bunker",
    .cert_pem = server_cert_pem_start,
    .transport_type = HTTP_TRANSPORT_OVER_SSL,
};
```

### REST API Patterns

**GET Request:**
```c
esp_err_t err;
err = esp_http_client_perform(client);
if (err == ESP_OK) {
    int status = esp_http_client_get_status_code(client);
    int content_length = esp_http_client_get_content_length(client);
    ESP_LOGI(TAG, "Status=%d, Length=%d", status, content_length);
}
```

**POST Request with JSON:**
```c
const char *post_data = "{\"fan_id\":\"BUNKER_001\",\"status\":\"running\"}";

esp_http_client_set_method(client, HTTP_METHOD_POST);
esp_http_client_set_header(client, "Content-Type", "application/json");
esp_http_client_set_post_field(client, post_data, strlen(post_data));

esp_err_t err = esp_http_client_perform(client);
```

### Best Practices

1. **Connection reuse:** Keep HTTP client handle open for multiple requests
2. **Timeout handling:** Set appropriate timeouts for embedded environments
3. **Memory management:** Use `esp_http_client_cleanup()` when done
4. **Error handling:** Check return values and implement retry logic
5. **Buffer sizing:** Size buffers appropriately for your payloads
6. **TLS session resumption:** Reduces handshake overhead

### Performance Optimization

- Enable HTTP keep-alive for multiple requests
- Use TLS session tickets (enabled by default in ESP-IDF)
- Consider chunked transfer encoding for large payloads
- Monitor heap usage during HTTPS operations

### Official Documentation
- ESP HTTP Client: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html
- ESP-TLS: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_tls.html

---

## 4. Watchdog Timers and Dead-Man Timer

### ESP32 Watchdog Types

ESP32 has two watchdog timer systems:

1. **Interrupt Watchdog Timer (IWDT):** Monitors FreeRTOS task switching
2. **Task Watchdog Timer (TWDT):** Monitors specific tasks

### Task Watchdog Timer (Primary for Application Monitoring)

**Configuration (menuconfig):**
```
Component config → ESP System Settings → Task Watchdog Timer
- CONFIG_ESP_TASK_WDT_EN: Enable Task Watchdog
- CONFIG_ESP_TASK_WDT_TIMEOUT_S: Timeout in seconds (default: 5)
- CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU0: Monitor IDLE task CPU0
- CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU1: Monitor IDLE task CPU1
```

**Subscribing Tasks:**
```c
#include "esp_task_wdt.h"

void critical_task(void *pvParameter) {
    // Subscribe this task to TWDT
    ESP_ERROR_CHECK(esp_task_wdt_add(NULL));  // NULL = current task

    while (1) {
        // Perform work
        check_fan_status();

        // Reset watchdog timer
        ESP_ERROR_CHECK(esp_task_wdt_reset());

        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    // Unsubscribe before deleting task
    esp_task_wdt_delete(NULL);
}
```

### Dead-Man Timer Pattern for Fail-Safe Fan Control

For safety-critical systems where fans MUST default to ON:

```c
// Global state
static bool dead_man_timer_active = false;
static uint32_t last_heartbeat_time = 0;

#define DEAD_MAN_TIMEOUT_MS (60000)  // 1 minute without heartbeat = fail-safe

void dead_man_timer_task(void *pvParameter) {
    esp_task_wdt_add(NULL);

    while (1) {
        uint32_t current_time = xTaskGetTickCount() * portTICK_PERIOD_MS;

        // Check if heartbeat has timed out
        if (dead_man_timer_active) {
            if ((current_time - last_heartbeat_time) > DEAD_MAN_TIMEOUT_MS) {
                ESP_LOGW(TAG, "Dead-man timer expired! Activating fail-safe mode");
                activate_fail_safe_mode();  // Turn ALL fans ON
                dead_man_timer_active = false;
            }
        }

        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// Called by API communication task when valid command received
void reset_dead_man_timer(void) {
    last_heartbeat_time = xTaskGetTickCount() * portTICK_PERIOD_MS;
    dead_man_timer_active = true;
}
```

### Best Practices

1. **Timeout Selection:** Should be at least 2x the period between FreeRTOS ticks
2. **Critical Sections:** Keep critical sections short; defer computation to tasks
3. **ISR Considerations:** Don't call `esp_task_wdt_reset()` from ISRs
4. **Idle Task Monitoring:** Enable for production to catch CPU starvation
5. **Recovery Strategy:** Define clear actions when watchdog triggers
6. **Multi-Task Systems:** Subscribe all long-running tasks
7. **Yield Regularly:** Insert `vTaskDelay()` in long-running loops

### Preventing Watchdog Triggers

```c
// BAD: Hogging CPU
while (1) {
    expensive_computation();  // No yielding
}

// GOOD: Yielding to other tasks
while (1) {
    expensive_computation();
    vTaskDelay(pdMS_TO_TICKS(10));  // Allow task switching
    esp_task_wdt_reset();
}
```

### Official Documentation
- Watchdogs: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/wdts.html

---

## 5. FreeRTOS Task Management

### ESP32 FreeRTOS Overview

ESP-IDF uses FreeRTOS with symmetric multiprocessing (SMP) support for dual-core ESP32:
- Core 0 (PRO_CPU): Protocol CPU
- Core 1 (APP_CPU): Application CPU

### Task Creation Pattern

```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

void sensor_task(void *pvParameter) {
    while (1) {
        // Task work
        read_temperature_sensor();

        // Yield to other tasks
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    vTaskDelete(NULL);  // Delete self if exiting
}

// Create task pinned to specific core
xTaskCreatePinnedToCore(
    sensor_task,           // Task function
    "sensor_task",         // Task name (for debugging)
    4096,                  // Stack size in bytes
    NULL,                  // Parameter to pass
    5,                     // Priority (0 = lowest, configMAX_PRIORITIES-1 = highest)
    &sensor_task_handle,   // Task handle
    0                      // Core ID: 0=PRO_CPU, 1=APP_CPU, tskNO_AFFINITY=either
);
```

### Recommended Task Architecture for Fan Control System

```
Priority Level    Task Name              Core    Stack    Purpose
---------------------------------------------------------------------------
25 (Highest)      watchdog_monitor       0       2048     Safety monitoring
20                relay_control          0       4096     Fan relay management
15                api_communication      1       8192     REST API client
10                wifi_manager           1       4096     WiFi connection
5                 led_controller         1       2048     Status indication
1                 telemetry_logger       1       4096     Data logging
0 (Idle)          IDLE tasks            0/1      1024     Power management
```

### Task Synchronization Primitives

**Queues (Inter-Task Communication):**
```c
QueueHandle_t fan_command_queue;

// Create queue
fan_command_queue = xQueueCreate(10, sizeof(fan_command_t));

// Send to queue (from API task)
fan_command_t cmd = {.fan_id = 1, .state = FAN_ON};
xQueueSend(fan_command_queue, &cmd, portMAX_DELAY);

// Receive from queue (in relay control task)
fan_command_t cmd;
if (xQueueReceive(fan_command_queue, &cmd, pdMS_TO_TICKS(100)) == pdTRUE) {
    execute_fan_command(&cmd);
}
```

**Semaphores (Resource Protection):**
```c
SemaphoreHandle_t relay_mutex;

// Create mutex
relay_mutex = xSemaphoreCreateMutex();

// Acquire before accessing shared resource
if (xSemaphoreTake(relay_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    // Critical section: modify relay state
    set_relay_state(fan_id, state);
    xSemaphoreGive(relay_mutex);
}
```

**Event Groups (Multi-Condition Signaling):**
```c
EventGroupHandle_t system_events;

#define WIFI_CONNECTED_BIT   BIT0
#define API_READY_BIT        BIT1
#define SENSORS_READY_BIT    BIT2

// Create event group
system_events = xEventGroupCreate();

// Set event
xEventGroupSetBits(system_events, WIFI_CONNECTED_BIT);

// Wait for multiple events
EventBits_t bits = xEventGroupWaitBits(
    system_events,
    WIFI_CONNECTED_BIT | API_READY_BIT,
    pdFALSE,    // Don't clear on exit
    pdTRUE,     // Wait for ALL bits
    portMAX_DELAY
);
```

### Stack Size Guidelines

- **Minimal tasks (LED blink):** 2048 bytes
- **WiFi/Network tasks:** 4096-8192 bytes
- **TLS/HTTPS tasks:** 8192-16384 bytes
- **General application:** 4096 bytes
- Monitor actual usage: `uxTaskGetStackHighWaterMark(NULL)`

### Best Practices

1. **Pin time-critical tasks** to specific cores for deterministic behavior
2. **Use appropriate priorities** - too many high-priority tasks starve others
3. **Minimize stack allocation** - heap is limited on ESP32
4. **Always include delays** in infinite loops to prevent watchdog triggers
5. **Delete tasks properly** - call `vTaskDelete()` before exiting
6. **Monitor stack usage** in development to right-size allocations
7. **Use task names** for debugging (viewable in crash dumps)
8. **Avoid blocking indefinitely** - use timeouts in queue/semaphore operations

### IoT-Specific Optimizations

- Idle task extensions for deep/light sleep (automatic in ESP-IDF)
- Optimized tick rate for low-power applications (CONFIG_FREERTOS_HZ)
- Automatic WiFi/Bluetooth task management

### Official Documentation
- FreeRTOS Overview: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html
- FreeRTOS API: https://www.freertos.org/a00106.html

---

## 6. Non-Volatile Storage (NVS)

### NVS Overview

NVS (Non-Volatile Storage) provides persistent key-value storage in flash memory:
- Survives power cycles and reboots
- Wear leveling built-in
- Support for multiple data types
- Optional encryption

### Basic NVS Operations

```c
#include "nvs_flash.h"
#include "nvs.h"

// Initialize NVS (call once at startup)
esp_err_t ret = nvs_flash_init();
if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
}
ESP_ERROR_CHECK(ret);

// Open NVS namespace
nvs_handle_t nvs_handle;
ret = nvs_open("storage", NVS_READWRITE, &nvs_handle);
if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Error opening NVS handle");
    return;
}

// Write values
int32_t fan_count = 8;
nvs_set_i32(nvs_handle, "fan_count", fan_count);

char bunker_id[32] = "BUNKER_001_A";
nvs_set_str(nvs_handle, "bunker_id", bunker_id);

// Commit changes (required!)
nvs_commit(nvs_handle);

// Read values
int32_t stored_fan_count;
ret = nvs_get_i32(nvs_handle, "fan_count", &stored_fan_count);
if (ret == ESP_OK) {
    ESP_LOGI(TAG, "Fan count: %d", stored_fan_count);
} else if (ret == ESP_ERR_NVS_NOT_FOUND) {
    ESP_LOGI(TAG, "Value not found, using default");
}

// Close handle
nvs_close(nvs_handle);
```

### Supported Data Types

- `nvs_set_i8()`, `nvs_get_i8()` - int8_t
- `nvs_set_u8()`, `nvs_get_u8()` - uint8_t
- `nvs_set_i16()`, `nvs_get_i16()` - int16_t
- `nvs_set_u16()`, `nvs_get_u16()` - uint16_t
- `nvs_set_i32()`, `nvs_get_i32()` - int32_t
- `nvs_set_u32()`, `nvs_get_u32()` - uint32_t
- `nvs_set_i64()`, `nvs_get_i64()` - int64_t
- `nvs_set_u64()`, `nvs_get_u64()` - uint64_t
- `nvs_set_str()`, `nvs_get_str()` - null-terminated string
- `nvs_set_blob()`, `nvs_get_blob()` - binary data

### NVS Encryption for Secure Credential Storage

**Critical for Production:** WiFi credentials and API keys MUST be encrypted in NVS.

#### Encryption Scheme 1: Flash Encryption-Based (ESP32)

Requires Flash Encryption to be enabled:

```
Security features → Enable flash encryption on boot
```

**Partition Table (partitions_encrypted.csv):**
```csv
# Name,     Type, SubType,  Offset,   Size, Flags
nvs,        data, nvs,      0x9000,   0x4000
nvs_key,    data, nvs_keys, ,         0x1000, encrypted
otadata,    data, ota,      0xd000,   0x2000
phy_init,   data, phy,      0xf000,   0x1000
factory,    app,  factory,  0x10000,  1M
ota_0,      app,  ota_0,    ,         1M
ota_1,      app,  ota_1,    ,         1M
```

**Initialization:**
```c
#include "nvs_flash.h"

// Read NVS encryption keys from partition
esp_err_t ret = nvs_flash_read_security_cfg_v2(nvs_sec_cfg_t *cfg);
if (ret == ESP_ERR_NVS_KEYS_NOT_INITIALIZED) {
    // Generate and store new keys
    nvs_flash_generate_keys(nvs_key_partition, &nvs_sec_cfg);
}

// Initialize NVS with encryption
nvs_flash_secure_init(&nvs_sec_cfg);
```

#### Encryption Scheme 2: HMAC-Based (ESP32-S2, S3, H2)

Derives encryption keys from eFuse HMAC key at runtime - no keys stored in flash!

**Configuration:**
```
Security features → Enable hardware secure boot
```

**Benefits:**
- Keys never stored in flash
- Works without Flash Encryption
- More secure key derivation

### Configuration Storage Pattern

```c
typedef struct {
    char wifi_ssid[32];
    char wifi_password[64];
    char api_endpoint[128];
    char api_key[64];
    uint8_t fan_count;
    bool fail_safe_enabled;
} system_config_t;

esp_err_t save_system_config(const system_config_t *config) {
    nvs_handle_t handle;
    esp_err_t err;

    err = nvs_open("config", NVS_READWRITE, &handle);
    if (err != ESP_OK) return err;

    // Save as blob for structured data
    err = nvs_set_blob(handle, "sys_config", config, sizeof(system_config_t));
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }

    nvs_close(handle);
    return err;
}

esp_err_t load_system_config(system_config_t *config) {
    nvs_handle_t handle;
    esp_err_t err;

    err = nvs_open("config", NVS_READONLY, &handle);
    if (err != ESP_OK) return err;

    size_t required_size = sizeof(system_config_t);
    err = nvs_get_blob(handle, "sys_config", config, &required_size);

    nvs_close(handle);
    return err;
}
```

### Best Practices

1. **Always call `nvs_commit()`** - writes are buffered until commit
2. **Use namespaces** - organize keys into logical namespaces
3. **Handle errors** - NVS operations can fail (flash wear, corruption)
4. **Encrypt sensitive data** - enable NVS encryption for credentials
5. **Version your structures** - include version field in blobs for migration
6. **Limit write frequency** - flash has limited write cycles (~100,000)
7. **Erase when necessary** - `nvs_flash_erase()` for factory reset
8. **Size partitions appropriately** - minimum 0x3000 (12KB), recommended 0x4000+

### Security Considerations

- **Never store plain-text credentials** without NVS encryption
- **Enable Flash Encryption** for production devices
- **Implement factory reset** - allow clearing all NVS data
- **Validate loaded data** - check for corruption or tampering
- **Use secure boot** - prevent unauthorized firmware modification

### Official Documentation
- NVS Library: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_flash.html
- NVS Encryption: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_encryption.html

---

## 7. Fail-Safe Relay Control

### Hardware Design Principles for Safety-Critical Systems

**CRITICAL REQUIREMENT:** Fans must default to ON in any failure scenario.

#### Recommended Hardware Configuration

1. **Use Normally Closed (NC) Relay Contacts**
   - When ESP32 loses power: relays de-energize → contacts close → fans turn ON
   - When firmware crashes: same fail-safe behavior
   - When network fails: same fail-safe behavior

2. **Relay Module Selection**
   - Optically isolated relay modules
   - Separate relay coil power (JD-VCC) from logic power
   - Sufficient current rating with derating for continuous operation
   - Status LEDs on relay module for visual inspection

3. **Electrical Safety**
   - Fuses or circuit breakers on AC circuits
   - Proper wire gauge for load current
   - Grounding per electrical code
   - Never exceed relay voltage/current ratings
   - Consider 50% derating for continuous AC loads

#### Firmware Fail-Safe Patterns

```c
#include "driver/gpio.h"

// GPIO configuration for relay control
#define RELAY_1_GPIO    GPIO_NUM_25
#define RELAY_2_GPIO    GPIO_NUM_26
#define RELAY_3_GPIO    GPIO_NUM_27
#define RELAY_4_GPIO    GPIO_NUM_14

typedef enum {
    RELAY_STATE_FAIL_SAFE,    // Relay OFF → NC contacts close → Fan ON
    RELAY_STATE_CONTROLLED     // Relay ON → NC contacts open → Fan OFF
} relay_state_t;

void init_relay_control(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << RELAY_1_GPIO) |
                        (1ULL << RELAY_2_GPIO) |
                        (1ULL << RELAY_3_GPIO) |
                        (1ULL << RELAY_4_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    // Initialize ALL relays to fail-safe state (OFF → Fans ON)
    set_all_relays_fail_safe();
}

void set_all_relays_fail_safe(void) {
    gpio_set_level(RELAY_1_GPIO, 0);  // Relay OFF → Fan ON
    gpio_set_level(RELAY_2_GPIO, 0);
    gpio_set_level(RELAY_3_GPIO, 0);
    gpio_set_level(RELAY_4_GPIO, 0);

    // Persist fail-safe state to NVS
    save_relay_state_nvs(RELAY_STATE_FAIL_SAFE);

    ESP_LOGW(TAG, "FAIL-SAFE MODE: All fans ON");
}

void set_relay_controlled(uint8_t relay_num, bool fan_on) {
    // Invert logic: fan_on=true means relay OFF (NC contact closes)
    gpio_num_t gpio = get_relay_gpio(relay_num);
    gpio_set_level(gpio, !fan_on);

    // Update NVS for power-cycle recovery
    save_relay_state_nvs(relay_num, fan_on);
}
```

#### Multi-Layer Safety Monitoring

```c
typedef struct {
    bool api_connection_healthy;
    bool watchdog_active;
    bool power_stable;
    bool temperature_sensors_ok;
    uint32_t last_valid_command_time;
} safety_monitor_t;

static safety_monitor_t safety_state = {0};

void safety_monitor_task(void *pvParameter) {
    esp_task_wdt_add(NULL);

    while (1) {
        uint32_t now = xTaskGetTickCount() * portTICK_PERIOD_MS;

        // Check API communication timeout
        if ((now - safety_state.last_valid_command_time) > API_TIMEOUT_MS) {
            ESP_LOGW(TAG, "API timeout - entering fail-safe");
            set_all_relays_fail_safe();
        }

        // Check sensor health
        if (!safety_state.temperature_sensors_ok) {
            ESP_LOGW(TAG, "Sensor failure - entering fail-safe");
            set_all_relays_fail_safe();
        }

        // Monitor heap fragmentation
        if (esp_get_free_heap_size() < MIN_HEAP_SIZE) {
            ESP_LOGE(TAG, "Low memory - entering fail-safe");
            set_all_relays_fail_safe();
        }

        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
```

#### Power-Cycle Recovery

```c
void app_main(void) {
    // Initialize NVS first
    nvs_flash_init();

    // Initialize relays BEFORE WiFi/network
    init_relay_control();

    // Try to recover previous state
    relay_state_t last_state;
    if (load_relay_state_nvs(&last_state) == ESP_OK) {
        if (last_state == RELAY_STATE_FAIL_SAFE) {
            set_all_relays_fail_safe();
        }
    } else {
        // Default to fail-safe on first boot or NVS corruption
        set_all_relays_fail_safe();
    }

    // Start network stack
    wifi_init();

    // Only after successful API connection, allow controlled operation
}
```

### Software Watchdog Integration

```c
// Implement dead-man's switch
#define HEARTBEAT_TIMEOUT_MS  (60000)  // 1 minute

static uint32_t last_heartbeat = 0;

void process_api_command(const api_command_t *cmd) {
    // Valid command received from API
    last_heartbeat = xTaskGetTickCount() * portTICK_PERIOD_MS;

    if (cmd->type == CMD_SET_FAN_STATE) {
        set_relay_controlled(cmd->fan_id, cmd->fan_on);
    }
}

void heartbeat_monitor_task(void *pvParameter) {
    while (1) {
        uint32_t now = xTaskGetTickCount() * portTICK_PERIOD_MS;

        if ((now - last_heartbeat) > HEARTBEAT_TIMEOUT_MS) {
            ESP_LOGW(TAG, "Heartbeat timeout - fail-safe activated");
            set_all_relays_fail_safe();
        }

        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}
```

### Best Practices

1. **Hardware-level fail-safe** - Use NC contacts for critical safety
2. **Default to safe state** - Always fail to "fans ON"
3. **Redundant monitoring** - Multiple layers of safety checks
4. **State persistence** - Save relay states to NVS for recovery
5. **Graceful degradation** - Continue operation with reduced functionality
6. **Visual indication** - LEDs show system state
7. **Logging** - Record all fail-safe activations
8. **Testing** - Regularly test fail-safe mechanisms
9. **Isolation** - Use optoisolation between logic and AC circuits
10. **Network loss handling** - Timeout to fail-safe if API unreachable

### Official Resources
- GPIO API: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html

---

## 8. LED Control for Device Identification

### ESP32 GPIO Capabilities for LED Control

**ESP32-DevKitC Features:**
- 34 GPIO pins total (GPIO0-GPIO39)
- **GPIOs 34-39:** Input only (cannot drive LEDs)
- **Onboard LED:** GPIO2 (common on most DevKit boards)
- **PWM Support:** All output-capable GPIOs support LED PWM (LEDC)
- **Channels:** 16 independent LEDC channels

### Basic GPIO LED Control

```c
#include "driver/gpio.h"

#define STATUS_LED_GPIO     GPIO_NUM_2   // Onboard LED
#define IDENTIFY_LED_GPIO   GPIO_NUM_4   // External identification LED
#define ERROR_LED_GPIO      GPIO_NUM_5   // Error indication

void init_leds(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << STATUS_LED_GPIO) |
                        (1ULL << IDENTIFY_LED_GPIO) |
                        (1ULL << ERROR_LED_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&io_conf));

    // Initial state: all off
    gpio_set_level(STATUS_LED_GPIO, 0);
    gpio_set_level(IDENTIFY_LED_GPIO, 0);
    gpio_set_level(ERROR_LED_GPIO, 0);
}

void set_status_led(bool on) {
    gpio_set_level(STATUS_LED_GPIO, on ? 1 : 0);
}
```

### PWM LED Control (Breathing, Dimming)

```c
#include "driver/ledc.h"

#define LEDC_TIMER          LEDC_TIMER_0
#define LEDC_MODE           LEDC_LOW_SPEED_MODE
#define LEDC_CHANNEL        LEDC_CHANNEL_0
#define LEDC_DUTY_RES       LEDC_TIMER_13_BIT  // 13-bit resolution (0-8191)
#define LEDC_FREQUENCY      5000                // 5 kHz

void init_pwm_led(gpio_num_t gpio) {
    // Timer configuration
    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_MODE,
        .timer_num        = LEDC_TIMER,
        .duty_resolution  = LEDC_DUTY_RES,
        .freq_hz          = LEDC_FREQUENCY,
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ESP_ERROR_CHECK(ledc_timer_config(&ledc_timer));

    // Channel configuration
    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_MODE,
        .channel        = LEDC_CHANNEL,
        .timer_sel      = LEDC_TIMER,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = gpio,
        .duty           = 0,
        .hpoint         = 0
    };
    ESP_ERROR_CHECK(ledc_channel_config(&ledc_channel));
}

void set_led_brightness(uint8_t brightness_percent) {
    uint32_t duty = (brightness_percent * 8191) / 100;
    ledc_set_duty(LEDC_MODE, LEDC_CHANNEL, duty);
    ledc_update_duty(LEDC_MODE, LEDC_CHANNEL);
}

// Breathing effect
void led_breathe_effect(void) {
    for (int i = 0; i <= 100; i += 5) {
        set_led_brightness(i);
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    for (int i = 100; i >= 0; i -= 5) {
        set_led_brightness(i);
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
```

### LED Status Pattern System

```c
typedef enum {
    LED_PATTERN_OFF,
    LED_PATTERN_SOLID,
    LED_PATTERN_SLOW_BLINK,      // 1 Hz
    LED_PATTERN_FAST_BLINK,      // 4 Hz
    LED_PATTERN_DOUBLE_BLINK,    // Two quick blinks, pause
    LED_PATTERN_BREATHE,         // Fade in/out
    LED_PATTERN_ERROR_FLASH,     // Rapid flash
} led_pattern_t;

typedef enum {
    SYSTEM_STATE_BOOTING,
    SYSTEM_STATE_PROVISIONING,
    SYSTEM_STATE_CONNECTING,
    SYSTEM_STATE_CONNECTED,
    SYSTEM_STATE_API_READY,
    SYSTEM_STATE_FAIL_SAFE,
    SYSTEM_STATE_ERROR,
    SYSTEM_STATE_IDENTIFY,       // User identification mode
} system_state_t;

// LED pattern mapping
static const led_pattern_t state_patterns[] = {
    [SYSTEM_STATE_BOOTING]       = LED_PATTERN_FAST_BLINK,
    [SYSTEM_STATE_PROVISIONING]  = LED_PATTERN_BREATHE,
    [SYSTEM_STATE_CONNECTING]    = LED_PATTERN_SLOW_BLINK,
    [SYSTEM_STATE_CONNECTED]     = LED_PATTERN_DOUBLE_BLINK,
    [SYSTEM_STATE_API_READY]     = LED_PATTERN_SOLID,
    [SYSTEM_STATE_FAIL_SAFE]     = LED_PATTERN_ERROR_FLASH,
    [SYSTEM_STATE_ERROR]         = LED_PATTERN_ERROR_FLASH,
    [SYSTEM_STATE_IDENTIFY]      = LED_PATTERN_FAST_BLINK,
};

void led_controller_task(void *pvParameter) {
    system_state_t current_state = SYSTEM_STATE_BOOTING;
    led_pattern_t current_pattern = LED_PATTERN_OFF;

    while (1) {
        // Get current system state (from queue or shared variable)
        current_pattern = state_patterns[current_state];

        switch (current_pattern) {
            case LED_PATTERN_SOLID:
                set_status_led(true);
                vTaskDelay(pdMS_TO_TICKS(100));
                break;

            case LED_PATTERN_SLOW_BLINK:
                set_status_led(true);
                vTaskDelay(pdMS_TO_TICKS(500));
                set_status_led(false);
                vTaskDelay(pdMS_TO_TICKS(500));
                break;

            case LED_PATTERN_FAST_BLINK:
                set_status_led(true);
                vTaskDelay(pdMS_TO_TICKS(125));
                set_status_led(false);
                vTaskDelay(pdMS_TO_TICKS(125));
                break;

            case LED_PATTERN_DOUBLE_BLINK:
                set_status_led(true);
                vTaskDelay(pdMS_TO_TICKS(100));
                set_status_led(false);
                vTaskDelay(pdMS_TO_TICKS(100));
                set_status_led(true);
                vTaskDelay(pdMS_TO_TICKS(100));
                set_status_led(false);
                vTaskDelay(pdMS_TO_TICKS(700));
                break;

            case LED_PATTERN_ERROR_FLASH:
                for (int i = 0; i < 10; i++) {
                    set_status_led(true);
                    vTaskDelay(pdMS_TO_TICKS(50));
                    set_status_led(false);
                    vTaskDelay(pdMS_TO_TICKS(50));
                }
                vTaskDelay(pdMS_TO_TICKS(1000));
                break;

            case LED_PATTERN_BREATHE:
                led_breathe_effect();
                break;

            default:
                set_status_led(false);
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
        }
    }
}
```

### Device Identification via API

```c
// Handle API command to identify device
void handle_identify_command(uint32_t duration_seconds) {
    ESP_LOGI(TAG, "Device identification requested for %d seconds", duration_seconds);

    system_state_t previous_state = get_system_state();
    set_system_state(SYSTEM_STATE_IDENTIFY);

    // LED controller will automatically start identify pattern
    vTaskDelay(pdMS_TO_TICKS(duration_seconds * 1000));

    // Restore previous state
    set_system_state(previous_state);
}
```

### Multi-Color RGB LED (Optional)

```c
#define RGB_LED_R_GPIO  GPIO_NUM_25
#define RGB_LED_G_GPIO  GPIO_NUM_26
#define RGB_LED_B_GPIO  GPIO_NUM_27

typedef struct {
    uint8_t r;
    uint8_t g;
    uint8_t b;
} rgb_color_t;

// Common colors
static const rgb_color_t COLOR_RED     = {255, 0, 0};
static const rgb_color_t COLOR_GREEN   = {0, 255, 0};
static const rgb_color_t COLOR_BLUE    = {0, 0, 255};
static const rgb_color_t COLOR_YELLOW  = {255, 255, 0};
static const rgb_color_t COLOR_MAGENTA = {255, 0, 255};
static const rgb_color_t COLOR_CYAN    = {0, 255, 255};
static const rgb_color_t COLOR_WHITE   = {255, 255, 255};

void set_rgb_color(const rgb_color_t *color) {
    ledc_set_duty(LEDC_MODE, LEDC_CHANNEL_0, (color->r * 8191) / 255);
    ledc_set_duty(LEDC_MODE, LEDC_CHANNEL_1, (color->g * 8191) / 255);
    ledc_set_duty(LEDC_MODE, LEDC_CHANNEL_2, (color->b * 8191) / 255);
    ledc_update_duty(LEDC_MODE, LEDC_CHANNEL_0);
    ledc_update_duty(LEDC_MODE, LEDC_CHANNEL_1);
    ledc_update_duty(LEDC_MODE, LEDC_CHANNEL_2);
}
```

### Best Practices

1. **Distinct patterns** - Make each state visually distinguishable
2. **Power consumption** - Consider LED current in battery applications
3. **Non-blocking** - Use task-based LED control, not blocking delays
4. **User documentation** - Clearly document LED pattern meanings
5. **Accessibility** - Consider adding audible indicators for visual impairments
6. **Current limiting** - Always use appropriate resistors for LEDs
7. **GPIO selection** - Avoid input-only pins (GPIO 34-39)
8. **PWM frequency** - Use >100 Hz to avoid visible flicker
9. **State persistence** - Don't change patterns too frequently
10. **Error indication** - Prioritize error states in pattern hierarchy

### Official Documentation
- GPIO: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html
- LEDC (PWM): https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/ledc.html

---

## 9. OTA Updates

### OTA Architecture in ESP32

Over-the-Air (OTA) updates enable remote firmware updates without physical access:
- Dual app partition scheme (ota_0, ota_1)
- Secure boot and anti-rollback protection
- Rollback mechanism for failed updates
- HTTPS transport for security

### Partition Table for OTA

```csv
# Name,     Type, SubType,  Offset,   Size,    Flags
nvs,        data, nvs,      0x9000,   0x4000
nvs_key,    data, nvs_keys, ,         0x1000,  encrypted
otadata,    data, ota,      0xd000,   0x2000
phy_init,   data, phy,      0xf000,   0x1000
factory,    app,  factory,  0x10000,  1M
ota_0,      app,  ota_0,    ,         1M
ota_1,      app,  ota_1,    ,         1M
```

**Key Partitions:**
- **factory:** Initial firmware (optional, can be removed to save space)
- **ota_0, ota_1:** Alternating update slots
- **otadata:** Tracks which OTA slot is active

### ESP HTTPS OTA Implementation

```c
#include "esp_https_ota.h"
#include "esp_ota_ops.h"
#include "esp_crt_bundle.h"

#define FIRMWARE_URL "https://api.example.com/firmware/bunker_v2.0.bin"

esp_err_t perform_ota_update(void) {
    ESP_LOGI(TAG, "Starting OTA update from: %s", FIRMWARE_URL);

    esp_http_client_config_t config = {
        .url = FIRMWARE_URL,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .timeout_ms = 30000,
        .keep_alive_enable = true,
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &config,
    };

    esp_err_t ret = esp_https_ota(&ota_config);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "OTA update successful, restarting...");
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
    } else {
        ESP_LOGE(TAG, "OTA update failed: %s", esp_err_to_name(ret));
    }

    return ret;
}
```

### Advanced OTA with Progress and Validation

```c
void advanced_ota_task(void *pvParameter) {
    esp_err_t ota_finish_err = ESP_OK;
    esp_http_client_config_t config = {
        .url = FIRMWARE_URL,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .timeout_ms = 30000,
        .keep_alive_enable = true,
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &config,
    };

    esp_https_ota_handle_t https_ota_handle = NULL;
    esp_err_t err = esp_https_ota_begin(&ota_config, &https_ota_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "OTA begin failed");
        goto ota_end;
    }

    // Get image size
    int binary_file_length = esp_https_ota_get_image_len_read(https_ota_handle);
    ESP_LOGI(TAG, "Image size: %d bytes", binary_file_length);

    // Download and flash in chunks
    while (1) {
        err = esp_https_ota_perform(https_ota_handle);
        if (err != ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
            break;
        }

        // Report progress
        int downloaded = esp_https_ota_get_image_len_read(https_ota_handle);
        int progress = (downloaded * 100) / binary_file_length;
        ESP_LOGI(TAG, "OTA progress: %d%%", progress);

        // Update LED or send status to API
        report_ota_progress(progress);
    }

    if (esp_https_ota_is_complete_data_received(https_ota_handle) != true) {
        ESP_LOGE(TAG, "Complete data not received");
        goto ota_end;
    }

    ota_finish_err = esp_https_ota_finish(https_ota_handle);
    if (ota_finish_err == ESP_OK) {
        ESP_LOGI(TAG, "OTA upgrade successful, restarting in 5 seconds...");
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_restart();
    } else {
        ESP_LOGE(TAG, "OTA upgrade failed: %s", esp_err_to_name(ota_finish_err));
    }

ota_end:
    esp_https_ota_abort(https_ota_handle);
    vTaskDelete(NULL);
}
```

### OTA Rollback Protection

```c
#include "esp_ota_ops.h"

void check_ota_validity(void) {
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t ota_state;

    if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
        if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
            // First boot after OTA - run diagnostic tests
            ESP_LOGI(TAG, "New firmware detected, running diagnostics...");

            bool diagnostic_passed = run_system_diagnostics();

            if (diagnostic_passed) {
                ESP_LOGI(TAG, "Diagnostics passed, marking OTA as valid");
                esp_ota_mark_app_valid_cancel_rollback();
            } else {
                ESP_LOGE(TAG, "Diagnostics failed, rolling back to previous firmware");
                esp_ota_mark_app_invalid_rollback_and_reboot();
            }
        }
    }
}

bool run_system_diagnostics(void) {
    // Test critical functionality
    bool wifi_ok = test_wifi_connection();
    bool api_ok = test_api_connectivity();
    bool relays_ok = test_relay_control();
    bool sensors_ok = test_sensors();

    return wifi_ok && api_ok && relays_ok && sensors_ok;
}
```

### Security Best Practices

#### 1. Signature Verification

**Enable in menuconfig:**
```
Security features → Enable application signature verification
Security features → Require signed app images
```

**Without Secure Boot:**
```
CONFIG_SECURE_SIGNED_APPS_NO_SECURE_BOOT=y
CONFIG_SECURE_SIGNED_ON_UPDATE_NO_SECURE_BOOT=y
```

**Sign firmware images:**
```bash
espsecure.py sign_data --keyfile secure_boot_signing_key.pem \
    --version 2 \
    --output firmware_signed.bin \
    firmware.bin
```

#### 2. Anti-Rollback Protection

Prevents downgrade attacks by checking security version in eFuse:

**Enable in menuconfig:**
```
Security features → Enable anti-rollback
App OTA → Security version (increment with each release)
```

**Important:** Incrementing security version is irreversible - older firmware won't boot!

#### 3. HTTPS Transport (REQUIRED)

Always use HTTPS for OTA downloads:
```c
.crt_bundle_attach = esp_crt_bundle_attach,  // Verify server certificate
```

#### 4. Pre-Encrypted Firmware

Distribute encrypted firmware for additional security:
```c
esp_https_ota_config_t ota_config = {
    .http_config = &config,
    .decrypt_config = &decrypt_config,  // Decrypt during OTA
};
```

### OTA Update Triggers

```c
// Periodic check for updates
void ota_check_task(void *pvParameter) {
    while (1) {
        // Wait 24 hours
        vTaskDelay(pdMS_TO_TICKS(24 * 60 * 60 * 1000));

        // Check API for available updates
        firmware_version_t latest_version;
        if (api_get_latest_firmware_version(&latest_version) == ESP_OK) {
            firmware_version_t current_version = get_current_version();

            if (is_newer_version(&latest_version, &current_version)) {
                ESP_LOGI(TAG, "New firmware available: v%d.%d.%d",
                         latest_version.major,
                         latest_version.minor,
                         latest_version.patch);

                // Trigger OTA update during maintenance window
                if (is_maintenance_window()) {
                    perform_ota_update();
                }
            }
        }
    }
}

// API-triggered update
void handle_api_ota_command(const char *firmware_url) {
    ESP_LOGI(TAG, "OTA update requested via API");

    // Validate URL format
    if (!is_valid_https_url(firmware_url)) {
        ESP_LOGE(TAG, "Invalid firmware URL");
        return;
    }

    // Enter fail-safe mode before OTA
    set_all_relays_fail_safe();

    // Perform update
    xTaskCreate(advanced_ota_task, "ota_task", 8192, (void*)firmware_url, 5, NULL);
}
```

### Best Practices

1. **Always use HTTPS** - Never download firmware over plain HTTP
2. **Verify signatures** - Enable signature verification for production
3. **Test new firmware** - Implement diagnostic tests after OTA
4. **Enable rollback** - Use `ESP_OTA_IMG_PENDING_VERIFY` state
5. **Anti-rollback** - Increment security version for security fixes
6. **Fail-safe during OTA** - Put system in safe state during updates
7. **Progress indication** - Show OTA progress via LED/API
8. **Retry logic** - Handle network failures gracefully
9. **Version tracking** - Store firmware version in NVS
10. **Maintenance windows** - Schedule updates during low-activity periods
11. **Staged rollouts** - Update devices gradually, not all at once
12. **Factory partition** - Keep factory firmware for emergency recovery

### Official Documentation
- OTA Updates: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/ota.html
- ESP HTTPS OTA: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_https_ota.html
- Secure Boot: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/secure-boot-v2.html

---

## 10. Testing Strategies

### Testing Frameworks in ESP-IDF

ESP-IDF supports multiple testing approaches:

1. **Unity Test Framework** (on-target testing)
2. **pytest-embedded** (automated test execution)
3. **CMock** (mocking for unit tests)
4. **Linux host-based testing** (hardware abstraction)

### On-Target Unit Testing with Unity

**Project Structure:**
```
components/fan_control/
├── CMakeLists.txt
├── include/fan_control.h
├── src/fan_control.c
└── test/
    ├── CMakeLists.txt
    └── test_fan_control.c
```

**Test CMakeLists.txt:**
```cmake
idf_component_register(
    SRC_DIRS "."
    INCLUDE_DIRS "."
    REQUIRES unity fan_control
)
```

**Example Test:**
```c
#include "unity.h"
#include "fan_control.h"
#include "esp_log.h"

static const char *TAG = "fan_control_test";

void setUp(void) {
    // Setup before each test
    fan_control_init();
}

void tearDown(void) {
    // Cleanup after each test
    fan_control_deinit();
}

TEST_CASE("Fan control initializes correctly", "[fan_control]") {
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_FAIL_SAFE, status.state);
}

TEST_CASE("Setting fan state updates GPIO", "[fan_control]") {
    set_fan_state(0, FAN_STATE_ON);
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_ON, status.state);
}

TEST_CASE("Fail-safe activates on timeout", "[fan_control][timeout=10]") {
    // Simulate normal operation
    set_fan_state(0, FAN_STATE_OFF);

    // Stop sending heartbeats
    vTaskDelay(pdMS_TO_TICKS(65000));  // Wait for timeout

    // Should revert to fail-safe
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_FAIL_SAFE, status.state);
}

// Test for edge cases
TEST_CASE("Invalid fan ID returns error", "[fan_control][negative]") {
    esp_err_t err = set_fan_state(99, FAN_STATE_ON);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, err);
}
```

**Running Tests:**
```bash
# Build test application
idf.py build

# Flash and run tests
idf.py flash monitor

# Run specific test
idf.py flash monitor -T "Fan control initializes correctly"
```

### Mocking with CMock

For testing components with hardware dependencies:

```c
// Mock GPIO for unit testing
#include "driver/gpio.h"
#include "Mockgpio.h"

TEST_CASE("Relay control sets correct GPIO level", "[relay][mock]") {
    // Setup mock expectation
    gpio_set_level_ExpectAndReturn(GPIO_NUM_25, 1, ESP_OK);

    // Execute code under test
    esp_err_t err = activate_relay(0);

    // Verify
    TEST_ASSERT_EQUAL(ESP_OK, err);
}
```

### Integration Testing with pytest-embedded

**Test Script (pytest_fan_control.py):**
```python
import pytest

@pytest.mark.esp32
@pytest.mark.generic
def test_wifi_provisioning(dut):
    """Test WiFi provisioning flow"""
    dut.expect("WiFi provisioning started", timeout=30)

    # Send provisioning credentials via serial
    dut.write('{"ssid":"TestNetwork","password":"test1234"}')

    dut.expect("WiFi connected", timeout=60)
    dut.expect("IP address: ", timeout=10)

@pytest.mark.esp32
def test_api_communication(dut):
    """Test API client functionality"""
    dut.expect("API client initialized", timeout=10)

    # Trigger API call
    dut.write("test_api_call")

    dut.expect("API response: 200", timeout=30)

@pytest.mark.esp32
@pytest.mark.timeout(120)
def test_ota_update(dut):
    """Test OTA update process"""
    dut.expect("System ready", timeout=30)

    # Trigger OTA
    dut.write("start_ota")

    dut.expect("OTA progress: 100%", timeout=90)
    dut.expect("OTA upgrade successful", timeout=10)
```

**Running pytest-embedded:**
```bash
pytest --target=esp32 -s
```

### Hardware-in-the-Loop (HIL) Testing

For safety-critical relay control:

```c
TEST_CASE("Relay physically switches under all conditions", "[hil][relay]") {
    // This test requires actual relay hardware connected

    // Set relay to controlled state
    set_relay_controlled(0, true);
    vTaskDelay(pdMS_TO_TICKS(100));

    // Verify voltage on relay output (requires ADC measurement)
    uint32_t voltage_mv = read_relay_output_voltage();
    TEST_ASSERT_GREATER_THAN(3000, voltage_mv);  // Expect ~3.3V

    // Set to fail-safe
    set_all_relays_fail_safe();
    vTaskDelay(pdMS_TO_TICKS(100));

    voltage_mv = read_relay_output_voltage();
    TEST_ASSERT_LESS_THAN(500, voltage_mv);  // Expect ~0V
}
```

### Automated CI Testing

**GitHub Actions Example (.github/workflows/esp32-test.yml):**
```yaml
name: ESP32 Tests

on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup ESP-IDF
      uses: espressif/esp-idf-ci-action@v1
      with:
        esp_idf_version: v5.5.1
        target: esp32

    - name: Build firmware
      run: |
        . $IDF_PATH/export.sh
        idf.py build

    - name: Build tests
      run: |
        . $IDF_PATH/export.sh
        idf.py build

    - name: Run host-based tests
      run: |
        . $IDF_PATH/export.sh
        pytest tests/host_tests/
```

### Manual Testing Checklist

Create comprehensive test plans for manual validation:

```
# Grain Bunker Fan Controller - Test Plan v1.0

## Power-On Tests
- [ ] Device boots within 10 seconds
- [ ] All relays default to fail-safe (fans ON)
- [ ] Status LED shows boot pattern
- [ ] Serial output shows no errors

## WiFi Provisioning Tests
- [ ] Provisioning AP appears within 30 seconds
- [ ] Captive portal redirects correctly
- [ ] SSID/password accepted and stored
- [ ] Device connects to WiFi after provisioning
- [ ] Re-provisioning works after factory reset

## API Communication Tests
- [ ] Device connects to API server
- [ ] TLS certificate validation works
- [ ] API commands control relays correctly
- [ ] Heartbeat timeout triggers fail-safe
- [ ] Network loss triggers fail-safe

## Fail-Safe Tests
- [ ] Power loss → fans turn ON
- [ ] Network loss (60s) → fans turn ON
- [ ] Firmware crash → fans turn ON
- [ ] Watchdog timeout → fans turn ON
- [ ] API timeout → fans turn ON

## OTA Update Tests
- [ ] OTA update downloads successfully
- [ ] Progress reported correctly
- [ ] Device reboots after update
- [ ] Rollback works on failed diagnostics
- [ ] Relays enter fail-safe during OTA

## Long-Duration Tests
- [ ] 24-hour stability test (no crashes)
- [ ] 1000 relay cycle test (no failures)
- [ ] WiFi reconnection after router reboot
- [ ] Memory leak check (heap size stable)

## Environmental Tests
- [ ] Operation at -20°C
- [ ] Operation at +60°C
- [ ] Power supply voltage 4.5V-5.5V
- [ ] EMI/EMC compliance
```

### Best Practices

1. **Test early and often** - Run tests on every commit
2. **Test on real hardware** - Simulators miss real-world issues
3. **Automate regression tests** - Use pytest-embedded for CI/CD
4. **Test failure modes** - Explicitly test error conditions
5. **Monitor test coverage** - Aim for >80% code coverage
6. **Use meaningful test names** - Describe what's being tested
7. **Keep tests fast** - Slow tests won't get run
8. **Test hardware integration** - Don't just mock everything
9. **Document test setup** - Hardware configurations, pin connections
10. **Version test data** - Store test configurations in git

### Official Documentation
- Unit Testing: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html
- pytest-embedded: https://docs.espressif.com/projects/pytest-embedded/en/latest/

---

## 11. Error Handling

### ESP-IDF Error Handling Philosophy

ESP-IDF uses `esp_err_t` return codes for systematic error management:
- Success: `ESP_OK` (0)
- Errors: `ESP_ERR_*` (negative values)
- Defined in `esp_err.h` and component-specific headers

### Error Handling Macros

**DO NOT use in production:**
```c
// ESP_ERROR_CHECK aborts on error - suitable for examples, NOT production
ESP_ERROR_CHECK(esp_wifi_init(&cfg));  // Will reboot if fails
```

**DO use in production:**
```c
#include "esp_check.h"

// Return on error with logging
esp_err_t init_wifi(void) {
    esp_err_t err;

    ESP_RETURN_ON_ERROR(nvs_flash_init(), TAG, "NVS init failed");
    ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "Netif init failed");
    ESP_RETURN_ON_ERROR(esp_event_loop_create_default(), TAG, "Event loop failed");

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&cfg), TAG, "WiFi init failed");

    return ESP_OK;
}

// Goto cleanup on error
esp_err_t complex_operation(void) {
    esp_err_t err = ESP_OK;
    resource_t *resource = NULL;

    resource = allocate_resource();
    ESP_GOTO_ON_FALSE(resource != NULL, ESP_ERR_NO_MEM, cleanup, TAG, "Resource alloc failed");

    err = perform_operation(resource);
    ESP_GOTO_ON_ERROR(err, cleanup, TAG, "Operation failed");

cleanup:
    if (resource) {
        free_resource(resource);
    }
    return err;
}
```

### Recommended Error Handling Patterns

#### Pattern 1: Retry with Timeout

```c
esp_err_t wifi_connect_with_retry(void) {
    const int MAX_RETRIES = 5;
    const int RETRY_DELAY_MS = 2000;

    for (int retry = 0; retry < MAX_RETRIES; retry++) {
        esp_err_t err = esp_wifi_connect();

        if (err == ESP_OK) {
            // Wait for connection event
            EventBits_t bits = xEventGroupWaitBits(
                wifi_event_group,
                WIFI_CONNECTED_BIT,
                pdFALSE, pdTRUE,
                pdMS_TO_TICKS(10000)
            );

            if (bits & WIFI_CONNECTED_BIT) {
                ESP_LOGI(TAG, "WiFi connected on attempt %d", retry + 1);
                return ESP_OK;
            }
        }

        ESP_LOGW(TAG, "WiFi connection failed, retry %d/%d", retry + 1, MAX_RETRIES);
        vTaskDelay(pdMS_TO_TICKS(RETRY_DELAY_MS));
    }

    ESP_LOGE(TAG, "WiFi connection failed after %d retries", MAX_RETRIES);
    return ESP_ERR_TIMEOUT;
}
```

#### Pattern 2: Graceful Degradation

```c
void app_main(void) {
    // Critical initialization - must succeed
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(init_relay_control());

    // Set to fail-safe immediately
    set_all_relays_fail_safe();

    // WiFi is important but not critical
    esp_err_t err = wifi_connect_with_retry();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "WiFi unavailable, entering local-only mode");
        system_mode = MODE_LOCAL_ONLY;
        return;  // Continue without WiFi
    }

    // API is optional - fail gracefully
    err = api_client_init();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "API unavailable, disabling cloud features");
        cloud_features_enabled = false;
    }

    // Start main application
    start_application();
}
```

#### Pattern 3: Resource Cleanup

```c
esp_err_t http_request_with_cleanup(const char *url) {
    esp_err_t err = ESP_OK;
    esp_http_client_handle_t client = NULL;
    char *response_buffer = NULL;

    // Allocate resources
    response_buffer = malloc(1024);
    ESP_GOTO_ON_FALSE(response_buffer, ESP_ERR_NO_MEM, cleanup, TAG, "Buffer alloc failed");

    esp_http_client_config_t config = {.url = url};
    client = esp_http_client_init(&config);
    ESP_GOTO_ON_FALSE(client, ESP_ERR_INVALID_STATE, cleanup, TAG, "Client init failed");

    // Perform operation
    err = esp_http_client_perform(client);
    ESP_GOTO_ON_ERROR(err, cleanup, TAG, "HTTP request failed");

    // Success path
    ESP_LOGI(TAG, "HTTP request successful");

cleanup:
    if (client) {
        esp_http_client_cleanup(client);
    }
    if (response_buffer) {
        free(response_buffer);
    }
    return err;
}
```

### Error Recovery Strategies

```c
typedef enum {
    RECOVERY_RETRY,
    RECOVERY_RESET,
    RECOVERY_FAIL_SAFE,
    RECOVERY_REBOOT,
} recovery_strategy_t;

recovery_strategy_t determine_recovery(esp_err_t err, const char *component) {
    switch (err) {
        case ESP_ERR_NO_MEM:
            ESP_LOGE(TAG, "%s: Out of memory", component);
            return RECOVERY_REBOOT;

        case ESP_ERR_TIMEOUT:
            ESP_LOGW(TAG, "%s: Timeout", component);
            return RECOVERY_RETRY;

        case ESP_ERR_INVALID_STATE:
            ESP_LOGE(TAG, "%s: Invalid state", component);
            return RECOVERY_RESET;

        case ESP_ERR_NOT_FOUND:
            ESP_LOGW(TAG, "%s: Resource not found", component);
            return RECOVERY_FAIL_SAFE;

        default:
            ESP_LOGE(TAG, "%s: Unknown error 0x%x (%s)",
                     component, err, esp_err_to_name(err));
            return RECOVERY_FAIL_SAFE;
    }
}

void handle_critical_error(esp_err_t err, const char *component) {
    recovery_strategy_t strategy = determine_recovery(err, component);

    switch (strategy) {
        case RECOVERY_RETRY:
            // Already handled by retry logic
            break;

        case RECOVERY_RESET:
            ESP_LOGW(TAG, "Resetting %s component", component);
            reset_component(component);
            break;

        case RECOVERY_FAIL_SAFE:
            ESP_LOGE(TAG, "Activating fail-safe mode");
            set_all_relays_fail_safe();
            break;

        case RECOVERY_REBOOT:
            ESP_LOGE(TAG, "Critical error, rebooting in 5 seconds...");
            vTaskDelay(pdMS_TO_TICKS(5000));
            esp_restart();
            break;
    }
}
```

### Error Logging with Context

```c
#define LOG_ERROR_WITH_CONTEXT(err, fmt, ...) \
    ESP_LOGE(TAG, "%s:%d: " fmt " (error: 0x%x - %s)", \
             __FILE__, __LINE__, ##__VA_ARGS__, err, esp_err_to_name(err))

// Usage
esp_err_t err = esp_wifi_connect();
if (err != ESP_OK) {
    LOG_ERROR_WITH_CONTEXT(err, "WiFi connection failed for SSID: %s", ssid);
    return err;
}
```

### Best Practices

1. **Never use ESP_ERROR_CHECK in production** - it aborts on error
2. **Use ESP_RETURN_ON_ERROR** for simple error propagation
3. **Use ESP_GOTO_ON_ERROR** for cleanup patterns
4. **Always check return values** - don't ignore errors
5. **Log errors with context** - include relevant state information
6. **Convert errors to names** - use `esp_err_to_name()` for readability
7. **Implement retry logic** - for transient failures
8. **Graceful degradation** - continue with reduced functionality
9. **Resource cleanup** - always free allocated resources
10. **Document error handling** - explain recovery strategies

### Common Error Codes

```c
ESP_OK               // Success (0)
ESP_FAIL             // Generic failure
ESP_ERR_NO_MEM       // Out of memory
ESP_ERR_INVALID_ARG  // Invalid argument
ESP_ERR_INVALID_STATE // Invalid state
ESP_ERR_INVALID_SIZE // Invalid size
ESP_ERR_NOT_FOUND    // Resource not found
ESP_ERR_NOT_SUPPORTED // Operation not supported
ESP_ERR_TIMEOUT      // Operation timeout
ESP_ERR_INVALID_RESPONSE // Invalid response
ESP_ERR_INVALID_CRC  // CRC or checksum error
ESP_ERR_INVALID_VERSION // Version mismatch
ESP_ERR_WIFI_*       // WiFi-specific errors
ESP_ERR_HTTP_*       // HTTP client errors
```

### Official Documentation
- Error Handling: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/error-handling.html

---

## 12. Logging Best Practices

### ESP-IDF Logging System

ESP-IDF provides a powerful logging framework with multiple verbosity levels:
- **ESP_LOGE:** Error (critical problems)
- **ESP_LOGW:** Warning (non-critical issues)
- **ESP_LOGI:** Info (high-level status)
- **ESP_LOGD:** Debug (detailed diagnostics)
- **ESP_LOGV:** Verbose (very detailed)

### Basic Logging

```c
#include "esp_log.h"

static const char *TAG = "FAN_CONTROL";

void example_function(void) {
    ESP_LOGE(TAG, "Critical relay failure on fan %d", fan_id);
    ESP_LOGW(TAG, "API connection unstable, retry count: %d", retries);
    ESP_LOGI(TAG, "Fan %d state changed: %s", fan_id, state_to_string(state));
    ESP_LOGD(TAG, "GPIO %d set to level %d", gpio_num, level);
    ESP_LOGV(TAG, "Heap free: %d bytes", esp_get_free_heap_size());
}
```

### Compile-Time Log Level Configuration

**Global level (menuconfig):**
```
Component config → Log output → Default log verbosity
```

**Per-component level:**
```c
// Set at runtime
esp_log_level_set("FAN_CONTROL", ESP_LOG_INFO);
esp_log_level_set("WIFI", ESP_LOG_WARN);
esp_log_level_set("*", ESP_LOG_ERROR);  // All other components
```

**Compile-time maximum:**
```
Component config → Log output → Maximum log verbosity
```

- Logs above this level are completely removed from binary
- Reduces flash usage and improves performance
- Production: set to ESP_LOG_INFO or ESP_LOG_WARN

### Production Logging Configuration

```c
void configure_production_logging(void) {
    // Global default: INFO level
    esp_log_level_set("*", ESP_LOG_INFO);

    // Critical components: WARN level
    esp_log_level_set("WIFI", ESP_LOG_WARN);
    esp_log_level_set("HTTP_CLIENT", ESP_LOG_WARN);

    // Safety-critical: ERROR level (always enabled)
    esp_log_level_set("RELAY_CONTROL", ESP_LOG_ERROR);
    esp_log_level_set("SAFETY_MONITOR", ESP_LOG_ERROR);

    // Sensitive components: disable completely in production
    esp_log_level_set("WIFI_PROV", ESP_LOG_NONE);
    esp_log_level_set("API_CLIENT", ESP_LOG_NONE);
}
```

### Advanced Logging Patterns

#### Pattern 1: Conditional Debug Logging

```c
// Only compiled if log level >= DEBUG
#if CONFIG_LOG_DEFAULT_LEVEL >= ESP_LOG_DEBUG
static void log_system_state(void) {
    ESP_LOGD(TAG, "=== System State ===");
    ESP_LOGD(TAG, "Free heap: %d", esp_get_free_heap_size());
    ESP_LOGD(TAG, "Uptime: %d seconds", esp_timer_get_time() / 1000000);
    ESP_LOGD(TAG, "WiFi RSSI: %d", get_wifi_rssi());
    ESP_LOGD(TAG, "===================");
}
#else
static inline void log_system_state(void) {}
#endif
```

#### Pattern 2: Structured Logging

```c
void log_fan_event(uint8_t fan_id, fan_state_t old_state, fan_state_t new_state, const char *reason) {
    ESP_LOGI(TAG, "FAN_EVENT|fan_id=%d|old_state=%s|new_state=%s|reason=%s",
             fan_id,
             fan_state_to_string(old_state),
             fan_state_to_string(new_state),
             reason);
}

// Usage
log_fan_event(1, FAN_STATE_OFF, FAN_STATE_ON, "API command");
log_fan_event(2, FAN_STATE_ON, FAN_STATE_FAIL_SAFE, "heartbeat timeout");
```

#### Pattern 3: Error Logging with Stack Trace

```c
#define LOG_ERROR_TRACE(err, msg, ...) do { \
    ESP_LOGE(TAG, msg " (0x%x - %s)", ##__VA_ARGS__, err, esp_err_to_name(err)); \
    ESP_LOGE(TAG, "  at %s:%d in %s()", __FILE__, __LINE__, __func__); \
} while(0)

// Usage
esp_err_t err = nvs_open("storage", NVS_READWRITE, &handle);
if (err != ESP_OK) {
    LOG_ERROR_TRACE(err, "Failed to open NVS namespace");
}
```

#### Pattern 4: Rate-Limited Logging

```c
void rate_limited_log(const char *message) {
    static uint32_t last_log_time = 0;
    const uint32_t LOG_INTERVAL_MS = 5000;  // Max once per 5 seconds

    uint32_t now = xTaskGetTickCount() * portTICK_PERIOD_MS;
    if ((now - last_log_time) >= LOG_INTERVAL_MS) {
        ESP_LOGW(TAG, "%s", message);
        last_log_time = now;
    }
}

// Prevents log spam in high-frequency events
while (1) {
    if (sensor_error) {
        rate_limited_log("Temperature sensor not responding");
    }
    vTaskDelay(pdMS_TO_TICKS(100));
}
```

### Logging to External Storage

```c
#include "esp_log.h"
#include "esp_vfs_fat.h"

static FILE *log_file = NULL;

int log_vprintf_to_file(const char *fmt, va_list args) {
    // Also output to UART
    vprintf(fmt, args);

    // Write to SD card
    if (log_file) {
        vfprintf(log_file, fmt, args);
        fflush(log_file);
    }

    return 0;
}

void init_file_logging(void) {
    // Mount SD card (example)
    mount_sd_card();

    // Open log file
    log_file = fopen("/sdcard/bunker_log.txt", "a");
    if (log_file) {
        // Redirect log output
        esp_log_set_vprintf(log_vprintf_to_file);
        ESP_LOGI(TAG, "File logging initialized");
    }
}
```

### Remote Logging via API

```c
typedef struct {
    char timestamp[32];
    char level[8];
    char tag[32];
    char message[256];
} log_entry_t;

QueueHandle_t log_queue;

int log_vprintf_remote(const char *fmt, va_list args) {
    // Regular UART output
    vprintf(fmt, args);

    // Parse and queue for remote transmission
    log_entry_t entry;
    snprintf(entry.timestamp, sizeof(entry.timestamp), "%llu", esp_timer_get_time());
    vsnprintf(entry.message, sizeof(entry.message), fmt, args);

    // Send to remote logging task (non-blocking)
    xQueueSend(log_queue, &entry, 0);

    return 0;
}

void remote_logging_task(void *pvParameter) {
    log_entry_t entry;

    while (1) {
        if (xQueueReceive(log_queue, &entry, pdMS_TO_TICKS(1000)) == pdTRUE) {
            // Send to API (batched for efficiency)
            send_log_to_api(&entry);
        }
    }
}
```

### Security Considerations

```c
// NEVER log sensitive data in production
void bad_logging_example(const char *api_key, const char *password) {
    ESP_LOGI(TAG, "Connecting with API key: %s", api_key);  // BAD!
    ESP_LOGI(TAG, "WiFi password: %s", password);           // BAD!
}

// Proper logging
void good_logging_example(const char *api_key, const char *password) {
    ESP_LOGI(TAG, "Connecting with API key: %s", "****");  // Good
    ESP_LOGI(TAG, "WiFi password configured: %s",
             password ? "yes" : "no");                       // Good
}

// Conditional sensitive logging (development only)
#ifdef CONFIG_LOG_SENSITIVE_DATA
    ESP_LOGD(TAG, "API key: %s", api_key);
#else
    ESP_LOGD(TAG, "API key: [REDACTED]");
#endif
```

### Best Practices

1. **Use appropriate log levels** - ERROR for failures, INFO for status, DEBUG for diagnostics
2. **Disable verbose logging in production** - Set compile-time max to INFO/WARN
3. **Use ESP_LOGx, not printf** - Provides level control and filtering
4. **Include meaningful context** - Log values, states, error codes
5. **Avoid logging in ISRs** - Use ESP_EARLY_LOGx or defer to task
6. **Rate-limit high-frequency logs** - Prevent log spam
7. **Never log credentials** - Redact passwords, API keys, tokens
8. **Use structured formats** - Makes parsing easier for monitoring tools
9. **Set per-component levels** - Fine-tune verbosity
10. **Monitor log output size** - Can impact performance over UART

### Official Documentation
- Logging Library: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/log.html

---

## 13. Power Optimization

### ESP32 Power Consumption Overview

**Active Modes:**
- WiFi TX (802.11n): ~120-160 mA
- WiFi RX: ~80-95 mA
- CPU active (160 MHz): ~40-50 mA
- CPU active (80 MHz): ~25-30 mA

**Sleep Modes:**
- Modem sleep (WiFi off): ~20-30 mA
- Light sleep: ~0.8 mA
- Deep sleep: ~10-150 µA
- Hibernation: ~2.5 µA

### Sleep Modes for Grain Bunker Application

**Consideration:** Fan control requires continuous operation and network connectivity, so **deep sleep is NOT appropriate**. However, **modem sleep** and **light sleep** can reduce power consumption.

### Modem Sleep (WiFi Power Save)

Automatically enabled when WiFi is connected:

```c
#include "esp_wifi.h"

void enable_wifi_power_save(void) {
    // Modem sleep: WiFi radio turns off between DTIM beacons
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_MIN_MODEM));

    // For more aggressive power saving (higher latency)
    // ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_MAX_MODEM));
}
```

**Trade-offs:**
- Power savings: ~60-80 mA reduction
- Latency increase: 100-300 ms for network responses
- Suitable for periodic API communication

### Light Sleep for Idle Periods

```c
#include "esp_sleep.h"
#include "esp_pm.h"

void enable_automatic_light_sleep(void) {
    // Enable automatic light sleep when idle
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 160,
        .min_freq_mhz = 80,
        .light_sleep_enable = true
    };
    ESP_ERROR_CHECK(esp_pm_configure(&pm_config));
}
```

**Automatic Light Sleep Conditions:**
- All FreeRTOS tasks are blocked
- No locks (WiFi, etc.) are held
- Wakes on interrupts or timers

### CPU Frequency Scaling

```c
void reduce_cpu_frequency(void) {
    // Lower CPU frequency when full performance not needed
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 80,   // Max 80 MHz (vs 160/240)
        .min_freq_mhz = 40,   // Min 40 MHz
        .light_sleep_enable = false
    };
    ESP_ERROR_CHECK(esp_pm_configure(&pm_config));
}
```

**Power Savings:**
- 160 MHz → 80 MHz: ~30-40% reduction
- Suitable if processing requirements are low

### GPIO Power Optimization

```c
void disable_unused_peripherals(void) {
    // Disable unused GPIO pull-ups/pull-downs
    for (int i = 0; i < GPIO_NUM_MAX; i++) {
        if (!gpio_is_used(i)) {
            gpio_set_pull_mode(i, GPIO_FLOATING);
        }
    }

    // Disable unused peripheral clocks
    // (automatically handled by ESP-IDF when not in use)
}
```

### Network Optimization

```c
void optimize_network_power(void) {
    // Reduce WiFi transmit power if close to AP
    esp_wifi_set_max_tx_power(40);  // Default: 80 (20 dBm)

    // Increase DTIM period for modem sleep efficiency
    // (requires AP configuration)

    // Use connection keep-alive to reduce reconnections
    esp_wifi_set_inactive_time(WIFI_IF_STA, 300);  // 300 seconds
}
```

### Task Scheduling Optimization

```c
void power_aware_task_design(void) {
    // BAD: Busy-wait loop
    while (1) {
        if (check_condition()) {
            do_work();
        }
    }

    // GOOD: Block on event/queue
    while (1) {
        EventBits_t bits = xEventGroupWaitBits(
            event_group,
            WORK_READY_BIT,
            pdTRUE,
            pdTRUE,
            portMAX_DELAY  // Block indefinitely, allows light sleep
        );

        if (bits & WORK_READY_BIT) {
            do_work();
        }
    }
}
```

### Relay Control Power Considerations

```c
// Use latching relays for power efficiency (hardware change)
// Standard relays: ~70-100 mA continuous coil current
// Latching relays: ~100-200 mA pulse, then 0 mA

void set_latching_relay(uint8_t relay_id, bool state) {
    // Pulse set/reset coil
    gpio_set_level(relay_set_gpio[relay_id], state ? 1 : 0);
    gpio_set_level(relay_reset_gpio[relay_id], state ? 0 : 1);

    vTaskDelay(pdMS_TO_TICKS(50));  // 50ms pulse

    // Disable both coils
    gpio_set_level(relay_set_gpio[relay_id], 0);
    gpio_set_level(relay_reset_gpio[relay_id], 0);
}
```

### Measurement and Monitoring

```c
void monitor_power_consumption(void) {
    // Estimate power consumption
    uint32_t free_heap = esp_get_free_heap_size();
    uint32_t min_free_heap = esp_get_minimum_free_heap_size();

    ESP_LOGI(TAG, "Heap: free=%d, min_free=%d", free_heap, min_free_heap);

    // Check WiFi power save status
    wifi_ps_type_t ps_type;
    esp_wifi_get_ps(&ps_type);
    ESP_LOGI(TAG, "WiFi PS mode: %d", ps_type);

    // Get current frequency
    rtc_cpu_freq_config_t freq_config;
    rtc_clk_cpu_freq_get_config(&freq_config);
    ESP_LOGI(TAG, "CPU freq: %d MHz", freq_config.freq_mhz);
}
```

### Best Practices for Grain Bunker Controller

1. **Enable WiFi modem sleep** - Suitable for periodic API communication
2. **Use appropriate CPU frequency** - 80 MHz likely sufficient
3. **Efficient task blocking** - Use queues/semaphores, not busy-wait
4. **Minimize WiFi reconnections** - Implement robust connection management
5. **Consider latching relays** - Zero holding current
6. **Power supply sizing** - Account for peak current (WiFi TX + relays)
7. **External power indicators** - Use hardware LED, not GPIO polling
8. **Batch API communications** - Reduce WiFi active time
9. **Monitor heap usage** - Leaks increase power consumption
10. **Test real-world power** - Measure with multimeter, not estimates

### Power Supply Recommendations

- **Minimum:** 5V @ 1.5A (WiFi TX + 4 standard relays)
- **Recommended:** 5V @ 2A with margin
- **Separate relay power** - Isolate JD-VCC for noise immunity
- **Bypass capacitors** - 100µF near ESP32, 10µF near relays
- **Voltage regulator** - LDO or buck for 3.3V with low dropout

### Official Documentation
- Power Management: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/power_management.html
- Sleep Modes: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/sleep_modes.html

---

## 14. Common Pitfalls

### 1. Component Manager Confusion

**Pitfall:** Manually editing CMakeLists.txt instead of using IDF Component Manager.

**Solution:**
```yaml
# idf_component.yml
dependencies:
  esp32-camera:
    version: "^2.0.0"
  espressif/led_strip:
    version: "^2.5.0"
```

Use `idf.py reconfigure` after adding dependencies.

### 2. ESP_ERROR_CHECK in Production Code

**Pitfall:** Using ESP_ERROR_CHECK(), which calls abort() on errors.

**Bad:**
```c
ESP_ERROR_CHECK(esp_wifi_connect());  // Reboots if connection fails
```

**Good:**
```c
esp_err_t err = esp_wifi_connect();
if (err != ESP_OK) {
    ESP_LOGW(TAG, "WiFi connection failed: %s", esp_err_to_name(err));
    // Implement retry or fallback logic
}
```

### 3. GPIO Input-Only Pins

**Pitfall:** Trying to use GPIO34-39 as outputs.

**Error:**
```c
gpio_set_level(GPIO_NUM_36, 1);  // FAILS - GPIO36 is input-only
```

**Solution:** Use GPIO0-33 for outputs, reserve 34-39 for inputs (ADC, buttons).

### 4. Stack Overflow in Tasks

**Pitfall:** Insufficient stack allocation, especially for TLS/HTTPS tasks.

**Symptoms:** Random crashes, watchdog triggers, heap corruption.

**Solution:**
```c
// BAD
xTaskCreate(https_task, "https", 2048, NULL, 5, NULL);

// GOOD
xTaskCreate(https_task, "https", 8192, NULL, 5, NULL);

// Monitor actual usage
UBaseType_t stack_high_water = uxTaskGetStackHighWaterMark(NULL);
ESP_LOGI(TAG, "Stack remaining: %d bytes", stack_high_water);
```

### 5. Forgetting NVS Commit

**Pitfall:** Writing to NVS but not calling `nvs_commit()`.

**Bad:**
```c
nvs_set_i32(handle, "value", 42);
nvs_close(handle);  // Data NOT saved!
```

**Good:**
```c
nvs_set_i32(handle, "value", 42);
nvs_commit(handle);  // Required!
nvs_close(handle);
```

### 6. Watchdog Timer Starvation

**Pitfall:** Long-running loops without yielding to FreeRTOS.

**Bad:**
```c
while (1) {
    expensive_computation();  // Triggers watchdog
}
```

**Good:**
```c
while (1) {
    expensive_computation();
    vTaskDelay(pdMS_TO_TICKS(10));  // Yield to other tasks
    esp_task_wdt_reset();
}
```

### 7. ISR-Unsafe Function Calls

**Pitfall:** Calling non-ISR-safe functions from interrupt handlers.

**Bad:**
```c
void IRAM_ATTR gpio_isr_handler(void *arg) {
    ESP_LOGI(TAG, "Interrupt!");  // NOT ISR-safe
    vTaskDelay(10);               // NOT ISR-safe
}
```

**Good:**
```c
void IRAM_ATTR gpio_isr_handler(void *arg) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    xQueueSendFromISR(event_queue, &event, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}
```

### 8. WiFi Connection State Assumptions

**Pitfall:** Assuming WiFi is always connected without checking events.

**Bad:**
```c
esp_wifi_connect();
// Immediately try to use network - fails if not connected
make_http_request();
```

**Good:**
```c
static bool wifi_connected = false;

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                                int32_t event_id, void *event_data) {
    if (event_id == WIFI_EVENT_STA_DISCONNECTED) {
        wifi_connected = false;
        esp_wifi_connect();  // Retry
    } else if (event_id == IP_EVENT_STA_GOT_IP) {
        wifi_connected = true;
    }
}

// Only make requests when connected
if (wifi_connected) {
    make_http_request();
}
```

### 9. Flash Partition Overflow

**Pitfall:** Application size exceeds partition size.

**Symptom:** `Error: app partition is too small for binary`

**Solution:**
```csv
# Increase app partition size in partitions.csv
factory,   app,  factory,  0x10000, 2M  # Increased from 1M
```

### 10. Memory Leaks

**Pitfall:** Allocating memory without freeing it.

**Detection:**
```c
void detect_memory_leaks(void) {
    static uint32_t last_free_heap = 0;
    uint32_t current_free_heap = esp_get_free_heap_size();

    if (last_free_heap > 0) {
        int32_t delta = (int32_t)current_free_heap - (int32_t)last_free_heap;
        if (delta < -1024) {  // Lost more than 1KB
            ESP_LOGW(TAG, "Possible memory leak: %d bytes", -delta);
        }
    }

    last_free_heap = current_free_heap;
}
```

### 11. Version Compatibility

**Pitfall:** Using Arduino-ESP32 APIs with latest ESP-IDF.

**Solution:** Check compatibility:
- Arduino-ESP32 2.x → ESP-IDF v4.4
- Arduino-ESP32 3.x → ESP-IDF v5.1

Or use pure ESP-IDF APIs.

### 12. UART Conflicts

**Pitfall:** Using GPIO1/GPIO3 (UART0) for other purposes.

**Issue:** Prevents serial monitor and bootloader communication.

**Solution:** Reserve GPIO1 (TX) and GPIO3 (RX) for UART0.

### 13. Flash Encryption Without Backup

**Pitfall:** Enabling flash encryption without backing up keys.

**Critical:** Once enabled, you CANNOT read flash without keys.

**Solution:**
1. Generate and securely store encryption keys offline
2. Test encryption in development first
3. Have recovery procedures documented

### 14. OTA Partition Table Mismatch

**Pitfall:** Changing partition table after OTA deployment.

**Issue:** OTA update fails because new firmware expects different layout.

**Solution:**
- Version partition tables
- Keep backward compatibility
- Use factory partition for recovery

### 15. Ignoring Return Values

**Pitfall:** Not checking return values from ESP-IDF functions.

**Bad:**
```c
esp_http_client_perform(client);  // Ignores errors
```

**Good:**
```c
esp_err_t err = esp_http_client_perform(client);
if (err != ESP_OK) {
    ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
    // Handle error
}
```

### Quick Reference: Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| ESP_ERROR_CHECK in production | Unexpected reboots | Use ESP_RETURN_ON_ERROR |
| Small task stack | Random crashes | Increase stack size (8KB for HTTPS) |
| No NVS commit | Data not saved | Call nvs_commit() |
| Busy-wait loop | Watchdog trigger | Add vTaskDelay() |
| ISR printf | Crash in interrupt | Use queues to defer logging |
| GPIO 34-39 output | Not working | Use GPIO 0-33 for outputs |
| No WiFi event handler | Connection issues | Implement event callbacks |
| Memory leak | Heap decreases | Monitor and fix allocations |
| Wrong partition size | Build failure | Adjust partitions.csv |
| Arduino + latest IDF | Compile errors | Check version compatibility |

---

## 15. Security Considerations

### Security Architecture Layers

1. **Hardware Security:** eFuse, Secure Boot, Flash Encryption
2. **Network Security:** TLS/HTTPS, WiFi WPA2/WPA3
3. **Application Security:** Credential management, OTA validation
4. **Physical Security:** Tamper detection, debug port access

### Secure Boot

Prevents unauthorized firmware from running:

**Enable in menuconfig:**
```
Security features → Enable hardware Secure Boot in bootloader
Security features → Secure boot version → Secure boot version 2 (RSA-PSS)
```

**Generate signing key:**
```bash
espsecure.py generate_signing_key --version 2 secure_boot_signing_key.pem
```

**Build process:**
```bash
idf.py build
espsecure.py sign_data --version 2 --keyfile secure_boot_signing_key.pem \
    build/bootloader/bootloader.bin build/bootloader/bootloader_signed.bin
```

**Important:**
- Secure boot is irreversible once enabled
- Store signing keys securely offline
- Test thoroughly before production deployment

### Flash Encryption

Encrypts firmware and data at rest:

**Enable in menuconfig:**
```
Security features → Enable flash encryption on boot
```

**Key Management:**
- Development: Re-flashable (generates new key each flash)
- Production: One-time programmable (key burned to eFuse)

**Encrypted Partitions:**
```csv
# Partitions marked "encrypted"
nvs_key,   data, nvs_keys, ,  0x1000, encrypted
factory,   app,  factory,  ,  1M,     encrypted
ota_0,     app,  ota_0,    ,  1M,     encrypted
```

**Critical:**
- Once enabled in production, device cannot be re-flashed without encryption key
- NVS encryption automatically enabled
- Plain-text debugging disabled

### WiFi Security

**Use WPA2/WPA3:**
```c
wifi_config_t wifi_config = {
    .sta = {
        .ssid = WIFI_SSID,
        .password = WIFI_PASS,
        .threshold.authmode = WIFI_AUTH_WPA2_PSK,  // Minimum WPA2
    },
};
```

**WPA3 (Enhanced Security):**
```c
.threshold.authmode = WIFI_AUTH_WPA3_PSK,
```

**WiFi Provisioning Security:**
- Always use Security 1 with Proof of Possession
- Use unique PoP per device (e.g., based on MAC address)
- Timeout provisioning mode after 10 minutes

### TLS/HTTPS Best Practices

**Certificate Validation (REQUIRED):**
```c
esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .crt_bundle_attach = esp_crt_bundle_attach,  // Verify server cert
    .timeout_ms = 5000,
};
```

**Custom CA Certificate:**
```c
extern const char ca_cert_pem_start[] asm("_binary_ca_cert_pem_start");

esp_http_client_config_t config = {
    .url = "https://private-api.example.com",
    .cert_pem = ca_cert_pem_start,  // Pinned certificate
};
```

**Mutual TLS (Client Authentication):**
```c
extern const char client_cert_pem_start[] asm("_binary_client_cert_pem_start");
extern const char client_key_pem_start[] asm("_binary_client_key_pem_start");

esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .cert_pem = client_cert_pem_start,
    .client_cert_pem = client_cert_pem_start,
    .client_key_pem = client_key_pem_start,
};
```

### Credential Storage

**NEVER store credentials in plain text:**

**Bad:**
```c
#define API_KEY "sk_live_123456789"  // Hardcoded in source
```

**Good:**
```c
// Enable NVS encryption
nvs_handle_t handle;
nvs_open_from_partition("nvs_encrypted", "creds", NVS_READONLY, &handle);
nvs_get_str(handle, "api_key", api_key_buffer, &length);
nvs_close(handle);
```

**Best: Use eFuse for device-specific secrets**
```c
// Burn device ID to eFuse (one-time programmable)
esp_efuse_write_field_blob(ESP_EFUSE_USER_DATA, device_id, 256);

// Derive API key from device ID + server-side lookup
```

### Debug Port Security

**Disable JTAG in production:**
```c
esp_efuse_write_field_cnt(ESP_EFUSE_DIS_DOWNLOAD_JTAG, 1);
```

**Disable UART download mode:**
```c
esp_efuse_write_field_cnt(ESP_EFUSE_DIS_DOWNLOAD_MODE, 1);
```

**Warning:** These are irreversible - test thoroughly first!

### OTA Security Checklist

- [x] HTTPS transport with certificate validation
- [x] Firmware signature verification
- [x] Anti-rollback protection enabled
- [x] Rollback on failed diagnostics
- [x] Version number validation
- [x] Secure storage of signing keys
- [x] Encrypted firmware distribution (optional)

### API Security

**Authentication:**
```c
char auth_header[256];
snprintf(auth_header, sizeof(auth_header), "Bearer %s", api_token);
esp_http_client_set_header(client, "Authorization", auth_header);
```

**Rate Limiting:**
```c
static uint32_t last_request_time = 0;
const uint32_t MIN_REQUEST_INTERVAL_MS = 1000;

uint32_t now = xTaskGetTickCount() * portTICK_PERIOD_MS;
if ((now - last_request_time) < MIN_REQUEST_INTERVAL_MS) {
    ESP_LOGW(TAG, "Rate limit exceeded");
    return ESP_ERR_INVALID_STATE;
}
last_request_time = now;
```

**Input Validation:**
```c
bool validate_api_response(const cJSON *json) {
    if (!cJSON_IsObject(json)) return false;

    cJSON *fan_id = cJSON_GetObjectItem(json, "fan_id");
    if (!cJSON_IsNumber(fan_id)) return false;
    if (fan_id->valueint < 0 || fan_id->valueint >= MAX_FANS) return false;

    cJSON *state = cJSON_GetObjectItem(json, "state");
    if (!cJSON_IsString(state)) return false;

    return true;
}
```

### Supply Chain Security

**Component Verification:**
```bash
# Verify ESP-IDF integrity
cd $IDF_PATH
git verify-tag v5.5.1  # Verify signed release tag

# Use official component registry
idf.py add-dependency "espressif/led_strip@^2.5.0"
```

**Dependency Pinning:**
```yaml
# idf_component.yml - pin exact versions
dependencies:
  espressif/esp_http_client:
    version: "==1.0.0"  # Exact version
```

### Logging Security

**Redact sensitive information:**
```c
void log_api_request(const char *url, const char *api_key) {
    #ifdef CONFIG_LOG_SENSITIVE_DATA
        ESP_LOGD(TAG, "API request: %s (key: %s)", url, api_key);
    #else
        ESP_LOGI(TAG, "API request: %s (key: [REDACTED])", url);
    #endif
}
```

**Disable debug logs in production:**
```
Component config → Log output → Maximum log verbosity → Info
```

### Physical Security

**Tamper Detection:**
```c
#define TAMPER_SWITCH_GPIO  GPIO_NUM_35

void init_tamper_detection(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << TAMPER_SWITCH_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .intr_type = GPIO_INTR_NEGEDGE,
    };
    gpio_config(&io_conf);
    gpio_isr_handler_add(TAMPER_SWITCH_GPIO, tamper_isr_handler, NULL);
}

void IRAM_ATTR tamper_isr_handler(void *arg) {
    // Immediate fail-safe response
    gpio_set_level(RELAY_1_GPIO, 0);
    gpio_set_level(RELAY_2_GPIO, 0);
    // ... all relays to fail-safe

    // Log tamper event
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    xEventGroupSetBitsFromISR(security_events, TAMPER_DETECTED_BIT,
                              &xHigherPriorityTaskWoken);
}
```

### Security Best Practices Summary

1. **Enable Secure Boot** - Production devices only run signed firmware
2. **Enable Flash Encryption** - Protect firmware and credentials at rest
3. **Use HTTPS/TLS** - All network communication encrypted and authenticated
4. **Encrypt NVS** - Protect stored credentials
5. **Validate OTA updates** - Signature verification + anti-rollback
6. **Use WPA2/WPA3** - Secure WiFi authentication
7. **Redact logs** - Never log passwords, keys, tokens
8. **Disable debug ports** - JTAG, UART download mode in production
9. **Input validation** - Sanitize all external data
10. **Rate limiting** - Prevent abuse of APIs
11. **Tamper detection** - Physical security monitoring
12. **Minimal privileges** - Least-privilege access for APIs
13. **Regular updates** - Keep ESP-IDF and components updated
14. **Secure development** - Code review, static analysis
15. **Incident response** - Plan for security breaches

### Official Documentation
- Security Overview: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/security.html
- Secure Boot V2: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/secure-boot-v2.html
- Flash Encryption: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/flash-encryption.html

---

## 16. Resources and Examples

### Official Espressif Resources

#### ESP-IDF Documentation
- **Programming Guide:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/index.html
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/index.html
- **Build System:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html

#### GitHub Repositories
- **ESP-IDF Main Repository:** https://github.com/espressif/esp-idf
- **ESP-IDF Examples:** https://github.com/espressif/esp-idf/tree/master/examples
- **ESP IoT Solution:** https://github.com/espressif/esp-iot-solution

#### Component Registry
- **Official Components:** https://components.espressif.com/
- **Component Documentation:** https://docs.espressif.com/projects/esp-iot-solution/

### Example Projects

#### Official ESP-IDF Examples (Most Relevant)

**WiFi Examples:**
```
esp-idf/examples/wifi/
├── getting_started/station/        # Basic WiFi connection
├── getting_started/softAP/         # Access Point mode
├── wifi_provisioning/              # WiFi provisioning
└── power_save/                     # WiFi power management
```

**Network Protocol Examples:**
```
esp-idf/examples/protocols/
├── esp_http_client/                # HTTP/HTTPS client
├── https_request/                  # Simple HTTPS GET
├── https_mbedtls/                  # TLS with custom certs
└── https_server/                   # HTTPS server
```

**System Examples:**
```
esp-idf/examples/system/
├── ota/                           # OTA update examples
├── deep_sleep/                    # Sleep mode examples
├── task_watchdog/                 # Watchdog timer
└── freertos/                      # FreeRTOS patterns
```

**Storage Examples:**
```
esp-idf/examples/storage/
├── nvs_rw_value/                  # NVS read/write
└── nvs_rw_blob/                   # NVS blob storage
```

**Security Examples:**
```
esp-idf/examples/security/
├── flash_encryption/              # Flash encryption
└── secure_boot/                   # Secure boot
```

#### Third-Party Projects

**WiFi Provisioning:**
- **ESP32 WiFi Manager:** https://github.com/Hraph/ESP32WiFiManager
- **WiFi Provisioner:** https://github.com/SanteriLindfors/WiFiProvisioner

**Industrial IoT:**
- **ESP-IDF NAT Example:** https://github.com/jonask1337/esp-idf-nat-example

### Learning Resources

#### Official Tutorials
- **ESP32 Tutorial Series:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/
- **ESP-IDF Examples README:** https://github.com/espressif/esp-idf/blob/master/examples/README.md

#### Community Resources
- **Random Nerd Tutorials:** https://randomnerdtutorials.com/projects-esp32/
- **ESP32 Forum:** https://esp32.com/
- **ESP32 Subreddit:** https://reddit.com/r/esp32

#### Books and Courses
- **FreeRTOS Course for ESP32:** https://github.com/god233012yamil/30-Day-FreeRTOS-Course-for-ESP32-Using-ESP-IDF

### Tools

#### Development Tools
- **ESP-IDF Visual Studio Code Extension:** https://marketplace.visualstudio.com/items?itemName=espressif.esp-idf-extension
- **ESP-IDF Eclipse Plugin:** https://github.com/espressif/idf-eclipse-plugin
- **PlatformIO for ESP32:** https://docs.platformio.org/en/latest/platforms/espressif32.html

#### Security Tools
- **espsecure.py:** Included with ESP-IDF for secure boot and flash encryption
- **espefuse.py:** eFuse programming and reading

#### Debugging Tools
- **ESP-IDF Monitor:** Built-in serial monitor with automatic decoding
- **OpenOCD for ESP32:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/jtag-debugging/

### Hardware Resources

#### ESP32 DevKitC Documentation
- **ESP32-DevKitC-VIE:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/hw-reference/esp32/get-started-devkitc.html
- **ESP32 Datasheet:** https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
- **ESP32 Technical Reference:** https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf

#### Pinout References
- **ESP32 Pinout:** https://randomnerdtutorials.com/esp32-pinout-reference-gpios/
- **ESP32 DevKit Pinout:** https://components101.com/microcontrollers/esp32-devkitc

### Relevant Example Code for Grain Bunker Project

#### 1. WiFi Connection with Auto-Reconnect
```
esp-idf/examples/wifi/getting_started/station/
```

#### 2. HTTPS REST API Client
```
esp-idf/examples/protocols/esp_http_client/
```

#### 3. WiFi Provisioning
```
esp-idf/examples/provisioning/wifi_prov_mgr/
```

#### 4. NVS Storage
```
esp-idf/examples/storage/nvs_rw_value/
```

#### 5. OTA Updates
```
esp-idf/examples/system/ota/simple_ota_example/
esp-idf/examples/system/ota/advanced_https_ota/
```

#### 6. Watchdog Timer
```
esp-idf/examples/system/task_watchdog/
```

#### 7. FreeRTOS Tasks
```
esp-idf/examples/system/freertos/basic_freertos_smp_usage/
```

### Testing and CI/CD

#### Testing Frameworks
- **Unity Test Framework:** Included in ESP-IDF
- **pytest-embedded:** https://docs.espressif.com/projects/pytest-embedded/en/latest/
- **CMock:** https://github.com/ThrowTheSwitch/CMock

#### CI/CD Examples
- **ESP-IDF CI Action:** https://github.com/espressif/esp-idf-ci-action

### Community Support

#### Official Channels
- **ESP32 Forum:** https://esp32.com/
- **GitHub Issues:** https://github.com/espressif/esp-idf/issues
- **Discord:** https://discord.gg/espressif

#### Stack Overflow
- **ESP32 Tag:** https://stackoverflow.com/questions/tagged/esp32
- **ESP-IDF Tag:** https://stackoverflow.com/questions/tagged/esp-idf

### Recommended Component Libraries

```yaml
# Example idf_component.yml for grain bunker project
dependencies:
  espressif/led_strip:
    version: "^2.5.0"

  # Add other useful components as needed
```

### Quick Reference Links

| Topic | Link |
|-------|------|
| ESP-IDF Getting Started | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/ |
| API Reference Index | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/index.html |
| WiFi API | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_wifi.html |
| HTTP Client API | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html |
| NVS API | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_flash.html |
| OTA API | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_https_ota.html |
| FreeRTOS | https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html |
| GPIO API | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html |
| Error Handling | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/error-handling.html |
| Security Overview | https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/security.html |

---

## Conclusion

This comprehensive guide covers modern best practices for ESP32 firmware development using ESP-IDF v5.5.1+ for your safety-critical grain bunker fan control system. Key takeaways:

### Critical Requirements for Your Project

1. **Fail-Safe Design:** Hardware-level safety using NC relay contacts
2. **Robust Networking:** Auto-reconnecting WiFi with graceful degradation
3. **Secure Storage:** NVS encryption for credentials
4. **Reliable OTA:** Signed updates with rollback protection
5. **Comprehensive Monitoring:** Multi-layer watchdog and dead-man timers
6. **Production-Ready Error Handling:** No ESP_ERROR_CHECK, proper retry logic

### Next Steps

1. Review official ESP-IDF examples for relevant patterns
2. Set up development environment with ESP-IDF v5.5.1+
3. Implement fail-safe relay control as highest priority
4. Build WiFi provisioning and API communication layers
5. Implement comprehensive testing strategy
6. Enable security features (Secure Boot, Flash Encryption) for production

### Support

- Official Documentation: https://docs.espressif.com/projects/esp-idf/
- Community Forum: https://esp32.com/
- GitHub Issues: https://github.com/espressif/esp-idf/issues

---

**Document Version:** 1.0
**Last Updated:** October 21, 2025
**ESP-IDF Version:** 5.5.1+
**Target Hardware:** ESP32-DevKitC-VIE
