# 2. ESP-TLS (TLS/SSL Support)

## Official Documentation
- **API Reference:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_tls.html
- **Security Overview:** https://docs.espressif.com/projects/esp-idf/en/stable/esp32/security/security.html
- **Header File:** `esp-tls/esp_tls.h`

## Purpose
Provides TLS/SSL abstraction layer for secure communications, integrated with ESP HTTP Client for HTTPS connections.

## Key Features
- TLS 1.2 and TLS 1.3 support
- Server certificate verification
- Client certificate authentication (mutual TLS)
- Pre-shared keys (PSK)
- Session resumption
- ALPN (Application-Layer Protocol Negotiation)
- SNI (Server Name Indication)

## Server Verification Methods

ESP-TLS requires ONE of the following verification methods (mandatory in ESP-IDF 5.x):

1. **CA Certificate Buffer** - Provide CA cert in PEM format
2. **Global CA Store** - Use shared CA store across connections
3. **Certificate Bundle** - Mozilla NSS root certificate bundle (RECOMMENDED)
4. **Pre-Shared Keys** - PSK-based authentication

**CRITICAL:** If no verification method is configured, TLS connection setup will return a fatal error by default. This prevents insecure connections.

## Certificate Bundle Configuration

The ESP x509 Certificate Bundle provides Mozilla's NSS root certificate store (130+ certificates) for server verification.

**Enable in menuconfig:**
```
Component config → mbedTLS → Enable mbedTLS certificate bundle
Component config → mbedTLS → Default certificate bundle → Default - Most common certificates
```

**Usage with ESP HTTP Client:**
```c
#include "esp_crt_bundle.h"

esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .crt_bundle_attach = esp_crt_bundle_attach,
};
```

## Custom CA Certificate

```c
extern const char server_root_cert_pem_start[] asm("_binary_server_cert_pem_start");

esp_http_client_config_t config = {
    .url = "https://api.example.com",
    .cert_pem = server_root_cert_pem_start,
};
```

Embed certificate in firmware:
```cmake