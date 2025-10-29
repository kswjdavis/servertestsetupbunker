# Raspberry Pi Monitoring Card Prep

Use this checklist to flash a Raspberry Pi OS Lite image, preconfigure Wi‑Fi/SSH,
and deploy the Bunkercolab monitoring stack on a Raspberry Pi 3B+.

## 1. Download the OS Image

```bash
curl -L -o ~/Downloads/raspios-lite-arm64.img.xz \
  https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2024-03-15/2024-03-15-raspios-bookworm-arm64-lite.img.xz

xz -d ~/Downloads/raspios-lite-arm64.img.xz
```

The second command produces `~/Downloads/raspios-lite-arm64.img`. Adjust the path
if you store it elsewhere.

## 2. Identify the microSD Device

- **macOS:** `diskutil list`
- **Linux:** `lsblk -p`
- **Windows:** use Raspberry Pi Imager or Rufus (skip to step 4)

Record the device path (e.g., `/dev/disk4` on macOS or `/dev/sdb` on Linux).

## 3. Flash the Image

> **Warning:** double-check the device path—`dd` will overwrite it entirely.

### macOS

```bash
diskutil unmountDisk /dev/disk4
sudo dd if=~/Downloads/raspios-lite-arm64.img of=/dev/rdisk4 \
  bs=4m conv=fsync status=progress
```

Replace `/dev/disk4` and `/dev/rdisk4` with your device identifiers.

### Linux

```bash
sudo umount /dev/sdb?  # unmount all partitions
sudo dd if=~/Downloads/raspios-lite-arm64.img of=/dev/sdb \
  bs=4M conv=fsync status=progress
```

Replace `/dev/sdb` with your own device.

## 4. Stage Boot Configuration

Mount the `boot` partition that appears after flashing (macOS usually auto-mounts
it under `/Volumes/boot`).

1. Copy `pitest/wpa_supplicant.conf.template` to the boot partition as
   `wpa_supplicant.conf`.
2. Create an empty file named `ssh` in the boot partition (`touch ssh`).
3. (Optional) Copy `scripts/pi-monitor/firstboot.sh` to the boot partition to let
   the Pi auto-install dependencies on first boot:
   ```bash
   cp scripts/pi-monitor/firstboot.sh /Volumes/boot/
   chmod +x /Volumes/boot/firstboot.sh
   ```

Safe eject the card when finished.

## 5. First Boot (Pi)

1. Insert the microSD into the Raspberry Pi 3B+ and power it up.
2. Wait ~1–2 minutes for Wi‑Fi to associate with SSID `Arkgow`.
3. SSH in (default credentials `bunker:bunker` if you used `firstboot.sh`):
   ```bash
   ssh bunker@bunker-monitor.local
   ```

If `firstboot.sh` was not used, create the user and install packages:

```bash
sudo useradd -m bunker
sudo usermod -aG sudo,dialout,gpio,adm bunker
sudo apt update
sudo apt install -y python3-venv python3-pip python3-gpiozero python3-serial \
    python3-psutil sqlite3 logrotate iw rfkill git
```

## 6. Deploy the Monitor

```bash
sudo mkdir -p /opt/bunker-monitor
sudo chown bunker:bunker /opt/bunker-monitor
rsync -av scripts/pi-monitor/ bunker@<pi-ip>:/opt/bunker-monitor/

ssh bunker@<pi-ip> '
  cd /opt/bunker-monitor &&
  python3 -m venv .venv &&
  source .venv/bin/activate &&
  pip install -r requirements.txt
'

sudo cp /opt/bunker-monitor/pi_monitor_config.yaml /etc/bunker-monitor.yaml
sudo cp /opt/bunker-monitor/pi-monitor.service /etc/systemd/system/
sudo cp /opt/bunker-monitor/logrotate.conf /etc/logrotate.d/bunker-monitor
sudo systemctl daemon-reload
sudo systemctl enable --now pi-monitor.service
```

> Update `/etc/bunker-monitor.yaml` if the serial path or Wi‑Fi interface differs.

## 7. Verify Operation

```bash
sudo systemctl status pi-monitor
sudo journalctl -u pi-monitor -f
ls /var/log/bunker/
sqlite3 /var/log/bunker/bunker_monitor.db \
  'SELECT recorded_at, level, tag, message FROM serial_logs ORDER BY id DESC LIMIT 5;'
```

## 8. Wiring Reference

| ESP32 DevKitC | Pi GPIO (BCM) | Notes                  |
|---------------|---------------|------------------------|
| GPIO4         | 17            | Relay state (1 kΩ)     |
| GPIO5         | 27            | LED state (1 kΩ)       |
| GND           | GND           | Common reference       |
| USB           | Pi USB port   | Power + serial logging |

Keep all signals at 3.3 V levels.

## 9. Retrieving Logs

```bash
scp bunker@<pi-ip>:/var/log/bunker/esp32-serial-*.jsonl .
scp bunker@<pi-ip>:/var/log/bunker/bunker_monitor.db .
```

Query recent errors:

```bash
sqlite3 bunker_monitor.db \
  "SELECT recorded_at, raw_line FROM serial_logs WHERE level='E' ORDER BY id DESC LIMIT 10;"
```

## 10. Maintenance

- `sudo systemctl restart pi-monitor` after config changes
- `sudo logrotate -f /etc/logrotate.d/bunker-monitor` to force rotation
- Keep ~1 GB free disk for sustained logging

