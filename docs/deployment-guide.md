# Deployment Guide

This document outlines the end-to-end procedure for deploying the Bunkercolab
platform to a production DigitalOcean droplet. It covers infrastructure
preparation, backend/frontend releases, SSL hardening, and rollback operations.

---

## 1. Prerequisites

- DigitalOcean droplet (Ubuntu 24.04 LTS, 2 GB RAM minimum)
- Domain name pointed to the droplet public IP
- SSH access with sudo privileges (root or `bunkercolab` user)
- Repository cloned to `/home/bunkercolab/Bunkercolab`
- Ports 80/443 allowed in the droplet firewall

---

## 2. Initial Server Preparation

1. SSH into the droplet as `root`.
2. Run the baseline provisioning script:

   ```bash
   sudo ./scripts/setup-droplet.sh
   ```

   This installs core packages (Python, PostgreSQL, nginx, certbot) and creates
   the `bunkercolab` user with passwordless sudo.

3. Switch to the application user and clone the repository:

   ```bash
   su - bunkercolab
   git clone <repo-url> ~/Bunkercolab
   ```

4. Configure the database:

   ```bash
   cd ~/Bunkercolab/scripts
   sudo ./setup-db.sh --db-password '<STRONG_DB_PASSWORD>'
   ```

   Environment overrides:
   - `DB_NAME` (default `bunkercolab`)
   - `DB_USER` (default `bunkercolab_user`)
   - `DB_PASSWORD` (prompted if omitted)

---

## 3. Environment Configuration

1. Copy the production template and edit values:

   ```bash
   cd ~/Bunkercolab/server
   cp .env.production.example .env.production
   nano .env.production
   ```

2. Required fields:
   - `DATABASE_URL=postgresql+asyncpg://bunkercolab_user:<password>@localhost/bunkercolab`
   - `SECRET_KEY` — 32+ random bytes (`openssl rand -hex 32`)
   - `CORS_ORIGINS=https://your-domain`
   - Weather tuning (`WEATHER_*` keys)
   - `ENVIRONMENT=production`

Keep the file readable by the `bunkercolab` user only:

```bash
chmod 600 .env.production
```

---

## 4. Systemd Service

1. Review the template at `config/bunkercolab.service`.
2. Install the service using the deployment script (handles placeholder
   substitution):

   ```bash
    cd ~/Bunkercolab/scripts
    ./deploy-server.sh --skip-git
   ```

   On first run the script will:
   - Create/update the Python virtual environment
   - Install dependencies
   - Apply Alembic migrations
   - Install `/etc/systemd/system/bunkercolab.service`
   - Restart the service

3. Verify:

   ```bash
   sudo systemctl status bunkercolab
   sudo journalctl -u bunkercolab -f
   ```

---

## 5. Nginx Reverse Proxy

1. Copy the template and customize the domain name:

   ```bash
   sudo cp ~/Bunkercolab/config/nginx.conf /etc/nginx/sites-available/bunkercolab
   sudo ln -s /etc/nginx/sites-available/bunkercolab /etc/nginx/sites-enabled/bunkercolab
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

2. Test and reload:

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

The template serves the built React bundle from `/var/www/bunkercolab` and
proxies `/api/` to the FastAPI service on `127.0.0.1:8000`.

---

## 6. TLS with Let’s Encrypt

1. Ensure DNS records point to the droplet.
2. Run certbot in nginx mode:

   ```bash
   sudo certbot --nginx -d bunkercolab.example.com
   ```

3. Confirm automatic renewal:

   ```bash
   sudo systemctl status certbot.timer
   sudo certbot renew --dry-run
   ```

The nginx template already references the certificate paths used by certbot.

---

## 7. Deploy Backend & Frontend

Deploy backend (fetch latest code, apply migrations, restart service):

```bash
cd ~/Bunkercolab/scripts
./deploy-server.sh
```

Build and deploy frontend assets:

```bash
./build-web.sh
```

By default the build script copies `web/dist` to `/var/www/bunkercolab` and
ensures ownership by `www-data`.

---

## 8. Verification Checklist

- `curl https://bunkercolab.example.com/api/healthz` returns `{"status":"ok"}`
- React UI loads over HTTPS without mixed-content issues
- `sudo systemctl status bunkercolab` reports `active (running)`
- PostgreSQL contains expected schema (`\dt` from psql)
- `/var/log/nginx/bunkercolab.error.log` free of 4xx/5xx bursts

---

## 9. Rollback Procedure

Use the rollback helper to reset the repository to a known good commit or tag:

```bash
cd ~/Bunkercolab/scripts
./rollback.sh <commit-or-tag>
```

The script performs:
1. `git fetch --all` and `git reset --hard <target>`
2. Optional `systemctl restart bunkercolab`
3. Instructions to rebuild backend/frontend (`deploy-server.sh --skip-git`,
   `build-web.sh --skip-install`)

Verify application health post-rollback before notifying stakeholders.

---

## Appendix A — ESP32 LED Flash Identification

Each provisioned ESP32 flashes its status LED with a unique pattern so field
operators can match hardware units to their database records.

### Flash Pattern

- `led_flash_sequence = 1` → 1 blink, 2 s pause, repeat
- `led_flash_sequence = 2` → 2 blinks, 2 s pause, repeat
- …
- `led_flash_sequence = 10` → 10 blinks, 2 s pause, repeat

Timing:

- Blink cadence: 200 ms ON, 200 ms OFF
- Pause after sequence: 2 s

### Field Deployment Steps

1. Provision the device via the web UI and note the assigned `led_flash_sequence`.
2. Confirm the provisioning response was applied to the device (auth token and LED
   sequence stored in NVS).
3. Power on the ESP32 and wait for Wi-Fi connection; the identification pattern
   starts automatically.
4. Count the LED blinks to confirm the unit matches the intended bunker record
   before installation.

### Troubleshooting

- **LED not flashing:** Ensure Wi-Fi credentials are correct and the device
  successfully connected.
- **Unexpected blink count:** Re-run provisioning to assign a new sequence or
  verify the NVS value via diagnostics.
- **No LED on board:** Adjust `CONFIG_LED_GPIO_PIN` in `menuconfig` to match the
  hardware LED wiring.

### LED Task Lifecycle During Resets & OTA

- The LED flash task runs as a background FreeRTOS task and terminates
  automatically when the device reboots for OTA updates or manual resets.
- After the device restarts, the task is re-created once Wi-Fi reconnects and
  the stored `led_flash_sequence` is loaded from NVS—operators should expect a
  brief pause during firmware upgrades.
- No additional actions are required post-update; the pattern resumes using the
  persisted sequence value.
