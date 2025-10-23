# 5. Watchdog Timers

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/wdts.html
- **Header Files:** `esp_task_wdt.h`, `esp_int_wdt.h`

## Purpose
Monitor task execution and interrupt handling to detect software hangs and trigger system recovery or panic.

## Watchdog Types

ESP32 provides three watchdog mechanisms:

1. **Hardware Watchdog Timer** - Low-level hardware timer (automatically configured)
2. **Interrupt Watchdog Timer (IWDT)** - Monitors interrupt handlers and task switching
3. **Task Watchdog Timer (TWDT)** - Monitors task execution and idle tasks

## Task Watchdog Timer (TWDT)

The TWDT monitors tasks to ensure they execute periodically without blocking. Critical for fail-safe operation.

### Core API Functions

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

### Configuration Structure

```c
typedef struct {
    uint32_t timeout_ms;        // Watchdog timeout in milliseconds
    bool trigger_panic;         // Trigger panic on timeout (vs. print warning)
} esp_task_wdt_config_t;
```

## Example: Initialize and Use TWDT

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

## Example: User-Level Watchdog for Code Sections

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

## Interrupt Watchdog Timer (IWDT)

Monitors interrupt handlers to detect if task switching is blocked. Automatically enabled in ESP-IDF.

**Configuration (menuconfig):**
```
Component config → ESP System Settings → Interrupt watchdog timeout (ms)
```

## Configuration Options (menuconfig)

```
Component config → ESP System Settings:
  - Initialize Task Watchdog Timer on startup (CONFIG_ESP_TASK_WDT_INIT)
  - Task Watchdog timeout period (seconds) (CONFIG_ESP_TASK_WDT_TIMEOUT_S)
  - Watch CPU0 Idle Task (CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU0)
  - Watch CPU1 Idle Task (CONFIG_ESP_TASK_WDT_CHECK_IDLE_TASK_CPU1)
  - Invoke panic handler on Task Watchdog timeout (CONFIG_ESP_TASK_WDT_PANIC)

  - Interrupt watchdog timeout (ms) (CONFIG_ESP_INT_WDT_TIMEOUT_MS)
```

## Best Practices for Safety-Critical Applications

1. **Enable panic on timeout** - Set `trigger_panic = true` for fail-safe behavior
2. **Set appropriate timeout** - Long enough for normal operation, short enough to detect hangs
3. **Reset periodically** - Call `esp_task_wdt_reset()` in all monitored tasks
4. **Monitor critical tasks** - Subscribe all safety-critical tasks to TWDT
5. **Keep ISRs short** - Interrupt watchdog triggers if ISRs block task switching
6. **Increase timeout before flash ops** - Large flash erases can exceed normal timeout
7. **Use user handles** - Monitor specific code sections with user-level watchdog

## Debugging Notes

- **JTAG/OpenOCD** automatically disables hardware watchdog during debugging
- **Print warnings** - Set `trigger_panic = false` for development to log instead of panic
- **Watchdog dumps** - ESP-IDF logs which tasks failed to reset watchdog

## Integration with Dead-Man Timer

The hardware watchdog provides an additional fail-safe layer:

```c
// Software timer triggers relay ON after 5 minutes
// Hardware watchdog resets system after 10 seconds of no task activity
// Combined: ensures system recovery even if software timer fails
```

---
