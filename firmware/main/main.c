/**
 * @file main.c
 * @brief Main application entry point for Bunkercolab ESP32 Firmware
 *
 * Epic 1: Foundation & Device Communication
 * Implements WiFi connectivity, HTTPS API communication, and status reporting.
 *
 * Application Flow:
 * 1. Initialize NVS storage
 * 2. Check provisioning status
 * 3. If not provisioned: Enter provisioning mode (AP mode)
 * 4. If provisioned: Connect to WiFi
 * 5. Initialize HTTPS client
 * 6. Start control loop task (coordinates status reporting + server decisions)
 *
 * @author Bunkercolab Team
 * @date 2025
 */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "nvs_flash.h"
#include "esp_pm.h"

#include "nvs_storage.h"
#include "wifi_manager.h"
#include "http_client.h"
#include "auth_fail_safe.h"
#include "relay_controller.h"
#include "deadman_timer.h"
#include "watchdog_manager.h"
#include "esp_timer.h"
#include "control_loop_logic.h"
#include "led_controller.h"
#include "ota_updater.h"
#include "firmware_version.h"

// Logging tag
static const char *TAG = "main";

// Application state
typedef enum {
    APP_STATE_INIT,
    APP_STATE_PROVISIONING,
    APP_STATE_CONNECTING,
    APP_STATE_OPERATIONAL,
    APP_STATE_ERROR
} app_state_t;

static app_state_t app_state = APP_STATE_INIT;

static bool s_initial_auth_complete = false;
static char s_device_state[32] = "booting";
static uint8_t s_led_flash_sequence = 0;
static bool s_led_task_started = false;

// Status reporting interval (FR23: 60 seconds)
#define STATUS_REPORT_INTERVAL_MS   60000

static void watchdog_delay_with_feed(TickType_t total_delay_ticks)
{
    if (total_delay_ticks == 0) {
        return;
    }

    const TickType_t feed_interval_ticks = pdMS_TO_TICKS(WATCHDOG_FEED_INTERVAL_MS);

    while (total_delay_ticks > 0) {
        TickType_t slice = (total_delay_ticks > feed_interval_ticks) ? feed_interval_ticks : total_delay_ticks;
        vTaskDelay(slice);
        watchdog_manager_feed();
        total_delay_ticks -= slice;
    }
}

/**
 * @brief WiFi event callback
 */
static void wifi_event_handler(wifi_state_t state, void *user_ctx)
{
    switch (state) {
        case WIFI_STATE_CONNECTED:
            ESP_LOGI(TAG, "WiFi connected successfully");
            app_state = APP_STATE_OPERATIONAL;

            if (!s_led_task_started) {
                if (s_led_flash_sequence >= 1 && s_led_flash_sequence <= 10) {
                    esp_err_t led_err = led_flash_task_start(s_led_flash_sequence);
                    if (led_err == ESP_OK) {
                        s_led_task_started = true;
                        ESP_LOGI(TAG, "LED identification sequence running (%u blinks)",
                                 (unsigned)s_led_flash_sequence);
                    } else {
                        ESP_LOGE(TAG, "Failed to start LED flash task: %s", esp_err_to_name(led_err));
                    }
                } else {
                    ESP_LOGW(TAG, "LED flash sequence not configured - skipping identification pattern");
                }
            }
            break;

        case WIFI_STATE_DISCONNECTED:
            ESP_LOGW(TAG, "WiFi disconnected, will retry");
            break;

        case WIFI_STATE_FAILED:
            ESP_LOGE(TAG, "WiFi connection failed");
            app_state = APP_STATE_ERROR;
            break;

        default:
            break;
    }
}

/**
 * @brief Trigger fail-safe mode when authentication cannot succeed.
 */
static void enter_auth_fail_safe(const char *reason, int status_code, const char *response_body)
{
    bool newly_triggered = auth_fail_safe_trigger(reason, status_code, response_body);
    if (!newly_triggered) {
        return;
    }

    strncpy(s_device_state, "unprovisioned/auth_failed", sizeof(s_device_state) - 1);
    s_device_state[sizeof(s_device_state) - 1] = '\0';
    app_state = APP_STATE_ERROR;
}

// Forward declaration
static esp_err_t perform_status_report(server_decision_t *decision_out, bool initial_attempt);

static void control_loop_task(void *pvParameters)
{
    (void)pvParameters;

    ESP_LOGI(TAG, "Control loop task started");

    if (watchdog_manager_subscribe_current_task("control_loop") == ESP_OK) {
        watchdog_manager_feed();
    }

    uint32_t last_report_tick = (uint32_t)xTaskGetTickCount();
    const uint32_t report_interval_ticks = (uint32_t)pdMS_TO_TICKS(STATUS_REPORT_INTERVAL_MS);
    bool initial_report_pending = true;
    bool wifi_was_connected = false;
    bool logged_auth_failure = false;
    bool last_decision_valid = false;
    bool last_shutdown_allowed = false;
    bool last_deadman_expired = deadman_timer_is_expired();
    bool last_relay_locked = relay_is_locked();

    while (1) {
        if (auth_fail_safe_is_active()) {
            if (!logged_auth_failure) {
                ESP_LOGW(TAG, "Authentication failed - control loop entering permanent fail-safe monitoring");
                logged_auth_failure = true;
            }

            if (!relay_is_locked()) {
                ESP_LOGW(TAG, "Ensuring relay is forced ON after authentication failure");
                relay_force_on();
            }

            watchdog_delay_with_feed(pdMS_TO_TICKS(1000));
            continue;
        }

        bool wifi_connected = wifi_manager_is_connected();
        if (wifi_connected && !wifi_was_connected) {
            ESP_LOGI(TAG, "WiFi connection restored - resuming control loop coordination");
        } else if (!wifi_connected && wifi_was_connected) {
            ESP_LOGW(TAG, "WiFi connection lost - awaiting reconnection while dead-man timer counts down");
        }
        wifi_was_connected = wifi_connected;

        if (wifi_connected) {
            uint32_t now_ticks = (uint32_t)xTaskGetTickCount();
            bool should_report = control_loop_should_attempt_report(
                wifi_connected,
                auth_fail_safe_is_active(),
                now_ticks,
                last_report_tick,
                initial_report_pending,
                report_interval_ticks
            );

            if (should_report) {
                server_decision_t raw_decision = {0};
                esp_err_t err = perform_status_report(&raw_decision, initial_report_pending);

                initial_report_pending = false;
                last_report_tick = now_ticks;

                control_loop_decision_t logic_decision = {
                    .shutdown_allowed = raw_decision.shutdown_allowed,
                    .reset_countdown = raw_decision.reset_countdown,
                    .valid = raw_decision.valid,
                };

                bool relay_locked_now = relay_is_locked();
                control_loop_actions_t actions = control_loop_process_decision(
                    err,
                    &logic_decision,
                    relay_locked_now,
                    last_decision_valid,
                    last_shutdown_allowed
                );

                if (actions.reset_deadman) {
                    ESP_LOGI(TAG, "Resetting dead-man timer per server directive");
                    deadman_timer_reset();

                    // Unlock relay when server control is restored
                    // This allows remote devices to recover from fail-safe without manual reboot
                    if (relay_locked_now) {
                        ESP_LOGI(TAG, "Server communication restored - unlocking relay");
                        relay_unlock_on_server_control_restored();
                        relay_locked_now = false;  // Update local state after unlock
                    }
                }

                if (raw_decision.valid && raw_decision.shutdown_allowed && relay_locked_now) {
                    ESP_LOGW(TAG, "Server allowed shutdown but relay locked in fail-safe state");
                }

                if (actions.relay_off) {
                    relay_set_off();
                }

                if (actions.relay_on) {
                    if (err != ESP_OK) {
                        ESP_LOGW(TAG, "Failing closed: keeping relay ON while awaiting next successful report");
                    }
                    relay_set_on();
                }

                if (actions.decision_valid && actions.decision_changed) {
                    ESP_LOGI(
                        TAG,
                        "Control decision applied: shutdown_allowed=%s",
                        actions.shutdown_allowed ? "true" : "false"
                    );
                }

                last_decision_valid = actions.decision_valid;
                last_shutdown_allowed = actions.shutdown_allowed;
            }
        }

        watchdog_delay_with_feed(pdMS_TO_TICKS(1000));

        bool deadman_expired = deadman_timer_is_expired();
        if (deadman_expired && !last_deadman_expired) {
            ESP_LOGW(TAG, "Dead-man timer expired; relay should now be locked in fail-safe ON state");
        } else if (!deadman_expired && last_deadman_expired) {
            ESP_LOGI(TAG, "Dead-man timer reset; normal watchdog cadence restored");
        }
        last_deadman_expired = deadman_expired;

        bool relay_locked = relay_is_locked();
        if (relay_locked && !last_relay_locked) {
            ESP_LOGW(TAG, "Relay transitioned to fail-safe locked ON state");
        } else if (!relay_locked && last_relay_locked) {
            ESP_LOGI(TAG, "Relay fail-safe lock cleared; normal control restored");
        }
        last_relay_locked = relay_locked;
    }
}

/**
 * @brief Perform an authenticated status report and process server response.
 */
static esp_err_t perform_status_report(server_decision_t *decision_out, bool initial_attempt)
{
    watchdog_manager_feed();

    if (!http_client_has_auth_token()) {
        enter_auth_fail_safe("Missing authentication token", 0, NULL);
        return ESP_ERR_INVALID_STATE;
    }

    device_status_t status = {
        .relay_state = relay_get_state(),
        .uptime_seconds = (uint32_t)(esp_timer_get_time() / 1000000),
        .wifi_rssi = (int32_t)wifi_manager_get_rssi(),
        .countdown_timer_remaining = deadman_timer_get_remaining(),
        .firmware_version = FIRMWARE_VERSION,

        // Story 2.11: Power & Health Telemetry
        .free_heap_bytes = esp_get_free_heap_size(),
        .wifi_ps_mode = wifi_manager_get_ps_mode(),
        .cpu_freq_mhz = 240,  // Configured max frequency (actual may vary with PM)
        .watchdog_reset_count = (uint8_t)watchdog_manager_get_reset_count(),
        .last_reset_reason = watchdog_manager_get_reset_reason_string(),
    };

    server_decision_t local_decision = {0};
    server_decision_t *decision_target = decision_out ? decision_out : &local_decision;

    esp_err_t err = http_client_report_status(&status, decision_target);

    if (err == ESP_OK) {
        if (decision_target->status_code == HTTP_STATUS_OK) {
            if (!s_initial_auth_complete && initial_attempt) {
                s_initial_auth_complete = true;
                strncpy(s_device_state, "authenticated", sizeof(s_device_state) - 1);
                s_device_state[sizeof(s_device_state) - 1] = '\0';
                ESP_LOGI(TAG, "Authentication successful (HTTP 200)");
                ESP_LOGI(TAG, "Device successfully authenticated with server - proceeding to normal operation");
            } else {
                ESP_LOGI(TAG, "Status accepted by server (HTTP 200)");
            }

            if (decision_target->valid) {
                const char *server_time = decision_target->server_time[0] ? decision_target->server_time : "<not provided>";
                ESP_LOGI(
                    TAG,
                    "Server decision: shutdown_allowed=%s reset_countdown=%s server_time=%s",
                    decision_target->shutdown_allowed ? "true" : "false",
                    decision_target->reset_countdown ? "true" : "false",
                    server_time
                );
            } else {
                ESP_LOGW(TAG, "Server response missing expected control fields");
            }
        } else if (decision_target->status_code == HTTP_STATUS_UNAUTHORIZED) {
            ESP_LOGE(TAG, "Authentication failed - invalid or expired token (HTTP 401)");
            enter_auth_fail_safe("Authentication failed - invalid or missing token", decision_target->status_code, NULL);
            err = ESP_ERR_INVALID_RESPONSE;
        } else {
            ESP_LOGW(TAG, "Unexpected HTTP status: %d", decision_target->status_code);
        }
    } else {
        ESP_LOGW(TAG, "Failed to report status: %s", esp_err_to_name(err));
    }

    ESP_LOGI(TAG, "Free heap: %u bytes", (unsigned)esp_get_free_heap_size());

    if (auth_fail_safe_is_active()) {
        ESP_LOGW(TAG, "Status reporting halted - authentication failure latched");
    }

    watchdog_manager_feed();

    return err;
}

/**
 * @brief Initialize and start application
 */
void app_main(void)
{
    ESP_LOGI(TAG, "Bunkercolab Firmware v%s starting...", FIRMWARE_VERSION);
    ESP_LOGI(TAG, "Epic 1: Foundation & Device Communication");

    relay_controller_init();
    watchdog_manager_init();
    if (watchdog_manager_last_boot_was_watchdog()) {
        ESP_LOGW(TAG, "Watchdog reboot detected - relay reinitialized to fail-safe ON state");
    }
    deadman_timer_init();

    esp_err_t led_init_err = led_controller_init();
    if (led_init_err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize LED controller: %s", esp_err_to_name(led_init_err));
    }

    esp_err_t ret;

    // ========================================================================
    // Stage 1: Initialize NVS Storage (FR12)
    // ========================================================================
    ESP_LOGI(TAG, "[1/6] Initializing NVS storage...");
    ret = nvs_storage_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS: %s", esp_err_to_name(ret));
        ESP_LOGE(TAG, "FATAL ERROR - Cannot continue without NVS");
        return;
    }
    ESP_LOGI(TAG, "NVS initialized successfully");

    // Configure CPU power management (Story 2.11)
    // Enables dynamic frequency scaling: 80MHz (idle) to 240MHz (active)
    // Provides 30-50% additional power savings when idle
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 240,        // Full speed when active
        .min_freq_mhz = 80,         // Low power when idle
        .light_sleep_enable = true  // Enable light sleep during delays
    };

    ret = esp_pm_configure(&pm_config);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Power management enabled: 80-240MHz with light sleep");
    } else {
        ESP_LOGW(TAG, "Failed to enable power management: %s (continuing anyway)",
                 esp_err_to_name(ret));
    }

    // ========================================================================
    // Stage 2: LED Test Mode Setup (before provisioning check for hardware testing)
    // ========================================================================
#ifdef CONFIG_LED_TEST_MODE
    // In test mode, start LED immediately for hardware validation (Story 5.1)
    s_led_flash_sequence = CONFIG_LED_TEST_SEQUENCE;
    ESP_LOGI(TAG, "[2/6] LED Test Mode: Starting flash sequence (%u blinks) on GPIO 5",
             (unsigned)s_led_flash_sequence);

    if (s_led_flash_sequence >= 1 && s_led_flash_sequence <= 10) {
        esp_err_t led_err = led_flash_task_start(s_led_flash_sequence);
        if (led_err == ESP_OK) {
            s_led_task_started = true;
            ESP_LOGI(TAG, "LED test mode: Flash task started successfully");
        } else {
            ESP_LOGE(TAG, "LED test mode: Failed to start flash task: %s", esp_err_to_name(led_err));
        }
    }

    // In test mode, run indefinitely to allow LED observation
    ESP_LOGI(TAG, "LED Test Mode Active - Device will flash LED continuously");
    ESP_LOGI(TAG, "Press RESET button to restart or disable CONFIG_LED_TEST_MODE for normal operation");
    return;  // Exit early in test mode
#endif

    // ========================================================================
    // Stage 3: Check Provisioning Status
    // ========================================================================
    ESP_LOGI(TAG, "[3/6] Checking provisioning status...");
    bool provisioned = false;
    ret = nvs_storage_is_provisioned(&provisioned);

    if (!provisioned) {
        ESP_LOGW(TAG, "Device not provisioned - secure provisioning required before operation");
        ESP_LOGW(TAG, "Provisioning implementation is in Epic 1 - Provisioning Component");
        ESP_LOGW(TAG, "Configure WiFi credentials, server URL, auth token, and LED sequence via approved provisioning workflow");
        app_state = APP_STATE_PROVISIONING;
        // TODO: Implement provisioning mode (separate component)
        return;
    }

    ESP_LOGI(TAG, "Device is provisioned");

    ret = nvs_storage_get_led_flash_sequence(&s_led_flash_sequence);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "LED flash sequence loaded from NVS: %u", (unsigned)s_led_flash_sequence);
    } else if (ret == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(TAG, "LED flash sequence not found in NVS - defaulting to disabled");
        s_led_flash_sequence = 0;
    } else {
        ESP_LOGE(TAG, "Failed to read LED flash sequence: %s", esp_err_to_name(ret));
        s_led_flash_sequence = 0;
    }

    // ========================================================================
    // Stage 3: Initialize Network Stack
    // ========================================================================
    ESP_LOGI(TAG, "[3/6] Initializing network stack...");

    // Initialize TCP/IP stack
    ESP_ERROR_CHECK(esp_netif_init());

    // Create default event loop
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Create default WiFi station
    esp_netif_create_default_wifi_sta();

    ESP_LOGI(TAG, "Network stack initialized");

    // ========================================================================
    // Stage 4: Initialize WiFi Manager (FR13, FR14)
    // ========================================================================
    ESP_LOGI(TAG, "[4/6] Initializing WiFi manager...");
    ret = wifi_manager_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize WiFi manager: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    // Connect to WiFi using stored credentials
    ESP_LOGI(TAG, "Connecting to WiFi...");
    ret = wifi_manager_connect(wifi_event_handler, NULL);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initiate WiFi connection: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    app_state = APP_STATE_CONNECTING;
    ESP_LOGI(TAG, "WiFi connection initiated");

    // ========================================================================
    // Stage 5: Initialize HTTPS Client (FR15, FR16)
    // ========================================================================
    ESP_LOGI(TAG, "[5/6] Initializing HTTPS client...");
    ret = http_client_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client: %s", esp_err_to_name(ret));
        app_state = APP_STATE_ERROR;
        return;
    }

    // Load server URL from NVS
    char server_url[256] = {0};
    ret = nvs_storage_get_server_url(server_url);
    if (ret == ESP_OK) {
        http_client_set_server_url(server_url);
        ESP_LOGI(TAG, "Server URL: %s", server_url);
    } else {
        ESP_LOGE(TAG, "No server URL in NVS - device must be provisioned first");
        ESP_LOGE(TAG, "Set server URL using nvs_storage_set_server_url()");
        app_state = APP_STATE_ERROR;
        return;
    }

    // Load auth token from NVS
    char auth_token[128] = {0};
    ret = nvs_storage_get_auth_token(auth_token);
    if (ret == ESP_OK && strlen(auth_token) > 0) {
        if (http_client_set_auth_token(auth_token) == ESP_OK) {
            ESP_LOGI(TAG, "Authentication token loaded from NVS (first 8 chars): %.8s...", auth_token);
        } else {
            ESP_LOGE(TAG, "Failed to configure authentication token");
            enter_auth_fail_safe("Failed to configure authentication token", 0, NULL);
            return;
        }
    } else {
        ESP_LOGE(TAG, "No auth token in NVS - device cannot authenticate");
        enter_auth_fail_safe("Missing auth token in NVS", 0, NULL);
        return;
    }

    ESP_LOGI(TAG, "HTTPS client initialized");

    // Start OTA updater task (best-effort; device continues even if task fails to start)
    esp_err_t ota_ret = ota_updater_start(server_url);
    if (ota_ret != ESP_OK) {
        ESP_LOGW(TAG, "Failed to start OTA updater: %s", esp_err_to_name(ota_ret));
    }

    // ========================================================================
    // Stage 6: Start Control Loop Task
    // ========================================================================
    ESP_LOGI(TAG, "[6/6] Starting control loop task...");

    BaseType_t control_loop_created = xTaskCreatePinnedToCore(
        control_loop_task,
        "control_loop",
        4096,
        NULL,
        6,
        NULL,
        1
    );

    if (control_loop_created != pdPASS) {
        ESP_LOGE(TAG, "Failed to create control loop task");
        app_state = APP_STATE_ERROR;
        return;
    }

    ESP_LOGI(TAG, "Control loop task started");
    ESP_LOGI(TAG, "==============================================");
    ESP_LOGI(TAG, "Bunkercolab firmware initialization complete");
    ESP_LOGI(TAG, "==============================================");
}
