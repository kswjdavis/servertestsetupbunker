/**
 * @file status_client.h
 * @brief HTTPS client for reporting device status to backend API.
 */

#pragma once

#include <stdbool.h>

#include "esp_err.h"

typedef struct {
    bool shutdown_allowed;
    bool reset_countdown;
    char server_time[64];
} status_response_t;

/**
 * @brief Perform HTTPS POST to backend status endpoint with retry logic.
 *
 * @param response Optional pointer to receive parsed response fields.
 * @return ESP_OK on success; ESP_FAIL or esp_err_t codes on failure.
 */
esp_err_t status_client_sync(status_response_t *response);
