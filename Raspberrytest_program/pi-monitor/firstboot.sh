#!/usr/bin/env bash
# Optional first-boot provisioning script for the Raspberry Pi image.
# Copy this file to /boot/firstboot.sh before first boot and mark executable.

set -euo pipefail

LOG="/var/log/bunker-firstboot.log"
exec > >(tee -a "$LOG") 2>&1

echo "[firstboot] $(date --iso-8601=seconds) Starting provisioning"

USER_NAME="bunker"
USER_PASS="bunker"

if ! id "$USER_NAME" >/dev/null 2>&1; then
  echo "[firstboot] Creating user $USER_NAME"
  useradd -m "$USER_NAME"
  echo "${USER_NAME}:${USER_PASS}" | chpasswd
  usermod -aG sudo,dialout,gpio,adm "$USER_NAME"
fi

echo "[firstboot] Updating apt cache"
apt-get update

echo "[firstboot] Installing dependencies"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3-venv python3-pip python3-gpiozero python3-serial python3-psutil \
  sqlite3 logrotate iw rfkill git

echo "[firstboot] Creating log directory"
install -d -o "$USER_NAME" -g "$USER_NAME" /var/log/bunker

echo "[firstboot] Provisioning complete"
systemctl disable firstboot.service || true
