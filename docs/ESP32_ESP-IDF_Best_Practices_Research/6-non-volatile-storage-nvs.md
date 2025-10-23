# 6. Non-Volatile Storage (NVS)

## NVS Overview

NVS (Non-Volatile Storage) provides persistent key-value storage in flash memory:
- Survives power cycles and reboots
- Wear leveling built-in
- Support for multiple data types
- Optional encryption

## Basic NVS Operations

```c
#include "nvs_flash.h"
#include "nvs.h"

// Initialize NVS (call once at startup)
esp_err_t ret = nvs_flash_init();
if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
}
ESP_ERROR_CHECK(ret);

// Open NVS namespace
nvs_handle_t nvs_handle;
ret = nvs_open("storage", NVS_READWRITE, &nvs_handle);
if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Error opening NVS handle");
    return;
}

// Write values
int32_t fan_count = 8;
nvs_set_i32(nvs_handle, "fan_count", fan_count);

char bunker_id[32] = "BUNKER_001_A";
nvs_set_str(nvs_handle, "bunker_id", bunker_id);

// Commit changes (required!)
nvs_commit(nvs_handle);

// Read values
int32_t stored_fan_count;
ret = nvs_get_i32(nvs_handle, "fan_count", &stored_fan_count);
if (ret == ESP_OK) {
    ESP_LOGI(TAG, "Fan count: %d", stored_fan_count);
} else if (ret == ESP_ERR_NVS_NOT_FOUND) {
    ESP_LOGI(TAG, "Value not found, using default");
}

// Close handle
nvs_close(nvs_handle);
```

## Supported Data Types

- `nvs_set_i8()`, `nvs_get_i8()` - int8_t
- `nvs_set_u8()`, `nvs_get_u8()` - uint8_t
- `nvs_set_i16()`, `nvs_get_i16()` - int16_t
- `nvs_set_u16()`, `nvs_get_u16()` - uint16_t
- `nvs_set_i32()`, `nvs_get_i32()` - int32_t
- `nvs_set_u32()`, `nvs_get_u32()` - uint32_t
- `nvs_set_i64()`, `nvs_get_i64()` - int64_t
- `nvs_set_u64()`, `nvs_get_u64()` - uint64_t
- `nvs_set_str()`, `nvs_get_str()` - null-terminated string
- `nvs_set_blob()`, `nvs_get_blob()` - binary data

## NVS Encryption for Secure Credential Storage

**Critical for Production:** WiFi credentials and API keys MUST be encrypted in NVS.

### Encryption Scheme 1: Flash Encryption-Based (ESP32)

Requires Flash Encryption to be enabled:

```
Security features → Enable flash encryption on boot
```

**Partition Table (partitions_encrypted.csv):**
```csv