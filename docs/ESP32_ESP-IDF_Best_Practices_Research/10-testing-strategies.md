# 10. Testing Strategies

## Testing Frameworks in ESP-IDF

ESP-IDF supports multiple testing approaches:

1. **Unity Test Framework** (on-target testing)
2. **pytest-embedded** (automated test execution)
3. **CMock** (mocking for unit tests)
4. **Linux host-based testing** (hardware abstraction)

## On-Target Unit Testing with Unity

**Project Structure:**
```
components/fan_control/
├── CMakeLists.txt
├── include/fan_control.h
├── src/fan_control.c
└── test/
    ├── CMakeLists.txt
    └── test_fan_control.c
```

**Test CMakeLists.txt:**
```cmake
idf_component_register(
    SRC_DIRS "."
    INCLUDE_DIRS "."
    REQUIRES unity fan_control
)
```

**Example Test:**
```c
#include "unity.h"
#include "fan_control.h"
#include "esp_log.h"

static const char *TAG = "fan_control_test";

void setUp(void) {
    // Setup before each test
    fan_control_init();
}

void tearDown(void) {
    // Cleanup after each test
    fan_control_deinit();
}

TEST_CASE("Fan control initializes correctly", "[fan_control]") {
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_FAIL_SAFE, status.state);
}

TEST_CASE("Setting fan state updates GPIO", "[fan_control]") {
    set_fan_state(0, FAN_STATE_ON);
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_ON, status.state);
}

TEST_CASE("Fail-safe activates on timeout", "[fan_control][timeout=10]") {
    // Simulate normal operation
    set_fan_state(0, FAN_STATE_OFF);

    // Stop sending heartbeats
    vTaskDelay(pdMS_TO_TICKS(65000));  // Wait for timeout

    // Should revert to fail-safe
    fan_status_t status = get_fan_status(0);
    TEST_ASSERT_EQUAL(FAN_STATE_FAIL_SAFE, status.state);
}

// Test for edge cases
TEST_CASE("Invalid fan ID returns error", "[fan_control][negative]") {
    esp_err_t err = set_fan_state(99, FAN_STATE_ON);
    TEST_ASSERT_EQUAL(ESP_ERR_INVALID_ARG, err);
}
```

**Running Tests:**
```bash