# ESP-IDF Version Information

## Recommended Version
**ESP-IDF v5.5.1 (stable)** - Released 2025
- Stable release with long-term support
- Full documentation available
- Compatible with ESP32-DevKitC-VIE

## Official Documentation Base URL
```
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/
```

## GitHub Repository
```
https://github.com/espressif/esp-idf
```

## Version-Specific Considerations

ESP-IDF 5.0 introduced major breaking changes from 4.x:
- CMake minimum version increased to 3.16
- Component dependencies must be explicitly declared
- 64-bit `time_t` prevents Y2K38 overflow (valid until 2104)
- Python 3.6 support removed
- mbedTLS is now the official TLS stack (OpenSSL deprecated)
- Component REQUIRES must specify PRIVATE/PUBLIC/INTERFACE

**Migration Guide:**
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/index.html

---
