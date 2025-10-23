# Migration Considerations

## ESP-IDF 5.0 Breaking Changes

If migrating from ESP-IDF 4.x to 5.x:

1. **CMake minimum version**
   - Requires CMake 3.16+
   - Update build environment

2. **Component dependencies**
   - Must explicitly declare all dependencies
   - Use REQUIRES/PRIV_REQUIRES in CMakeLists.txt

3. **mbedTLS is default**
   - OpenSSL support deprecated
   - Update to esp-tls or mbedTLS APIs

4. **Time handling**
   - 64-bit time_t (no Y2K38 issue)
   - Update time-related code if needed

5. **Build system**
   - Component registration changes
   - Update CMakeLists.txt syntax

## Official Migration Guide
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-5.x/5.0/index.html

---
