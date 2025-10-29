# 10. Unit Testing Framework

## Official Documentation
- **API Guide:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html
- **Example:** `examples/system/unit_test/`
- **Framework:** Unity (not Catch)

## Purpose
Test ESP32 firmware logic on target hardware using the Unity test framework integrated with ESP-IDF.

## Key Features
- Unity test framework (C-based)
- Target-based testing on ESP32
- Linux host-based testing (with mocks)
- CMock for mocking support
- Test discovery and execution
- Serial output for results

## Unity Test Framework

ESP-IDF uses **Unity** as the official unit test framework. Unity is a lightweight C testing framework designed for embedded systems.

**Important:** ESP-IDF does NOT use Catch framework. Catch is C++ only.

## Test File Structure

Tests are placed in the `test` subdirectory of components:

```
my_component/
├── CMakeLists.txt
├── include/
│   └── my_component.h
├── my_component.c
└── test/
    ├── CMakeLists.txt
    └── test_my_component.c
```

## Example: Basic Unity Test

```c
// test/test_deadman_timer.c
#include "unity.h"
#include "esp_timer.h"
#include "deadman_timer.h"

// Setup function (runs before each test)
void setUp(void) {
    init_deadman_timer();
}

// Teardown function (runs after each test)
void tearDown(void) {
    cleanup_deadman_timer();
}

// Test case: Timer initialization
TEST_CASE("Deadman timer initializes correctly", "[deadman]") {
    // Arrange
    esp_timer_handle_t timer = get_deadman_timer_handle();

    // Assert
    TEST_ASSERT_NOT_NULL(timer);
    TEST_ASSERT_FALSE(esp_timer_is_active(timer));
}

// Test case: Timer reset
TEST_CASE("Deadman timer resets on command", "[deadman]") {
    // Arrange
    reset_deadman_timer();

    // Act
    bool is_active = esp_timer_is_active(get_deadman_timer_handle());

    // Assert
    TEST_ASSERT_TRUE(is_active);
}

// Test case: Timer expiration triggers failsafe
TEST_CASE("Deadman timer expiration activates failsafe", "[deadman]") {
    // Arrange
    reset_deadman_timer();

    // Act
    // Wait for timer expiration (or manually trigger callback)
    simulate_timer_expiration();

    // Assert
    TEST_ASSERT_EQUAL(RELAY_ON, get_relay_state());
    TEST_ASSERT_FALSE(is_shutdown_allowed());
}

// Test case: Connection loss stops timer
TEST_CASE("Connection loss stops timer and activates failsafe", "[deadman]") {
    // Arrange
    reset_deadman_timer();
    TEST_ASSERT_TRUE(esp_timer_is_active(get_deadman_timer_handle()));

    // Act
    handle_connection_lost();

    // Assert
    TEST_ASSERT_FALSE(esp_timer_is_active(get_deadman_timer_handle()));
    TEST_ASSERT_EQUAL(RELAY_ON, get_relay_state());
}
```

## Unity Assertion Macros

```c
// Boolean
TEST_ASSERT_TRUE(condition);
TEST_ASSERT_FALSE(condition);
TEST_ASSERT(condition);

// Equality
TEST_ASSERT_EQUAL(expected, actual);
TEST_ASSERT_EQUAL_INT(expected, actual);
TEST_ASSERT_EQUAL_STRING(expected, actual);
TEST_ASSERT_EQUAL_MEMORY(expected, actual, length);

// Pointers
TEST_ASSERT_NULL(pointer);
TEST_ASSERT_NOT_NULL(pointer);

// Ranges
TEST_ASSERT_LESS_THAN(threshold, actual);
TEST_ASSERT_GREATER_THAN(threshold, actual);
TEST_ASSERT_INT_WITHIN(delta, expected, actual);

// Floating Point
TEST_ASSERT_EQUAL_FLOAT(expected, actual);
TEST_ASSERT_FLOAT_WITHIN(delta, expected, actual);

// Messages
TEST_ASSERT_EQUAL_MESSAGE(expected, actual, "Custom message");
TEST_FAIL_MESSAGE("Failure message");
```

## Test Organization with Tags

```c
TEST_CASE("Fast unit test", "[unit][fast]") {
    // Fast test
}

TEST_CASE("Integration test requiring WiFi", "[integration][wifi]") {
    // Integration test
}

TEST_CASE("Slow stress test", "[stress][slow]") {
    // Stress test
}
```

Run specific tags:
```bash
idf.py test --tags="unit,fast"
```

## CMakeLists.txt for Test Component

```cmake