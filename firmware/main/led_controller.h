/**
 * @file led_controller.h
 * @brief LED flash identification controller for ESP32 devices.
 *
 * Provides initialization and background flashing task that drives the
 * onboard LED in a unique blink pattern used during deployment to match
 * devices with their database records.
 */

#ifndef LED_CONTROLLER_H
#define LED_CONTROLLER_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err_compat.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Configure the LED GPIO for output control.
 *
 * The GPIO number is sourced from menuconfig (`CONFIG_LED_GPIO_PIN`).
 *
 * @return ESP_OK on success, error code otherwise.
 */
esp_err_t led_controller_init(void);

/**
 * @brief Start (or update) the LED flash task.
 *
 * When called the first time, a FreeRTOS task is created that repeatedly
 * flashes the LED according to the provided flash count. Subsequent calls
 * update the active pattern without recreating the task.
 *
 * Pattern: `flash_count` rapid blinks (200ms ON / 200ms OFF) followed by a
 * 2 second pause, then repeat.
 *
 * @param flash_count Number of blinks per cycle (valid range: 1-10).
 * @return ESP_OK on success, ESP_ERR_INVALID_ARG for out-of-range counts,
 *         or ESP_FAIL if task creation fails.
 */
esp_err_t led_flash_task_start(uint8_t flash_count);

/**
 * @brief Stop the LED flash task and turn the LED off.
 */
void led_flash_task_stop(void);

/**
 * @brief Manually set the LED state. Primarily for diagnostics/tests.
 *
 * @param state true to turn LED ON, false to turn it OFF.
 */
void led_set_state(bool state);

#ifdef UNIT_TEST
/**
 * @brief Return whether the LED controller has completed initialization.
 */
bool led_test_is_initialized(void);

/**
 * @brief Query whether the flash task is currently active.
 */
bool led_test_is_task_running(void);

/**
 * @brief Retrieve the currently configured flash count.
 */
uint8_t led_test_get_flash_count(void);

/**
 * @brief Retrieve the most recent LED state written via led_set_state().
 */
bool led_test_get_led_state(void);

/**
 * @brief Retrieve the configured on/off/pause durations in milliseconds.
 */
uint32_t led_test_get_on_duration_ms(void);
uint32_t led_test_get_off_duration_ms(void);
uint32_t led_test_get_pause_duration_ms(void);

/**
 * @brief Reset internal LED controller state (UNIT_TEST only).
 */
void led_test_reset_state(void);
#endif

#ifdef __cplusplus
}
#endif

#endif // LED_CONTROLLER_H
