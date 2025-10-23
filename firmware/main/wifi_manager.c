/**
 * @file wifi_manager.c
 * @brief WiFi Manager Implementation
 *
 * Implements WiFi connection management with automatic reconnection strategy:
 * - First 5 attempts: every 30 seconds (FR14)
 * - Subsequent attempts: every 2 minutes (FR14)
 */

#include "wifi_manager.h"
#include "nvs_storage.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/timers.h"
#include <string.h>

static const char *TAG = "wifi_manager";

// Event group bits
#define WIFI_CONNECTED_BIT    BIT0
#define WIFI_FAIL_BIT         BIT1

// Internal state
typedef struct {
    wifi_state_t state;
    uint8_t retry_count;
    bool should_reconnect;
    char ssid[33];
    char password[65];
    wifi_event_callback_t callback;
    void *callback_ctx;
    EventGroupHandle_t event_group;
    TimerHandle_t reconnect_timer;
    int8_t last_rssi;
    uint32_t connect_time;
} wifi_manager_state_t;

static wifi_manager_state_t s_wifi_state = {
    .state = WIFI_STATE_IDLE,
    .retry_count = 0,
    .should_reconnect = false,
    .callback = NULL,
    .callback_ctx = NULL,
    .event_group = NULL,
    .reconnect_timer = NULL,
    .last_rssi = 0,
    .connect_time = 0
};

// Forward declarations
static void wifi_event_handler_internal(void* arg, esp_event_base_t event_base,
                                        int32_t event_id, void* event_data);
static void reconnect_timer_callback(TimerHandle_t xTimer);
static void start_reconnect_timer(void);
static void notify_state_change(wifi_state_t new_state);

/**
 * @brief Initialize WiFi manager
 */
esp_err_t wifi_manager_init(void)
{
    if (s_wifi_state.event_group != NULL) {
        ESP_LOGW(TAG, "WiFi manager already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing WiFi manager...");

    // Create event group for WiFi events
    s_wifi_state.event_group = xEventGroupCreate();
    if (s_wifi_state.event_group == NULL) {
        ESP_LOGE(TAG, "Failed to create event group");
        return ESP_FAIL;
    }

    // Create reconnection timer
    s_wifi_state.reconnect_timer = xTimerCreate(
        "wifi_reconnect",                       // Timer name
        pdMS_TO_TICKS(WIFI_FAST_RETRY_INTERVAL_MS), // Initial period
        pdFALSE,                                // One-shot timer
        NULL,                                   // Timer ID
        reconnect_timer_callback                // Callback function
    );

    if (s_wifi_state.reconnect_timer == NULL) {
        ESP_LOGE(TAG, "Failed to create reconnection timer");
        vEventGroupDelete(s_wifi_state.event_group);
        s_wifi_state.event_group = NULL;
        return ESP_FAIL;
    }

    // Initialize WiFi with default configuration
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_err_t ret = esp_wifi_init(&cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize WiFi: %s", esp_err_to_name(ret));
        xTimerDelete(s_wifi_state.reconnect_timer, 0);
        vEventGroupDelete(s_wifi_state.event_group);
        s_wifi_state.event_group = NULL;
        s_wifi_state.reconnect_timer = NULL;
        return ret;
    }

    // Register event handlers
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                &wifi_event_handler_internal, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                                &wifi_event_handler_internal, NULL));

    // Set WiFi mode to station
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    // Start WiFi
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "WiFi manager initialized successfully");
    return ESP_OK;
}

/**
 * @brief Connect to WiFi using stored credentials
 */
esp_err_t wifi_manager_connect(wifi_event_callback_t callback, void *user_ctx)
{
    if (s_wifi_state.event_group == NULL) {
        ESP_LOGE(TAG, "WiFi manager not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    // Load credentials from NVS
    char ssid[NVS_MAX_SSID_LEN] = {0};
    char password[NVS_MAX_PASS_LEN] = {0};

    esp_err_t ret = nvs_storage_get_wifi_credentials(ssid, password);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get WiFi credentials from NVS: %s", esp_err_to_name(ret));
        return ret;
    }

    return wifi_manager_connect_with_credentials(ssid, password, callback, user_ctx);
}

/**
 * @brief Connect to WiFi with explicit credentials
 */
esp_err_t wifi_manager_connect_with_credentials(
    const char *ssid,
    const char *password,
    wifi_event_callback_t callback,
    void *user_ctx)
{
    if (s_wifi_state.event_group == NULL) {
        ESP_LOGE(TAG, "WiFi manager not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (!ssid || !password) {
        ESP_LOGE(TAG, "Invalid parameters");
        return ESP_ERR_INVALID_ARG;
    }

    ESP_LOGI(TAG, "Connecting to WiFi SSID: %s", ssid);

    // Store credentials
    strncpy(s_wifi_state.ssid, ssid, sizeof(s_wifi_state.ssid) - 1);
    strncpy(s_wifi_state.password, password, sizeof(s_wifi_state.password) - 1);
    s_wifi_state.callback = callback;
    s_wifi_state.callback_ctx = user_ctx;
    s_wifi_state.should_reconnect = true;
    s_wifi_state.retry_count = 0;

    // Configure WiFi station
    wifi_config_t wifi_config = {
        .sta = {
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
            .pmf_cfg = {
                .capable = true,
                .required = false
            },
        },
    };

    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, password, sizeof(wifi_config.sta.password));

    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    // Connect
    esp_err_t ret = esp_wifi_connect();
    if (ret == ESP_OK) {
        s_wifi_state.state = WIFI_STATE_CONNECTING;
        notify_state_change(WIFI_STATE_CONNECTING);
    }

    return ret;
}

/**
 * @brief Disconnect from WiFi
 */
esp_err_t wifi_manager_disconnect(void)
{
    if (s_wifi_state.event_group == NULL) {
        ESP_LOGE(TAG, "WiFi manager not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Disconnecting from WiFi");

    // Stop reconnection attempts
    s_wifi_state.should_reconnect = false;
    xTimerStop(s_wifi_state.reconnect_timer, 0);

    return esp_wifi_disconnect();
}

/**
 * @brief Get current WiFi status
 */
esp_err_t wifi_manager_get_status(wifi_status_t *status)
{
    if (!status) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_wifi_state.event_group == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    status->state = s_wifi_state.state;
    status->retry_count = s_wifi_state.retry_count;
    status->rssi = s_wifi_state.last_rssi;
    strncpy(status->ssid, s_wifi_state.ssid, sizeof(status->ssid) - 1);

    if (s_wifi_state.state == WIFI_STATE_CONNECTED) {
        wifi_ap_record_t ap_info;
        if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
            memcpy(status->bssid, ap_info.bssid, 6);
            status->rssi = ap_info.rssi;
            s_wifi_state.last_rssi = ap_info.rssi;
        }

        // Get IP address
        esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (netif) {
            esp_netif_ip_info_t ip_info;
            if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK) {
                status->ip_addr = ip_info.ip.addr;
            }
        }

        // Calculate uptime
        status->uptime_sec = (xTaskGetTickCount() - s_wifi_state.connect_time) / 1000;
    } else {
        status->ip_addr = 0;
        status->uptime_sec = 0;
        memset(status->bssid, 0, 6);
    }

    return ESP_OK;
}

/**
 * @brief Check if WiFi is connected
 */
bool wifi_manager_is_connected(void)
{
    return (s_wifi_state.state == WIFI_STATE_CONNECTED);
}

/**
 * @brief Get current signal strength
 */
int8_t wifi_manager_get_rssi(void)
{
    if (s_wifi_state.state != WIFI_STATE_CONNECTED) {
        return 0;
    }

    wifi_ap_record_t ap_info;
    if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
        s_wifi_state.last_rssi = ap_info.rssi;
        return ap_info.rssi;
    }

    return s_wifi_state.last_rssi;
}

/**
 * @brief Start WiFi scan
 */
esp_err_t wifi_manager_scan(uint16_t max_ap, wifi_ap_record_t *ap_records, uint16_t *ap_count)
{
    if (!ap_records || !ap_count) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_wifi_state.event_group == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    ESP_LOGI(TAG, "Starting WiFi scan...");

    // Start scan
    esp_err_t ret = esp_wifi_scan_start(NULL, true);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start scan: %s", esp_err_to_name(ret));
        return ret;
    }

    // Get scan results
    uint16_t number = max_ap;
    ret = esp_wifi_scan_get_ap_records(&number, ap_records);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get scan results: %s", esp_err_to_name(ret));
        return ret;
    }

    *ap_count = number;
    ESP_LOGI(TAG, "Found %d access points", number);

    return ESP_OK;
}

/**
 * @brief Reset retry count
 */
esp_err_t wifi_manager_reset_retry_count(void)
{
    s_wifi_state.retry_count = 0;
    ESP_LOGI(TAG, "Retry count reset");
    return ESP_OK;
}

/**
 * @brief Deinitialize WiFi manager
 */
esp_err_t wifi_manager_deinit(void)
{
    if (s_wifi_state.event_group == NULL) {
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Deinitializing WiFi manager...");

    // Stop reconnection timer
    if (s_wifi_state.reconnect_timer) {
        xTimerStop(s_wifi_state.reconnect_timer, 0);
        xTimerDelete(s_wifi_state.reconnect_timer, 0);
        s_wifi_state.reconnect_timer = NULL;
    }

    // Unregister event handlers
    esp_event_handler_unregister(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler_internal);
    esp_event_handler_unregister(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler_internal);

    // Stop and deinitialize WiFi
    esp_wifi_stop();
    esp_wifi_deinit();

    // Delete event group
    vEventGroupDelete(s_wifi_state.event_group);
    s_wifi_state.event_group = NULL;

    s_wifi_state.state = WIFI_STATE_IDLE;

    ESP_LOGI(TAG, "WiFi manager deinitialized");
    return ESP_OK;
}

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * @brief WiFi event handler
 */
static void wifi_event_handler_internal(void* arg, esp_event_base_t event_base,
                                        int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT) {
        switch (event_id) {
            case WIFI_EVENT_STA_START:
                ESP_LOGI(TAG, "WiFi station started");
                break;

            case WIFI_EVENT_STA_CONNECTED:
                ESP_LOGI(TAG, "Connected to AP");
                break;

            case WIFI_EVENT_STA_DISCONNECTED: {
                wifi_event_sta_disconnected_t *event = (wifi_event_sta_disconnected_t *)event_data;
                ESP_LOGW(TAG, "Disconnected from AP (reason: %d)", event->reason);

                s_wifi_state.state = WIFI_STATE_DISCONNECTED;
                notify_state_change(WIFI_STATE_DISCONNECTED);

                // Handle reconnection
                if (s_wifi_state.should_reconnect) {
                    s_wifi_state.retry_count++;
                    ESP_LOGI(TAG, "Reconnection attempt %d", s_wifi_state.retry_count);
                    start_reconnect_timer();
                } else {
                    ESP_LOGI(TAG, "Reconnection disabled, not attempting to reconnect");
                }
                break;
            }

            default:
                break;
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP address: " IPSTR, IP2STR(&event->ip_info.ip));

        s_wifi_state.state = WIFI_STATE_CONNECTED;
        s_wifi_state.retry_count = 0;
        s_wifi_state.connect_time = xTaskGetTickCount();

        // Stop reconnection timer if running
        xTimerStop(s_wifi_state.reconnect_timer, 0);

        xEventGroupSetBits(s_wifi_state.event_group, WIFI_CONNECTED_BIT);
        notify_state_change(WIFI_STATE_CONNECTED);
    }
}

/**
 * @brief Start reconnection timer with appropriate interval
 */
static void start_reconnect_timer(void)
{
    TickType_t interval;

    // FR14: First 5 attempts every 30s, then every 2 minutes
    if (s_wifi_state.retry_count <= WIFI_MAX_FAST_RETRY) {
        interval = pdMS_TO_TICKS(WIFI_FAST_RETRY_INTERVAL_MS);
        ESP_LOGI(TAG, "Fast retry mode: attempting reconnection in %d seconds",
                 WIFI_FAST_RETRY_INTERVAL_MS / 1000);
    } else {
        interval = pdMS_TO_TICKS(WIFI_SLOW_RETRY_INTERVAL_MS);
        ESP_LOGI(TAG, "Slow retry mode: attempting reconnection in %d seconds",
                 WIFI_SLOW_RETRY_INTERVAL_MS / 1000);
    }

    xTimerChangePeriod(s_wifi_state.reconnect_timer, interval, 0);
    xTimerStart(s_wifi_state.reconnect_timer, 0);
}

/**
 * @brief Reconnection timer callback
 */
static void reconnect_timer_callback(TimerHandle_t xTimer)
{
    ESP_LOGI(TAG, "Reconnection timer fired, attempting to reconnect...");

    esp_err_t ret = esp_wifi_connect();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initiate reconnection: %s", esp_err_to_name(ret));
    }
}

/**
 * @brief Notify application of state change
 */
static void notify_state_change(wifi_state_t new_state)
{
    if (s_wifi_state.callback) {
        s_wifi_state.callback(new_state, s_wifi_state.callback_ctx);
    }
}
