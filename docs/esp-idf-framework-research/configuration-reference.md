# Configuration Reference

## Critical menuconfig Options

### HTTP Client
```
Component config → ESP HTTP client:
  ☑ Enable HTTPS (CONFIG_ESP_HTTP_CLIENT_ENABLE_HTTPS)
  Buffer size: 512 bytes
  TX buffer size: 512 bytes
```

### TLS/Certificate Bundle
```
Component config → mbedTLS:
  ☑ Enable mbedTLS certificate bundle
  Certificate bundle → Default (Most common certificates)
  ☑ Enable use of time/date
  TLS Version → TLS 1.2 minimum
```

### WiFi
```
Component config → Wi-Fi:
  WiFi IRAM speed optimization: Yes
  WiFi RX IRAM speed optimization: Yes
  WiFi Static RX buffer number: 10
  WiFi Dynamic RX buffer number: 32
```

### LWIP/SNTP
```
Component config → LWIP:
  ☑ Enable SNTP
  Request interval: 3600000 (1 hour)
  Number of servers: 2
```

### Task Watchdog
```
Component config → ESP System Settings:
  ☑ Initialize Task Watchdog Timer on startup
  Timeout period: 5-10 seconds
  ☑ Watch CPU0 Idle Task
  ☑ Invoke panic handler on timeout

  Interrupt watchdog timeout: 300-1000 ms
```

### NVS
```
Component config → NVS:
  ☑ Enable NVS encryption (requires Flash Encryption)
```

### Logging
```
Component config → Log output:
  Default log level: Info
  ☑ Use ANSI terminal colors
```

## Flash Partitions

For OTA updates and NVS, configure partitions:

```csv