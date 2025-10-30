/**
 * @file ota_updater.c
 * @brief Periodic OTA update task using ESP-IDF HTTPS OTA APIs.
 */

#include "ota_updater.h"

#include <string.h>

#include "esp_http_client.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#include "firmware_version.h"
#include "wifi_manager.h"

static const char *TAG = "ota_updater";

// External certificate (embedded via CMakeLists.txt)
extern const uint8_t server_cert_pem_start[] asm("_binary_server_cert_pem_start");
extern const uint8_t server_cert_pem_end[]   asm("_binary_server_cert_pem_end");

#define OTA_CHECK_INTERVAL_HOURS 24
#define OTA_CHECK_INTERVAL_MS (OTA_CHECK_INTERVAL_HOURS * 60 * 60 * 1000)
#define OTA_RETRY_DELAY_MS (5 * 60 * 1000)  // Retry every 5 minutes when offline

static TaskHandle_t s_ota_task = NULL;
static char s_firmware_url[256];

static uint32_t s_last_logged_percent = 0;

static esp_err_t ota_perform_update(void);
static void ota_check_task(void *pvParameters);
static esp_err_t ota_build_firmware_url(const char *server_url, char *buffer, size_t buffer_len);
static esp_err_t ota_http_event_handler(esp_http_client_event_t *evt);

esp_err_t ota_updater_start(const char *server_url)
{
    if (server_url == NULL) {
        ESP_LOGE(TAG, "Server URL is null");
        return ESP_ERR_INVALID_ARG;
    }

    esp_err_t url_ret = ota_build_firmware_url(server_url, s_firmware_url, sizeof(s_firmware_url));
    if (url_ret != ESP_OK) {
        return url_ret;
    }

    if (s_ota_task != NULL) {
        ESP_LOGW(TAG, "OTA updater task already running");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Starting OTA updater task (current firmware v%s)", FIRMWARE_VERSION);
    BaseType_t created = xTaskCreatePinnedToCore(
        ota_check_task,
        "ota_check_task",
        6144,
        NULL,
        4,
        &s_ota_task,
        1
    );

    if (created != pdPASS) {
        ESP_LOGE(TAG, "Failed to create OTA task");
        s_ota_task = NULL;
        return ESP_FAIL;
    }

    return ESP_OK;
}

static esp_err_t ota_build_firmware_url(const char *server_url, char *buffer, size_t buffer_len)
{
    if (!server_url || !buffer || buffer_len == 0) {
        return ESP_ERR_INVALID_ARG;
    }

    size_t len = strnlen(server_url, buffer_len);
    if (len == 0 || len >= buffer_len) {
        ESP_LOGE(TAG, "Server URL invalid or too long");
        return ESP_ERR_INVALID_ARG;
    }

    bool has_trailing_slash = server_url[len - 1] == '/';

    int written = snprintf(
        buffer,
        buffer_len,
        has_trailing_slash ? "%sapi/v1/firmware/latest.bin" : "%s/api/v1/firmware/latest.bin",
        server_url
    );

    if (written < 0 || (size_t)written >= buffer_len) {
        ESP_LOGE(TAG, "Firmware URL buffer too small");
        return ESP_ERR_INVALID_SIZE;
    }

    return ESP_OK;
}

static esp_err_t ota_http_event_handler(esp_http_client_event_t *evt)
{
    if (evt == NULL || evt->client == NULL) {
        return ESP_FAIL;
    }

    switch (evt->event_id) {
        case HTTP_EVENT_ON_CONNECTED: {
            s_last_logged_percent = 0;
            int64_t content_length = esp_http_client_get_content_length(evt->client);
            if (content_length > 0) {
                ESP_LOGI(TAG, "OTA download started (size: %lld bytes)", content_length);
            } else {
                ESP_LOGI(TAG, "OTA download started");
            }
            break;
        }
        case HTTP_EVENT_ON_DATA: {
            int64_t content_length = esp_http_client_get_content_length(evt->client);
            if (content_length > 0) {
                static int64_t bytes_downloaded = 0;
                bytes_downloaded += evt->data_len;
                uint32_t percent = (uint32_t)((bytes_downloaded * 100) / content_length);
                if (percent >= s_last_logged_percent + 10 || percent == 100) {
                    ESP_LOGI(TAG, "OTA progress: %u%%", percent);
                    s_last_logged_percent = percent;
                }
                if (percent == 100) {
                    bytes_downloaded = 0;
                }
            }
            break;
        }
        default:
            break;
    }

    return ESP_OK;
}

// Context for capturing version header in event handler
typedef struct {
    char version[64];
    bool found;
} version_check_context_t;

static esp_err_t version_check_http_event_handler(esp_http_client_event_t *evt)
{
    version_check_context_t *ctx = (version_check_context_t *)evt->user_data;

    switch (evt->event_id) {
        case HTTP_EVENT_ON_HEADER:
            // Check if this is the x-firmware-version header
            if (strcasecmp(evt->header_key, "x-firmware-version") == 0) {
                strncpy(ctx->version, evt->header_value, sizeof(ctx->version) - 1);
                ctx->version[sizeof(ctx->version) - 1] = '\0';
                ctx->found = true;
                ESP_LOGI(TAG, "Found firmware version header: %s", ctx->version);
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

static bool ota_check_version_changed(void)
{
    version_check_context_t ctx = {0};

    // Make HEAD request to check firmware version without downloading
    esp_http_client_config_t config = {
        .url = s_firmware_url,
        .method = HTTP_METHOD_HEAD,
        .timeout_ms = 10000,
        .cert_pem = (const char *)server_cert_pem_start,
        .event_handler = version_check_http_event_handler,
        .user_data = &ctx,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client for version check");
        return true;  // Fail open: allow update attempt if version check fails
    }

    // Perform HEAD request (this will trigger event handler for headers)
    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);

    ESP_LOGI(TAG, "HEAD request: HTTP %d", status_code);

    if (err != ESP_OK || status_code != 200) {
        ESP_LOGW(TAG, "HEAD request failed: err=%s, status=%d",
                 esp_err_to_name(err), status_code);
        esp_http_client_cleanup(client);
        return true;  // Fail open
    }

    esp_http_client_cleanup(client);

    if (!ctx.found) {
        ESP_LOGW(TAG, "No x-firmware-version header found, will attempt update");
        return true;  // No version info, attempt update
    }

    ESP_LOGI(TAG, "Server firmware version: %s", ctx.version);

    // Compare with last installed version from NVS
    nvs_handle_t nvs;
    char last_version[64] = {0};
    bool version_changed = true;

    if (nvs_open("ota", NVS_READWRITE, &nvs) == ESP_OK) {
        size_t len = sizeof(last_version);
        if (nvs_get_str(nvs, "last_version", last_version, &len) == ESP_OK) {
            ESP_LOGI(TAG, "Installed firmware version: %s", last_version);
            version_changed = (strcmp(ctx.version, last_version) != 0);
        } else {
            ESP_LOGI(TAG, "No previous version recorded");
        }

        if (!version_changed) {
            ESP_LOGI(TAG, "Firmware version unchanged, skipping OTA");
        } else {
            // Save new version to NVS after successful update
            nvs_set_str(nvs, "last_version", ctx.version);
            nvs_commit(nvs);
            ESP_LOGI(TAG, "New firmware version available, will update");
        }
        nvs_close(nvs);
    }

    return version_changed;
}

static esp_err_t ota_perform_update(void)
{
    // Check if version changed before downloading
    if (!ota_check_version_changed()) {
        ESP_LOGI(TAG, "OTA check: firmware is up to date");
        return ESP_OK;
    }

    esp_http_client_config_t http_config = {
        .url = s_firmware_url,
        .timeout_ms = 30000,
        .cert_pem = (const char *)server_cert_pem_start,  // Use embedded server certificate
        .event_handler = ota_http_event_handler,
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &http_config,
    };

    ESP_LOGI(TAG, "Downloading firmware update from %s", s_firmware_url);
    esp_err_t ret = esp_https_ota(&ota_config);

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "OTA update successful - new firmware downloaded and verified");
        ESP_LOGI(TAG, "Rebooting to apply new firmware...");
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
        return ESP_OK;  // esp_restart should not return, but keep return for completeness
    }

    ESP_LOGW(TAG, "OTA update skipped or failed: %s", esp_err_to_name(ret));
    return ret;
}

static void ota_check_task(void *pvParameters)
{
    (void)pvParameters;

    const TickType_t check_interval_ticks = pdMS_TO_TICKS(OTA_CHECK_INTERVAL_MS);
    const TickType_t retry_interval_ticks = pdMS_TO_TICKS(OTA_RETRY_DELAY_MS);

    // Delay shortly at startup to allow connectivity and provisioning tasks to settle
    vTaskDelay(pdMS_TO_TICKS(5000));

    while (1) {
        if (!wifi_manager_is_connected()) {
            ESP_LOGW(TAG, "WiFi not connected; delaying OTA check");
            vTaskDelay(retry_interval_ticks);
            continue;
        }

        esp_err_t ret = ota_perform_update();
        if (ret == ESP_OK) {
            // esp_restart should have been invoked - but if not, wait before next check
            vTaskDelay(check_interval_ticks);
            continue;
        }

        // On failure, rely on ESP-IDF rollback mechanism (AC5) and retry later
        vTaskDelay(check_interval_ticks);
    }
}
