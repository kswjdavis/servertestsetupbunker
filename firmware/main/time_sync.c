#include "time_sync.h"

#include <stdbool.h>
#include <time.h>

#include "esp_log.h"
#include "esp_sntp.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "time_sync";
static const uint32_t kPollingIntervalMs = 2000;

static bool is_time_synced(void)
{
    time_t now = 0;
    struct tm timeinfo = {0};
    time(&now);
    localtime_r(&now, &timeinfo);
    return timeinfo.tm_year >= (2020 - 1900);
}

esp_err_t time_sync_obtain(uint32_t timeout_ms)
{
    if (is_time_synced()) {
        ESP_LOGI(TAG, "System time already synchronized");
        return ESP_OK;
    }

    sntp_setoperatingmode(SNTP_OPMODE_POLL);
    sntp_setservername(0, "pool.ntp.org");
    sntp_init();

    uint32_t waited_ms = 0;
    while (!is_time_synced()) {
        if (waited_ms >= timeout_ms) {
            ESP_LOGE(TAG, "SNTP time sync timed out after %u ms", waited_ms);
            return ESP_ERR_TIMEOUT;
        }
        ESP_LOGI(TAG, "Waiting for SNTP time synchronization...");
        vTaskDelay(pdMS_TO_TICKS(kPollingIntervalMs));
        waited_ms += kPollingIntervalMs;
    }

    time_t now = 0;
    time(&now);
    ESP_LOGI(TAG, "Time synchronized: %s", ctime(&now));
    return ESP_OK;
}
