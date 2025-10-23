#!/usr/bin/env bash
#
# Initial DigitalOcean Droplet Setup Script
# Run this on a fresh Ubuntu 24.04 LTS droplet as root
#
set -euo pipefail

echo "=== Bunkercolab DigitalOcean Droplet Setup ==="
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root"
   exit 1
fi

# Update system
echo "[1/6] Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/6] Installing dependencies..."
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    postgresql \
    postgresql-contrib \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    curl

# Create application user
echo "[3/6] Creating application user..."
if id "bunkercolab" &>/dev/null; then
    echo "User bunkercolab already exists, skipping..."
else
    adduser --disabled-password --gecos "" bunkercolab
    usermod -aG sudo bunkercolab
    echo "bunkercolab ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/bunkercolab
    chmod 0440 /etc/sudoers.d/bunkercolab
fi

# Setup PostgreSQL
echo "[4/6] Setting up PostgreSQL..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'bunkercolab'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE bunkercolab;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = 'bunkercolab_user'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER bunkercolab_user WITH PASSWORD 'CHANGE_ME_IN_PRODUCTION';"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bunkercolab TO bunkercolab_user;"

# Configure firewall
echo "[5/6] Configuring firewall..."
ufw --force enable
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw status

echo "[6/6] Installation complete!"
echo
echo "=== Next Steps ==="
echo "1. Switch to bunkercolab user: su - bunkercolab"
echo "2. Clone repository: git clone <your-repo-url> ~/Bunkercolab"
echo "3. Run deploy-server.sh script to deploy the application"
echo "4. Update PostgreSQL password in .env file"
echo
