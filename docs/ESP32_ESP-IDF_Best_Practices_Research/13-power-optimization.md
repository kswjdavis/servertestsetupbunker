# 13. Power Optimization

## ESP32 Power Consumption Overview

**Active Modes:**
- WiFi TX (802.11n): ~120-160 mA
- WiFi RX: ~80-95 mA
- CPU active (160 MHz): ~40-50 mA
- CPU active (80 MHz): ~25-30 mA

**Sleep Modes:**
- Modem sleep (WiFi off): ~20-30 mA
- Light sleep: ~0.8 mA
- Deep sleep: ~10-150 µA
- Hibernation: ~2.5 µA

## Sleep Modes for Grain Bunker Application

**Consideration:** Fan control requires continuous operation and network connectivity, so **deep sleep is NOT appropriate**. However, **modem sleep** and **light sleep** can reduce power consumption.

## Modem Sleep (WiFi Power Save)

Automatically enabled when WiFi is connected:

```c
#include "esp_wifi.h"

void enable_wifi_power_save(void) {
    // Modem sleep: WiFi radio turns off between DTIM beacons
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_MIN_MODEM));

    // For more aggressive power saving (higher latency)
    // ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_MAX_MODEM));
}
```

**Trade-offs:**
- Power savings: ~60-80 mA reduction
- Latency increase: 100-300 ms for network responses
- Suitable for periodic API communication

## Light Sleep for Idle Periods

```c
#include "esp_sleep.h"
#include "esp_pm.h"

void enable_automatic_light_sleep(void) {
    // Enable automatic light sleep when idle
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 160,
        .min_freq_mhz = 80,
        .light_sleep_enable = true
    };
    ESP_ERROR_CHECK(esp_pm_configure(&pm_config));
}
```

**Automatic Light Sleep Conditions:**
- All FreeRTOS tasks are blocked
- No locks (WiFi, etc.) are held
- Wakes on interrupts or timers

## CPU Frequency Scaling

```c
void reduce_cpu_frequency(void) {
    // Lower CPU frequency when full performance not needed
    esp_pm_config_esp32_t pm_config = {
        .max_freq_mhz = 80,   // Max 80 MHz (vs 160/240)
        .min_freq_mhz = 40,   // Min 40 MHz
        .light_sleep_enable = false
    };
    ESP_ERROR_CHECK(esp_pm_configure(&pm_config));
}
```

**Power Savings:**
- 160 MHz → 80 MHz: ~30-40% reduction
- Suitable if processing requirements are low

## GPIO Power Optimization

```c
void disable_unused_peripherals(void) {
    // Disable unused GPIO pull-ups/pull-downs
    for (int i = 0; i < GPIO_NUM_MAX; i++) {
        if (!gpio_is_used(i)) {
            gpio_set_pull_mode(i, GPIO_FLOATING);
        }
    }

    // Disable unused peripheral clocks
    // (automatically handled by ESP-IDF when not in use)
}
```

## Network Optimization

```c
void optimize_network_power(void) {
    // Reduce WiFi transmit power if close to AP
    esp_wifi_set_max_tx_power(40);  // Default: 80 (20 dBm)

    // Increase DTIM period for modem sleep efficiency
    // (requires AP configuration)

    // Use connection keep-alive to reduce reconnections
    esp_wifi_set_inactive_time(WIFI_IF_STA, 300);  // 300 seconds
}
```

## Task Scheduling Optimization

```c
void power_aware_task_design(void) {
    // BAD: Busy-wait loop
    while (1) {
        if (check_condition()) {
            do_work();
        }
    }

    // GOOD: Block on event/queue
    while (1) {
        EventBits_t bits = xEventGroupWaitBits(
            event_group,
            WORK_READY_BIT,
            pdTRUE,
            pdTRUE,
            portMAX_DELAY  // Block indefinitely, allows light sleep
        );

        if (bits & WORK_READY_BIT) {
            do_work();
        }
    }
}
```

## Relay Control Power Considerations

```c
// Use latching relays for power efficiency (hardware change)
// Standard relays: ~70-100 mA continuous coil current
// Latching relays: ~100-200 mA pulse, then 0 mA

void set_latching_relay(uint8_t relay_id, bool state) {
    // Pulse set/reset coil
    gpio_set_level(relay_set_gpio[relay_id], state ? 1 : 0);
    gpio_set_level(relay_reset_gpio[relay_id], state ? 0 : 1);

    vTaskDelay(pdMS_TO_TICKS(50));  // 50ms pulse

    // Disable both coils
    gpio_set_level(relay_set_gpio[relay_id], 0);
    gpio_set_level(relay_reset_gpio[relay_id], 0);
}
```

## Measurement and Monitoring

```c
void monitor_power_consumption(void) {
    // Estimate power consumption
    uint32_t free_heap = esp_get_free_heap_size();
    uint32_t min_free_heap = esp_get_minimum_free_heap_size();

    ESP_LOGI(TAG, "Heap: free=%d, min_free=%d", free_heap, min_free_heap);

    // Check WiFi power save status
    wifi_ps_type_t ps_type;
    esp_wifi_get_ps(&ps_type);
    ESP_LOGI(TAG, "WiFi PS mode: %d", ps_type);

    // Get current frequency
    rtc_cpu_freq_config_t freq_config;
    rtc_clk_cpu_freq_get_config(&freq_config);
    ESP_LOGI(TAG, "CPU freq: %d MHz", freq_config.freq_mhz);
}
```

## Best Practices for Grain Bunker Controller

1. **Enable WiFi modem sleep** - Suitable for periodic API communication
2. **Use appropriate CPU frequency** - 80 MHz likely sufficient
3. **Efficient task blocking** - Use queues/semaphores, not busy-wait
4. **Minimize WiFi reconnections** - Implement robust connection management
5. **Consider latching relays** - Zero holding current
6. **Power supply sizing** - Account for peak current (WiFi TX + relays)
7. **External power indicators** - Use hardware LED, not GPIO polling
8. **Batch API communications** - Reduce WiFi active time
9. **Monitor heap usage** - Leaks increase power consumption
10. **Test real-world power** - Measure with multimeter, not estimates

## Power Supply Recommendations

- **Minimum:** 5V @ 1.5A (WiFi TX + 4 standard relays)
- **Recommended:** 5V @ 2A with margin
- **Separate relay power** - Isolate JD-VCC for noise immunity
- **Bypass capacitors** - 100µF near ESP32, 10µF near relays
- **Voltage regulator** - LDO or buck for 3.3V with low dropout

## Official Documentation
- Power Management: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/power_management.html
- Sleep Modes: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/sleep_modes.html

---
