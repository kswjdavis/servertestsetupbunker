/**
 * @file deadman_timer.c
 * @brief FreeRTOS-backed dead-man countdown timer with fail-safe integration.
 *
 * Implements the 5-minute watchdog described in Story 2.1. The timer
 * decrements once per second in its own FreeRTOS task, latches a fail-safe
 * relay trigger when it expires, and exposes reset and read APIs to the rest
 * of the firmware. C11 atomics guarantee thread-safe access so the task, HTTP
 * response handler, and status reporter can operate concurrently without
 * additional locking primitives.
 */

#include "deadman_timer.h"

#include <stdatomic.h>

#include "relay_controller.h"

#if defined(ESP_PLATFORM)
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#else
#include <stdio.h>

/* Lightweight log shims for host-based unit tests. */
#define ESP_LOGI(tag, fmt, ...) ((void)fprintf(stdout, "I (%s) " fmt "\n", tag, ##__VA_ARGS__))
#define ESP_LOGW(tag, fmt, ...) ((void)fprintf(stdout, "W (%s) " fmt "\n", tag, ##__VA_ARGS__))
#define ESP_LOGE(tag, fmt, ...) ((void)fprintf(stdout, "E (%s) " fmt "\n", tag, ##__VA_ARGS__))
#endif

static const char *TAG = "deadman_timer";

static atomic_uint_least32_t s_countdown_seconds = ATOMIC_VAR_INIT(DEADMAN_TIMER_INITIAL_VALUE);
static atomic_bool s_expired = ATOMIC_VAR_INIT(false);
static atomic_bool s_initialized = ATOMIC_VAR_INIT(false);

#if defined(ESP_PLATFORM)
static TaskHandle_t s_deadman_task_handle = NULL;
#endif

/**
 * @brief Execute a single one-second tick of the countdown timer.
 *
 * The function is invoked by the FreeRTOS task in production firmware and
 * is exposed to unit tests via deadman_timer_test_tick() for deterministic
 * simulation.
 */
static void deadman_timer_handle_tick(void)
{
    uint32_t snapshot = atomic_load_explicit(&s_countdown_seconds, memory_order_acquire);
    if (snapshot == 0U) {
        return;
    }

    snapshot = atomic_fetch_sub_explicit(&s_countdown_seconds, 1U, memory_order_acq_rel);

    if (snapshot == 1U) {
        bool already_expired = atomic_exchange_explicit(&s_expired, true, memory_order_acq_rel);
        if (!already_expired) {
            ESP_LOGE(TAG, "Dead-man timer expired - entering fail-safe");
            relay_force_on();
        }
    }
}

#if defined(ESP_PLATFORM)
static void deadman_timer_task(void *pvParameters)
{
    (void)pvParameters;

    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(1000U));
        deadman_timer_handle_tick();
    }
}
#endif

void deadman_timer_init(void)
{
    bool expected = false;
    if (!atomic_compare_exchange_strong_explicit(
            &s_initialized,
            &expected,
            true,
            memory_order_acq_rel,
            memory_order_acquire)) {
        return; /* Already initialized. */
    }

    atomic_store_explicit(&s_countdown_seconds, DEADMAN_TIMER_INITIAL_VALUE, memory_order_release);
    atomic_store_explicit(&s_expired, false, memory_order_release);

#if defined(ESP_PLATFORM)
    BaseType_t created = xTaskCreate(
        deadman_timer_task,
        "deadman_timer",
        2048,
        NULL,
        5,
        &s_deadman_task_handle);

    if (created != pdPASS) {
        ESP_LOGE(TAG, "Failed to create dead-man timer task (err=%ld)", (long)created);
        atomic_store_explicit(&s_initialized, false, memory_order_release);
        s_deadman_task_handle = NULL;
        return;
    }
#endif

    ESP_LOGI(TAG, "Dead-man timer initialized (%u seconds)", DEADMAN_TIMER_INITIAL_VALUE);
}

void deadman_timer_reset(void)
{
    atomic_store_explicit(&s_countdown_seconds, DEADMAN_TIMER_INITIAL_VALUE, memory_order_release);
    atomic_store_explicit(&s_expired, false, memory_order_release);
    ESP_LOGI(TAG, "Dead-man timer reset");
}

uint32_t deadman_timer_get_remaining(void)
{
    return atomic_load_explicit(&s_countdown_seconds, memory_order_acquire);
}

bool deadman_timer_is_expired(void)
{
    return atomic_load_explicit(&s_expired, memory_order_acquire);
}

#if defined(UNIT_TEST)
void deadman_timer_test_tick(void)
{
    deadman_timer_handle_tick();
}
#endif
