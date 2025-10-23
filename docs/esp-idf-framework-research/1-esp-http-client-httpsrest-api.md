# 1. ESP HTTP Client (HTTPS/REST API)

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html
- **Header File:** `esp_http_client/include/esp_http_client.h`
- **Example Code:** `examples/protocols/esp_http_client/main/esp_http_client_example.c`

## Purpose
Provides HTTP/HTTPS client functionality for RESTful API communication with cloud server, supporting TLS encryption, authentication, and various HTTP methods.

## Key Features
- Full HTTPS/TLS support with server certificate verification
- Basic and Digest authentication
- Custom header management (for authentication tokens)
- Persistent connections for multiple requests
- Asynchronous/non-blocking mode
- Chunked transfer encoding
- Automatic redirect handling
- HTTP/2 via ALPN negotiation

## Core API Functions

### Initialization & Cleanup
```c
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *config);
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t client);
```

### Request Execution
```c
// Blocking/non-blocking complete HTTP transaction
esp_err_t esp_http_client_perform(esp_http_client_handle_t client);

// Low-level stream operations
esp_err_t esp_http_client_open(esp_http_client_handle_t client, int write_len);
int esp_http_client_write(esp_http_client_handle_t client, const char *buffer, int len);
int esp_http_client_fetch_headers(esp_http_client_handle_t client);
int esp_http_client_read(esp_http_client_handle_t client, char *buffer, int len);
esp_err_t esp_http_client_close(esp_http_client_handle_t client);
```

### Header Management
```c
esp_err_t esp_http_client_set_header(esp_http_client_handle_t client,
                                     const char *key, const char *value);
esp_err_t esp_http_client_get_header(esp_http_client_handle_t client,
                                     const char *key, char **value);
esp_err_t esp_http_client_delete_header(esp_http_client_handle_t client,
                                        const char *key);
```

### Response Handling
```c
int esp_http_client_get_status_code(esp_http_client_handle_t client);
int64_t esp_http_client_get_content_length(esp_http_client_handle_t client);
bool esp_http_client_is_chunked_response(esp_http_client_handle_t client);
bool esp_http_client_is_complete_data_received(esp_http_client_handle_t client);
```

## Configuration Structure

```c
typedef struct {
    const char *url;                    // Full URL (overrides host/port/path)
    const char *host;                   // Server hostname
    int port;                           // Server port (default 80/443)
    const char *path;                   // Request path
    const char *query;                  // Query string

    // Authentication
    const char *username;               // Username for authentication
    const char *password;               // Password for authentication
    esp_http_client_auth_type_t auth_type; // HTTP_AUTH_TYPE_BASIC or DIGEST

    // TLS/SSL Configuration
    const char *cert_pem;               // Server CA certificate (PEM format)
    size_t cert_len;                    // Certificate length
    const char *client_cert_pem;        // Client certificate for mutual TLS
    const char *client_key_pem;         // Client private key
    esp_http_client_tls_version_t tls_version; // TLS 1.2, 1.3, or unspecified
    esp_err_t (*crt_bundle_attach)(void *conf); // Certificate bundle attach function
    bool use_global_ca_store;           // Use global CA store
    bool skip_cert_common_name_check;   // Skip CN verification (insecure!)

    // HTTP Configuration
    esp_http_client_method_t method;    // GET, POST, PUT, DELETE, etc.
    int timeout_ms;                     // Network timeout (default 5000ms)
    bool disable_auto_redirect;         // Manual redirect handling
    int max_redirection_count;          // Maximum redirects (default 10)

    // Buffers
    int buffer_size;                    // RX buffer size (default 512)
    int buffer_size_tx;                 // TX buffer size (default 512)

    // Event Handling
    http_event_handle_cb event_handler; // Event callback function
    void *user_data;                    // User context pointer

    // Advanced
    bool is_async;                      // Non-blocking mode (HTTPS only)
    bool keep_alive_enable;             // TCP keepalive
    int keep_alive_idle;                // Keepalive idle time (seconds)
    int keep_alive_interval;            // Keepalive interval (seconds)
    int keep_alive_count;               // Keepalive probe count

} esp_http_client_config_t;
```

## HTTPS with Certificate Bundle (RECOMMENDED)

```c
#include "esp_http_client.h"
#include "esp_crt_bundle.h"

static void https_rest_request(void) {
    esp_http_client_config_t config = {
        .url = "https://api.example.com/v1/devices/status",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,  // Mozilla CA bundle
        .event_handler = http_event_handler,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);

    // Add authentication token header
    esp_http_client_set_header(client, "Authorization", "Bearer YOUR_TOKEN");
    esp_http_client_set_header(client, "Content-Type", "application/json");

    // Set POST data
    const char *post_data = "{\"status\":\"online\",\"uptime\":12345}";
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    // Execute request
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTPS Status = %d", status_code);
    } else {
        ESP_LOGE(TAG, "HTTPS request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
}
```

## Authentication Token in Header

```c
// Method 1: Set header directly
esp_http_client_set_header(client, "Authorization", "Bearer abc123xyz");

// Method 2: Configure in initialization
char auth_header[128];
snprintf(auth_header, sizeof(auth_header), "Bearer %s", auth_token);
esp_http_client_set_header(client, "Authorization", auth_header);
```

## Event Handler Pattern

```c
esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    static char *output_buffer = NULL;
    static int output_len = 0;

    switch(evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGE(TAG, "HTTP_EVENT_ERROR");
            break;

        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGI(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;

        case HTTP_EVENT_HEADERS_SENT:
            ESP_LOGI(TAG, "HTTP_EVENT_HEADERS_SENT");
            break;

        case HTTP_EVENT_ON_HEADER:
            ESP_LOGI(TAG, "Header: %s: %s", evt->header_key, evt->header_value);
            break;

        case HTTP_EVENT_ON_DATA:
            // Accumulate response data
            if (!esp_http_client_is_chunked_response(evt->client)) {
                if (output_buffer == NULL) {
                    output_buffer = malloc(esp_http_client_get_content_length(evt->client));
                    output_len = 0;
                }
                memcpy(output_buffer + output_len, evt->data, evt->data_len);
                output_len += evt->data_len;
            }
            break;

        case HTTP_EVENT_ON_FINISH:
            ESP_LOGI(TAG, "HTTP_EVENT_ON_FINISH");
            if (output_buffer != NULL) {
                // Process complete response
                ESP_LOGI(TAG, "Response: %.*s", output_len, output_buffer);
                free(output_buffer);
                output_buffer = NULL;
            }
            output_len = 0;
            break;

        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGI(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
    }
    return ESP_OK;
}
```

## Error Codes
- `ESP_OK` - Success
- `ESP_ERR_HTTP_CONNECT` - Connection failed
- `ESP_ERR_HTTP_WRITE_DATA` - Failed to write data
- `ESP_ERR_HTTP_FETCH_HEADER` - Failed to fetch headers
- `ESP_ERR_HTTP_EAGAIN` - Timeout (async mode)
- `ESP_ERR_HTTP_CONNECTION_CLOSED` - Connection closed by server

## Best Practices for IoT Control System

1. **Always use HTTPS with certificate verification** - Use `crt_bundle_attach` for production
2. **Set reasonable timeouts** - 10-30 seconds for cloud API calls
3. **Implement retry logic** - Handle transient network failures
4. **Use persistent connections** - Reuse same client handle for multiple requests
5. **Monitor content length** - Validate complete response received
6. **Free resources** - Always call `esp_http_client_cleanup()`

## Configuration Requirements (menuconfig)
```
Component config → ESP HTTP client → Enable HTTPS (CONFIG_ESP_HTTP_CLIENT_ENABLE_HTTPS)
Component config → mbedTLS → Certificate Bundle → Enable (CONFIG_MBEDTLS_CERTIFICATE_BUNDLE)
```

---
