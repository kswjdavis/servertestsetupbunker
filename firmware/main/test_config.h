/**
 * @file test_config.h
 * @brief Test configuration for ESP32 firmware
 *
 * SECURITY WARNING: These hardcoded credentials are for TESTING ONLY!
 * Remove this file before production deployment.
 */

#ifndef TEST_CONFIG_H
#define TEST_CONFIG_H

// Test WiFi credentials
#define TEST_WIFI_SSID      "Davis"
#define TEST_WIFI_PASSWORD  "jeffmary"

// Test server configuration
#define TEST_SERVER_URL     "http://206.189.210.203"

// Test device authentication token (temporary - for testing only)
#define TEST_AUTH_TOKEN     "1bc580a0-5be2-4b83-99f6-e8e08a29a334"

// Enable test mode (auto-configure NVS if empty)
#define ENABLE_TEST_MODE    1

#endif // TEST_CONFIG_H
