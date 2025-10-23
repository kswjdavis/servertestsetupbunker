#!/usr/bin/env bash
#
# Deploy FastAPI Backend to DigitalOcean
# Run this as the bunkercolab user after setup-droplet.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"

echo "=== Bunkercolab Backend Deployment ==="
echo "Project root: $PROJECT_ROOT"
echo

# Check if running as bunkercolab user
if [[ "$(whoami)" != "bunkercolab" ]]; then
    echo "WARNING: This script should be run as the bunkercolab user"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Setup Python virtual environment
echo "[1/5] Setting up Python virtual environment..."
cd "$SERVER_DIR"

if [[ ! -d "venv" ]]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment
echo "[2/5] Configuring environment..."
if [[ ! -f ".env" ]]; then
    cp .env.example .env
    echo "CREATED: .env file from .env.example"
    echo "WARNING: You must edit .env with production settings!"
    echo "  - DATABASE_URL (update password)"
    echo "  - SECRET_KEY (generate secure key)"
    echo "  - CORS_ORIGINS (your domain)"
    read -p "Press Enter to continue after editing .env..."
fi

# Run database migrations
echo "[3/5] Running database migrations..."
if [[ -d "alembic" ]]; then
    alembic upgrade head
else
    echo "WARNING: Alembic not initialized yet. Skipping migrations."
fi

# Setup systemd service
echo "[4/5] Setting up systemd service..."
sudo tee /etc/systemd/system/bunkercolab.service > /dev/null <<EOF
[Unit]
Description=Bunker Colab FastAPI Application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=bunkercolab
Group=bunkercolab
WorkingDirectory=$SERVER_DIR
Environment="PATH=$SERVER_DIR/venv/bin"
EnvironmentFile=$SERVER_DIR/.env
ExecStart=$SERVER_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable bunkercolab
sudo systemctl restart bunkercolab

# Check service status
echo "[5/5] Checking service status..."
sleep 2
sudo systemctl status bunkercolab --no-pager || true

echo
echo "=== Backend Deployment Complete ==="
echo "Service status: sudo systemctl status bunkercolab"
echo "View logs: sudo journalctl -u bunkercolab -f"
echo "Test API: curl http://localhost:8000/healthz"
echo
