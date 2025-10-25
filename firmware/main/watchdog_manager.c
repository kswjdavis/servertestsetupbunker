#include "watchdog_manager.h"

#include <inttypes.h>
#include <stdbool.h>

#include "esp_log.h"
#include "esp_err_compat.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "esp_attr.h"

static const char *TAG = "watchdog_manager";

RTC_DATA_ATTR static uint32_t s_watchdog_reset_count = 0;
RTC_DATA_ATTR static bool s_last_boot_was_watchdog = false;
static bool s_initialized = false;

static void log_reset_reason(void)
{
    if (!s_last_boot_was_watchdog) {
        ESP_LOGI(TAG, "Watchdog reset count: %" PRIu32, s_watchdog_reset_count);
    } else {
        ESP_LOGW(TAG, "Device rebooted due to watchdog reset");
        ESP_LOGW(TAG, "Watchdog reset count: %" PRIu32, s_watchdog_reset_count);
    }
}

void watchdog_manager_init(void)
{
    if (s_initialized) {
        log_reset_reason();
        return;
    }

    esp_reset_reason_t reason = esp_reset_reason();
    if (reason == ESP_RST_TASK_WDT || reason == ESP_RST_WDT) {
        s_watchdog_reset_count++;
        s_last_boot_was_watchdog = true;
    } else {
        s_last_boot_was_watchdog = false;
    }

    esp_task_wdt_deinit();

    const esp_task_wdt_config_t config = {
        .timeout_ms = WATCHDOG_TIMEOUT_SECONDS * 1000,
        .idle_core_mask = 0,
        .trigger_panic = true,
    };

    esp_err_t err = esp_task_wdt_init(&config);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "Failed to initialize task watchdog: %s", esp_err_to_name(err));
        return;
    }

    s_initialized = true;
    log_reset_reason();
}

esp_err_t watchdog_manager_subscribe_current_task(const char *task_name)
{
    if (!s_initialized) {
        ESP_LOGW(TAG, "Watchdog not initialized before subscribing task %s", task_name ? task_name : "<unnamed>");
        watchdog_manager_init();
    }

    esp_err_t err = esp_task_wdt_add(NULL);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "Failed to add task to watchdog (%s): %s", task_name ? task_name : "<unnamed>", esp_err_to_name(err));
        return err;
    }

    ESP_LOGI(TAG, "Task subscribed to watchdog: %s", task_name ? task_name : "<unnamed>");
    return ESP_OK;
}

esp_err_t watchdog_manager_feed(void)
{
    esp_err_t err = esp_task_wdt_reset();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to feed watchdog: %s", esp_err_to_name(err));
    }
    return err;
}

uint32_t watchdog_manager_get_reset_count(void)
{
    return s_watchdog_reset_count;
}

bool watchdog_manager_last_boot_was_watchdog(void)
{
    return s_last_boot_was_watchdog;
}
