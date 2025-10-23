#include "wifi_manager.h"

#include <string.h>

#include "esp_err.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

#include "nvs_storage.h"
#include "provisioning.h"

static const char *TAG = "wifi_manager";

typedef struct {
    char ssid[STORAGE_WIFI_SSID_MAX_LEN + 1];
    char password[STORAGE_WIFI_PASSWORD_MAX_LEN + 1];
    bool present;
} wifi_credentials_t;

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_DISCONNECTED_BIT BIT1

#define FAST_RETRY_DELAY_MS (30 * 1000)
#define SLOW_RETRY_DELAY_MS (120 * 1000)
#define MAX_FAST_RETRIES 5

static EventGroupHandle_t s_event_group;
static TaskHandle_t s_reconnect_task;
static wifi_credentials_t s_credentials;
static uint8_t s_station_mac[6];
static char s_mac_string[18];
static int s_retry_count;
static esp_event_handler_instance_t s_any_id_instance;
static esp_event_handler_instance_t s_got_ip_instance;
static esp_netif_t *s_sta_netif;
static esp_netif_t *s_ap_netif;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
static void ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
static void wifi_reconnect_task(void *param);
static esp_err_t configure_station(void);
static bool load_credentials(void);
static void cache_mac_address(void);

static void wifi_reconnect_task(void *param)
{
    (void)param;
    for (;;) {
        xEventGroupWaitBits(s_event_group, WIFI_DISCONNECTED_BIT, pdTRUE, pdFALSE, portMAX_DELAY);

        while ((xEventGroupGetBits(s_event_group) & WIFI_CONNECTED_BIT) == 0) {
            s_retry_count++;
            int delay_ms = (s_retry_count <= MAX_FAST_RETRIES) ? FAST_RETRY_DELAY_MS : SLOW_RETRY_DELAY_MS;
            ESP_LOGW(TAG, "WiFi reconnect attempt %d (delay %d ms)", s_retry_count, delay_ms);

            esp_err_t err = esp_wifi_connect();
            if (err != ESP_OK) {
                ESP_LOGE(TAG, "esp_wifi_connect failed: %s", esp_err_to_name(err));
            }

            vTaskDelay(pdMS_TO_TICKS(delay_ms));
        }

        s_retry_count = 0;
    }
}

esp_err_t wifi_manager_init(void)
{
    esp_err_t err = esp_netif_init();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    err = esp_event_loop_create_default();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    if (s_sta_netif == NULL) {
        s_sta_netif = esp_netif_create_default_wifi_sta();
    }
    if (s_ap_netif == NULL) {
        s_ap_netif = esp_netif_create_default_wifi_ap();
    }

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    s_event_group = xEventGroupCreate();
    if (s_event_group == NULL) {
        return ESP_ERR_NO_MEM;
    }

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT,
        ESP_EVENT_ANY_ID,
        &wifi_event_handler,
        NULL,
        &s_any_id_instance));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        IP_EVENT,
        IP_EVENT_STA_GOT_IP,
        &ip_event_handler,
        NULL,
        &s_got_ip_instance));

    cache_mac_address();

    BaseType_t created = xTaskCreate(
        wifi_reconnect_task,
        "wifi_reconnect",
        4096,
        NULL,
        tskIDLE_PRIORITY + 1,
        &s_reconnect_task);
    if (created != pdPASS) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static void cache_mac_address(void)
{
    esp_read_mac(s_station_mac, ESP_MAC_WIFI_STA);
    snprintf(s_mac_string,
             sizeof(s_mac_string),
             "%02X:%02X:%02X:%02X:%02X:%02X",
             s_station_mac[0],
             s_station_mac[1],
             s_station_mac[2],
             s_station_mac[3],
             s_station_mac[4],
             s_station_mac[5]);
    ESP_LOGI(TAG, "Device MAC: %s", s_mac_string);
}

static bool load_credentials(void)
{
    bool found = false;
    esp_err_t err = nvs_load_wifi_credentials(
        s_credentials.ssid,
        sizeof(s_credentials.ssid),
        s_credentials.password,
        sizeof(s_credentials.password),
        &found);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load WiFi credentials: %s", esp_err_to_name(err));
        return false;
    }
    s_credentials.present = found;
    return found;
}

static esp_err_t configure_station(void)
{
    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.sta.ssid, s_credentials.ssid, sizeof(wifi_config.sta.ssid));
    strlcpy((char *)wifi_config.sta.password, s_credentials.password, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.required = false;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    return ESP_OK;
}

esp_err_t wifi_manager_start(void)
{
    if (!load_credentials()) {
        ESP_LOGW(TAG, "No WiFi credentials found. Starting provisioning.");
        provisioning_result_t result;
        esp_err_t err = provisioning_run(s_station_mac, &result);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Provisioning failed: %s", esp_err_to_name(err));
            return err;
        }

        ESP_ERROR_CHECK(nvs_save_wifi_credentials(result.ssid, result.password));
        if (result.has_auth_token) {
            ESP_ERROR_CHECK(nvs_save_auth_token(result.auth_token));
        }

        ESP_LOGI(TAG, "Credentials saved. Restarting to join network.");
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
        return ESP_OK;  // Not reached
    }

    ESP_ERROR_CHECK(configure_station());
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_LOGI(TAG, "Connecting to SSID '%s'", s_credentials.ssid);
    ESP_ERROR_CHECK(esp_wifi_connect());

    return ESP_OK;
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    if (event_base != WIFI_EVENT) {
        return;
    }

    switch (event_id) {
        case WIFI_EVENT_STA_START:
            ESP_LOGI(TAG, "WiFi STA start");
            esp_wifi_connect();
            break;
        case WIFI_EVENT_STA_CONNECTED:
            ESP_LOGI(TAG, "Connected to AP");
            break;
        case WIFI_EVENT_STA_DISCONNECTED: {
            wifi_event_sta_disconnected_t *disconnected = (wifi_event_sta_disconnected_t *)event_data;
            ESP_LOGW(TAG, "Disconnected from AP (reason: %d)", disconnected->reason);
            xEventGroupClearBits(s_event_group, WIFI_CONNECTED_BIT);
            xEventGroupSetBits(s_event_group, WIFI_DISCONNECTED_BIT);
            break;
        }
        default:
            break;
    }
}

static void ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(s_event_group, WIFI_CONNECTED_BIT);
        xEventGroupClearBits(s_event_group, WIFI_DISCONNECTED_BIT);
        s_retry_count = 0;
    }
}

bool wifi_manager_is_connected(void)
{
    if (s_event_group == NULL) {
        return false;
    }
    EventBits_t bits = xEventGroupGetBits(s_event_group);
    return (bits & WIFI_CONNECTED_BIT) != 0;
}

const char *wifi_manager_mac_address(void)
{
    return s_mac_string;
}
