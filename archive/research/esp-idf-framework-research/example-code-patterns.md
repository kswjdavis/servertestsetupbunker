# Example Code Patterns

## Complete Initialization Sequence

```c
void app_main(void) {
    ESP_LOGI(TAG, "Grain Bunker Fan Controller Starting...");

    // 1. Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Initialize fail-safe GPIO (FANS ON)
    init_relay_gpio();
    init_status_led();

    // 3. Initialize watchdog timer
    init_task_watchdog();

    // 4. Initialize WiFi and connect
    init_wifi();
    wait_for_wifi_connection();

    // 5. Initialize SNTP for accurate time
    initialize_sntp();
    wait_for_time_sync();

    // 6. Initialize dead-man timer
    init_deadman_timer();

    // 7. Start main control loop
    xTaskCreate(control_task, "control_task", 4096, NULL, 5, NULL);

    ESP_LOGI(TAG, "Initialization complete - entering main loop");
}
```

## WiFi Connection with Retry Logic

```c
#define WIFI_MAXIMUM_RETRY 5
static int s_retry_num = 0;
static EventGroupHandle_t s_wifi_event_group;

static void event_handler(void* arg, esp_event_base_t event_base,
                         int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < WIFI_MAXIMUM_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Retry WiFi connection (%d/%d)", s_retry_num, WIFI_MAXIMUM_RETRY);
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGE(TAG, "WiFi connection failed");
            // Activate fail-safe
            activate_failsafe();
        }

    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}
```

## HTTPS API Request with Authentication

```c
esp_err_t send_status_to_server(void) {
    char auth_token[128];
    load_auth_token(auth_token, sizeof(auth_token));

    // Create JSON payload
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "device_id", get_device_id());
    cJSON_AddNumberToObject(root, "uptime", esp_timer_get_time() / 1000000);
    cJSON_AddStringToObject(root, "state", get_relay_state() == RELAY_ON ? "fans_on" : "fans_off");
    cJSON_AddNumberToObject(root, "rssi", get_wifi_rssi());

    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    // Configure HTTPS client
    esp_http_client_config_t config = {
        .url = "https://api.example.com/v1/devices/status",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .event_handler = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    // Set headers
    char auth_header[256];
    snprintf(auth_header, sizeof(auth_header), "Bearer %s", auth_token);
    esp_http_client_set_header(client, "Authorization", auth_header);
    esp_http_client_set_header(client, "Content-Type", "application/json");

    // Set POST data
    esp_http_client_set_post_field(client, json_string, strlen(json_string));

    // Execute request
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "Status report sent, HTTP %d", status_code);

        if (status_code == 200) {
            // Success
        } else {
            ESP_LOGW(TAG, "Server returned non-200 status");
        }
    } else {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        // Don't activate fail-safe for transient errors
    }

    cJSON_free(json_string);
    esp_http_client_cleanup(client);

    return err;
}
```

## Control Loop with Dead-Man Timer

```c
void control_task(void *pvParameters) {
    // Subscribe to task watchdog
    esp_task_wdt_add(NULL);

    while (1) {
        // Reset task watchdog
        esp_task_wdt_reset();

        // Check WiFi connection
        if (!is_wifi_connected()) {
            ESP_LOGW(TAG, "WiFi disconnected - activating fail-safe");
            activate_failsafe();
            vTaskDelay(pdMS_TO_TICKS(30000));  // Wait 30s before retry
            continue;
        }

        // Poll server for shutdown command
        esp_err_t err = poll_server_for_command();

        if (err == ESP_OK) {
            // Check if "shutdown allowed" received
            if (is_shutdown_command_active()) {
                reset_deadman_timer();  // Reset 5-minute countdown

                // Turn fans OFF if local conditions safe
                if (check_local_conditions_safe()) {
                    set_fans_state(false);
                }
            }
        } else {
            ESP_LOGE(TAG, "Server communication failed");
            // Transient error - keep existing state
        }

        // Send status report every 60 seconds
        static uint32_t last_status_time = 0;
        uint32_t now = esp_timer_get_time() / 1000000;
        if (now - last_status_time >= 60) {
            send_status_to_server();
            last_status_time = now;
        }

        // Main loop runs every 60 seconds
        vTaskDelay(pdMS_TO_TICKS(60000));
    }
}
```

---
