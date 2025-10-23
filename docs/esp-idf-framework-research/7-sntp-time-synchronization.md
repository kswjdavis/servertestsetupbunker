# 7. SNTP (Time Synchronization)

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/system_time.html
- **Example:** `examples/protocols/sntp/`
- **Header File:** `esp_sntp.h`

## Purpose
Synchronize system time with NTP servers for accurate timekeeping, required for TLS certificate validation and timer management.

## Key Features
- SNTP client for time synchronization
- Multiple NTP server support
- Automatic periodic updates
- Smooth or immediate time adjustment
- Sync notification callbacks
- 64-bit time_t (valid until 2104)

## Core API Functions

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

## Synchronization Modes

1. **Immediate Mode (SNTP_SYNC_MODE_IMMED)** - Default, updates time instantly via `settimeofday()`
2. **Smooth Mode (SNTP_SYNC_MODE_SMOOTH)** - Gradual adjustment via `adjtime()`, switches to immediate if difference >35 minutes

## Example: Initialize SNTP

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

## Example: Wait for Time Sync

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

## Example: Legacy lwIP API

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

## Multiple NTP Servers

```c
esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG_MULTIPLE(2,
    ESP_SNTP_SERVER_LIST("pool.ntp.org", "time.google.com")
);
esp_netif_sntp_init(&config);
```

## Sync Status Checking

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

## Configuration Options

### Update Interval
```
Component config → LWIP → SNTP → Request interval to update time (ms)
Default: 3600000 (1 hour)
```

### Smooth Sync
Enable smooth time adjustment in config:
```c
config.smooth_sync = true;
```

## Integration with Dead-Man Timer

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

## Timezone Configuration

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

## Best Practices

1. **Initialize after WiFi** - SNTP requires network connectivity
2. **Wait for first sync** - Use `esp_netif_sntp_sync_wait()` before critical operations
3. **Use multiple servers** - Redundancy for reliability
4. **Enable sync callback** - Monitor sync events
5. **Set timezone** - Configure local timezone if needed
6. **Check sync status** - Verify time is valid before TLS connections
7. **Minimum update interval** - Per RFC 4330, use ≥15 seconds

## Time Overflow Considerations

ESP-IDF 5.x uses 64-bit `time_t`:
- Valid range: 1970 to ~2104
- No Y2K38 problem
- SNTP/NTP timestamps follow RFC 2030 conventions

## Configuration Requirements (menuconfig)

```
Component config → LWIP:
  - Enable SNTP
  - Request interval to update time (ms): 3600000

Component config → mbedTLS:
  - Enable use of time/date (required for TLS certificate validation)
```

---
