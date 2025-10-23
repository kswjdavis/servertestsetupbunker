#include "nvs_storage.h"

#include <string.h>

#include "esp_log.h"
#include "nvs.h"

static const char *TAG = "nvs_storage";

static esp_err_t with_namespace(nvs_open_mode mode, nvs_handle_t *handle)
{
    return nvs_open(STORAGE_NAMESPACE, mode, handle);
}

esp_err_t nvs_storage_init(void)
{
    nvs_handle_t handle;
    esp_err_t err = with_namespace(NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s", STORAGE_NAMESPACE, esp_err_to_name(err));
        return err;
    }
    nvs_close(handle);
    return ESP_OK;
}

static esp_err_t save_string(const char *key, const char *value)
{
    nvs_handle_t handle;
    esp_err_t err = with_namespace(NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_str(handle, key, value);
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }
    nvs_close(handle);
    return err;
}

static esp_err_t load_string(const char *key, char *buffer, size_t buffer_size, bool *found)
{
    nvs_handle_t handle;
    esp_err_t err = with_namespace(NVS_READONLY, &handle);
    if (err != ESP_OK) {
        if (found) {
            *found = false;
        }
        return err;
    }

    size_t required = 0;
    err = nvs_get_str(handle, key, NULL, &required);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        if (found) {
            *found = false;
        }
        nvs_close(handle);
        return ESP_OK;
    }
    if (err != ESP_OK) {
        nvs_close(handle);
        return err;
    }

    if (required > buffer_size) {
        nvs_close(handle);
        return ESP_ERR_NVS_INVALID_LENGTH;
    }

    err = nvs_get_str(handle, key, buffer, &required);
    if (err == ESP_OK && found) {
        *found = true;
    }
    nvs_close(handle);
    return err;
}

esp_err_t nvs_save_wifi_credentials(const char *ssid, const char *password)
{
    if (ssid == NULL || password == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    ESP_LOGI(TAG, "Saving WiFi credentials for SSID '%s'", ssid);
    // NOTE: Password is NOT logged for security
    esp_err_t err = save_string("wifi_ssid", ssid);
    if (err != ESP_OK) {
        return err;
    }
    return save_string("wifi_password", password);
}

esp_err_t nvs_load_wifi_credentials(char *ssid,
                                    size_t ssid_size,
                                    char *password,
                                    size_t password_size,
                                    bool *found)
{
    bool ssid_found = false;
    bool password_found = false;
    esp_err_t err = load_string("wifi_ssid", ssid, ssid_size, &ssid_found);
    if (err != ESP_OK) {
        return err;
    }
    err = load_string("wifi_password", password, password_size, &password_found);
    if (err != ESP_OK) {
        return err;
    }

    if (found) {
        *found = ssid_found && password_found;
    }
    return ESP_OK;
}

esp_err_t nvs_save_auth_token(const char *token)
{
    if (token == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    ESP_LOGI(TAG, "Saving auth token (%zu bytes)", strlen(token));
    // NOTE: Token value is NOT logged for security
    return save_string("auth_token", token);
}

esp_err_t nvs_load_auth_token(char *token, size_t token_size, bool *found)
{
    return load_string("auth_token", token, token_size, found);
}

static esp_err_t clear_key(const char *key)
{
    nvs_handle_t handle;
    esp_err_t err = with_namespace(NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }
    err = nvs_erase_key(handle, key);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        err = ESP_OK;
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }
    nvs_close(handle);
    return err;
}

esp_err_t nvs_clear_wifi_credentials(void)
{
    esp_err_t err = clear_key("wifi_ssid");
    if (err != ESP_OK) {
        return err;
    }
    return clear_key("wifi_password");
}

esp_err_t nvs_clear_auth_token(void)
{
    return clear_key("auth_token");
}
