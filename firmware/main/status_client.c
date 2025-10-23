#include "status_client.h"

#include <stdbool.h>
#include <string.h>

#include "cJSON.h"
#include "esp_err.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_tls.h"

#include "nvs_storage.h"
#include "wifi_manager.h"

static const char *TAG = "status_client";

extern const uint8_t root_cert_pem_start[] asm("_binary_certs_root_cert_pem_start");
extern const uint8_t root_cert_pem_end[] asm("_binary_certs_root_cert_pem_end");

#ifndef CONFIG_STATUS_ENDPOINT_URL
#define STATUS_ENDPOINT_URL "https://api.bunkercolab.local/api/v1/control/status"
#endif

static esp_err_t build_status_payload(char **out_json)
{
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }

    cJSON_AddStringToObject(root, "device_mac", wifi_manager_mac_address());
    cJSON_AddNumberToObject(root, "uptime_ms", (double)(esp_timer_get_time() / 1000));
    cJSON_AddBoolToObject(root, "connected", wifi_manager_is_connected());

    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (json == NULL) {
        return ESP_ERR_NO_MEM;
    }

    *out_json = json;
    return ESP_OK;
}

static esp_err_t parse_response(const char *payload, status_response_t *out_response)
{
    if (out_response == NULL) {
        return ESP_OK;
    }

    cJSON *root = cJSON_Parse(payload);
    if (root == NULL) {
        ESP_LOGE(TAG, "Failed to parse JSON response");
        return ESP_FAIL;
    }

    cJSON *shutdown_allowed = cJSON_GetObjectItemCaseSensitive(root, "shutdown_allowed");
    cJSON *reset_countdown = cJSON_GetObjectItemCaseSensitive(root, "reset_countdown");
    cJSON *server_time = cJSON_GetObjectItemCaseSensitive(root, "server_time");

    out_response->shutdown_allowed = cJSON_IsBool(shutdown_allowed) ? cJSON_IsTrue(shutdown_allowed) : false;
    out_response->reset_countdown = cJSON_IsBool(reset_countdown) ? cJSON_IsTrue(reset_countdown) : false;

    if (cJSON_IsString(server_time) && (server_time->valuestring != NULL)) {
        strlcpy(out_response->server_time, server_time->valuestring, sizeof(out_response->server_time));
    } else {
        out_response->server_time[0] = '\0';
    }

    cJSON_Delete(root);
    return ESP_OK;
}

static esp_err_t perform_request(const char *auth_token, status_response_t *response)
{
    char *json_payload = NULL;
    esp_err_t err = build_status_payload(&json_payload);
    if (err != ESP_OK) {
        return err;
    }

    esp_http_client_config_t config = {
        .url = STATUS_ENDPOINT_URL,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .cert_pem = (const char *)root_cert_pem_start,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        cJSON_free(json_payload);
        return ESP_ERR_NO_MEM;
    }

    char auth_header[STORAGE_AUTH_TOKEN_MAX_LEN + 16];
    snprintf(auth_header, sizeof(auth_header), "Bearer %s", auth_token);

    esp_http_client_set_header(client, "Authorization", auth_header);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_payload, strlen(json_payload));

    err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        if (status_code < 200 || status_code >= 300) {
            ESP_LOGE(TAG, "HTTP status %d received", status_code);
            err = ESP_FAIL;
        } else {
            int content_length = esp_http_client_get_content_length(client);
            if (content_length < 0) {
                content_length = 0;
            }

            char response_buffer[512] = {0};
            int len = esp_http_client_read_response(client, response_buffer, sizeof(response_buffer) - 1);
            if (len >= 0) {
                response_buffer[len] = '\0';
                ESP_LOGI(TAG, "Response: %s", response_buffer);
                err = parse_response(response_buffer, response);
            } else {
                ESP_LOGE(TAG, "Failed to read HTTP response body: %d", len);
                err = ESP_FAIL;
            }
        }
    } else {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    cJSON_free(json_payload);
    return err;
}

esp_err_t status_client_sync(status_response_t *response)
{
    char token[STORAGE_AUTH_TOKEN_MAX_LEN + 1] = {0};
    bool token_found = false;
    esp_err_t err = nvs_load_auth_token(token, sizeof(token), &token_found);
    if (err != ESP_OK || !token_found) {
        ESP_LOGE(TAG, "Auth token not found in NVS (err=%s)", esp_err_to_name(err));
        return ESP_ERR_NOT_FOUND;
    }

    const int max_attempts = 3;
    int delay_ms = 1000;
    for (int attempt = 1; attempt <= max_attempts; ++attempt) {
        err = perform_request(token, response);
        if (err == ESP_OK) {
            return ESP_OK;
        }

        ESP_LOGW(TAG, "Attempt %d/%d failed (%s)", attempt, max_attempts, esp_err_to_name(err));
        if (attempt < max_attempts) {
            ESP_LOGI(TAG, "Retrying in %d ms", delay_ms);
            vTaskDelay(pdMS_TO_TICKS(delay_ms));
            delay_ms *= 2;
        }
    }

    ESP_LOGE(TAG, "Status sync failed after %d attempts", max_attempts);
    return err;
}
