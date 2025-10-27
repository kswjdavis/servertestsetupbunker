#ifndef OTA_UPDATER_H
#define OTA_UPDATER_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start the OTA updater periodic task using the provided server URL.
 *
 * @param server_url Base URL of the backend API (e.g., https://example.com)
 * @return ESP_OK on success, error code otherwise.
 */
esp_err_t ota_updater_start(const char *server_url);

#ifdef __cplusplus
}
#endif

#endif  // OTA_UPDATER_H
