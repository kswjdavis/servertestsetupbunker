/**
 * @file relay_controller.h
 * @brief GPIO-backed relay controller with fail-safe locking semantics.
 *
 * Controls a normally-closed relay that keeps bunker ventilation fans
 * running in the event of hardware or software failures. The component
 * exposes explicit ON/OFF helpers, a force-on fail-safe latch, and state
 * inspection APIs used by status reporting and safety subsystems.
 */

#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize relay controller state.
 *
 * Ensures the controller starts in a known fail-safe state (fans ON).
 */
void relay_controller_init(void);

/** Drive the relay to the ON state (GPIO LOW, fans running). */
void relay_set_on(void);

/** Drive the relay to the OFF state (GPIO HIGH, fans stopped). */
void relay_set_off(void);

/**
 * @brief Force relay into ON state and latch fail-safe lock.
 *
 * Subsequent attempts to toggle the relay off will be ignored until the
 * device reboots, guaranteeing fail-safe behaviour.
 */
void relay_force_on(void);

/**
 * @brief Check whether the relay has been latched in fail-safe mode.
 *
 * @return true if relay has been forced ON and locked, false otherwise.
 */
bool relay_is_locked(void);

/**
 * @brief Retrieve human-readable relay state for logging.
 *
 * @return "ON" or "OFF".
 */
const char *relay_get_state(void);

#ifdef UNIT_TEST
/**
 * @brief Expose raw GPIO level for host-based unit tests.
 *
 * @return 0 when fans are ON (relay closed), 1 when fans are OFF.
 */
int relay_test_get_gpio_level(void);
#endif

#ifdef __cplusplus
}
#endif

#endif // RELAY_CONTROLLER_H
