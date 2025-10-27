#include <assert.h>
#include <stdio.h>
#include <time.h>

#include "../main/http_client_utils.h"

static void test_retry_limits(void)
{
    assert(http_client_should_retry(0) == true);
    assert(http_client_should_retry(1) == true);
    assert(http_client_should_retry(HTTP_RETRY_MAX_ATTEMPTS - 1) == false);
}

static void test_backoff_delays(void)
{
    assert(http_client_backoff_delay_ms(0) == HTTP_RETRY_BASE_DELAY_MS);
    assert(http_client_backoff_delay_ms(1) == (HTTP_RETRY_BASE_DELAY_MS * 2U));
    assert(http_client_backoff_delay_ms(2) == HTTP_RETRY_MAX_DELAY_MS);
    assert(http_client_backoff_delay_ms(3) == 0U);  // Out of range attempt
}

static void test_time_validation(void)
{
    struct tm invalid_time = {.tm_year = (HTTP_MIN_VALID_YEAR - 1) - 1900};
    struct tm valid_time = {.tm_year = (HTTP_MIN_VALID_YEAR) - 1900};

    assert(http_client_time_is_valid(NULL) == false);
    assert(http_client_time_is_valid(&invalid_time) == false);
    assert(http_client_time_is_valid(&valid_time) == true);
}

int main(void)
{
    test_retry_limits();
    test_backoff_delays();
    test_time_validation();
    printf("All http_client_utils tests passed.\n");
    return 0;
}
