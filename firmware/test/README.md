# Bunkercolab Firmware Test Suite

## Overview

This directory contains test infrastructure for the Bunkercolab ESP32 firmware. Tests are organized into unit tests, integration tests, and system tests following ESP-IDF testing best practices.

## Test Framework

We use **Unity** as the test framework, which is integrated into ESP-IDF.

Official Documentation:
- [ESP-IDF Unit Testing](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html)
- [Unity Test Framework](http://www.throwtheswitch.org/unity)

## Test Organization

```
test/
├── README.md                    # This file
├── unit/                        # Component unit tests
│   ├── test_nvs_storage.c      # NVS storage tests
│   ├── test_wifi_manager.c     # WiFi manager tests
│   └── test_http_client.c      # HTTP client tests
├── integration/                 # Integration tests
│   ├── test_wifi_connection.c  # End-to-end WiFi tests
│   └── test_api_communication.c # API communication tests
└── system/                      # Full system tests
    ├── test_status_reporting.c # Status reporting tests
    └── test_memory_leaks.c     # Memory leak detection
```

## Running Tests

### On-Target Testing (ESP32 Hardware)

```bash
# Build and flash test firmware
cd firmware/test/unit
idf.py -p /dev/ttyUSB0 flash monitor

# Run all tests
# In the serial monitor, type:
# > test

# Run specific test
# > test "nvs_storage"
```

### Host-Based Testing (Linux/macOS)

```bash
# Build for host platform
cd firmware/test/unit
idf.py build

# Run tests
./build/test_app.elf
```

## Planned Test Suites

### Unit Tests (Components in Isolation)

#### 1. NVS Storage Tests (`test_nvs_storage.c`)

**Status:** 🔄 Planned

Tests:
- [ ] `test_nvs_init()` - NVS initialization
- [ ] `test_nvs_set_get_wifi_credentials()` - WiFi credential storage/retrieval
- [ ] `test_nvs_set_get_auth_token()` - Auth token storage/retrieval
- [ ] `test_nvs_set_get_device_id()` - Device ID storage/retrieval
- [ ] `test_nvs_set_get_server_url()` - Server URL storage/retrieval
- [ ] `test_nvs_provisioned_flag()` - Provisioning flag
- [ ] `test_nvs_erase_all()` - Factory reset
- [ ] `test_nvs_encryption()` - Verify encryption enabled
- [ ] `test_nvs_invalid_params()` - Error handling for invalid inputs
- [ ] `test_nvs_max_sizes()` - Boundary testing for string lengths

Example test structure:
```c
#include "unity.h"
#include "nvs_storage.h"

void setUp(void) {
    // Initialize NVS before each test
    nvs_storage_init();
}

void tearDown(void) {
    // Clean up after each test
    nvs_storage_erase_all();
}

TEST_CASE("NVS stores and retrieves WiFi credentials", "[nvs]") {
    const char* ssid = "TestNetwork";
    const char* password = "TestPassword123";

    // Store credentials
    esp_err_t ret = nvs_storage_set_wifi_credentials(ssid, password);
    TEST_ASSERT_EQUAL(ESP_OK, ret);

    // Retrieve credentials
    char retrieved_ssid[33] = {0};
    char retrieved_password[65] = {0};
    ret = nvs_storage_get_wifi_credentials(retrieved_ssid, retrieved_password);

    TEST_ASSERT_EQUAL(ESP_OK, ret);
    TEST_ASSERT_EQUAL_STRING(ssid, retrieved_ssid);
    TEST_ASSERT_EQUAL_STRING(password, retrieved_password);
}
```

#### 2. WiFi Manager Tests (`test_wifi_manager.c`)

**Status:** 🔄 Planned

Tests:
- [ ] `test_wifi_init()` - WiFi manager initialization
- [ ] `test_wifi_reconnect_timing()` - Verify FR14 (30s/2min intervals)
- [ ] `test_wifi_state_machine()` - State transitions
- [ ] `test_wifi_rssi_reading()` - Signal strength monitoring
- [ ] `test_wifi_scan()` - Network scanning
- [ ] `test_wifi_callback()` - Event callbacks
- [ ] `test_wifi_disconnect()` - Graceful disconnection
- [ ] `test_wifi_retry_count()` - Retry counter

**Critical Test: Reconnection Timing (FR14)**
```c
TEST_CASE("WiFi reconnection uses correct timing", "[wifi]") {
    // Mock WiFi disconnection
    simulate_wifi_disconnect();

    // Measure reconnection intervals
    for (int i = 1; i <= 7; i++) {
        uint32_t start = esp_timer_get_time() / 1000; // milliseconds
        wait_for_reconnect_attempt();
        uint32_t end = esp_timer_get_time() / 1000;
        uint32_t interval = end - start;

        if (i <= 5) {
            // First 5 attempts: 30 seconds
            TEST_ASSERT_INT_WITHIN(2000, 30000, interval);
        } else {
            // Subsequent attempts: 2 minutes
            TEST_ASSERT_INT_WITHIN(5000, 120000, interval);
        }
    }
}
```

#### 3. HTTP Client Tests (`test_http_client.c`)

**Status:** 🔄 Planned

Tests:
- [ ] `test_http_init()` - HTTP client initialization
- [ ] `test_http_time_sync()` - SNTP time synchronization
- [ ] `test_http_tls_validation()` - Certificate validation (FR15)
- [ ] `test_http_auth_header()` - Bearer token in Authorization header (FR16)
- [ ] `test_http_status_report()` - Status reporting (FR23)
- [ ] `test_http_provision()` - Device provisioning
- [ ] `test_http_error_handling()` - Network errors, timeouts
- [ ] `test_http_json_parsing()` - JSON request/response handling
- [ ] `test_http_invalid_cert()` - Reject invalid certificates

### Integration Tests (Component Interactions)

#### 4. WiFi Connection Test (`test_wifi_connection.c`)

**Status:** 🔄 Planned

Full WiFi connection flow:
- [ ] Load credentials from NVS
- [ ] Connect to WiFi
- [ ] Handle disconnection
- [ ] Automatic reconnection
- [ ] Update RSSI periodically

#### 5. API Communication Test (`test_api_communication.c`)

**Status:** 🔄 Planned

End-to-end API communication:
- [ ] Initialize HTTP client
- [ ] Load auth token from NVS
- [ ] Send authenticated request
- [ ] Parse response
- [ ] Handle 401 Unauthorized
- [ ] Retry on network failures

### System Tests (Full Application)

#### 6. Status Reporting Test (`test_status_reporting.c`)

**Status:** 🔄 Planned

Full status reporting flow (FR23):
```c
TEST_CASE("Status reporting works end-to-end", "[system]") {
    // Setup: Provision device
    nvs_storage_set_wifi_credentials("TestNet", "password");
    nvs_storage_set_device_id("TEST_DEVICE_001");
    nvs_storage_set_auth_token("test_token");
    nvs_storage_set_server_url("https://test.api.com");
    nvs_storage_set_provisioned(true);

    // Start application
    app_main();

    // Wait for WiFi connection
    wait_for_wifi_connection(30000); // 30 seconds max
    TEST_ASSERT_TRUE(wifi_manager_is_connected());

    // Wait for first status report (should be <30 seconds)
    bool report_sent = wait_for_status_report(30000);
    TEST_ASSERT_TRUE(report_sent);

    // Verify reports continue every 60 seconds
    for (int i = 0; i < 3; i++) {
        uint32_t start = esp_timer_get_time() / 1000;
        report_sent = wait_for_status_report(70000); // 70s max
        uint32_t interval = (esp_timer_get_time() / 1000) - start;

        TEST_ASSERT_TRUE(report_sent);
        TEST_ASSERT_INT_WITHIN(5000, 60000, interval); // 60s ± 5s
    }
}
```

#### 7. Memory Leak Test (`test_memory_leaks.c`)

**Status:** 🔄 Planned

24-hour memory stability test:
```c
TEST_CASE("No memory leaks after 24 hours", "[system][ignore]") {
    // Note: Use [ignore] tag for long-running tests

    uint32_t initial_heap = esp_get_free_heap_size();
    ESP_LOGI("test", "Initial heap: %lu bytes", initial_heap);

    // Run status reporting for 24 hours
    const uint32_t test_duration_ms = 24 * 60 * 60 * 1000; // 24 hours
    const uint32_t check_interval_ms = 60 * 60 * 1000;     // Check every hour

    uint32_t elapsed = 0;
    while (elapsed < test_duration_ms) {
        vTaskDelay(pdMS_TO_TICKS(check_interval_ms));
        elapsed += check_interval_ms;

        uint32_t current_heap = esp_get_free_heap_size();
        ESP_LOGI("test", "Heap after %lu hours: %lu bytes",
                 elapsed / (60 * 60 * 1000), current_heap);

        // Heap should not decrease by more than 10%
        uint32_t heap_loss = initial_heap - current_heap;
        uint32_t max_loss = initial_heap / 10;
        TEST_ASSERT_LESS_THAN(max_loss, heap_loss);
    }

    uint32_t final_heap = esp_get_free_heap_size();
    ESP_LOGI("test", "Final heap: %lu bytes", final_heap);

    // Success metric: Free heap >30KB after 48 hours
    TEST_ASSERT_GREATER_THAN(30000, final_heap);
}
```

### Security Tests

#### 8. TLS Certificate Validation (`test_security.c`)

**Status:** 🔄 Planned

Tests:
- [ ] Accept valid certificate from trusted CA
- [ ] Reject self-signed certificate
- [ ] Reject expired certificate
- [ ] Reject certificate with wrong hostname
- [ ] Verify time sync before TLS validation

Example:
```c
TEST_CASE("Reject invalid TLS certificate", "[security]") {
    // Set server URL to endpoint with invalid cert
    http_client_set_server_url("https://self-signed.badssl.com");

    http_response_t response = {0};
    esp_err_t ret = http_client_get("/", &response);

    // Should fail certificate validation
    TEST_ASSERT_NOT_EQUAL(ESP_OK, ret);
    TEST_ASSERT_EQUAL(0, response.status_code);
}
```

## Test Infrastructure Setup

### 1. Create Test Application

```bash
cd firmware/test/unit
idf.py create-component test_nvs_storage
```

### 2. Configure Test Menu

In `test/unit/CMakeLists.txt`:
```cmake
idf_component_register(
    SRCS "test_nvs_storage.c"
         "test_wifi_manager.c"
         "test_http_client.c"
    INCLUDE_DIRS "."
    REQUIRES unity nvs_flash main
)
```

### 3. Mock External Dependencies

For unit testing, create mocks for:
- WiFi driver (esp_wifi)
- HTTP client (esp_http_client)
- NVS flash (nvs_flash)

Use ESP-IDF's component mocking or CMock.

## Continuous Integration

### GitHub Actions Workflow (Planned)

```yaml
name: ESP32 Firmware Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup ESP-IDF
        uses: espressif/esp-idf-ci-action@v1
      - name: Build Tests
        run: |
          cd firmware/test/unit
          idf.py build
      - name: Run Host Tests
        run: |
          cd firmware/test/unit
          ./build/test_app.elf
```

## Test Coverage Goals

| Component | Target Coverage | Current |
|-----------|----------------|---------|
| NVS Storage | 90% | 0% 🔴 |
| WiFi Manager | 80% | 0% 🔴 |
| HTTP Client | 85% | 0% 🔴 |
| Main Application | 70% | 0% 🔴 |

## Test Execution Checklist

Before releasing firmware:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Security tests pass
- [ ] 24-hour memory leak test passes
- [ ] Manual testing on real hardware
- [ ] Test with actual backend server
- [ ] Test WiFi reconnection with simulated failures
- [ ] Test TLS certificate validation with various certs
- [ ] Verify status reporting frequency (60 seconds)

## Known Test Limitations

1. **Hardware Dependencies:** Some tests require real WiFi network
2. **Time-Based Tests:** Reconnection timing tests take 10+ minutes
3. **TLS Testing:** Requires valid test certificate infrastructure
4. **Memory Leak Tests:** 24-hour tests impractical for CI

**Solution:** Use combination of:
- Unit tests with mocks (fast, in CI)
- Integration tests on real hardware (nightly)
- Long-running tests on dedicated test devices (weekly)

## References

- [ESP-IDF Unit Testing Guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html)
- [Unity Test Framework](http://www.throwtheswitch.org/unity)
- [CMock Mocking Framework](http://www.throwtheswitch.org/cmock)

---

**Status:** Test infrastructure planned, implementation pending
**Priority:** High (required before Epic 1 completion)
**Next Steps:** Implement unit tests for NVS storage component

**Generated with Claude Code**
