# BUG-001: NVS Partition Offset Mismatch in Documentation

**Date Discovered:** October 28, 2025
**Discovered By:** James (Dev Agent) during Story 2.11 implementation
**Severity:** HIGH (Blocks provisioning)
**Status:** IDENTIFIED - Fix Implemented

---

## Summary

The hardware test report (HARDWARE_TEST_REPORT_2025-10-27.md) documents flashing NVS provisioning data to **0xB000**, but the actual NVS partition is located at **0xC000** according to `partitions.csv`.

This mismatch causes provisioning to fail silently - data is written to the wrong flash location and never read by the firmware.

---

## Impact

- **Device provisioning fails** with "Device not provisioned" error
- **Previous test success misleading** - may have worked due to existing data at 0xC000
- **Documentation incorrect** - could mislead future developers

---

## Root Cause

**partitions.csv:**
```
nvs,      data, nvs,     0xC000,  0x4000,
```

**Hardware Test Report (line 122):**
```
- **Flash Location**: 0xB000 (24KB partition)
```

The test report incorrectly documented 0xB000 as the NVS location.

---

## Fix Applied

1. **Corrected flash command:**
   ```bash
   python -m esptool --chip esp32 -p /dev/cu.usbserial-10 -b 460800 write_flash 0xC000 nvs_provision.bin
   ```

2. **Erase before write:**
   ```bash
   python -m esptool --chip esp32 -p /dev/cu.usbserial-10 -b 460800 erase_region 0xC000 0x4000
   ```

---

## Validation

✅ After flashing to 0xC000:
- Device detects as provisioned
- WiFi connects successfully
- Auth token loads correctly
- Backend communication works

---

## Recommendations

1. **Update HARDWARE_TEST_REPORT_2025-10-27.md** - Correct Flash Location to 0xC000
2. **Add validation script** - Script to verify NVS offset matches partitions.csv
3. **Document in README** - Add NVS provisioning section with correct offset
4. **Create helper script** - `provision_device.sh` that reads offset from partitions.csv

---

## Related Issues

- Story 2.11: Power Management (blocked by this bug)
- Backend: JSON response malformed (separate issue)

---

## Files Affected

- `firmware/HARDWARE_TEST_REPORT_2025-10-27.md` (incorrect documentation)
- `firmware/partitions.csv` (source of truth)
- `firmware/nvs_provision.csv` (provisioning data)
