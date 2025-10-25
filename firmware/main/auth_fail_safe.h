/**
 * @file auth_fail_safe.h
 * @brief Helpers for latching fail-safe mode on authentication failures.
 *
 * This module isolates the state machine that ensures the relay is forced ON
 * and the authentication token is cleared whenever the device encounters
 * authentication errors. It exposes simple helpers for production code and
 * unit tests to observe or reset the fail-safe latch.
 */

#ifndef AUTH_FAIL_SAFE_H
#define AUTH_FAIL_SAFE_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Trigger the authentication fail-safe latch.
 *
 * @param reason        Optional human-readable reason string (may be NULL).
 * @param status_code   HTTP status code returned by the server (<= 0 if unavailable).
 * @param response_body Optional server response body (may be NULL).
 *
 * @return true when the latch transitioned from inactive to active, false if it
 *         was already engaged.
 */
bool auth_fail_safe_trigger(const char *reason, int status_code, const char *response_body);

/** @brief Check whether the authentication fail-safe latch is active. */
bool auth_fail_safe_is_active(void);

#if defined(UNIT_TEST)
/** @brief Reset internal state for host-based unit tests. */
void auth_fail_safe_reset_for_test(void);

/** @brief Retrieve the number of times the latch has been activated (tests only). */
unsigned int auth_fail_safe_get_activation_count(void);
#endif

#ifdef __cplusplus
}
#endif

#endif /* AUTH_FAIL_SAFE_H */
