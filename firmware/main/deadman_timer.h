/**
 * @file deadman_timer.h
 * @brief Stub interface for the dead-man countdown timer component.
 *
 * Story 1.8 reads the remaining countdown value when reporting status
 * to the server. A full implementation arrives in Story 2.1; this stub
 * exposes the API surface so callers can be wired up now.
 */

#ifndef DEADMAN_TIMER_H
#define DEADMAN_TIMER_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Default countdown value in seconds (5 minutes). */
#define DEADMAN_TIMER_INITIAL_VALUE 300U

/** Initialize the dead-man timer component. */
void deadman_timer_init(void);

/** Reset the countdown timer back to its initial value. */
void deadman_timer_reset(void);

/** Retrieve the remaining countdown value in seconds. */
uint32_t deadman_timer_get_remaining(void);

/** Determine whether the countdown has expired. */
bool deadman_timer_is_expired(void);

#ifdef __cplusplus
}
#endif

#endif // DEADMAN_TIMER_H
