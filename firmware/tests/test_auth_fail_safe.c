#include <assert.h>
#include <stdbool.h>
#include <string.h>

#include "auth_fail_safe.h"

static unsigned int g_relay_force_on_count = 0;
static unsigned int g_token_clear_count = 0;

void relay_force_on(void)
{
    ++g_relay_force_on_count;
}

void http_client_clear_auth_token(void)
{
    ++g_token_clear_count;
}

static void reset_state(void)
{
    g_relay_force_on_count = 0;
    g_token_clear_count = 0;
    auth_fail_safe_reset_for_test();
}

static void test_initial_state(void)
{
    reset_state();
    assert(auth_fail_safe_is_active() == false);
    assert(auth_fail_safe_get_activation_count() == 0U);
}

static void test_single_trigger_latches_fail_safe(void)
{
    reset_state();

    bool latched = auth_fail_safe_trigger("Missing token", 401, "{\"detail\":\"unauthorized\"}");
    assert(latched == true);
    assert(auth_fail_safe_is_active() == true);
    assert(auth_fail_safe_get_activation_count() == 1U);
    assert(g_relay_force_on_count == 1U);
    assert(g_token_clear_count == 1U);
}

static void test_duplicate_trigger_is_ignored(void)
{
    reset_state();
    assert(auth_fail_safe_trigger(NULL, 0, NULL) == true);
    assert(auth_fail_safe_trigger(NULL, 0, NULL) == false);
    assert(auth_fail_safe_get_activation_count() == 1U);
    assert(g_relay_force_on_count == 1U);
}

int main(void)
{
    test_initial_state();
    test_single_trigger_latches_fail_safe();
    test_duplicate_trigger_is_ignored();
    return 0;
}
