# 3. HTTPS/TLS REST API Communication

## ESP HTTP Client (Official)

ESP-IDF provides `esp_http_client` with full HTTPS/TLS support using mbedTLS.

## Basic HTTPS Configuration

```c
#include "esp_http_client.h"
#include "esp_crt_bundle.h"

esp_http_client_config_t config = {
    .url = "https://api.example.com/v1/bunker/status",
    .transport_type = HTTP_TRANSPORT_OVER_SSL,
    .crt_bundle_attach = esp_crt_bundle_attach,  // Use certificate bundle
    .timeout_ms = 5000,
    .buffer_size = 1024,
    .buffer_size_tx = 1024,
};

esp_http_client_handle_t client = esp_http_client_init(&config);
```

## Certificate Verification Strategies

### Strategy 1: ESP Certificate Bundle (RECOMMENDED)

The ESP x509 Certificate Bundle includes common root CA certificates:
- Automatically maintained by Espressif
- Minimal flash footprint
- Handles most public APIs

**Enable in menuconfig:**
```
Component config → ESP-TLS → Allow different endpoint's CA to be selected
```

### Strategy 2: Custom CA Certificate

For private APIs or specific validation:

```c
extern const char server_cert_pem_start[] asm("_binary_server_cert_pem_start");

esp_http_client_config_t config = {
    .url = "https://api.private.com/bunker",
    .cert_pem = server_cert_pem_start,
    .transport_type = HTTP_TRANSPORT_OVER_SSL,
};
```

## REST API Patterns

**GET Request:**
```c
esp_err_t err;
err = esp_http_client_perform(client);
if (err == ESP_OK) {
    int status = esp_http_client_get_status_code(client);
    int content_length = esp_http_client_get_content_length(client);
    ESP_LOGI(TAG, "Status=%d, Length=%d", status, content_length);
}
```

**POST Request with JSON:**
```c
const char *post_data = "{\"fan_id\":\"BUNKER_001\",\"status\":\"running\"}";

esp_http_client_set_method(client, HTTP_METHOD_POST);
esp_http_client_set_header(client, "Content-Type", "application/json");
esp_http_client_set_post_field(client, post_data, strlen(post_data));

esp_err_t err = esp_http_client_perform(client);
```

## Best Practices

1. **Connection reuse:** Keep HTTP client handle open for multiple requests
2. **Timeout handling:** Set appropriate timeouts for embedded environments
3. **Memory management:** Use `esp_http_client_cleanup()` when done
4. **Error handling:** Check return values and implement retry logic
5. **Buffer sizing:** Size buffers appropriately for your payloads
6. **TLS session resumption:** Reduces handshake overhead

## Performance Optimization

- Enable HTTP keep-alive for multiple requests
- Use TLS session tickets (enabled by default in ESP-IDF)
- Consider chunked transfer encoding for large payloads
- Monitor heap usage during HTTPS operations

## Official Documentation
- ESP HTTP Client: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html
- ESP-TLS: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_tls.html

---
