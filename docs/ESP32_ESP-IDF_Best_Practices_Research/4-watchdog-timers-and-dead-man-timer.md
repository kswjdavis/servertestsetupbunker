# 4. Watchdog Timers and Dead-Man Timer

## ESP32 Watchdog Types

ESP32 has two watchdog timer systems:

1. **Interrupt Watchdog Timer (IWDT):** Monitors FreeRTOS task switching
2. **Task Watchdog Timer (TWDT):** Monitors specific tasks

## Task Watchdog Timer (Primary for Application Monitoring)

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

## Dead-Man Timer Pattern for Fail-Safe Fan Control

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

## Best Practices

1. **Timeout Selection:** Should be at least 2x the period between FreeRTOS ticks
2. **Critical Sections:** Keep critical sections short; defer computation to tasks
3. **ISR Considerations:** Don't call `esp_task_wdt_reset()` from ISRs
4. **Idle Task Monitoring:** Enable for production to catch CPU starvation
5. **Recovery Strategy:** Define clear actions when watchdog triggers
6. **Multi-Task Systems:** Subscribe all long-running tasks
7. **Yield Regularly:** Insert `vTaskDelay()` in long-running loops

## Preventing Watchdog Triggers

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

## Official Documentation
- Watchdogs: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/wdts.html

---
