/**
 * @file relay_controller.c
 * @brief Stub relay controller implementation supporting fail-safe mode.
 *
 * The full GPIO-backed controller will arrive in Story 2.2. For Story 1.7 we
 * only need to guarantee that code can signal a fail-safe condition that keeps
 * the fans running. This stub tracks state in-memory and emits diagnostic logs
 * so behaviour is observable during firmware bring-up without hardware access.
 */

#include "relay_controller.h"

#include "esp_log.h"

typedef enum {
    RELAY_STATE_ON = 0,
    RELAY_STATE_OFF = 1
} relay_state_t;

static const char *TAG = "relay_controller";
static relay_state_t s_state = RELAY_STATE_ON;
static bool s_locked = false;

void relay_controller_init(void)
{
    s_state = RELAY_STATE_ON;
    s_locked = false;
    ESP_LOGI(TAG, "Relay controller initialized (stub) - default state: %s", relay_get_state());
}

void relay_force_on(void)
{
    if (!s_locked) {
        ESP_LOGE(TAG, "Fail-safe active: forcing relay ON (fans running)");
    } else {
        ESP_LOGW(TAG, "Fail-safe already latched; relay remains ON");
    }

    s_state = RELAY_STATE_ON;
    s_locked = true;
}

bool relay_is_locked(void)
{
    return s_locked;
}

const char *relay_get_state(void)
{
    return s_state == RELAY_STATE_ON ? "ON" : "OFF";
}

