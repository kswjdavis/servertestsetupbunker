# 3. cJSON (JSON Parsing)

## Official Documentation
- **GitHub README:** https://github.com/espressif/esp-idf/blob/master/components/json/README
- **Component Path:** `components/json/`
- **Header File:** `cJSON/cJSON.h`

## Purpose
Lightweight JSON parser and generator for handling API request/response payloads.

## Key Features
- Parse JSON strings to C structures
- Generate JSON strings from C structures
- Support for objects, arrays, strings, numbers, booleans, null
- Single-file implementation
- Minimal memory footprint

## Core API Functions

### Parsing
```c
cJSON *cJSON_Parse(const char *value);
void cJSON_Delete(cJSON *item);
```

### Object Access
```c
cJSON *cJSON_GetObjectItem(const cJSON *object, const char *string);
char *cJSON_GetStringValue(const cJSON *item);
double cJSON_GetNumberValue(const cJSON *item);
```

### Type Checking
```c
cJSON_bool cJSON_IsObject(const cJSON *item);
cJSON_bool cJSON_IsString(const cJSON *item);
cJSON_bool cJSON_IsNumber(const cJSON *item);
cJSON_bool cJSON_IsBool(const cJSON *item);
```

### Creating JSON
```c
cJSON *cJSON_CreateObject(void);
cJSON *cJSON_CreateArray(void);
cJSON *cJSON_CreateString(const char *string);
cJSON *cJSON_CreateNumber(double num);
cJSON *cJSON_CreateBool(cJSON_bool boolean);

void cJSON_AddItemToObject(cJSON *object, const char *string, cJSON *item);
void cJSON_AddItemToArray(cJSON *array, cJSON *item);
```

### Serialization
```c
char *cJSON_Print(const cJSON *item);          // Formatted output
char *cJSON_PrintUnformatted(const cJSON *item); // Compact output
void cJSON_free(void *object);                 // Free printed string
```

## Example: Parsing API Response

```c
#include "cJSON.h"

void parse_api_response(const char *json_string) {
    cJSON *root = cJSON_Parse(json_string);

    if (root == NULL) {
        const char *error_ptr = cJSON_GetErrorPtr();
        ESP_LOGE(TAG, "JSON parse error before: %s", error_ptr);
        return;
    }

    // Extract values
    cJSON *command = cJSON_GetObjectItem(root, "command");
    if (cJSON_IsString(command)) {
        ESP_LOGI(TAG, "Command: %s", cJSON_GetStringValue(command));
    }

    cJSON *timeout = cJSON_GetObjectItem(root, "timeout");
    if (cJSON_IsNumber(timeout)) {
        int timeout_sec = (int)cJSON_GetNumberValue(timeout);
        ESP_LOGI(TAG, "Timeout: %d seconds", timeout_sec);
    }

    cJSON *enabled = cJSON_GetObjectItem(root, "shutdown_allowed");
    if (cJSON_IsBool(enabled)) {
        bool is_enabled = cJSON_IsTrue(enabled);
        ESP_LOGI(TAG, "Shutdown allowed: %s", is_enabled ? "true" : "false");
    }

    cJSON_Delete(root);  // CRITICAL: Free memory
}
```

## Example: Creating API Request

```c
char* create_status_request(int uptime, const char *state, int rssi) {
    cJSON *root = cJSON_CreateObject();

    cJSON_AddStringToObject(root, "device_id", "esp32-001");
    cJSON_AddNumberToObject(root, "uptime", uptime);
    cJSON_AddStringToObject(root, "state", state);
    cJSON_AddNumberToObject(root, "rssi", rssi);

    // Nested object
    cJSON *location = cJSON_CreateObject();
    cJSON_AddStringToObject(location, "bunker_id", "bunker-1");
    cJSON_AddNumberToObject(location, "fan_position", 1);
    cJSON_AddItemToObject(root, "location", location);

    // Convert to string (caller must free)
    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    return json_string;  // Remember to cJSON_free(json_string) after use
}
```

## Memory Management Best Practices

1. **Always delete parsed JSON** - Call `cJSON_Delete(root)` after parsing
2. **Free printed strings** - Use `cJSON_free()` not stdlib `free()`
3. **Check for NULL** - Parsing can fail on malformed JSON
4. **Limit buffer sizes** - Allocate sufficient space for JSON strings

## Error Handling

```c
cJSON *root = cJSON_Parse(json_string);
if (root == NULL) {
    const char *error_ptr = cJSON_GetErrorPtr();
    if (error_ptr != NULL) {
        ESP_LOGE(TAG, "Error before: %s", error_ptr);
    }
    return;
}
```

## Configuration Requirements
No special menuconfig required - included by default in ESP-IDF.

---
