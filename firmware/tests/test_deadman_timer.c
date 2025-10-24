#include <assert.h>
#include <pthread.h>
#include <stddef.h>
#include <stdatomic.h>
#include <stdio.h>

#include "../main/deadman_timer.h"

/* Stub relay dependency so unit tests can observe fail-safe behaviour. */
static atomic_uint relay_force_on_call_count = ATOMIC_VAR_INIT(0U);

void relay_force_on(void)
{
    (void)atomic_fetch_add_explicit(&relay_force_on_call_count, 1U, memory_order_relaxed);
}

static void reset_test_state(void)
{
    atomic_store_explicit(&relay_force_on_call_count, 0U, memory_order_relaxed);
    deadman_timer_reset();
}

static void test_initial_state(void)
{
    reset_test_state();

    assert(deadman_timer_get_remaining() == DEADMAN_TIMER_INITIAL_VALUE);
    assert(deadman_timer_is_expired() == false);
}

static void test_countdown_decrements(void)
{
    reset_test_state();

    deadman_timer_test_tick();
    deadman_timer_test_tick();
    deadman_timer_test_tick();

    assert(deadman_timer_get_remaining() == DEADMAN_TIMER_INITIAL_VALUE - 3U);
    assert(deadman_timer_is_expired() == false);
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 0U);
}

static void test_reset_restores_initial_value(void)
{
    reset_test_state();

    for (unsigned int i = 0; i < 17; ++i) {
        deadman_timer_test_tick();
    }

    deadman_timer_reset();

    assert(deadman_timer_get_remaining() == DEADMAN_TIMER_INITIAL_VALUE);
    assert(deadman_timer_is_expired() == false);
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 0U);
}

static void test_expiration_triggers_fail_safe_once(void)
{
    reset_test_state();

    for (unsigned int i = 0; i < DEADMAN_TIMER_INITIAL_VALUE; ++i) {
        deadman_timer_test_tick();
    }

    assert(deadman_timer_get_remaining() == 0U);
    assert(deadman_timer_is_expired() == true);
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 1U);

    deadman_timer_test_tick();
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 1U);
}

static void test_reset_allows_subsequent_expiration(void)
{
    reset_test_state();

    for (unsigned int i = 0; i < DEADMAN_TIMER_INITIAL_VALUE; ++i) {
        deadman_timer_test_tick();
    }

    assert(deadman_timer_is_expired() == true);
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 1U);

    deadman_timer_reset();
    atomic_store_explicit(&relay_force_on_call_count, 0U, memory_order_relaxed);

    for (unsigned int i = 0; i < DEADMAN_TIMER_INITIAL_VALUE; ++i) {
        deadman_timer_test_tick();
    }

    assert(deadman_timer_is_expired() == true);
    assert(deadman_timer_get_remaining() == 0U);
    assert(atomic_load_explicit(&relay_force_on_call_count, memory_order_relaxed) == 1U);
}

static void *ticker_thread(void *arg)
{
    (void)arg;
    for (unsigned int i = 0; i < 5000U; ++i) {
        deadman_timer_test_tick();
        if (deadman_timer_get_remaining() == 0U) {
            deadman_timer_reset();
        }
    }
    return NULL;
}

static void *reader_thread(void *arg)
{
    (void)arg;
    for (unsigned int i = 0; i < 5000U; ++i) {
        bool expired = deadman_timer_is_expired();
        uint32_t remaining = deadman_timer_get_remaining();
        assert(remaining <= DEADMAN_TIMER_INITIAL_VALUE);
        if (expired) {
            uint32_t confirm = deadman_timer_get_remaining();
            assert(confirm == 0U || confirm == DEADMAN_TIMER_INITIAL_VALUE);
        }
    }
    return NULL;
}

static void *reset_thread(void *arg)
{
    (void)arg;
    for (unsigned int i = 0; i < 500U; ++i) {
        deadman_timer_reset();
    }
    return NULL;
}

static void test_concurrent_access(void)
{
    reset_test_state();

    pthread_t threads[3];
    assert(pthread_create(&threads[0], NULL, ticker_thread, NULL) == 0);
    assert(pthread_create(&threads[1], NULL, reader_thread, NULL) == 0);
    assert(pthread_create(&threads[2], NULL, reset_thread, NULL) == 0);

    for (size_t i = 0; i < 3; ++i) {
        assert(pthread_join(threads[i], NULL) == 0);
    }

    bool expired = deadman_timer_is_expired();
    uint32_t remaining = deadman_timer_get_remaining();
    assert(remaining <= DEADMAN_TIMER_INITIAL_VALUE);
    if (expired) {
        uint32_t confirm = deadman_timer_get_remaining();
        assert(confirm == 0U || confirm == DEADMAN_TIMER_INITIAL_VALUE);
    }
}

int main(void)
{
    deadman_timer_init();

    test_initial_state();
    test_countdown_decrements();
    test_reset_restores_initial_value();
    test_expiration_triggers_fail_safe_once();
    test_reset_allows_subsequent_expiration();
    test_concurrent_access();

    printf("All deadman_timer tests passed.\n");
    return 0;
}
