/**
 * @file nvs_storage.c
 * @brief NVS Storage Implementation
 *
 * Implements encrypted non-volatile storage for WiFi credentials,
 * authentication tokens, and device configuration.
 */

#include "nvs_storage.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "nvs_storage";

// NVS handle (opened once during init)
static bool nvs_initialized = false;

/**
 * @brief Initialize NVS storage with encryption
 */
esp_err_t nvs_storage_init(void)
{
    if (nvs_initialized) {
        ESP_LOGW(TAG, "NVS already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing NVS flash...");

    // Initialize NVS
    esp_err_t ret = nvs_flash_init();

    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        // NVS partition was truncated and needs to be erased
        ESP_LOGW(TAG, "NVS partition needs erasing, erasing...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS: %s", esp_err_to_name(ret));
        return ret;
    }

    // Note: NVS encryption is enabled via sdkconfig (CONFIG_NVS_ENCRYPTION=y)
    // Flash encryption must be enabled for NVS encryption to work
    ESP_LOGI(TAG, "NVS flash initialized successfully");

    nvs_initialized = true;
    return ESP_OK;
}

/**
 * @brief Store WiFi credentials securely
 */
esp_err_t nvs_storage_set_wifi_credentials(const char *ssid, const char *password)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!ssid || !password) {
        ESP_LOGE(TAG, "Invalid parameters: ssid or password is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(ssid) > NVS_MAX_SSID_LEN || strlen(password) > NVS_MAX_PASS_LEN) {
        ESP_LOGE(TAG, "SSID or password too long");
        return ESP_ERR_INVALID_SIZE;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    // Open NVS handle for WiFi namespace
    ret = nvs_open(NVS_NAMESPACE_WIFI, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s",
                 NVS_NAMESPACE_WIFI, esp_err_to_name(ret));
        return ret;
    }

    // Store SSID
    ret = nvs_set_str(nvs_handle, NVS_KEY_WIFI_SSID, ssid);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set WiFi SSID: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    // Store password (encrypted by NVS)
    ret = nvs_set_str(nvs_handle, NVS_KEY_WIFI_PASS, password);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set WiFi password: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    // Commit changes to flash
    ret = nvs_commit(nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS changes: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "WiFi credentials stored successfully (SSID: %s)", ssid);
    return ESP_OK;
}

/**
 * @brief Retrieve WiFi credentials
 */
esp_err_t nvs_storage_get_wifi_credentials(char *ssid, char *password)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!ssid || !password) {
        ESP_LOGE(TAG, "Invalid parameters: ssid or password is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    // Open NVS handle for WiFi namespace
    ret = nvs_open(NVS_NAMESPACE_WIFI, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s",
                 NVS_NAMESPACE_WIFI, esp_err_to_name(ret));
        return ret;
    }

    // Get SSID (buffer size includes null terminator)
    size_t ssid_len = NVS_MAX_SSID_LEN + 1;
    ret = nvs_get_str(nvs_handle, NVS_KEY_WIFI_SSID, ssid, &ssid_len);
    if (ret != ESP_OK) {
        if (ret == ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "WiFi SSID not found in NVS");
        } else {
            ESP_LOGE(TAG, "Failed to get WiFi SSID: %s", esp_err_to_name(ret));
        }
        nvs_close(nvs_handle);
        return ret;
    }

    // Get password (buffer size includes null terminator)
    size_t pass_len = NVS_MAX_PASS_LEN + 1;
    ret = nvs_get_str(nvs_handle, NVS_KEY_WIFI_PASS, password, &pass_len);
    if (ret != ESP_OK) {
        if (ret == ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "WiFi password not found in NVS");
        } else {
            ESP_LOGE(TAG, "Failed to get WiFi password: %s", esp_err_to_name(ret));
        }
        nvs_close(nvs_handle);
        return ret;
    }

    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "WiFi credentials retrieved successfully (SSID: %s)", ssid);
    return ESP_OK;
}

/**
 * @brief Store authentication token securely
 */
esp_err_t nvs_storage_set_auth_token(const char *token)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!token) {
        ESP_LOGE(TAG, "Invalid parameter: token is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(token) > NVS_MAX_TOKEN_LEN) {
        ESP_LOGE(TAG, "Token too long");
        return ESP_ERR_INVALID_SIZE;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    // Open NVS handle for auth namespace
    ret = nvs_open(NVS_NAMESPACE_AUTH, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s",
                 NVS_NAMESPACE_AUTH, esp_err_to_name(ret));
        return ret;
    }

    // Store token (encrypted by NVS)
    ret = nvs_set_str(nvs_handle, NVS_KEY_AUTH_TOKEN, token);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set auth token: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    // Commit changes to flash
    ret = nvs_commit(nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS changes: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    nvs_close(nvs_handle);

    // Never log the actual token value
    ESP_LOGI(TAG, "Auth token stored successfully (length: %zu)", strlen(token));
    return ESP_OK;
}

/**
 * @brief Retrieve authentication token
 */
esp_err_t nvs_storage_get_auth_token(char *token)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!token) {
        ESP_LOGE(TAG, "Invalid parameter: token is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    // Open NVS handle for auth namespace
    ret = nvs_open(NVS_NAMESPACE_AUTH, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s",
                 NVS_NAMESPACE_AUTH, esp_err_to_name(ret));
        return ret;
    }

    // Get token (buffer size includes null terminator)
    size_t token_len = NVS_MAX_TOKEN_LEN + 1;
    ret = nvs_get_str(nvs_handle, NVS_KEY_AUTH_TOKEN, token, &token_len);
    if (ret != ESP_OK) {
        if (ret == ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "Auth token not found in NVS");
        } else {
            ESP_LOGE(TAG, "Failed to get auth token: %s", esp_err_to_name(ret));
        }
        nvs_close(nvs_handle);
        return ret;
    }

    nvs_close(nvs_handle);

    // Never log the actual token value
    ESP_LOGI(TAG, "Auth token retrieved successfully (length: %d)", strlen(token));
    return ESP_OK;
}

/**
 * @brief Store device ID
 */
esp_err_t nvs_storage_set_device_id(const char *device_id)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!device_id) {
        ESP_LOGE(TAG, "Invalid parameter: device_id is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(device_id) > NVS_MAX_DEVICE_ID_LEN) {
        ESP_LOGE(TAG, "Device ID too long");
        return ESP_ERR_INVALID_SIZE;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = nvs_set_str(nvs_handle, NVS_KEY_DEVICE_ID, device_id);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set device ID: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    ret = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "Device ID stored: %s", device_id);
    return ret;
}

/**
 * @brief Retrieve device ID
 */
esp_err_t nvs_storage_get_device_id(char *device_id)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!device_id) {
        ESP_LOGE(TAG, "Invalid parameter: device_id is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        return ret;
    }

    size_t len = NVS_MAX_DEVICE_ID_LEN + 1;  // Buffer size includes null terminator
    ret = nvs_get_str(nvs_handle, NVS_KEY_DEVICE_ID, device_id, &len);
    nvs_close(nvs_handle);

    return ret;
}

/**
 * @brief Store server URL
 */
esp_err_t nvs_storage_set_server_url(const char *url)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!url) {
        ESP_LOGE(TAG, "Invalid parameter: url is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(url) > NVS_MAX_URL_LEN) {
        ESP_LOGE(TAG, "URL too long");
        return ESP_ERR_INVALID_SIZE;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = nvs_set_str(nvs_handle, NVS_KEY_SERVER_URL, url);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set server URL: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    ret = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "Server URL stored: %s", url);
    return ret;
}

/**
 * @brief Retrieve server URL
 */
esp_err_t nvs_storage_get_server_url(char *url)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!url) {
        ESP_LOGE(TAG, "Invalid parameter: url is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        return ret;
    }

    size_t len = NVS_MAX_URL_LEN + 1;  // Buffer size includes null terminator
    ret = nvs_get_str(nvs_handle, NVS_KEY_SERVER_URL, url, &len);
    nvs_close(nvs_handle);

    return ret;
}

/**
 * @brief Mark device as provisioned
 */
esp_err_t nvs_storage_set_provisioned(bool provisioned)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace: %s", esp_err_to_name(ret));
        return ret;
    }

    ret = nvs_set_u8(nvs_handle, NVS_KEY_PROVISIONED, provisioned ? 1 : 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to set provisioned flag: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }

    ret = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "Provisioned flag set to: %d", provisioned);
    return ret;
}

/**
 * @brief Check if device has been provisioned
 */
esp_err_t nvs_storage_is_provisioned(bool *provisioned)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!provisioned) {
        ESP_LOGE(TAG, "Invalid parameter: provisioned is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t ret;

    ret = nvs_open(NVS_NAMESPACE_CONFIG, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        // If namespace doesn't exist, device is not provisioned
        *provisioned = false;
        return ESP_OK;
    }

    uint8_t value = 0;
    ret = nvs_get_u8(nvs_handle, NVS_KEY_PROVISIONED, &value);
    nvs_close(nvs_handle);

    if (ret == ESP_ERR_NVS_NOT_FOUND) {
        // Key not found means not provisioned
        *provisioned = false;
        return ESP_OK;
    } else if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get provisioned flag: %s", esp_err_to_name(ret));
        return ret;
    }

    *provisioned = (value != 0);
    return ESP_OK;
}

/**
 * @brief Clear all stored data (factory reset)
 */
esp_err_t nvs_storage_erase_all(void)
{
    if (!nvs_initialized) {
        ESP_LOGE(TAG, "NVS not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGW(TAG, "Erasing all NVS data (factory reset)...");

    esp_err_t ret = nvs_flash_erase();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase NVS: %s", esp_err_to_name(ret));
        return ret;
    }

    // Reinitialize NVS after erase
    nvs_initialized = false;
    ret = nvs_storage_init();

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Factory reset completed successfully");
    }

    return ret;
}
