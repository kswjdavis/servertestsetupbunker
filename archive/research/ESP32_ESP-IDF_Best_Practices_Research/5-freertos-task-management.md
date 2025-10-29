# 5. FreeRTOS Task Management

## ESP32 FreeRTOS Overview

ESP-IDF uses FreeRTOS with symmetric multiprocessing (SMP) support for dual-core ESP32:
- Core 0 (PRO_CPU): Protocol CPU
- Core 1 (APP_CPU): Application CPU

## Task Creation Pattern

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

## Recommended Task Architecture for Fan Control System

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

## Task Synchronization Primitives

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

## Stack Size Guidelines

- **Minimal tasks (LED blink):** 2048 bytes
- **WiFi/Network tasks:** 4096-8192 bytes
- **TLS/HTTPS tasks:** 8192-16384 bytes
- **General application:** 4096 bytes
- Monitor actual usage: `uxTaskGetStackHighWaterMark(NULL)`

## Best Practices

1. **Pin time-critical tasks** to specific cores for deterministic behavior
2. **Use appropriate priorities** - too many high-priority tasks starve others
3. **Minimize stack allocation** - heap is limited on ESP32
4. **Always include delays** in infinite loops to prevent watchdog triggers
5. **Delete tasks properly** - call `vTaskDelete()` before exiting
6. **Monitor stack usage** in development to right-size allocations
7. **Use task names** for debugging (viewable in crash dumps)
8. **Avoid blocking indefinitely** - use timeouts in queue/semaphore operations

## IoT-Specific Optimizations

- Idle task extensions for deep/light sleep (automatic in ESP-IDF)
- Optimized tick rate for low-power applications (CONFIG_FREERTOS_HZ)
- Automatic WiFi/Bluetooth task management

## Official Documentation
- FreeRTOS Overview: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html
- FreeRTOS API: https://www.freertos.org/a00106.html

---
