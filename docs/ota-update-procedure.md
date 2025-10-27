# ESP32 OTA Update Procedure

This guide explains how to build, upload, and validate OTA firmware updates for Bunkercolab ESP32 devices.

## Prerequisites
- ESP-IDF 5.x toolchain installed and configured
- Backend server deployed and reachable over HTTPS
- Admin API token with firmware upload permissions
- Devices already provisioned with Wi-Fi credentials, server URL, and auth token

## Build Firmware
```bash
cd firmware
idf.py build
```

The compiled image lives at `build/<project>.bin`. Substitute its path in the upload step below.

## Upload Firmware to Server (AC2, AC8)
Use the authenticated firmware upload endpoint. Replace placeholders with your values.
```bash
curl -X POST "https://your-server.com/api/v1/firmware/upload" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@build/firmware.bin"
```

The server stores the image as `latest.bin` and makes it available at `/api/v1/firmware/latest.bin` for OTA clients.

## Device OTA Check (AC1, AC3, AC6)
- Devices check the firmware endpoint every 24 hours.
- OTA updates run only when the device is online and authenticated.
- Progress is logged with `ESP_LOGI(TAG, "OTA progress: ...")` for monitoring.

### Manual Trigger (Optional)
You can temporarily reduce the polling interval by rebuilding the firmware with a shorter interval for bench testing.

## Rollback & NVS Preservation (AC4, AC5)
- The ESP-IDF dual-partition OTA scheme keeps NVS in a dedicated partition, so credentials and tokens remain intact after updates.
- If the downloaded firmware fails validation or cannot boot, ESP-IDF automatically rolls back to the previous partition.
- Monitor serial logs for `OTA update successful` or errors indicating automatic rollback.

## Verify Update (AC7, AC9)
1. After the device restarts, it reports its firmware version in the next status update.
2. The web UI device list displays the firmware version badge.
3. Confirm the backend `/api/v1/devices` response reflects the new version.

## Rollback Procedure (AC10)
1. Upload the last known-good firmware via the same `/api/v1/firmware/upload` endpoint.
2. Power-cycle or wait for the device to poll the firmware endpoint.
3. If a faulty image causes repeated failures, provisioned devices automatically revert; no manual flash is required unless both OTA slots contain broken firmware.

## Troubleshooting
- **Download fails:** Verify TLS connectivity and certificate bundle. Ensure `FIRMWARE_STORAGE_DIR` is readable.
- **Device stays on old firmware:** Check logs for OTA failure messages and validate that the new binary is healthy.
- **Storage errors:** Confirm the configured firmware storage directory has sufficient disk space and correct permissions.
