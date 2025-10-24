/**
 * @file http_client_utils.c
 * @brief Helper utilities for the HTTPS client retry and time validation logic.
 */

#include "http_client_utils.h"

bool http_client_should_retry(size_t attempt)
{
    return (attempt + 1U) < HTTP_RETRY_MAX_ATTEMPTS;
}

uint32_t http_client_backoff_delay_ms(size_t attempt)
{
    if (attempt >= HTTP_RETRY_MAX_ATTEMPTS) {
        return 0U;
    }

    uint32_t delay = HTTP_RETRY_BASE_DELAY_MS;
    for (size_t i = 0; i < attempt; ++i) {
        if (delay >= HTTP_RETRY_MAX_DELAY_MS) {
            delay = HTTP_RETRY_MAX_DELAY_MS;
            break;
        }
        delay *= 2U;
        if (delay > HTTP_RETRY_MAX_DELAY_MS) {
            delay = HTTP_RETRY_MAX_DELAY_MS;
        }
    }

    if (delay > HTTP_RETRY_MAX_DELAY_MS) {
        delay = HTTP_RETRY_MAX_DELAY_MS;
    }

    return delay;
}

bool http_client_time_is_valid(const struct tm *timeinfo)
{
    if (timeinfo == NULL) {
        return false;
    }

    const int min_year = HTTP_MIN_VALID_YEAR - 1900;
    return timeinfo->tm_year >= min_year;
}
