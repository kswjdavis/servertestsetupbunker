/**
 * @file deadman_timer.h
 * @brief Interface for the ESP32 dead-man countdown timer fail-safe component.
 *
 * Provides initialization, reset, inspection, and test-hook APIs for the
 * countdown timer that protects bunker fans when communication is lost.
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

#ifdef UNIT_TEST
/** Advance the timer by one simulated second (exposed for unit tests). */
void deadman_timer_test_tick(void);
#endif

#ifdef __cplusplus
}
#endif

#endif // DEADMAN_TIMER_H
