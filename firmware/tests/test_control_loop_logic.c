#include <assert.h>
#include <stdio.h>

#include "../main/control_loop_logic.h"

static control_loop_decision_t make_decision(bool valid, bool shutdown_allowed, bool reset)
{
    control_loop_decision_t decision = {
        .shutdown_allowed = shutdown_allowed,
        .reset_countdown = reset,
        .valid = valid,
    };
    return decision;
}

static void test_shutdown_allowed_turns_fans_off(void)
{
    control_loop_decision_t decision = make_decision(true, true, false);
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_OK,
        &decision,
        false,
        false,
        false
    );

    assert(actions.decision_valid == true);
    assert(actions.shutdown_allowed == true);
    assert(actions.relay_off == true);
    assert(actions.relay_on == false);
    assert(actions.decision_changed == true);
}

static void test_shutdown_denied_turns_fans_on(void)
{
    control_loop_decision_t decision = make_decision(true, false, false);
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_OK,
        &decision,
        false,
        true,
        true
    );

    assert(actions.decision_valid == true);
    assert(actions.shutdown_allowed == false);
    assert(actions.relay_on == true);
    assert(actions.relay_off == false);
    assert(actions.decision_changed == true);
}

static void test_reset_deadman_requested(void)
{
    control_loop_decision_t decision = make_decision(true, true, true);
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_OK,
        &decision,
        false,
        false,
        false
    );

    assert(actions.reset_deadman == true);
    assert(actions.relay_off == true);
}

static void test_failure_forces_fail_safe_when_unlocked(void)
{
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_FAIL,
        NULL,
        false,
        true,
        true
    );

    assert(actions.decision_valid == false);
    assert(actions.relay_on == true);
    assert(actions.relay_off == false);
}

static void test_failure_respects_locked_relay(void)
{
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_FAIL,
        NULL,
        true,
        true,
        true
    );

    assert(actions.relay_on == false);
    assert(actions.relay_off == false);
}

static void test_relay_lock_blocks_shutdown_off(void)
{
    control_loop_decision_t decision = make_decision(true, true, false);
    control_loop_actions_t actions = control_loop_process_decision(
        ESP_OK,
        &decision,
        true,
        false,
        false
    );

    assert(actions.decision_valid == true);
    assert(actions.relay_off == false);
    assert(actions.shutdown_allowed == true);
}

static void test_decision_change_detection(void)
{
    control_loop_decision_t allow = make_decision(true, true, false);
    control_loop_actions_t first = control_loop_process_decision(
        ESP_OK,
        &allow,
        false,
        false,
        false
    );
    assert(first.decision_changed == true);

    control_loop_actions_t second = control_loop_process_decision(
        ESP_OK,
        &allow,
        false,
        first.decision_valid,
        first.shutdown_allowed
    );
    assert(second.decision_changed == false);
}

static void test_report_scheduling_helpers(void)
{
    uint32_t interval = 60000;

    assert(control_loop_should_attempt_report(false, false, 1000, 0, true, interval) == false);
    assert(control_loop_should_attempt_report(true, false, 1000, 0, true, interval) == true);
    assert(control_loop_should_attempt_report(true, true, 1000, 0, true, interval) == false);
    assert(control_loop_should_attempt_report(true, false, 1000, 0, false, interval) == false);
    assert(control_loop_should_attempt_report(true, false, 61000, 0, false, interval) == true);
}

int main(void)
{
    test_shutdown_allowed_turns_fans_off();
    test_shutdown_denied_turns_fans_on();
    test_reset_deadman_requested();
    test_failure_forces_fail_safe_when_unlocked();
    test_failure_respects_locked_relay();
    test_relay_lock_blocks_shutdown_off();
    test_decision_change_detection();
    test_report_scheduling_helpers();

    printf("All control loop logic tests passed.\n");
    return 0;
}

