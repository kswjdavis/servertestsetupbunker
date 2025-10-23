#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "nvs_storage.h"
#include "status_client.h"
#include "time_sync.h"
#include "wifi_manager.h"

static const char *TAG = "bunkercolab";

static void wait_for_wifi_connection(void)
{
    const int max_wait_cycles = 30;
    int waited = 0;
    while (!wifi_manager_is_connected() && waited < max_wait_cycles) {
        ESP_LOGI(TAG, "Waiting for WiFi connection... (%d/%d)", waited + 1, max_wait_cycles);
        vTaskDelay(pdMS_TO_TICKS(1000));
        waited++;
    }

    if (!wifi_manager_is_connected()) {
        ESP_LOGW(TAG, "WiFi not connected after wait period; continuing");
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "Bunkercolab firmware starting up");

    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(nvs_storage_init());
    ESP_ERROR_CHECK(wifi_manager_init());
    ESP_ERROR_CHECK(wifi_manager_start());

    wait_for_wifi_connection();

    if (wifi_manager_is_connected()) {
        esp_err_t sync_err = time_sync_obtain(30000);
        if (sync_err != ESP_OK) {
            ESP_LOGW(TAG, "SNTP sync failed: %s", esp_err_to_name(sync_err));
        }

        status_response_t response = {0};
        esp_err_t status_err = status_client_sync(&response);
        if (status_err == ESP_OK) {
            ESP_LOGI(TAG,
                     "Status sync succeeded: shutdown_allowed=%s reset_countdown=%s server_time=%s",
                     response.shutdown_allowed ? "true" : "false",
                     response.reset_countdown ? "true" : "false",
                     response.server_time);
        } else {
            ESP_LOGW(TAG, "Status sync failed: %s", esp_err_to_name(status_err));
        }
    }

    while (true) {
        if (wifi_manager_is_connected()) {
            ESP_LOGD(TAG, "WiFi connected (MAC %s)", wifi_manager_mac_address());
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
