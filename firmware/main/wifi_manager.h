/**
 * @file wifi_manager.h
 * @brief WiFi station lifecycle management with reconnection handling.
 */

#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t wifi_manager_init(void);
esp_err_t wifi_manager_start(void);

bool wifi_manager_is_connected(void);
const char *wifi_manager_mac_address(void);

#ifdef __cplusplus
}
#endif
