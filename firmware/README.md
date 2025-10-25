# Bunkercolab Firmware

ESP-IDF (v5.x) project scaffold generated to support the ESP32 control loop.

## Requirements

- ESP-IDF 5.x installed and configured (`idf.py` available in PATH)

## Usage

```bash
idf.py set-target esp32
idf.py build
idf.py flash
```

## LED Flash Identification

- Devices use the onboard LED for deployment identification: N rapid blinks (200 ms on/off) followed by a 2 s pause.
- Configure the LED GPIO via `menuconfig` (`Component config → LED Identification Configuration`). Default is GPIO 2 on DevKitC boards.
- Ensure `led_flash_sequence` (1-10) is written to NVS during provisioning so the firmware starts flashing automatically after Wi-Fi connection.

## Secure Configuration

- `test_config.h` and automatic test-mode provisioning have been removed to eliminate hardcoded credentials.
- All runtime secrets (WiFi credentials, auth token, server URL) live in encrypted NVS and must be provisioned before the firmware attempts to connect.
- Use your preferred provisioning flow (AP-mode wizard or offline NVS image) to populate the following keys defined in `nvs_storage.h`:
  - `wifi_ssid` / `wifi_pass`
  - `server_url` (e.g. `https://206.189.210.203`)
  - `auth_token`
  - `led_flash_seq`
  - `provisioned` flag set to `1`
- For lab provisioning without the captive-portal component, create an NVS image via Espressif's `nvs_partition_gen.py` with those key/value pairs and flash it alongside the firmware. Refer to the [ESP-IDF Secure NVS documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/storage/nvs_flash.html#generating-an-nvs-partition) for the exact CSV format.
