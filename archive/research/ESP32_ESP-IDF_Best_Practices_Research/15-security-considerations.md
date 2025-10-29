# 15. Security Considerations

## Security Architecture Layers

1. **Hardware Security:** eFuse, Secure Boot, Flash Encryption
2. **Network Security:** TLS/HTTPS, WiFi WPA2/WPA3
3. **Application Security:** Credential management, OTA validation
4. **Physical Security:** Tamper detection, debug port access

## Secure Boot

Prevents unauthorized firmware from running:

**Enable in menuconfig:**
```
Security features → Enable hardware Secure Boot in bootloader
Security features → Secure boot version → Secure boot version 2 (RSA-PSS)
```

**Generate signing key:**
```bash
espsecure.py generate_signing_key --version 2 secure_boot_signing_key.pem
```

**Build process:**
```bash
idf.py build
espsecure.py sign_data --version 2 --keyfile secure_boot_signing_key.pem \
    build/bootloader/bootloader.bin build/bootloader/bootloader_signed.bin
```

**Important:**
- Secure boot is irreversible once enabled
- Store signing keys securely offline
- Test thoroughly before production deployment

## Flash Encryption

Encrypts firmware and data at rest:

**Enable in menuconfig:**
```
Security features → Enable flash encryption on boot
```

**Key Management:**
- Development: Re-flashable (generates new key each flash)
- Production: One-time programmable (key burned to eFuse)

**Encrypted Partitions:**
```csv