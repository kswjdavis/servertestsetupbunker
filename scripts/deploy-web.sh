#!/usr/bin/env bash
#
# Build and Deploy React Frontend
# Run this as the bunkercolab user after nginx is configured
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/web"
NGINX_ROOT="/var/www/bunkercolab"

echo "=== Bunkercolab Frontend Deployment ==="
echo "Web directory: $WEB_DIR"
echo

# Check if web directory exists
if [[ ! -d "$WEB_DIR" ]]; then
    echo "ERROR: Web directory not found at $WEB_DIR"
    echo "This script requires the frontend to be set up first."
    exit 1
fi

# Install dependencies
echo "[1/4] Installing npm dependencies..."
cd "$WEB_DIR"

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found. Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

npm install

# Build production bundle
echo "[2/4] Building production bundle..."
npm run build

# Deploy to nginx
echo "[3/4] Deploying to nginx..."
sudo mkdir -p "$NGINX_ROOT"
sudo rm -rf "$NGINX_ROOT"/*
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"

# Verify deployment
echo "[4/4] Verifying deployment..."
if [[ -f "$NGINX_ROOT/index.html" ]]; then
    echo "SUCCESS: Frontend deployed to $NGINX_ROOT"
else
    echo "ERROR: Deployment failed - index.html not found"
    exit 1
fi

echo
echo "=== Frontend Deployment Complete ==="
echo "Files deployed to: $NGINX_ROOT"
echo
