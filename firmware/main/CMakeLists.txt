idf_component_register(
    SRCS
        # "led_test.c"
        "main.c"
        "wifi_manager.c"
        "nvs_storage.c"
        "http_client.c"
        "http_client_utils.c"
        "deadman_timer.c"
        "relay_controller.c"
        "led_controller.c"
        "auth_fail_safe.c"
        "watchdog_manager.c"
        "control_loop_logic.c"
        # "ota_updater.c"  # Temporarily disabled - has API compatibility issues
    INCLUDE_DIRS "."
    REQUIRES
        esp_wifi
        esp_event
        esp_netif
        nvs_flash
        esp_http_server
        esp_http_client
        esp-tls
        esp_timer
        esp_https_ota
        app_update
        esp_pm
        json
    PRIV_REQUIRES
        esp_driver_gpio
    EMBED_TXTFILES
        "certs/root_cert.pem"
        "certs/server_cert.pem"
)
