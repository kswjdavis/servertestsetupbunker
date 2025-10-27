#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "../main/relay_controller.h"

static void reset_relay(void)
{
    relay_controller_init();
}

static void test_initial_state(void)
{
    reset_relay();

    assert(relay_is_locked() == false);
    assert(relay_test_get_gpio_level() == 0);
    assert(strcmp(relay_get_state(), "ON") == 0);
}

static void test_set_off_and_on_sequence(void)
{
    reset_relay();

    relay_set_off();
    assert(strcmp(relay_get_state(), "OFF") == 0);
    assert(relay_test_get_gpio_level() == 1);
    assert(relay_is_locked() == false);

    relay_set_on();
    assert(strcmp(relay_get_state(), "ON") == 0);
    assert(relay_test_get_gpio_level() == 0);
}

static void test_force_on_latches_fail_safe(void)
{
    reset_relay();

    relay_set_off();
    assert(strcmp(relay_get_state(), "OFF") == 0);
    assert(relay_test_get_gpio_level() == 1);

    relay_force_on();
    assert(relay_is_locked() == true);
    assert(strcmp(relay_get_state(), "ON") == 0);
    assert(relay_test_get_gpio_level() == 0);

    relay_set_off();
    assert(strcmp(relay_get_state(), "ON") == 0);
    assert(relay_test_get_gpio_level() == 0);
}

static void test_reinit_clears_lock(void)
{
    reset_relay();
    relay_force_on();
    assert(relay_is_locked() == true);

    relay_controller_init();
    assert(relay_is_locked() == false);
    assert(strcmp(relay_get_state(), "ON") == 0);
    assert(relay_test_get_gpio_level() == 0);
}

static void test_unlock_on_server_control_restored(void)
{
    reset_relay();

    // Force fail-safe lock
    relay_force_on();
    assert(relay_is_locked() == true);
    assert(strcmp(relay_get_state(), "ON") == 0);

    // Verify relay_set_off() is blocked by lock
    relay_set_off();
    assert(strcmp(relay_get_state(), "ON") == 0);  // Still ON
    assert(relay_is_locked() == true);              // Still locked

    // Simulate server control restoration
    relay_unlock_on_server_control_restored();
    assert(relay_is_locked() == false);             // Lock cleared
    assert(strcmp(relay_get_state(), "ON") == 0);   // State unchanged (still ON)

    // Verify relay_set_off() now works
    relay_set_off();
    assert(strcmp(relay_get_state(), "OFF") == 0);  // Now OFF
    assert(relay_test_get_gpio_level() == 1);       // GPIO confirms OFF
}

static void test_unlock_when_not_locked(void)
{
    reset_relay();

    // Call unlock when relay is not locked
    assert(relay_is_locked() == false);
    relay_unlock_on_server_control_restored();
    assert(relay_is_locked() == false);  // Still not locked (no-op)

    // Verify normal operation still works
    relay_set_off();
    assert(strcmp(relay_get_state(), "OFF") == 0);
}

static void test_unlock_and_relock_cycle(void)
{
    reset_relay();

    // First fail-safe event
    relay_force_on();
    assert(relay_is_locked() == true);

    // Server control restored
    relay_unlock_on_server_control_restored();
    assert(relay_is_locked() == false);

    // Second fail-safe event (simulates another timeout)
    relay_force_on();
    assert(relay_is_locked() == true);

    // Verify lock blocks off command
    relay_set_off();
    assert(strcmp(relay_get_state(), "ON") == 0);

    // Second server control restoration
    relay_unlock_on_server_control_restored();
    assert(relay_is_locked() == false);

    // Verify off command now works
    relay_set_off();
    assert(strcmp(relay_get_state(), "OFF") == 0);
}

int main(void)
{
    test_initial_state();
    test_set_off_and_on_sequence();
    test_force_on_latches_fail_safe();
    test_reinit_clears_lock();
    test_unlock_on_server_control_restored();
    test_unlock_when_not_locked();
    test_unlock_and_relock_cycle();

    printf("All relay_controller tests passed.\n");
    return 0;
}

