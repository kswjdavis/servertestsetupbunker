/**
 * @file main.c
 * @brief Main application entry point for Bunkercolab ESP32 Firmware
 *
 * Epic 1: Foundation & Device Communication
 * Implements WiFi connectivity, HTTPS API communication, and status reporting.
 *
 * Application Flow:
 * 1. Initialize NVS storage
 * 2. Check provisioning status
 * 3. If not provisioned: Enter provisioning mode (AP mode)
 * 4. If provisioned: Connect to WiFi
 * 5. Initialize HTTPS client
 * 6. Start status reporting task (60s interval)
 *
 * @author Bunkercolab Team
 * @date 2025
 */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "nvs_flash.h"

#include "nvs_storage.h"
#include "wifi_manager.h"
#include "http_client.h"
#include "esp_timer.h"

// Logging tag
static const char *TAG = "main";

// Application state
typedef enum {
    APP_STATE_INIT,
    APP_STATE_PROVISIONING,
    APP_STATE_CONNECTING,
    APP_STATE_OPERATIONAL,
    APP_STATE_ERROR
} app_state_t;

static app_state_t app_state = APP_STATE_INIT;

// Status reporting interval (FR23: 60 seconds)
#define STATUS_REPORT_INTERVAL_MS   60000

// Firmware version
#define FIRMWARE_VERSION "1.0.0-epic1"

/**
 * @brief WiFi event callback
 */
static void wifi_event_handler(wifi_state_t state, void *user_ctx)
{
    switch (state) {
        case WIFI_STATE_CONNECTED:
            ESP_LOGI(TAG, "WiFi connected successfully");
            app_state = APP_STATE_OPERATIONAL;
            break;

        case WIFI_STATE_DISCONNECTED:
            ESP_LOGW(TAG, "WiFi disconnected, will retry");
            break;

        case WIFI_STATE_FAILED:
            ESP_LOGE(TAG, "WiFi connection failed");
            app_state = APP_STATE_ERROR;
            break;

        default:
            break;
    }
}

/**
 * @brief Status reporting task (FR23)
 *
 * Reports device status to cloud server every 60 seconds.
 */
static void status_reporting_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Status reporting task started");

    TickType_t last_wake_time = xTaskGetTickCount();

    while (1) {
        // Wait for next reporting interval
        vTaskDelayUntil(&last_wake_time, pdMS_TO_TICKS(STATUS_REPORT_INTERVAL_MS));

        // Only report if WiFi is connected
        if (!wifi_manager_is_connected()) {
            ESP_LOGW(TAG, "Skipping status report - WiFi not connected");
            continue;
        }

        // Prepare status data
        device_status_t status = {0};

        // Get device ID from NVS
        if (nvs_storage_get_device_id(status.device_id) != ESP_OK) {
            ESP_LOGE(TAG, "Failed to get device ID from NVS");
            continue;
        }

        // Get WiFi RSSI
        status.wifi_rssi = wifi_manager_get_rssi();

        // Get system information
        status.uptime_sec = esp_timer_get_time() / 1000000; // Convert microseconds to seconds
        status.free_heap = esp_get_free_heap_size();
        status.firmware_version = FIRMWARE_VERSION;
        status.connected = true;

        // Report status to server
        http_response_t response = {0};
        esp_err_t err = http_client_report_status(&status, &response);

        if (err == ESP_OK) {
            ESP_LOGI(TAG, "Status reported successfully (HTTP %d)", response.status_code);

            if (response.status_code == HTTP_STATUS_UNAUTHORIZED) {
                ESP_LOGE(TAG, "Authentication failed - token may be invalid");
            }
        } else {
            ESP_LOGW(TAG, "Failed to report status: %s", esp_err_to_name(err));
        }

        // Cleanup response
        http_client_free_response(&response);

        // Log heap usage for monitoring
        ESP_LOGI(TAG, "Free heap: %lu bytes", status.free_heap);
    }
}

/**
 * @brief Initialize and start application
 */
void app_main(void)
{
    ESP_LOGI(TAG, "Bunkercolab Firmware v%s starting...", FIRMWARE_VERSION);
    ESP_LOGI(TAG, "Epic 1: Foundation & Device Communication");

    esp_err_t ret;

    // ========================================================================
    // Stage 1: Initialize NVS Storage (FR12)
    // ========================================================================
    ESP_LOGI(TAG, "[1/6] Initializing NVS storage...");
    ret = nvs_storage_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS: %s", esp_err_to_name(ret));
        ESP_LOGE(TAG, "FATAL ERROR - Cannot continue without NVS");
        return;
    }
    ESP_LOGI(TAG, "NVS initialized successfully");

    // ========================================================================
    // Stage 2: Check Provisioning Status
    // ========================================================================
    ESP_LOGI(TAG, "[2/6] Checking provisioning status...");
    bool provisioned = false;
    ret = nvs_storage_is_provisioned(&provisioned);

    if (!provisioned) {
        ESP_LOGW(TAG, "Device not provisioned - would enter provisioning mode");
        ESP_LOGW(TAG, "Provisioning implementation is in Epic 1 - Provisioning Component");
        ESP_LOGW(TAG, "For now, please configure WiFi and token manually in NVS");
        app_state = APP_STATE_PROVISIONING;
        // TODO: Implement provisioning mode (separate component)
        return;
    }

    ESP_LOGI(TAG, "Device is provisioned");

    // ========================================================================
    // Stage 3: Initialize Network Stack
    // ========================================================================
    ESP_LOGI(TAG, "[3/6] Initializing network stack...");

    // Initialize TCP/IP stack
    ESP_ERROR_CHECK(esp_netif_init());

    // Create default event loop
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Create default WiFi station
    esp_netif_create_default_wifi_sta();

    ESP_LOGI(TAG, "Network stack initialized");

    // ========================================================================
    // Stage 4: Initialize WiFi Manager (FR13, FR14)
    // ========================================================================
    ESP_LOGI(TAG, "[4/6] Initializing WiFi manager...");
    ret = wifi_manager_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize WiFi manager: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    // Connect to WiFi using stored credentials
    ESP_LOGI(TAG, "Connecting to WiFi...");
    ret = wifi_manager_connect(wifi_event_handler, NULL);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initiate WiFi connection: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    app_state = APP_STATE_CONNECTING;
    ESP_LOGI(TAG, "WiFi connection initiated");

    // ========================================================================
    // Stage 5: Initialize HTTPS Client (FR15, FR16)
    // ========================================================================
    ESP_LOGI(TAG, "[5/6] Initializing HTTPS client...");
    ret = http_client_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    // Load server URL from NVS
    char server_url[256] = {0};
    ret = nvs_storage_get_server_url(server_url);
    if (ret == ESP_OK) {
        http_client_set_server_url(server_url);
        ESP_LOGI(TAG, "Server URL: %s", server_url);
    } else {
        ESP_LOGE(TAG, "No server URL in NVS - device must be provisioned first");
        ESP_LOGE(TAG, "Set server URL using nvs_storage_set_server_url()");
        app_state = APP_STATE_ERROR;
        return;
    }

    // Load auth token from NVS
    char auth_token[128] = {0};
    ret = nvs_storage_get_auth_token(auth_token);
    if (ret == ESP_OK) {
        http_client_set_auth_token(auth_token);
        ESP_LOGI(TAG, "Authentication token loaded (redacted)");
    } else {
        ESP_LOGW(TAG, "No auth token in NVS");
    }

    ESP_LOGI(TAG, "HTTPS client initialized");

    // ========================================================================
    // Stage 6: Start Status Reporting Task (FR23)
    // ========================================================================
    ESP_LOGI(TAG, "[6/6] Starting status reporting task...");

    BaseType_t task_ret = xTaskCreatePinnedToCore(
        status_reporting_task,      // Task function
        "status_report",             // Task name
        4096,                        // Stack size (4KB)
        NULL,                        // Parameters
        5,                           // Priority
        NULL,                        // Task handle
        1                            // Core 1
    );

    if (task_ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create status reporting task");
        app_state = APP_STATE_ERROR;
        return;
    }

    ESP_LOGI(TAG, "Status reporting task started");
    ESP_LOGI(TAG, "==============================================");
    ESP_LOGI(TAG, "Bunkercolab firmware initialization complete");
    ESP_LOGI(TAG, "==============================================");
}
