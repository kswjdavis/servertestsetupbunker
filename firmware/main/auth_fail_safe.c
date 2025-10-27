/**
 * @file auth_fail_safe.c
 * @brief Implementation of the authentication fail-safe latch.
 *
 * The fail-safe ensures bunker fans default to ON state whenever authentication
 * with the backend cannot succeed. The latch only triggers once per reboot to
 * avoid repeated relay toggling.
 */

#include "auth_fail_safe.h"

#include <stdatomic.h>
#include <string.h>

#include "http_client.h"
#include "relay_controller.h"

#if defined(ESP_PLATFORM)
#include "esp_log.h"
#else
#include <stdio.h>
#define ESP_LOGE(tag, fmt, ...) ((void)fprintf(stderr, "E (%s) " fmt "\n", tag, ##__VA_ARGS__))
#define ESP_LOGW(tag, fmt, ...) ((void)fprintf(stderr, "W (%s) " fmt "\n", tag, ##__VA_ARGS__))
#endif

static const char *TAG = "auth_fail_safe";
static atomic_bool s_auth_fail_safe_active = ATOMIC_VAR_INIT(false);
#if defined(UNIT_TEST)
static atomic_uint s_activation_count = ATOMIC_VAR_INIT(0U);
#endif

bool auth_fail_safe_trigger(const char *reason, int status_code, const char *response_body)
{
    bool already_active = atomic_load_explicit(&s_auth_fail_safe_active, memory_order_acquire);
    if (already_active) {
        ESP_LOGW(TAG, "Auth fail-safe already active; ignoring duplicate trigger");
        return false;
    }

    bool expected = false;
    if (!atomic_compare_exchange_strong_explicit(
            &s_auth_fail_safe_active,
            &expected,
            true,
            memory_order_acq_rel,
            memory_order_acquire)) {
        ESP_LOGW(TAG, "Auth fail-safe already active (CAS); ignoring duplicate trigger");
        return false;
    }

    if (reason != NULL && strlen(reason) > 0) {
        ESP_LOGE(TAG, "Authentication failure: %s", reason);
    } else {
        ESP_LOGE(TAG, "Authentication failure: unspecified reason");
    }

    if (status_code > 0) {
        ESP_LOGE(TAG, "Server response status: %d", status_code);
    }

    if (response_body != NULL && strlen(response_body) > 0) {
        ESP_LOGE(TAG, "Server response body: %s", response_body);
    }

    ESP_LOGE(TAG, "Entering fail-safe mode due to authentication failure");

    relay_force_on();
    http_client_clear_auth_token();

#if defined(UNIT_TEST)
    atomic_fetch_add_explicit(&s_activation_count, 1U, memory_order_relaxed);
#endif

    return true;
}

bool auth_fail_safe_is_active(void)
{
    return atomic_load_explicit(&s_auth_fail_safe_active, memory_order_acquire);
}

#if defined(UNIT_TEST)
void auth_fail_safe_reset_for_test(void)
{
    atomic_store_explicit(&s_auth_fail_safe_active, false, memory_order_release);
    atomic_store_explicit(&s_activation_count, 0U, memory_order_release);
}

unsigned int auth_fail_safe_get_activation_count(void)
{
    return atomic_load_explicit(&s_activation_count, memory_order_acquire);
}
#endif
