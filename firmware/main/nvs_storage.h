/**
 * @file nvs_storage.h
 * @brief Simple helpers for storing persistent configuration in NVS.
 */

#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define STORAGE_NAMESPACE "bunker_config"
#define STORAGE_WIFI_SSID_MAX_LEN 32
#define STORAGE_WIFI_PASSWORD_MAX_LEN 64
#define STORAGE_AUTH_TOKEN_MAX_LEN 128

/**
 * @brief Ensure the NVS namespace exists and is accessible.
 */
esp_err_t nvs_storage_init(void);

esp_err_t nvs_save_wifi_credentials(const char *ssid, const char *password);
esp_err_t nvs_load_wifi_credentials(char *ssid,
                                    size_t ssid_size,
                                    char *password,
                                    size_t password_size,
                                    bool *found);

esp_err_t nvs_save_auth_token(const char *token);
esp_err_t nvs_load_auth_token(char *token, size_t token_size, bool *found);

esp_err_t nvs_clear_wifi_credentials(void);
esp_err_t nvs_clear_auth_token(void);

#ifdef __cplusplus
}
#endif
