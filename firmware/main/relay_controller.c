/**
 * @file relay_controller.c
 * @brief GPIO-backed relay controller with fail-safe locking semantics.
 *
 * Controls a normally-closed relay that keeps bunker ventilation fans running
 * whenever communication or firmware failures occur. The component configures
 * the relay GPIO, exposes ON/OFF helpers, and latches a fail-safe lock that
 * prevents the fans from being shut down once a critical condition occurs.
 */

#include "relay_controller.h"

#include <stdatomic.h>

#if defined(ESP_PLATFORM)
#include "driver/gpio.h"
#include "esp_err.h"
#include "esp_log.h"
#include "sdkconfig.h"
#else
#include <stdio.h>

/* Lightweight logging shims for host-based unit tests. */
#define ESP_LOGI(tag, fmt, ...) ((void)fprintf(stdout, "I (%s) " fmt "\n", tag, ##__VA_ARGS__))
#define ESP_LOGW(tag, fmt, ...) ((void)fprintf(stdout, "W (%s) " fmt "\n", tag, ##__VA_ARGS__))
#define ESP_LOGE(tag, fmt, ...) ((void)fprintf(stdout, "E (%s) " fmt "\n", tag, ##__VA_ARGS__))
#endif

#ifndef CONFIG_RELAY_GPIO_PIN
#define CONFIG_RELAY_GPIO_PIN 2
#endif

#define RELAY_GPIO CONFIG_RELAY_GPIO_PIN

typedef enum {
    RELAY_STATE_ON = 0,  /* GPIO LOW = relay closed = fans ON */
    RELAY_STATE_OFF = 1  /* GPIO HIGH = relay open = fans OFF */
} relay_state_t;

static const char *TAG = "relay_controller";
static atomic_int s_state = ATOMIC_VAR_INIT(RELAY_STATE_ON);
static atomic_bool s_locked = ATOMIC_VAR_INIT(false);

#if defined(ESP_PLATFORM)
static void relay_configure_gpio(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << RELAY_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    esp_err_t err = gpio_config(&io_conf);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure relay GPIO (err=%d)", (int)err);
    }
}

static void relay_write_level(int level)
{
    esp_err_t err = gpio_set_level(RELAY_GPIO, level);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to drive relay GPIO level (err=%d)", (int)err);
    }
}

static int relay_read_level(void)
{
    return gpio_get_level(RELAY_GPIO);
}
#else
static atomic_int s_mock_gpio_level = ATOMIC_VAR_INIT(0);

static void relay_configure_gpio(void)
{
    atomic_store_explicit(&s_mock_gpio_level, 0, memory_order_release);
}

static void relay_write_level(int level)
{
    atomic_store_explicit(&s_mock_gpio_level, level, memory_order_release);
}

static int relay_read_level(void)
{
    return atomic_load_explicit(&s_mock_gpio_level, memory_order_acquire);
}
#endif

static void relay_apply_state(relay_state_t state)
{
    int level = (state == RELAY_STATE_ON) ? 0 : 1;
    relay_write_level(level);
    atomic_store_explicit(&s_state, state, memory_order_release);
}

void relay_controller_init(void)
{
    relay_configure_gpio();
    atomic_store_explicit(&s_locked, false, memory_order_release);
    relay_apply_state(RELAY_STATE_ON);

    ESP_LOGI(TAG, "Relay controller initialized (GPIO %d)", RELAY_GPIO);
    ESP_LOGI(TAG, "Fail-safe default: fans ON (normally-closed relay)");
}

void relay_set_on(void)
{
    relay_apply_state(RELAY_STATE_ON);

    if (atomic_load_explicit(&s_locked, memory_order_acquire)) {
        ESP_LOGI(TAG, "Relay: ON (locked in fail-safe mode)");
    } else {
        ESP_LOGI(TAG, "Relay: ON (fans running)");
    }
}

void relay_set_off(void)
{
    if (atomic_load_explicit(&s_locked, memory_order_acquire)) {
        ESP_LOGW(TAG, "Cannot turn relay OFF - fail-safe lock active");
        return;
    }

    relay_apply_state(RELAY_STATE_OFF);
    ESP_LOGI(TAG, "Relay: OFF (fans stopped)");
}

void relay_force_on(void)
{
    relay_apply_state(RELAY_STATE_ON);
    bool already_locked = atomic_exchange_explicit(&s_locked, true, memory_order_acq_rel);

    if (!already_locked) {
        ESP_LOGE(TAG, "RELAY LOCKED IN ON STATE - FAIL-SAFE ACTIVE");
        ESP_LOGE(TAG, "Relay locked until device reboot");
    } else {
        ESP_LOGW(TAG, "Relay already locked in fail-safe mode");
    }
}

bool relay_is_locked(void)
{
    return atomic_load_explicit(&s_locked, memory_order_acquire);
}

const char *relay_get_state(void)
{
    relay_state_t state = (relay_state_t)atomic_load_explicit(&s_state, memory_order_acquire);
    return (state == RELAY_STATE_ON) ? "ON" : "OFF";
}

#ifdef UNIT_TEST
int relay_test_get_gpio_level(void)
{
    return relay_read_level();
}
#endif
