# 7. Fail-Safe Relay Control

## Hardware Design Principles for Safety-Critical Systems

**CRITICAL REQUIREMENT:** Fans must default to ON in any failure scenario.

### Recommended Hardware Configuration

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

### Firmware Fail-Safe Patterns

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

### Multi-Layer Safety Monitoring

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

### Power-Cycle Recovery

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

## Software Watchdog Integration

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

## Best Practices

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

## Official Resources
- GPIO API: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html

---
