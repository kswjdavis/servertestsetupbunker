/**
 * @file http_client.c
 * @brief HTTPS REST API Client Implementation
 *
 * Implements secure HTTPS communication with TLS certificate validation,
 * token-based authentication, and JSON request/response handling.
 */

#include "http_client.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "esp_sntp.h"
#include "esp_timer.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>
#include <time.h>
#include "http_client_utils.h"
#include "nvs_storage.h"

static const char *TAG = "http_client";

// Client state
typedef struct {
    char server_url[256];
    char auth_token[128];
    bool initialized;
    bool time_synced;
    esp_err_t last_error;
    bool auth_token_loaded;
} http_client_state_t;

static http_client_state_t s_http_state = {
    .server_url = {0},
    .auth_token = {0},
    .initialized = false,
    .time_synced = false,
    .last_error = ESP_OK,
    .auth_token_loaded = false
};

// Forward declarations
static esp_err_t sync_time_sntp(void);
static esp_err_t http_perform_request(const char *url, esp_http_client_method_t method,
                                       const char *post_data, http_response_t *response);

/**
 * @brief Initialize HTTP client and sync time via SNTP
 */
esp_err_t http_client_init(void)
{
    if (s_http_state.initialized) {
        ESP_LOGW(TAG, "HTTP client already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing HTTPS client...");

    // Synchronize time via SNTP for TLS certificate validation
    esp_err_t ret = sync_time_sntp();
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Time sync failed: %s (continuing anyway)", esp_err_to_name(ret));
        // Don't fail initialization - time sync may succeed later
    } else {
        s_http_state.time_synced = true;
        ESP_LOGI(TAG, "Time synchronized successfully");
    }

    s_http_state.initialized = true;
    ESP_LOGI(TAG, "HTTPS client initialized");

    return ESP_OK;
}

/**
 * @brief Set authentication token
 */
esp_err_t http_client_set_auth_token(const char *token)
{
    if (!token) {
        ESP_LOGE(TAG, "Invalid token");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(token) >= sizeof(s_http_state.auth_token)) {
        ESP_LOGE(TAG, "Token too long");
        return ESP_ERR_INVALID_SIZE;
    }

    memset(s_http_state.auth_token, 0, sizeof(s_http_state.auth_token));
    strncpy(s_http_state.auth_token, token, sizeof(s_http_state.auth_token) - 1);
    s_http_state.auth_token_loaded = strlen(s_http_state.auth_token) > 0;

    if (s_http_state.auth_token_loaded) {
        ESP_LOGI(TAG, "Authentication token set (first 8 chars): %.8s...", s_http_state.auth_token);
    } else {
        ESP_LOGW(TAG, "Authentication token cleared - empty token provided");
    }

    return ESP_OK;
}

/**
 * @brief Set base server URL
 */
esp_err_t http_client_set_server_url(const char *url)
{
    if (!url) {
        ESP_LOGE(TAG, "Invalid URL");
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(url) >= sizeof(s_http_state.server_url)) {
        ESP_LOGE(TAG, "URL too long");
        return ESP_ERR_INVALID_SIZE;
    }

    strncpy(s_http_state.server_url, url, sizeof(s_http_state.server_url) - 1);
    ESP_LOGI(TAG, "Server URL set: %s", url);

    return ESP_OK;
}

/**
 * @brief Report device status to server (FR23)
 */
esp_err_t http_client_report_status(const device_status_t *status, server_decision_t *decision)
{
    if (!s_http_state.initialized) {
        ESP_LOGE(TAG, "HTTP client not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!status || !status->relay_state || !status->firmware_version) {
        ESP_LOGE(TAG, "Invalid status parameter");
        return ESP_ERR_INVALID_ARG;
    }

    if (decision) {
        decision->shutdown_allowed = false;
        decision->reset_countdown = false;
        decision->server_time[0] = '\0';
        decision->status_code = 0;
        decision->valid = false;
    }

    // Build endpoint URL
    char url[512];
    snprintf(url, sizeof(url), "%s/api/v1/control/status", s_http_state.server_url);

    // Create JSON payload
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        ESP_LOGE(TAG, "Failed to create JSON object");
        return ESP_ERR_NO_MEM;
    }

    cJSON_AddStringToObject(root, "relay_state", status->relay_state);
    cJSON_AddNumberToObject(root, "uptime_seconds", status->uptime_seconds);
    cJSON_AddNumberToObject(root, "wifi_rssi", status->wifi_rssi);
    cJSON_AddNumberToObject(root, "countdown_timer_remaining", status->countdown_timer_remaining);
    cJSON_AddStringToObject(root, "firmware_version", status->firmware_version);

    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_string) {
        ESP_LOGE(TAG, "Failed to serialize JSON");
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGD(TAG, "Status report payload: %s", json_string);

    http_response_t response = {0};
    esp_err_t ret = http_perform_request(url, HTTP_METHOD_POST, json_string, &response);

    free(json_string);

    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Failed to report status: %s", esp_err_to_name(ret));
        http_client_free_response(&response);
        return ret;
    }

    ESP_LOGI(TAG, "Status reported successfully (HTTP %d)", response.status_code);

    if (decision) {
        decision->status_code = response.status_code;
    }

    if (response.status_code == HTTP_STATUS_OK && response.body && decision) {
        cJSON *json = cJSON_Parse(response.body);
        if (json) {
            cJSON *shutdown = cJSON_GetObjectItemCaseSensitive(json, "shutdown_allowed");
            if (cJSON_IsBool(shutdown)) {
                decision->shutdown_allowed = cJSON_IsTrue(shutdown);
            }

            cJSON *reset = cJSON_GetObjectItemCaseSensitive(json, "reset_countdown");
            if (cJSON_IsBool(reset)) {
                decision->reset_countdown = cJSON_IsTrue(reset);
            }

            cJSON *server_time = cJSON_GetObjectItemCaseSensitive(json, "server_time");
            if (cJSON_IsString(server_time) && server_time->valuestring) {
                strncpy(decision->server_time, server_time->valuestring, sizeof(decision->server_time) - 1);
                decision->server_time[sizeof(decision->server_time) - 1] = '\0';
            } else {
                decision->server_time[0] = '\0';
            }

            decision->valid = true;
            cJSON_Delete(json);
        } else {
            ESP_LOGW(TAG, "Failed to parse server response JSON");
        }
    } else if (response.status_code != HTTP_STATUS_OK && response.body) {
        ESP_LOGW(TAG, "Server responded with HTTP %d: %s", response.status_code, response.body);
    }

    http_client_free_response(&response);
    return ret;
}

/**
 * @brief Provision device and obtain authentication token
 */
esp_err_t http_client_provision_device(const char *device_id, char *token)
{
    if (!s_http_state.initialized) {
        ESP_LOGE(TAG, "HTTP client not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!device_id || !token) {
        ESP_LOGE(TAG, "Invalid parameters");
        return ESP_ERR_INVALID_ARG;
    }

    // Build endpoint URL
    char url[512];
    snprintf(url, sizeof(url), "%s/api/v1/devices/provision", s_http_state.server_url);

    // Create JSON payload
    cJSON *root = cJSON_CreateObject();
    if (!root) {
        ESP_LOGE(TAG, "Failed to create JSON object");
        return ESP_ERR_NO_MEM;
    }

    cJSON_AddStringToObject(root, "device_id", device_id);

    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_string) {
        ESP_LOGE(TAG, "Failed to serialize JSON");
        return ESP_ERR_NO_MEM;
    }

    // Perform HTTP POST
    http_response_t response = {0};
    esp_err_t ret = http_perform_request(url, HTTP_METHOD_POST, json_string, &response);

    free(json_string);

    if (ret != ESP_OK || response.status_code != HTTP_STATUS_OK) {
        ESP_LOGE(TAG, "Provisioning failed: %s (HTTP %d)",
                 esp_err_to_name(ret), response.status_code);
        http_client_free_response(&response);
        return ret != ESP_OK ? ret : ESP_FAIL;
    }

    // Parse response to extract auth token and LED flash sequence
    if (response.body) {
        cJSON *json = cJSON_Parse(response.body);
        if (json) {
            cJSON *token_obj = cJSON_GetObjectItemCaseSensitive(json, "auth_token");
            if (!cJSON_IsString(token_obj)) {
                token_obj = cJSON_GetObjectItemCaseSensitive(json, "token");
            }

            if (cJSON_IsString(token_obj)) {
                strncpy(token, token_obj->valuestring, 127);
                token[127] = '\0';
                ESP_LOGI(TAG, "Device provisioned successfully - auth token received");
                ret = ESP_OK;
            } else {
                ESP_LOGE(TAG, "Auth token not found in provisioning response");
                ret = ESP_FAIL;
            }

            cJSON *sequence_obj = cJSON_GetObjectItemCaseSensitive(json, "led_flash_sequence");
            if (cJSON_IsNumber(sequence_obj)) {
                int sequence = sequence_obj->valueint;
                esp_err_t seq_ret = nvs_storage_set_led_flash_sequence((uint8_t)sequence);
                if (seq_ret == ESP_OK) {
                    ESP_LOGI(TAG, "LED flash sequence stored from provisioning response: %d", sequence);
                } else {
                    ESP_LOGE(TAG, "Failed to persist LED flash sequence: %s", esp_err_to_name(seq_ret));
                }
            } else {
                ESP_LOGW(TAG, "LED flash sequence missing from provisioning response");
            }
            cJSON_Delete(json);
        } else {
            ESP_LOGE(TAG, "Failed to parse JSON response");
            ret = ESP_FAIL;
        }
    }

    http_client_free_response(&response);
    return ret;
}

/**
 * @brief Perform generic GET request
 */
esp_err_t http_client_get(const char *endpoint, http_response_t *response)
{
    if (!s_http_state.initialized) {
        ESP_LOGE(TAG, "HTTP client not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    char url[512];
    snprintf(url, sizeof(url), "%s%s", s_http_state.server_url, endpoint);

    return http_perform_request(url, HTTP_METHOD_GET, NULL, response);
}

/**
 * @brief Perform generic POST request
 */
esp_err_t http_client_post(const char *endpoint, const char *json_body, http_response_t *response)
{
    if (!s_http_state.initialized) {
        ESP_LOGE(TAG, "HTTP client not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    char url[512];
    snprintf(url, sizeof(url), "%s%s", s_http_state.server_url, endpoint);

    return http_perform_request(url, HTTP_METHOD_POST, json_body, response);
}

/**
 * @brief Free HTTP response resources
 */
void http_client_free_response(http_response_t *response)
{
    if (response && response->body) {
        free(response->body);
        response->body = NULL;
        response->body_len = 0;
    }
}

/**
 * @brief Check if TLS connection is secure
 */
bool http_client_is_secure(void)
{
    return s_http_state.time_synced;
}

/**
 * @brief Get last HTTP error code
 */
esp_err_t http_client_get_last_error(void)
{
    return s_http_state.last_error;
}

/**
 * @brief Deinitialize HTTP client
 */
esp_err_t http_client_deinit(void)
{
    if (!s_http_state.initialized) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Deinitializing HTTP client");

    // Clear sensitive data
    memset(s_http_state.auth_token, 0, sizeof(s_http_state.auth_token));
    memset(s_http_state.server_url, 0, sizeof(s_http_state.server_url));

    s_http_state.initialized = false;
    s_http_state.time_synced = false;

    return ESP_OK;
}

bool http_client_has_auth_token(void)
{
    return s_http_state.auth_token_loaded && strlen(s_http_state.auth_token) > 0;
}

void http_client_clear_auth_token(void)
{
    memset(s_http_state.auth_token, 0, sizeof(s_http_state.auth_token));
    s_http_state.auth_token_loaded = false;
    ESP_LOGW(TAG, "Authentication token cleared");
}

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * @brief HTTP event handler callback
 */
static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGD(TAG, "HTTP_EVENT_ERROR");
            break;
        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;
        case HTTP_EVENT_HEADER_SENT:
            ESP_LOGD(TAG, "HTTP_EVENT_HEADER_SENT");
            break;
        case HTTP_EVENT_ON_HEADER:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_HEADER: %s: %s", evt->header_key, evt->header_value);
            break;
        case HTTP_EVENT_ON_DATA:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
            if (evt->user_data) {
                http_response_t *resp = (http_response_t *)evt->user_data;
                // Accumulate response body
                char *new_body = realloc(resp->body, resp->body_len + evt->data_len + 1);
                if (new_body) {
                    memcpy(new_body + resp->body_len, evt->data, evt->data_len);
                    resp->body_len += evt->data_len;
                    new_body[resp->body_len] = '\0';
                    resp->body = new_body;
                }
            }
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_FINISH");
            break;
        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
        default:
            break;
    }
    return ESP_OK;
}

/**
 * @brief Perform HTTP request
 */
static esp_err_t http_perform_request(const char *url, esp_http_client_method_t method,
                                       const char *post_data, http_response_t *response)
{
    if (!url) {
        ESP_LOGE(TAG, "Invalid URL");
        return ESP_ERR_INVALID_ARG;
    }

    // Ensure time is synced before HTTPS requests (for TLS certificate validation)
    if (!s_http_state.time_synced) {
        ESP_LOGI(TAG, "Time not yet synced, attempting SNTP sync before HTTPS request...");
        esp_err_t ret = sync_time_sntp();
        if (ret == ESP_OK) {
            s_http_state.time_synced = true;
            ESP_LOGI(TAG, "Time synchronized successfully");
        } else {
            ESP_LOGW(TAG, "SNTP sync failed: %s - TLS validation may fail", esp_err_to_name(ret));
        }
    }

    ESP_LOGI(TAG, "HTTP %s: %s", method == HTTP_METHOD_GET ? "GET" : "POST", url);

    // Initialize response if provided
    if (response) {
        memset(response, 0, sizeof(http_response_t));
    }

    // Configure HTTP client
    esp_http_client_config_t config = {
        .url = url,
        .method = method,
        .timeout_ms = HTTP_CLIENT_TIMEOUT_MS,
        .transport_type = HTTP_TRANSPORT_OVER_SSL,
        .crt_bundle_attach = esp_crt_bundle_attach,  // Use certificate bundle (FR15)
        .event_handler = http_event_handler,
        .user_data = response,
        .buffer_size = HTTP_CLIENT_MAX_RESPONSE_SIZE,
        .buffer_size_tx = 1024,
    };

    esp_err_t err = ESP_FAIL;

    for (size_t attempt = 0; attempt < HTTP_RETRY_MAX_ATTEMPTS; ++attempt) {
        esp_http_client_handle_t client = esp_http_client_init(&config);
        if (!client) {
            ESP_LOGE(TAG, "Failed to initialize HTTP client");
            err = ESP_FAIL;
            break;
        }

        // Set headers
        esp_http_client_set_header(client, "User-Agent", HTTP_CLIENT_USER_AGENT);
        esp_http_client_set_header(client, "Content-Type", "application/json");

        // Add authentication header if token is set (FR16)
        if (strlen(s_http_state.auth_token) > 0) {
            char auth_header[256];
            snprintf(auth_header, sizeof(auth_header), "Bearer %s", s_http_state.auth_token);
            esp_http_client_set_header(client, "Authorization", auth_header);
            ESP_LOGD(TAG, "Authorization header set (first 8 chars): %.8s...", s_http_state.auth_token);
        }

        // Set POST data if provided
        if (method == HTTP_METHOD_POST && post_data) {
            esp_http_client_set_post_field(client, post_data, strlen(post_data));
        }

        err = esp_http_client_perform(client);

        if (err == ESP_OK) {
            int status_code = esp_http_client_get_status_code(client);
            int content_length = esp_http_client_get_content_length(client);

            ESP_LOGI(TAG, "HTTP Status = %d, content_length = %d", status_code, content_length);

            if (response) {
                response->status_code = status_code;
                response->timestamp = esp_timer_get_time() / 1000; // milliseconds
            }

            s_http_state.last_error = ESP_OK;
            esp_http_client_cleanup(client);
            return ESP_OK;
        }

        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        s_http_state.last_error = err;

        esp_http_client_cleanup(client);

        if (!http_client_should_retry(attempt)) {
            break;
        }

        const uint32_t delay_ms = http_client_backoff_delay_ms(attempt);
        ESP_LOGW(TAG, "Retrying HTTPS request in %u ms (attempt %zu of %u)",
                 delay_ms, attempt + 2U, HTTP_RETRY_MAX_ATTEMPTS);
        vTaskDelay(pdMS_TO_TICKS(delay_ms));
    }

    return err;
}

/**
 * @brief Synchronize time via SNTP
 *
 * Required for TLS certificate validation (certificate expiry checks).
 */
static esp_err_t sync_time_sntp(void)
{
    ESP_LOGI(TAG, "Initializing SNTP time synchronization...");

    // Configure SNTP
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_setservername(1, "time.nist.gov");
    esp_sntp_init();

    // Wait for time to be set
    time_t now = 0;
    struct tm timeinfo = {0};
    int retry = 0;
    const int retry_count = 15; // Wait up to 15 seconds

    while (!http_client_time_is_valid(&timeinfo) && ++retry < retry_count) {
        ESP_LOGD(TAG, "Waiting for system time to be set... (%d/%d)", retry, retry_count);
        vTaskDelay(pdMS_TO_TICKS(1000));
        time(&now);
        localtime_r(&now, &timeinfo);
    }

    if (!http_client_time_is_valid(&timeinfo)) {
        ESP_LOGE(TAG, "Failed to sync time via SNTP");
        return ESP_ERR_TIMEOUT;
    }

    char strftime_buf[64];
    strftime(strftime_buf, sizeof(strftime_buf), "%c", &timeinfo);
    ESP_LOGI(TAG, "Time synchronized: %s", strftime_buf);

    return ESP_OK;
}
