/**
 * @file esp_err_compat.h
 * @brief Minimal ESP-IDF error compatibility layer for host-side builds.
 *
 * When building inside ESP-IDF this header simply includes the real
 * `esp_err.h`. For host-side unit tests we provide lightweight typedefs
 * and constants so firmware modules depending on `esp_err_t` continue to
 * compile without the Espressif SDK.
 */

#ifndef ESP_ERR_COMPAT_H
#define ESP_ERR_COMPAT_H

#ifdef ESP_PLATFORM
#include "esp_err.h"
#else
#include <stdint.h>

typedef int32_t esp_err_t;

#ifndef ESP_OK
#define ESP_OK                       0
#endif

#ifndef ESP_FAIL
#define ESP_FAIL                     -1
#endif

#ifndef ESP_ERR_INVALID_STATE
#define ESP_ERR_INVALID_STATE        0x103
#endif

#ifndef ESP_ERR_INVALID_ARG
#define ESP_ERR_INVALID_ARG          0x102
#endif

#ifndef ESP_ERR_NO_MEM
#define ESP_ERR_NO_MEM               0x101
#endif

#ifndef ESP_ERR_INVALID_SIZE
#define ESP_ERR_INVALID_SIZE         0x10B
#endif

#ifndef ESP_ERR_INVALID_RESPONSE
#define ESP_ERR_INVALID_RESPONSE     0x108
#endif

#endif /* ESP_PLATFORM */

#endif /* ESP_ERR_COMPAT_H */

