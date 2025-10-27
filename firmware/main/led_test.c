/**
 * LED Test Program for Keyes LED Module
 *
 * Wiring:
 * - LED Signal (S) -> GPIO2
 * - LED Power (+)  -> 3.3V
 * - LED Ground (-) -> GND
 */

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"

#define LED_GPIO GPIO_NUM_2
#define BLINK_DELAY_MS 500

static const char *TAG = "LED_TEST";

void app_main(void)
{
    ESP_LOGI(TAG, "LED Test Starting...");
    ESP_LOGI(TAG, "LED connected to GPIO%d", LED_GPIO);

    // Configure GPIO
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    // Blink loop
    int blink_count = 0;
    while (1) {
        // Turn LED ON
        gpio_set_level(LED_GPIO, 1);
        ESP_LOGI(TAG, "LED ON (count: %d)", ++blink_count);
        vTaskDelay(pdMS_TO_TICKS(BLINK_DELAY_MS));

        // Turn LED OFF
        gpio_set_level(LED_GPIO, 0);
        ESP_LOGI(TAG, "LED OFF");
        vTaskDelay(pdMS_TO_TICKS(BLINK_DELAY_MS));
    }
}
