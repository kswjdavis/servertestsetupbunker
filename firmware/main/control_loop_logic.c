#include "control_loop_logic.h"

control_loop_actions_t control_loop_process_decision(
    esp_err_t report_err,
    const control_loop_decision_t *decision,
    bool relay_locked,
    bool last_decision_valid,
    bool last_shutdown_allowed)
{
    control_loop_actions_t actions = {
        .reset_deadman = false,
        .relay_on = false,
        .relay_off = false,
        .relay_force_on = false,
        .decision_valid = false,
        .shutdown_allowed = last_shutdown_allowed,
        .decision_changed = false,
    };

    if (report_err != ESP_OK) {
        if (!relay_locked) {
            actions.relay_on = true;
        }
        return actions;
    }

    if (!decision || !decision->valid) {
        return actions;
    }

    actions.decision_valid = true;
    actions.shutdown_allowed = decision->shutdown_allowed;

    if (decision->reset_countdown) {
        actions.reset_deadman = true;
    }

    if (decision->shutdown_allowed) {
        if (!relay_locked) {
            actions.relay_off = true;
        }
    } else {
        actions.relay_on = true;
    }

    if (!last_decision_valid || decision->shutdown_allowed != last_shutdown_allowed) {
        actions.decision_changed = true;
    }

    return actions;
}

bool control_loop_should_attempt_report(
    bool wifi_connected,
    bool authentication_failed,
    uint32_t now_ticks,
    uint32_t last_report_tick,
    bool initial_report_pending,
    uint32_t interval_ticks)
{
    if (authentication_failed || !wifi_connected) {
        return false;
    }

    if (initial_report_pending) {
        return true;
    }

    return (now_ticks - last_report_tick) >= interval_ticks;
}

