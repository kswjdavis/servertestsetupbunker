# Deployment Guide

This guide captures the procedures and reference material needed when deploying
the Bunkercolab POC. Additional sections will be expanded as deployment tooling
stories land.

## ESP32 LED Flash Identification

Each provisioned ESP32 flashes its status LED with a unique pattern so field
operators can match hardware units to their database records.

### Flash Pattern

- `led_flash_sequence = 1` → 1 blink, 2 s pause, repeat
- `led_flash_sequence = 2` → 2 blinks, 2 s pause, repeat
- …
- `led_flash_sequence = 10` → 10 blinks, 2 s pause, repeat

Timing:

- Blink cadence: 200 ms ON, 200 ms OFF
- Pause after sequence: 2 s

### Field Deployment Steps

1. Provision the device via the web UI and note the assigned `led_flash_sequence`.
2. Confirm the provisioning response was applied to the device (auth token and LED sequence stored in NVS).
3. Power on the ESP32 and wait for Wi-Fi connection; the identification pattern starts automatically.
4. Count the LED blinks to confirm the unit matches the intended bunker record before installation.

### Troubleshooting

- **LED not flashing:** Ensure Wi-Fi credentials are correct and the device successfully connected.
- **Unexpected blink count:** Re-run provisioning to assign a new sequence or verify the NVS value via diagnostics.
- **No LED on board:** Adjust `CONFIG_LED_GPIO_PIN` in `menuconfig` to match the hardware LED wiring.

### LED Task Lifecycle During Resets & OTA

- The LED flash task runs as a background FreeRTOS task and terminates automatically when the device reboots for OTA updates or manual resets.
- After the device restarts, the task is re-created once Wi-Fi reconnects and the stored `led_flash_sequence` is loaded from NVS—operators should expect a brief pause during firmware upgrades.
- No additional actions are required post-update; the pattern resumes using the persisted sequence value.
