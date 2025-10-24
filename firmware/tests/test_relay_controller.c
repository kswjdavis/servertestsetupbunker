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

int main(void)
{
    test_initial_state();
    test_set_off_and_on_sequence();
    test_force_on_latches_fail_safe();
    test_reinit_clears_lock();

    printf("All relay_controller tests passed.\n");
    return 0;
}

