# 8. LED Control for Device Identification

## ESP32 GPIO Capabilities for LED Control

**ESP32-DevKitC Features:**
- 34 GPIO pins total (GPIO0-GPIO39)
- **GPIOs 34-39:** Input only (cannot drive LEDs)
- **Onboard LED:** GPIO2 (common on most DevKit boards)
- **PWM Support:** All output-capable GPIOs support LED PWM (LEDC)
- **Channels:** 16 independent LEDC channels

## Basic GPIO LED Control

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

## PWM LED Control (Breathing, Dimming)

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

## LED Status Pattern System

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

## Device Identification via API

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

## Multi-Color RGB LED (Optional)

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

## Best Practices

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

## Official Documentation
- GPIO: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html
- LEDC (PWM): https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/ledc.html

---
