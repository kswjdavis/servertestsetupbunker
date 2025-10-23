#!/usr/bin/env bash
#
# Setup Nginx Reverse Proxy Configuration
# Run this after backend is deployed and tested
#
set -euo pipefail

echo "=== Nginx Configuration Setup ==="
echo

# Get domain name from user
read -p "Enter your domain name (or press Enter to skip SSL setup): " DOMAIN_NAME

if [[ -z "$DOMAIN_NAME" ]]; then
    echo "No domain provided - configuring for HTTP only"
    DOMAIN_NAME="_"
    USE_SSL=false
else
    echo "Configuring for domain: $DOMAIN_NAME"
    USE_SSL=true
fi

echo

# Create nginx site configuration
echo "[1/3] Creating nginx configuration..."
sudo tee /etc/nginx/sites-available/bunkercolab > /dev/null <<'EOF'
# Bunkercolab Nginx Configuration
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Serve React SPA
    location / {
        root /var/www/bunkercolab;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # FastAPI docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:8000/redoc;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
    }
}
EOF

# Update server_name if domain provided
if [[ "$USE_SSL" == "true" ]]; then
    sudo sed -i "s/server_name _;/server_name $DOMAIN_NAME;/" /etc/nginx/sites-available/bunkercolab
fi

# Enable site
echo "[2/3] Enabling site..."
sudo ln -sf /etc/nginx/sites-available/bunkercolab /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
echo "[3/3] Testing nginx configuration..."
sudo nginx -t

if [[ $? -eq 0 ]]; then
    echo "SUCCESS: Nginx configuration is valid"
    sudo systemctl reload nginx
    echo "Nginx reloaded successfully"
else
    echo "ERROR: Nginx configuration test failed"
    exit 1
fi

echo
echo "=== Nginx Configuration Complete ==="

if [[ "$USE_SSL" == "true" ]]; then
    echo "Domain: $DOMAIN_NAME"
    echo
    echo "=== Next Steps ==="
    echo "1. Ensure DNS is pointed to this server's IP address"
    echo "2. Deploy frontend: bash scripts/deploy-web.sh"
    echo "3. Setup SSL: sudo certbot --nginx -d $DOMAIN_NAME"
else
    echo "HTTP-only mode (no SSL)"
    echo
    echo "=== Next Steps ==="
    echo "1. Deploy frontend: bash scripts/deploy-web.sh"
    echo "2. Access via: http://YOUR_SERVER_IP"
fi
echo
