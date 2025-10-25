/**
 * @file control_loop_logic.h
 * @brief Testable helpers for evaluating ESP32 control loop decisions.
 *
 * These helpers isolate the pure decision-making logic from the FreeRTOS
 * task orchestration so we can exercise the safety-critical behaviour in
 * host-based tests without ESP-IDF dependencies.
 */

#ifndef CONTROL_LOOP_LOGIC_H
#define CONTROL_LOOP_LOGIC_H

#include <stdbool.h>
#include <stdint.h>

#include "esp_err_compat.h"

typedef struct {
    bool shutdown_allowed;
    bool reset_countdown;
    bool valid;
} control_loop_decision_t;

typedef struct {
    bool reset_deadman;
    bool relay_on;
    bool relay_off;
    bool relay_force_on;
    bool decision_valid;
    bool shutdown_allowed;
    bool decision_changed;
} control_loop_actions_t;

control_loop_actions_t control_loop_process_decision(
    esp_err_t report_err,
    const control_loop_decision_t *decision,
    bool relay_locked,
    bool last_decision_valid,
    bool last_shutdown_allowed);

bool control_loop_should_attempt_report(
    bool wifi_connected,
    bool authentication_failed,
    uint32_t now_ticks,
    uint32_t last_report_tick,
    bool initial_report_pending,
    uint32_t interval_ticks);

#endif /* CONTROL_LOOP_LOGIC_H */

