/**
 * @file provisioning.h
 * @brief Simplified SoftAP provisioning flow for first-boot credential entry.
 */

#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#include "nvs_storage.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char ssid[STORAGE_WIFI_SSID_MAX_LEN + 1];
    char password[STORAGE_WIFI_PASSWORD_MAX_LEN + 1];
    char auth_token[STORAGE_AUTH_TOKEN_MAX_LEN + 1];
    bool has_auth_token;
} provisioning_result_t;

/**
 * @brief Launch SoftAP provisioning flow.
 *
 * @param mac_bytes MAC address bytes used to generate unique SoftAP SSID.
 * @param result    Output buffer populated with captured credentials.
 */
esp_err_t provisioning_run(const uint8_t mac_bytes[6], provisioning_result_t *result);

#ifdef __cplusplus
}
#endif
