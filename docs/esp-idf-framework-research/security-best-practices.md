# Security Best Practices

## TLS/HTTPS Security

1. **Always verify server certificates**
   ```c
   esp_http_client_config_t config = {
       .url = "https://api.example.com",
       .crt_bundle_attach = esp_crt_bundle_attach,  // REQUIRED
   };
   ```

2. **Never skip certificate verification**
   ```c
   // NEVER do this in production:
   config.skip_cert_common_name_check = true;  // INSECURE!
   ```

3. **Use TLS 1.2 minimum**
   ```c
   config.tls_version = ESP_HTTP_CLIENT_TLS_VER_TLS_1_2;
   ```

4. **Enable time synchronization**
   - Certificate validation requires accurate system time
   - Initialize SNTP before HTTPS connections
   - Enable `CONFIG_MBEDTLS_HAVE_TIME_DATE`

5. **Keep certificates updated**
   - Update certificate bundle via OTA firmware updates
   - Monitor Espressif security advisories

## Credential Storage

1. **Use NVS encryption**
   ```
   Component config → NVS → Enable NVS encryption
   Requires Flash Encryption to be enabled
   ```

2. **Separate namespaces**
   ```c
   nvs_open("wifi_config", NVS_READWRITE, &handle);  // WiFi credentials
   nvs_open("device_config", NVS_READWRITE, &handle); // Auth tokens
   ```

3. **Never hardcode credentials**
   - Store via provisioning wizard
   - Use NVS for persistent storage
   - Wipe NVS on factory reset

## Firmware Security

1. **Enable Secure Boot**
   ```
   Security features → Enable hardware Secure Boot in bootloader
   ```

2. **Enable Flash Encryption**
   ```
   Security features → Enable flash encryption on boot
   ```

3. **OTA Updates over HTTPS only**
   ```c
   esp_https_ota_config_t ota_config = {
       .http_config = {
           .url = "https://firmware.example.com/latest.bin",
           .crt_bundle_attach = esp_crt_bundle_attach,
       },
   };
   ```

4. **Anti-rollback protection**
   ```
   Security features → Enable app anti-rollback support
   ```

## Network Security

1. **Use WPA2/WPA3 for WiFi**
   ```c
   wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
   ```

2. **Validate all API responses**
   ```c
   cJSON *root = cJSON_Parse(response);
   if (root == NULL) {
       ESP_LOGE(TAG, "Invalid JSON response");
       return ESP_FAIL;
   }
   ```

3. **Implement rate limiting**
   - Limit API request frequency
   - Handle 429 (Too Many Requests) responses

4. **Use authentication tokens**
   ```c
   esp_http_client_set_header(client, "Authorization", "Bearer TOKEN");
   ```

## Fail-Safe Security

1. **Default to safe state**
   - Relay initialization: FANS ON
   - Any error condition: FANS ON
   - Power loss: Normally-closed relay ensures FANS ON

2. **Validate all inputs**
   - Check JSON structure before parsing
   - Validate timer values before use
   - Verify GPIO states after setting

3. **Monitor watchdog**
   - Enable panic on watchdog timeout
   - Log all watchdog resets

4. **Secure provisioning**
   - Use Security 2 for WiFi provisioning
   - Implement proof-of-possession
   - Timeout provisioning mode after 10 minutes

---
