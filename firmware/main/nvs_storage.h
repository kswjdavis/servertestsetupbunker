/**
 * @file nvs_storage.h
 * @brief NVS (Non-Volatile Storage) Manager for Bunkercolab Firmware
 *
 * Provides encrypted storage for WiFi credentials, authentication tokens,
 * and device configuration. Uses ESP-IDF NVS with encryption enabled.
 *
 * @note All sensitive data (WiFi passwords, auth tokens) are stored encrypted
 */

#ifndef NVS_STORAGE_H
#define NVS_STORAGE_H

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// NVS Namespace Names
#define NVS_NAMESPACE_CONFIG   "config"
#define NVS_NAMESPACE_WIFI     "wifi"
#define NVS_NAMESPACE_AUTH     "auth"

// NVS Keys
#define NVS_KEY_WIFI_SSID      "wifi_ssid"
#define NVS_KEY_WIFI_PASS      "wifi_pass"
#define NVS_KEY_AUTH_TOKEN     "auth_token"
#define NVS_KEY_DEVICE_ID      "device_id"
#define NVS_KEY_PROVISIONED    "provisioned"
#define NVS_KEY_SERVER_URL     "server_url"

// Maximum string lengths
#define NVS_MAX_SSID_LEN       32
#define NVS_MAX_PASS_LEN       64
#define NVS_MAX_TOKEN_LEN      128
#define NVS_MAX_URL_LEN        256
#define NVS_MAX_DEVICE_ID_LEN  64

/**
 * @brief Initialize NVS storage with encryption
 *
 * Initializes the NVS flash partition and enables encryption.
 * Must be called before any other NVS operations.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_init(void);

/**
 * @brief Store WiFi credentials securely
 *
 * @param ssid WiFi network SSID (max 32 chars)
 * @param password WiFi password (max 64 chars)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_set_wifi_credentials(const char *ssid, const char *password);

/**
 * @brief Retrieve WiFi credentials
 *
 * @param ssid Buffer to store SSID (must be at least NVS_MAX_SSID_LEN bytes)
 * @param password Buffer to store password (must be at least NVS_MAX_PASS_LEN bytes)
 * @return ESP_OK on success, ESP_ERR_NVS_NOT_FOUND if not stored
 */
esp_err_t nvs_storage_get_wifi_credentials(char *ssid, char *password);

/**
 * @brief Store authentication token securely
 *
 * @param token Authentication token (max 128 chars)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_set_auth_token(const char *token);

/**
 * @brief Retrieve authentication token
 *
 * @param token Buffer to store token (must be at least NVS_MAX_TOKEN_LEN bytes)
 * @return ESP_OK on success, ESP_ERR_NVS_NOT_FOUND if not stored
 */
esp_err_t nvs_storage_get_auth_token(char *token);

/**
 * @brief Store device ID
 *
 * @param device_id Device unique identifier (max 64 chars)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_set_device_id(const char *device_id);

/**
 * @brief Retrieve device ID
 *
 * @param device_id Buffer to store device ID (must be at least NVS_MAX_DEVICE_ID_LEN bytes)
 * @return ESP_OK on success, ESP_ERR_NVS_NOT_FOUND if not stored
 */
esp_err_t nvs_storage_get_device_id(char *device_id);

/**
 * @brief Store server URL
 *
 * @param url Server base URL (max 256 chars)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_set_server_url(const char *url);

/**
 * @brief Retrieve server URL
 *
 * @param url Buffer to store URL (must be at least NVS_MAX_URL_LEN bytes)
 * @return ESP_OK on success, ESP_ERR_NVS_NOT_FOUND if not stored
 */
esp_err_t nvs_storage_get_server_url(char *url);

/**
 * @brief Mark device as provisioned
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_set_provisioned(bool provisioned);

/**
 * @brief Check if device has been provisioned
 *
 * @param provisioned Pointer to store provisioned status
 * @return ESP_OK on success, ESP_ERR_NVS_NOT_FOUND if not set (defaults to false)
 */
esp_err_t nvs_storage_is_provisioned(bool *provisioned);

/**
 * @brief Clear all stored data (factory reset)
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t nvs_storage_erase_all(void);

#ifdef __cplusplus
}
#endif

#endif // NVS_STORAGE_H
