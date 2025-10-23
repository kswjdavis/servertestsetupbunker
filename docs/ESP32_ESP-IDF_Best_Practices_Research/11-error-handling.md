# 11. Error Handling

## ESP-IDF Error Handling Philosophy

ESP-IDF uses `esp_err_t` return codes for systematic error management:
- Success: `ESP_OK` (0)
- Errors: `ESP_ERR_*` (negative values)
- Defined in `esp_err.h` and component-specific headers

## Error Handling Macros

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

## Recommended Error Handling Patterns

### Pattern 1: Retry with Timeout

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

### Pattern 2: Graceful Degradation

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

### Pattern 3: Resource Cleanup

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

## Error Recovery Strategies

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

## Error Logging with Context

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

## Best Practices

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

## Common Error Codes

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

## Official Documentation
- Error Handling: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/error-handling.html

---
