# 4. NVS (Non-Volatile Storage)

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_flash.html
- **Header File:** `nvs_flash/include/nvs_flash.h`, `nvs.h`

## Purpose
Store key-value pairs in flash memory for persistent data (WiFi credentials, authentication tokens, device configuration).

## Key Features
- Key-value pair storage in flash
- Wear leveling by design
- Namespace support for organization
- Type-safe APIs (string, integer, blob)
- Encryption support (tied to flash encryption)
- Atomic operations with commit

## Core API Functions

### Initialization
```c
esp_err_t nvs_flash_init(void);
esp_err_t nvs_flash_erase(void);
```

### Handle Management
```c
esp_err_t nvs_open(const char *namespace, nvs_open_mode_t open_mode, nvs_handle_t *out_handle);
void nvs_close(nvs_handle_t handle);
esp_err_t nvs_commit(nvs_handle_t handle);
```

### String Operations
```c
esp_err_t nvs_set_str(nvs_handle_t handle, const char *key, const char *value);
esp_err_t nvs_get_str(nvs_handle_t handle, const char *key, char *out_value, size_t *length);
```

### Integer Operations
```c
esp_err_t nvs_set_i32(nvs_handle_t handle, const char *key, int32_t value);
esp_err_t nvs_get_i32(nvs_handle_t handle, const char *key, int32_t *out_value);
esp_err_t nvs_set_u32(nvs_handle_t handle, const char *key, uint32_t value);
esp_err_t nvs_get_u32(nvs_handle_t handle, const char *key, uint32_t *out_value);
```

### Blob Operations
```c
esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *value, size_t length);
esp_err_t nvs_get_blob(nvs_handle_t handle, const char *key, void *out_value, size_t *length);
```

### Key Management
```c
esp_err_t nvs_erase_key(nvs_handle_t handle, const char *key);
esp_err_t nvs_erase_all(nvs_handle_t handle);
```

## String Storage Limits
- Maximum string length: **4000 bytes** (including null terminator)
- Strings must be null-terminated
- Storage requires contiguous space in same NVS page

## Example: Store WiFi Credentials

```c
#include "nvs_flash.h"
#include "nvs.h"

esp_err_t save_wifi_credentials(const char *ssid, const char *password) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    // Open NVS namespace
    err = nvs_open("wifi_config", NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error opening NVS: %s", esp_err_to_name(err));
        return err;
    }

    // Write SSID
    err = nvs_set_str(nvs_handle, "ssid", ssid);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write SSID: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Write password
    err = nvs_set_str(nvs_handle, "password", password);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write password: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Commit changes to flash
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit: %s", esp_err_to_name(err));
    }

    nvs_close(nvs_handle);
    return err;
}
```

## Example: Retrieve WiFi Credentials

```c
esp_err_t load_wifi_credentials(char *ssid, size_t ssid_len,
                                 char *password, size_t pass_len) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("wifi_config", NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    // Read SSID
    size_t required_size = ssid_len;
    err = nvs_get_str(nvs_handle, "ssid", ssid, &required_size);
    if (err != ESP_OK) {
        nvs_close(nvs_handle);
        return err;
    }

    // Read password
    required_size = pass_len;
    err = nvs_get_str(nvs_handle, "password", password, &required_size);

    nvs_close(nvs_handle);
    return err;
}
```

## Example: Store Authentication Token

```c
esp_err_t save_auth_token(const char *token) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("device_config", NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) return err;

    err = nvs_set_str(nvs_handle, "auth_token", token);
    if (err == ESP_OK) {
        err = nvs_commit(nvs_handle);
    }

    nvs_close(nvs_handle);
    return err;
}

esp_err_t load_auth_token(char *token, size_t token_len) {
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open("device_config", NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) return err;

    size_t required_size = token_len;
    err = nvs_get_str(nvs_handle, "auth_token", token, &required_size);

    nvs_close(nvs_handle);
    return err;
}
```

## Error Codes
- `ESP_OK` - Success
- `ESP_ERR_NVS_NOT_FOUND` - Key doesn't exist
- `ESP_ERR_NVS_NOT_ENOUGH_SPACE` - Insufficient storage
- `ESP_ERR_NVS_INVALID_LENGTH` - Buffer too small
- `ESP_ERR_NVS_VALUE_TOO_LONG` - String exceeds 4000 bytes
- `ESP_ERR_NVS_READ_ONLY` - Attempt to write to read-only handle

## RAM Usage Estimation
- Each 1 MB of NVS partition: **22 KB RAM**
- Each 1000 keys: **5.5 KB RAM**

## Best Practices

1. **Use namespaces** - Organize credentials by component ("wifi_config", "device_config")
2. **Always commit** - Changes aren't persisted until `nvs_commit()`
3. **Close handles** - Free resources with `nvs_close()`
4. **Handle errors** - Check for `ESP_ERR_NVS_NOT_FOUND` on first boot
5. **Query size first** - Call with NULL buffer to get required length
6. **Enable encryption** - Use NVS encryption for sensitive credentials
7. **Avoid large blobs** - Use FAT filesystem for data >4KB

## Initialization in app_main()

```c
void app_main(void) {
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Continue with application...
}
```

---
