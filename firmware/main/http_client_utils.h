/**
 * @file http_client_utils.h
 * @brief Helper utilities for HTTPS client retry and time validation logic.
 *
 * These helpers are intentionally free of ESP-IDF dependencies so they can be
 * unit-tested on the host toolchain.
 */

#ifndef HTTP_CLIENT_UTILS_H
#define HTTP_CLIENT_UTILS_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Minimum year (UTC) considered valid for TLS certificate validation. */
#define HTTP_MIN_VALID_YEAR          2020

/** Maximum number of retry attempts for HTTP operations. */
#define HTTP_RETRY_MAX_ATTEMPTS      3U

/** Base delay in milliseconds for the first retry attempt. */
#define HTTP_RETRY_BASE_DELAY_MS     1000U

/** Maximum delay in milliseconds between retry attempts (after backoff). */
#define HTTP_RETRY_MAX_DELAY_MS      4000U

/**
 * @brief Determine whether another retry should be attempted.
 *
 * @param attempt Current attempt index (0-based).
 * @return true if another retry should be performed, false otherwise.
 */
bool http_client_should_retry(size_t attempt);

/**
 * @brief Compute the backoff delay for the given attempt.
 *
 * Uses exponential backoff capped at HTTP_RETRY_MAX_DELAY_MS.
 *
 * @param attempt Current attempt index (0-based).
 * @return Delay in milliseconds before the next retry.
 */
uint32_t http_client_backoff_delay_ms(size_t attempt);

/**
 * @brief Validate SNTP synchronized time for TLS operations.
 *
 * @param timeinfo Pointer to populated struct tm.
 * @return true if the time is considered valid, false otherwise.
 */
bool http_client_time_is_valid(const struct tm *timeinfo);

#ifdef __cplusplus
}
#endif

#endif /* HTTP_CLIENT_UTILS_H */
