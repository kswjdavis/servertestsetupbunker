/**
 * @file deadman_timer.c
 * @brief Stub implementation of the dead-man countdown timer.
 *
 * The complete countdown behaviour will be implemented in Story 2.1.
 * For Story 1.8 we only need to surface a remaining-time value so the
 * status reporting payload matches the backend contract.
 */

#include "deadman_timer.h"

#include "esp_log.h"

static const char *TAG = "deadman_timer_stub";
static bool s_initialized = false;

void deadman_timer_init(void)
{
    if (!s_initialized) {
        ESP_LOGI(TAG, "Dead-man timer stub initialized");
        s_initialized = true;
    }
}

void deadman_timer_reset(void)
{
    ESP_LOGI(TAG, "Dead-man timer reset (stubbed)");
}

uint32_t deadman_timer_get_remaining(void)
{
    return DEADMAN_TIMER_INITIAL_VALUE;
}

bool deadman_timer_is_expired(void)
{
    return false;
}
