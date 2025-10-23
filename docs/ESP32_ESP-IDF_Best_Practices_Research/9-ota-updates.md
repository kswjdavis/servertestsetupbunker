# 9. OTA Updates

## OTA Architecture in ESP32

Over-the-Air (OTA) updates enable remote firmware updates without physical access:
- Dual app partition scheme (ota_0, ota_1)
- Secure boot and anti-rollback protection
- Rollback mechanism for failed updates
- HTTPS transport for security

## Partition Table for OTA

```csv