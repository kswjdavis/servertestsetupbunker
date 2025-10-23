/**
 * @file http_client.h
 * @brief HTTPS REST API Client for Bunkercolab Firmware
 *
 * Provides secure HTTPS communication with the cloud backend.
 * Implements TLS certificate validation, token-based authentication,
 * and JSON request/response handling.
 *
 * Security Features:
 * - TLS 1.2/1.3 with certificate validation (FR15)
 * - ESP Certificate Bundle for automatic CA validation
 * - Token-based authentication in Authorization header (FR16)
 * - SNTP time synchronization for certificate expiry checks
 *
 * @note All API calls are synchronous and blocking
 */

#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// API Configuration
#define HTTP_CLIENT_TIMEOUT_MS          10000       // 10 second timeout
#define HTTP_CLIENT_MAX_RESPONSE_SIZE   2048        // Maximum response buffer
#define HTTP_CLIENT_USER_AGENT          "BunkercolabESP32/1.0"

// HTTP Status Codes
#define HTTP_STATUS_OK                  200
#define HTTP_STATUS_CREATED             201
#define HTTP_STATUS_ACCEPTED            202
#define HTTP_STATUS_BAD_REQUEST         400
#define HTTP_STATUS_UNAUTHORIZED        401
#define HTTP_STATUS_FORBIDDEN           403
#define HTTP_STATUS_NOT_FOUND           404
#define HTTP_STATUS_INTERNAL_ERROR      500
#define HTTP_STATUS_SERVICE_UNAVAILABLE 503

/**
 * @brief HTTP response data structure
 */
typedef struct {
    int status_code;                                // HTTP status code
    char *body;                                     // Response body (dynamically allocated)
    size_t body_len;                                // Length of response body
    int64_t timestamp;                              // Response timestamp (Unix epoch ms)
} http_response_t;

/**
 * @brief Device status data for reporting (FR23)
 */
typedef struct {
    char device_id[64];         // Device unique identifier
    uint32_t uptime_sec;        // Device uptime in seconds
    int8_t wifi_rssi;           // WiFi signal strength (dBm)
    uint32_t free_heap;         // Free heap memory (bytes)
    const char *firmware_version; // Firmware version string
    bool connected;             // WiFi connection status
} device_status_t;

/**
 * @brief Initialize HTTP client
 *
 * Initializes HTTPS client with TLS certificate validation enabled.
 * Also synchronizes time via SNTP for certificate validation.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_init(void);

/**
 * @brief Set authentication token for API requests
 *
 * Token will be included in Authorization header as "Bearer <token>"
 *
 * @param token Authentication token (will be copied internally)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_set_auth_token(const char *token);

/**
 * @brief Set base server URL
 *
 * @param url Server base URL (e.g., "https://api.bunkercolab.com")
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_set_server_url(const char *url);

/**
 * @brief Report device status to server (FR23)
 *
 * POST /api/v1/devices/{device_id}/status
 *
 * @param status Device status data to report
 * @param response Optional pointer to store server response (caller must free)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_report_status(const device_status_t *status, http_response_t *response);

/**
 * @brief Provision device and obtain authentication token
 *
 * POST /api/v1/devices/provision
 *
 * @param device_id Device unique identifier
 * @param token Buffer to store received token (min 128 bytes)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_provision_device(const char *device_id, char *token);

/**
 * @brief Perform generic GET request
 *
 * @param endpoint API endpoint path (e.g., "/api/v1/devices")
 * @param response Pointer to store response (caller must free)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_get(const char *endpoint, http_response_t *response);

/**
 * @brief Perform generic POST request with JSON body
 *
 * @param endpoint API endpoint path
 * @param json_body JSON request body (null-terminated string)
 * @param response Pointer to store response (caller must free)
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_post(const char *endpoint, const char *json_body, http_response_t *response);

/**
 * @brief Free HTTP response resources
 *
 * Frees dynamically allocated response body.
 *
 * @param response Response structure to free
 */
void http_client_free_response(http_response_t *response);

/**
 * @brief Check if TLS connection is secure
 *
 * Verifies that server certificate was validated successfully.
 *
 * @return true if secure connection established, false otherwise
 */
bool http_client_is_secure(void);

/**
 * @brief Get last HTTP error code
 *
 * @return Last error code from HTTP operations
 */
esp_err_t http_client_get_last_error(void);

/**
 * @brief Deinitialize HTTP client and cleanup resources
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t http_client_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // HTTP_CLIENT_H
