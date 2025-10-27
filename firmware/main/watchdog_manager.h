#ifndef WATCHDOG_MANAGER_H
#define WATCHDOG_MANAGER_H

#include <stdbool.h>
#include <stdint.h>

#include "esp_err_compat.h"

#define WATCHDOG_TIMEOUT_SECONDS 60
#define WATCHDOG_FEED_INTERVAL_MS 30000

void watchdog_manager_init(void);
esp_err_t watchdog_manager_subscribe_current_task(const char *task_name);
esp_err_t watchdog_manager_feed(void);
uint32_t watchdog_manager_get_reset_count(void);
bool watchdog_manager_last_boot_was_watchdog(void);
const char* watchdog_manager_get_reset_reason_string(void);

#endif /* WATCHDOG_MANAGER_H */
