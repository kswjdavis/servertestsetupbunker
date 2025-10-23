# 12. Logging Best Practices

## ESP-IDF Logging System

ESP-IDF provides a powerful logging framework with multiple verbosity levels:
- **ESP_LOGE:** Error (critical problems)
- **ESP_LOGW:** Warning (non-critical issues)
- **ESP_LOGI:** Info (high-level status)
- **ESP_LOGD:** Debug (detailed diagnostics)
- **ESP_LOGV:** Verbose (very detailed)

## Basic Logging

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

## Compile-Time Log Level Configuration

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

## Production Logging Configuration

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

## Advanced Logging Patterns

### Pattern 1: Conditional Debug Logging

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

### Pattern 2: Structured Logging

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

### Pattern 3: Error Logging with Stack Trace

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

### Pattern 4: Rate-Limited Logging

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

## Logging to External Storage

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

## Remote Logging via API

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

## Security Considerations

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

## Best Practices

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

## Official Documentation
- Logging Library: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/log.html

---
