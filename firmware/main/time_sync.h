/**
 * @file time_sync.h
 * @brief SNTP time synchronization helpers for TLS validation.
 */

#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize SNTP and wait for time synchronization.
 *
 * @param timeout_ms Maximum time to wait for synchronization before timing out.
 * @return ESP_OK if a valid time was obtained; ESP_ERR_TIMEOUT otherwise.
 */
esp_err_t time_sync_obtain(uint32_t timeout_ms);

#ifdef __cplusplus
}
#endif
