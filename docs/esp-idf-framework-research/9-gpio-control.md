# 9. GPIO Control

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html
- **Header File:** `driver/gpio.h`
- **Example:** `examples/peripherals/gpio/generic_gpio/`

## Purpose
Control GPIO pins for digital output (relay, LED) and input (buttons), with interrupt support.

## Key Features
- Digital input/output control
- Internal pull-up/pull-down resistors
- Configurable drive strength
- Edge and level interrupts
- Per-pin interrupt handlers
- Output enable/disable

## Core API Functions

### Configuration
```c
esp_err_t gpio_config(const gpio_config_t *pGPIOConfig);
esp_err_t gpio_set_direction(gpio_num_t gpio_num, gpio_mode_t mode);
esp_err_t gpio_set_pull_mode(gpio_num_t gpio_num, gpio_pull_mode_t pull);
esp_err_t gpio_set_drive_capability(gpio_num_t gpio_num, gpio_drive_cap_t strength);
```

### Digital I/O
```c
esp_err_t gpio_set_level(gpio_num_t gpio_num, uint32_t level);
int gpio_get_level(gpio_num_t gpio_num);
```

### Interrupts
```c
esp_err_t gpio_set_intr_type(gpio_num_t gpio_num, gpio_int_type_t intr_type);
esp_err_t gpio_install_isr_service(int intr_alloc_flags);
esp_err_t gpio_isr_handler_add(gpio_num_t gpio_num, gpio_isr_t isr_handler, void *args);
esp_err_t gpio_isr_handler_remove(gpio_num_t gpio_num);
```

## GPIO Modes

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

## Pull Modes

```c
typedef enum {
    GPIO_PULLUP_ONLY,        // Pull-up enabled
    GPIO_PULLDOWN_ONLY,      // Pull-down enabled
    GPIO_PULLUP_PULLDOWN,    // Both enabled
    GPIO_FLOATING            // No pull resistors
} gpio_pull_mode_t;
```

## Drive Capability

```c
typedef enum {
    GPIO_DRIVE_CAP_0,  // Weakest (~5mA)
    GPIO_DRIVE_CAP_1,  // Stronger (~10mA)
    GPIO_DRIVE_CAP_2,  // Even stronger (~20mA)
    GPIO_DRIVE_CAP_3   // Strongest (~40mA)
} gpio_drive_cap_t;
```

## Example: Relay Control (Normally Closed)

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

## Example: LED Status Indicator

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

## Example: Button Input with Interrupt

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

## Configuration Structure

```c
typedef struct {
    uint64_t pin_bit_mask;        // Bitmask of pins to configure
    gpio_mode_t mode;             // GPIO mode (input/output)
    gpio_pullup_t pull_up_en;     // Pull-up enable
    gpio_pulldown_t pull_down_en; // Pull-down enable
    gpio_int_type_t intr_type;    // Interrupt type
} gpio_config_t;
```

## Interrupt Types

```c
GPIO_INTR_DISABLE      // Disable interrupt
GPIO_INTR_POSEDGE      // Rising edge
GPIO_INTR_NEGEDGE      // Falling edge
GPIO_INTR_ANYEDGE      // Both edges
GPIO_INTR_LOW_LEVEL    // Low level
GPIO_INTR_HIGH_LEVEL   // High level
```

## Best Practices for Relay Control

1. **Fail-safe initialization** - Always initialize to safe state (FANS ON)
2. **Use normally-closed relay** - Fans ON when relay is de-energized
3. **Disable pull resistors** - For relay outputs (external driver handles logic)
4. **Set drive strength** - Adjust based on relay driver circuit
5. **Atomic state changes** - Use `gpio_set_level()` for thread-safe operation
6. **Monitor state** - Log all relay state changes for debugging

## Normally-Closed Relay Pattern

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

## GPIO Pin Restrictions (ESP32)

- **GPIO 0** - Bootstrapping pin, pulled up, connected to boot button
- **GPIO 2** - Bootstrapping pin, connected to LED
- **GPIO 5** - Bootstrapping pin (VSPI SS)
- **GPIO 12** - Bootstrapping pin, sets flash voltage
- **GPIO 15** - Bootstrapping pin, pulled up
- **GPIO 34-39** - Input only, no pull-up/pull-down

**Recommended for relays:** GPIO 2, 4, 16, 17, 18, 19, 21, 22, 23

## ISR Considerations

For ISR callbacks:
- Mark ISR functions with `IRAM_ATTR` attribute
- Keep ISR short and non-blocking
- Use queues to communicate with tasks
- No printf, malloc, or blocking operations in ISR

---
