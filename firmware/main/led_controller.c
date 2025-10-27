/**
 * @file led_controller.c
 * @brief LED flash identification controller implementation.
 */

#include "led_controller.h"

static bool s_initialized = false;

#ifdef UNIT_TEST
static bool s_test_task_running = false;
static uint8_t s_test_flash_count = 0;
static bool s_test_led_state = false;
#endif

#if defined(ESP_PLATFORM)

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "sdkconfig.h"

#ifndef CONFIG_LED_GPIO_PIN
#define CONFIG_LED_GPIO_PIN 2
#endif

#define LED_GPIO_PIN              CONFIG_LED_GPIO_PIN
#define LED_TASK_STACK_SIZE       2048
#define LED_TASK_PRIORITY         3
#define LED_ON_TICKS              pdMS_TO_TICKS(200)
#define LED_OFF_TICKS             pdMS_TO_TICKS(200)
#define LED_PAUSE_TICKS           pdMS_TO_TICKS(2000)

static const char *TAG = "led_controller";
static TaskHandle_t s_led_task_handle = NULL;
static volatile uint8_t s_flash_count = 0;

static void led_gpio_configure(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GPIO_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure LED GPIO (err=%d)", (int)err);
    }
}

static void led_gpio_write(bool state)
{
    esp_err_t err = gpio_set_level(LED_GPIO_PIN, state ? 1 : 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set LED GPIO level (err=%d)", (int)err);
    }

#ifdef UNIT_TEST
    s_test_led_state = state;
#endif
}

static void led_flash_task(void *param)
{
    (void)param;

    ESP_LOGI(TAG, "LED flash task running on core %d", xPortGetCoreID());

    while (true) {
        uint8_t flash_count = s_flash_count;

        if (flash_count < 1 || flash_count > 10) {
            flash_count = 1;  // Defensive fallback
        }

        for (uint8_t i = 0; i < flash_count; ++i) {
            led_gpio_write(true);
            vTaskDelay(LED_ON_TICKS);
            led_gpio_write(false);
            vTaskDelay(LED_OFF_TICKS);
        }

        /* Short yield so updates to flash_count apply quickly without a full pause. */
        if (ulTaskNotifyTake(pdTRUE, LED_PAUSE_TICKS) > 0) {
            continue;
        }
    }
}

esp_err_t led_controller_init(void)
{
    if (s_initialized) {
        return ESP_OK;
    }

    led_gpio_configure();
    led_gpio_write(false);
    s_initialized = true;

#ifdef UNIT_TEST
    s_test_task_running = false;
    s_test_flash_count = 0;
#endif

    ESP_LOGI(TAG, "LED controller initialized (GPIO %d)", LED_GPIO_PIN);
    return ESP_OK;
}

esp_err_t led_flash_task_start(uint8_t flash_count)
{
    if (flash_count < 1 || flash_count > 10) {
        ESP_LOGE(TAG, "Invalid flash count: %u (expected 1-10)", (unsigned)flash_count);
        return ESP_ERR_INVALID_ARG;
    }

    if (!s_initialized) {
        esp_err_t err = led_controller_init();
        if (err != ESP_OK) {
            return err;
        }
    }

    s_flash_count = flash_count;

    if (s_led_task_handle != NULL) {
        ESP_LOGI(TAG, "LED flash sequence updated to %u blinks", (unsigned)flash_count);
        xTaskNotifyGive(s_led_task_handle);
#ifdef UNIT_TEST
        s_test_flash_count = flash_count;
#endif
        return ESP_OK;
    }

    BaseType_t created = xTaskCreatePinnedToCore(
        led_flash_task,
        "led_flash",
        LED_TASK_STACK_SIZE,
        NULL,
        LED_TASK_PRIORITY,
        &s_led_task_handle,
        tskNO_AFFINITY
    );

    if (created != pdPASS) {
        s_led_task_handle = NULL;
        ESP_LOGE(TAG, "Failed to create LED flash task");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "LED flash task created with sequence %u", (unsigned)flash_count);

#ifdef UNIT_TEST
    s_test_task_running = true;
    s_test_flash_count = flash_count;
#endif

    return ESP_OK;
}

void led_flash_task_stop(void)
{
    if (s_led_task_handle != NULL) {
        TaskHandle_t handle = s_led_task_handle;
        s_led_task_handle = NULL;
        vTaskDelete(handle);
        ESP_LOGI(TAG, "LED flash task stopped");
    }

    led_gpio_write(false);

#ifdef UNIT_TEST
    s_test_task_running = false;
    s_test_flash_count = 0;
#endif
}

void led_set_state(bool state)
{
    if (!s_initialized) {
        if (led_controller_init() != ESP_OK) {
            return;
        }
    }

    led_gpio_write(state);

#ifdef UNIT_TEST
    s_test_led_state = state;
#endif
}

#else /* !ESP_PLATFORM */

#include <stdio.h>

esp_err_t led_controller_init(void)
{
    s_initialized = true;
#ifdef UNIT_TEST
    s_test_task_running = false;
    s_test_flash_count = 0;
    s_test_led_state = false;
#endif
    return ESP_OK;
}

esp_err_t led_flash_task_start(uint8_t flash_count)
{
    if (flash_count < 1 || flash_count > 10) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!s_initialized) {
        esp_err_t err = led_controller_init();
        if (err != ESP_OK) {
            return err;
        }
    }

#ifdef UNIT_TEST
    s_test_task_running = true;
    s_test_flash_count = flash_count;
#else
    (void)printf("LED flash start (host stub) count=%u\n", (unsigned)flash_count);
#endif
    return ESP_OK;
}

void led_flash_task_stop(void)
{
#ifdef UNIT_TEST
    s_test_task_running = false;
    s_test_flash_count = 0;
#else
    (void)printf("LED flash stop (host stub)\n");
#endif
}

void led_set_state(bool state)
{
    if (!s_initialized) {
        esp_err_t err = led_controller_init();
        if (err != ESP_OK) {
            return;
        }
    }

#ifdef UNIT_TEST
    s_test_led_state = state;
#else
    (void)printf("LED set state (host stub): %s\n", state ? "ON" : "OFF");
#endif
}

#endif /* ESP_PLATFORM */

#ifdef UNIT_TEST
bool led_test_is_initialized(void)
{
    return s_initialized;
}

bool led_test_is_task_running(void)
{
#if defined(ESP_PLATFORM)
    return s_led_task_handle != NULL;
#else
    return s_test_task_running;
#endif
}

uint8_t led_test_get_flash_count(void)
{
#if defined(ESP_PLATFORM)
    return s_flash_count;
#else
    return s_test_flash_count;
#endif
}

bool led_test_get_led_state(void)
{
    return s_test_led_state;
}

uint32_t led_test_get_on_duration_ms(void)
{
    return 200U;
}

uint32_t led_test_get_off_duration_ms(void)
{
    return 200U;
}

uint32_t led_test_get_pause_duration_ms(void)
{
    return 2000U;
}

void led_test_reset_state(void)
{
    s_initialized = false;
    s_test_task_running = false;
    s_test_flash_count = 0;
    s_test_led_state = false;
}
#endif /* UNIT_TEST */
