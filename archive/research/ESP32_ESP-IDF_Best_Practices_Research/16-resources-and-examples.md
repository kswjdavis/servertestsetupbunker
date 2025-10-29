# 16. Resources and Examples

## Official Espressif Resources

### ESP-IDF Documentation
- **Programming Guide:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/index.html
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/index.html
- **Build System:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html

### GitHub Repositories
- **ESP-IDF Main Repository:** https://github.com/espressif/esp-idf
- **ESP-IDF Examples:** https://github.com/espressif/esp-idf/tree/master/examples
- **ESP IoT Solution:** https://github.com/espressif/esp-iot-solution

### Component Registry
- **Official Components:** https://components.espressif.com/
- **Component Documentation:** https://docs.espressif.com/projects/esp-iot-solution/

## Example Projects

### Official ESP-IDF Examples (Most Relevant)

**WiFi Examples:**
```
esp-idf/examples/wifi/
├── getting_started/station/        # Basic WiFi connection
├── getting_started/softAP/         # Access Point mode
├── wifi_provisioning/              # WiFi provisioning
└── power_save/                     # WiFi power management
```

**Network Protocol Examples:**
```
esp-idf/examples/protocols/
├── esp_http_client/                # HTTP/HTTPS client
├── https_request/                  # Simple HTTPS GET
├── https_mbedtls/                  # TLS with custom certs
└── https_server/                   # HTTPS server
```

**System Examples:**
```
esp-idf/examples/system/
├── ota/                           # OTA update examples
├── deep_sleep/                    # Sleep mode examples
├── task_watchdog/                 # Watchdog timer
└── freertos/                      # FreeRTOS patterns
```

**Storage Examples:**
```
esp-idf/examples/storage/
├── nvs_rw_value/                  # NVS read/write
└── nvs_rw_blob/                   # NVS blob storage
```

**Security Examples:**
```
esp-idf/examples/security/
├── flash_encryption/              # Flash encryption
└── secure_boot/                   # Secure boot
```

### Third-Party Projects

**WiFi Provisioning:**
- **ESP32 WiFi Manager:** https://github.com/Hraph/ESP32WiFiManager
- **WiFi Provisioner:** https://github.com/SanteriLindfors/WiFiProvisioner

**Industrial IoT:**
- **ESP-IDF NAT Example:** https://github.com/jonask1337/esp-idf-nat-example

## Learning Resources

### Official Tutorials
- **ESP32 Tutorial Series:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/
- **ESP-IDF Examples README:** https://github.com/espressif/esp-idf/blob/master/examples/README.md

### Community Resources
- **Random Nerd Tutorials:** https://randomnerdtutorials.com/projects-esp32/
- **ESP32 Forum:** https://esp32.com/
- **ESP32 Subreddit:** https://reddit.com/r/esp32

### Books and Courses
- **FreeRTOS Course for ESP32:** https://github.com/god233012yamil/30-Day-FreeRTOS-Course-for-ESP32-Using-ESP-IDF

## Tools

### Development Tools
- **ESP-IDF Visual Studio Code Extension:** https://marketplace.visualstudio.com/items?itemName=espressif.esp-idf-extension
- **ESP-IDF Eclipse Plugin:** https://github.com/espressif/idf-eclipse-plugin
- **PlatformIO for ESP32:** https://docs.platformio.org/en/latest/platforms/espressif32.html

### Security Tools
- **espsecure.py:** Included with ESP-IDF for secure boot and flash encryption
- **espefuse.py:** eFuse programming and reading

### Debugging Tools
- **ESP-IDF Monitor:** Built-in serial monitor with automatic decoding
- **OpenOCD for ESP32:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/jtag-debugging/

## Hardware Resources

### ESP32 DevKitC Documentation
- **ESP32-DevKitC-VIE:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/hw-reference/esp32/get-started-devkitc.html
- **ESP32 Datasheet:** https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
- **ESP32 Technical Reference:** https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf

### Pinout References
- **ESP32 Pinout:** https://randomnerdtutorials.com/esp32-pinout-reference-gpios/
- **ESP32 DevKit Pinout:** https://components101.com/microcontrollers/esp32-devkitc

## Relevant Example Code for Grain Bunker Project

### 1. WiFi Connection with Auto-Reconnect
```
esp-idf/examples/wifi/getting_started/station/
```

### 2. HTTPS REST API Client
```
esp-idf/examples/protocols/esp_http_client/
```

### 3. WiFi Provisioning
```
esp-idf/examples/provisioning/wifi_prov_mgr/
```

### 4. NVS Storage
```
esp-idf/examples/storage/nvs_rw_value/
```

### 5. OTA Updates
```
esp-idf/examples/system/ota/simple_ota_example/
esp-idf/examples/system/ota/advanced_https_ota/
```

### 6. Watchdog Timer
```
esp-idf/examples/system/task_watchdog/
```

### 7. FreeRTOS Tasks
```
esp-idf/examples/system/freertos/basic_freertos_smp_usage/
```

## Testing and CI/CD

### Testing Frameworks
- **Unity Test Framework:** Included in ESP-IDF
- **pytest-embedded:** https://docs.espressif.com/projects/pytest-embedded/en/latest/
- **CMock:** https://github.com/ThrowTheSwitch/CMock

### CI/CD Examples
- **ESP-IDF CI Action:** https://github.com/espressif/esp-idf-ci-action

## Community Support

### Official Channels
- **ESP32 Forum:** https://esp32.com/
- **GitHub Issues:** https://github.com/espressif/esp-idf/issues
- **Discord:** https://discord.gg/espressif

### Stack Overflow
- **ESP32 Tag:** https://stackoverflow.com/questions/tagged/esp32
- **ESP-IDF Tag:** https://stackoverflow.com/questions/tagged/esp-idf

## Recommended Component Libraries

```yaml