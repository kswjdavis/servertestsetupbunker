/**
 * @file relay_controller.h
 * @brief Minimal relay controller interface for fail-safe operations.
 *
 * Story 1.7 depends on the ability to force the relay ON when
 * authentication fails. A full relay controller implementation will
 * arrive in later stories; this header exposes the minimal APIs needed
 * today so other modules can invoke the fail-safe path without
 * worrying about hardware details yet.
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

/**
 * @brief Force relay into ON state and latch fail-safe lock.
 *
 * Subsequent attempts to toggle the relay off should respect the lock.
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

#ifdef __cplusplus
}
#endif

#endif // RELAY_CONTROLLER_H

