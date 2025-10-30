# ESP32 Firmware OTA Update Guide

## Quick Steps

1. **Build firmware:**
   ```bash
   cd firmware
   source ~/esp/esp-idf/export.sh
   idf.py build
   ```

2. **Upload to production (choose one):**

   **Method A: API Upload (Recommended)**
   ```bash
   curl -X POST "https://bunker.americanagrionics.com/api/v1/firmware/upload" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -F "file=@build/bunkercolab.bin"
   ```

   **Method B: Direct SCP (Development Only)**
   ```bash
   scp -i ../SSH_Key/.ssh/deploy_key \
       build/bunkercolab.bin \
       root@206.189.210.203:/home/bunkercolab/Bunkercolab/server/app/firmware_storage/latest.bin
   ```

   ⚠️ **CRITICAL PATH:** Must be `server/app/firmware_storage/latest.bin`
   - ✅ Correct: `/home/bunkercolab/Bunkercolab/server/app/firmware_storage/`
   - ❌ Wrong: `/home/bunkercolab/Bunkercolab/server/firmware_storage/`

3. **Verify version updated:**
   ```bash
   curl -sI https://bunker.americanagrionics.com/api/v1/firmware/latest.bin | grep x-firmware-version
   ```
   Version should be a new timestamp.

4. **Device will auto-update:**
   - Next OTA check (every 24 hours or on reboot)
   - Downloads only if version changed
   - Reboots into new firmware automatically

## Troubleshooting

**Version not updating?**
- Check you uploaded to correct directory: `server/app/firmware_storage/`
- Restart backend: `ssh ... 'systemctl restart bunkercolab'`

**OTA validation failed?**
- Verify firmware image: `esptool.py --chip esp32 image_info build/bunkercolab.bin`
- Flash directly via serial as fallback: `idf.py -p /dev/cu.usbserial-10 flash`

**Device downloading repeatedly?**
- Check logs for "Found firmware version header" - should see version captured
- Verify NVS has last_version stored
