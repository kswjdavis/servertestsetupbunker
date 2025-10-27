#include <assert.h>
#include <stdbool.h>
#include <stdio.h>

#include "../main/led_controller.h"

static void reset_state(void)
{
    led_flash_task_stop();
    led_test_reset_state();
}

static void test_initial_state(void)
{
    reset_state();
    assert(!led_test_is_initialized());
    assert(!led_test_is_task_running());
    assert(led_test_get_flash_count() == 0);
    assert(led_test_get_led_state() == false);
}

static void test_init_sets_defaults(void)
{
    reset_state();
    assert(led_controller_init() == ESP_OK);
    assert(led_test_is_initialized());
    assert(!led_test_is_task_running());
    assert(led_test_get_flash_count() == 0);
    assert(led_test_get_led_state() == false);
}

static void test_start_rejects_invalid_values(void)
{
    reset_state();
    assert(led_flash_task_start(0) == ESP_ERR_INVALID_ARG);
    assert(!led_test_is_initialized());
    assert(!led_test_is_task_running());
    assert(led_flash_task_start(11) == ESP_ERR_INVALID_ARG);
    assert(!led_test_is_initialized());
}

static void test_start_performs_lazy_init(void)
{
    reset_state();
    assert(led_flash_task_start(3) == ESP_OK);
    assert(led_test_is_initialized());
    assert(led_test_is_task_running());
    assert(led_test_get_flash_count() == 3);
    assert(led_test_get_led_state() == false);
}

static void test_start_updates_existing_task(void)
{
    reset_state();
    assert(led_flash_task_start(2) == ESP_OK);
    assert(led_test_get_flash_count() == 2);
    assert(led_flash_task_start(5) == ESP_OK);
    assert(led_test_is_task_running());
    assert(led_test_get_flash_count() == 5);
}

static void test_stop_clears_task_state(void)
{
    reset_state();
    assert(led_flash_task_start(4) == ESP_OK);
    led_flash_task_stop();
    assert(!led_test_is_task_running());
    assert(led_test_get_flash_count() == 0);
    assert(led_test_get_led_state() == false);
}

static void test_manual_led_state_control(void)
{
    reset_state();
    assert(led_controller_init() == ESP_OK);
    led_set_state(true);
    assert(led_test_get_led_state() == true);
    led_set_state(false);
    assert(led_test_get_led_state() == false);
}

static void test_duration_constants(void)
{
    reset_state();
    assert(led_test_get_on_duration_ms() == 200U);
    assert(led_test_get_off_duration_ms() == 200U);
    assert(led_test_get_pause_duration_ms() == 2000U);
}

int main(void)
{
    test_initial_state();
    test_init_sets_defaults();
    test_start_rejects_invalid_values();
    test_start_performs_lazy_init();
    test_start_updates_existing_task();
    test_stop_clears_task_state();
    test_manual_led_state_control();
    test_duration_constants();

    printf("All led_controller tests passed.\n");
    return 0;
}
