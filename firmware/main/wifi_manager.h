/**
 * @file wifi_manager.h
 * @brief WiFi Connection Manager for Bunkercolab Firmware
 *
 * Manages WiFi connection, reconnection logic, and network monitoring.
 * Implements automatic reconnection strategy as specified in Epic 1:
 * - First 5 attempts: every 30 seconds
 * - Subsequent attempts: every 2 minutes
 *
 * @note Thread-safe and event-driven using ESP-IDF WiFi events
 */

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "esp_err_compat.h"
#include "esp_wifi.h"
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Reconnection timing constants (FR14)
#define WIFI_MAX_FAST_RETRY         5           // First 5 attempts use fast retry
#define WIFI_FAST_RETRY_INTERVAL_MS 30000       // 30 seconds
#define WIFI_SLOW_RETRY_INTERVAL_MS 120000      // 2 minutes

// WiFi connection timeouts
#define WIFI_CONNECT_TIMEOUT_MS     15000       // 15 seconds to establish connection
#define WIFI_RSSI_THRESHOLD         -80         // Minimum acceptable signal strength (dBm)

/**
 * @brief WiFi connection state
 */
typedef enum {
    WIFI_STATE_IDLE,            // Not started
    WIFI_STATE_CONNECTING,      // Attempting connection
    WIFI_STATE_CONNECTED,       // Successfully connected
    WIFI_STATE_DISCONNECTED,    // Disconnected, will retry
    WIFI_STATE_FAILED           // Connection failed permanently
} wifi_state_t;

/**
 * @brief WiFi status information
 */
typedef struct {
    wifi_state_t state;         // Current connection state
    uint8_t retry_count;        // Number of reconnection attempts
    int8_t rssi;                // Signal strength (dBm)
    char ssid[33];              // Connected SSID (null-terminated)
    uint8_t bssid[6];           // AP MAC address
    uint32_t ip_addr;           // Assigned IP address
    uint32_t uptime_sec;        // Time connected in seconds
} wifi_status_t;

/**
 * @brief WiFi event callback function type
 *
 * @param event WiFi state change event
 * @param user_ctx User-provided context pointer
 */
typedef void (*wifi_event_callback_t)(wifi_state_t event, void *user_ctx);

/**
 * @brief Initialize WiFi manager
 *
 * Initializes WiFi driver, event handlers, and state machine.
 * Must be called before any other WiFi operations.
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_init(void);

/**
 * @brief Connect to WiFi network using stored credentials
 *
 * Attempts to connect using credentials from NVS storage.
 * Non-blocking - returns immediately and uses callback for status.
 *
 * @param callback Optional callback for state change events
 * @param user_ctx Optional user context passed to callback
 * @return ESP_OK if connection initiated, error code otherwise
 */
esp_err_t wifi_manager_connect(wifi_event_callback_t callback, void *user_ctx);

/**
 * @brief Connect to WiFi network with explicit credentials
 *
 * Connects to specified network without storing credentials.
 * Useful for testing or temporary connections.
 *
 * @param ssid WiFi network SSID
 * @param password WiFi password
 * @param callback Optional callback for state change events
 * @param user_ctx Optional user context passed to callback
 * @return ESP_OK if connection initiated, error code otherwise
 */
esp_err_t wifi_manager_connect_with_credentials(
    const char *ssid,
    const char *password,
    wifi_event_callback_t callback,
    void *user_ctx
);

/**
 * @brief Disconnect from WiFi and stop reconnection attempts
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_disconnect(void);

/**
 * @brief Get current WiFi status
 *
 * @param status Pointer to store status information
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_get_status(wifi_status_t *status);

/**
 * @brief Check if WiFi is connected
 *
 * @return true if connected, false otherwise
 */
bool wifi_manager_is_connected(void);

/**
 * @brief Get current signal strength (RSSI)
 *
 * @return RSSI in dBm, or 0 if not connected
 */
int8_t wifi_manager_get_rssi(void);

/**
 * @brief Start WiFi scan for available networks
 *
 * @param max_ap Maximum number of APs to return
 * @param ap_records Array to store AP records
 * @param ap_count Pointer to store actual number of APs found
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_scan(uint16_t max_ap, wifi_ap_record_t *ap_records, uint16_t *ap_count);

/**
 * @brief Reset reconnection attempt counter
 *
 * Useful after manual intervention or configuration changes.
 *
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_reset_retry_count(void);

/**
 * @brief Get current WiFi power save mode (Story 2.11)
 *
 * @return Power save mode value (0=none, 1=min_modem, 2=max_modem)
 */
uint8_t wifi_manager_get_ps_mode(void);

/**
 * @brief Deinitialize WiFi manager and cleanup resources
 *
 * @return ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_deinit(void);

#ifdef __cplusplus
}
#endif

#endif // WIFI_MANAGER_H
