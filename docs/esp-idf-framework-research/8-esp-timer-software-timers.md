# 8. ESP Timer (Software Timers)

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_timer.html
- **Header File:** `esp_timer.h`

## Purpose
High-resolution software timers with microsecond precision for delayed and periodic actions, including dead-man countdown timer implementation.

## Key Features
- Microsecond resolution timers
- One-shot and periodic timer modes
- Task or ISR dispatch methods
- Callback-based execution
- Light sleep integration
- Automatic clock frequency adjustment

## Timer Types

1. **One-shot timers** - Execute callback once upon expiration, then stop
2. **Periodic timers** - Automatically restart after each expiration until manually stopped

## Dispatch Methods

1. **ESP_TIMER_TASK** (default) - Callbacks dispatched from high-priority ESP Timer task
   - Serialize callback execution
   - Safe for non-time-critical operations
   - Can use blocking operations

2. **ESP_TIMER_ISR** - Callbacks executed directly from interrupt handler
   - Lower latency (~microseconds)
   - Must be non-blocking, no printf, no malloc
   - Use for time-critical operations only

## Core API Functions

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

## Configuration Structure

```c
typedef struct {
    esp_timer_cb_t callback;           // Timer callback function
    void *arg;                         // Argument passed to callback
    esp_timer_dispatch_t dispatch_method;  // ESP_TIMER_TASK or ESP_TIMER_ISR
    const char *name;                  // Timer name for debugging
    bool skip_unhandled_events;        // Skip missed events (periodic only)
} esp_timer_create_args_t;
```

## Example: Dead-Man Countdown Timer (5 Minutes)

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

## Example: Periodic Status Report Timer

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

## Accuracy Characteristics

**Minimum practical timeouts (ESP32 @ 240 MHz):**
- One-shot timers: ~20 microseconds
- Periodic timers: ~50 microseconds

Lower CPU frequencies increase minimum timeouts. For sub-microsecond precision, use hardware timers (GPTimer, RMT).

## Timer Precision

```c
// Get current time in microseconds
int64_t start_time = esp_timer_get_time();

// ... perform operation ...

int64_t end_time = esp_timer_get_time();
int64_t elapsed_us = end_time - start_time;

ESP_LOGI(TAG, "Operation took %lld microseconds", elapsed_us);
```

## Light Sleep Integration

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

## Debugging

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

## Best Practices

1. **Use task dispatch for most cases** - ISR dispatch only when necessary
2. **Keep callbacks short** - Offload work to tasks via queues
3. **Check timer state** - Use `esp_timer_is_active()` before stop/restart
4. **Handle expiration properly** - Implement fail-safe logic in callbacks
5. **Monitor timer drift** - Use profiling for time-critical applications
6. **Stop timers before delete** - Ensure timer is stopped before deletion
7. **Use descriptive names** - Helps debugging with `esp_timer_dump()`

## Integration Example: Complete Dead-Man System

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
