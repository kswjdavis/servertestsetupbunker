# Digital Ocean Droplet Access Information

## Server Details

**IP Address:** `206.189.210.203`
**OS:** Ubuntu 24.04 LTS
**User:** `root` (or `bunkercolab` for application)

## SSH Access

### Using Deploy Key (Recommended)
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203
```

### Using Main Key (Has Passphrase)
```bash
ssh -i SSH_Key/.ssh/id_ed25519 root@206.189.210.203
# Passphrase: Bunker1!
```

## Database Credentials

**Database:** `bunkercolab`
**User:** `bunkercolab_user`
**Password:** `Bunker123` (changed from `Bunker1!` to avoid special character issues)
**Port:** 5432 (localhost only, not exposed externally)

### Connect to PostgreSQL
```bash
# From the droplet
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203
su - postgres
psql -d bunkercolab

# Or directly
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'su - postgres -c "psql -d bunkercolab"'
```

## Application Directories

**Application Root:** `/home/bunkercolab/Bunkercolab/`
**Backend:** `/home/bunkercolab/Bunkercolab/server/`
**Frontend:** `/var/www/bunkercolab/`

## Services

### FastAPI Backend Service
```bash
# Status
systemctl status bunkercolab-api

# Logs
journalctl -u bunkercolab-api -f

# Restart
systemctl restart bunkercolab-api

# Stop/Start
systemctl stop bunkercolab-api
systemctl start bunkercolab-api
```

### Nginx
```bash
# Status
systemctl status nginx

# Test configuration
nginx -t

# Reload
systemctl reload nginx

# Logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### PostgreSQL
```bash
systemctl status postgresql
```

## Deployment Scripts

Located in `scripts/` directory:
- `setup-droplet.sh` - Initial server setup
- `deploy-server.sh` - Deploy FastAPI backend
- `deploy-web.sh` - Deploy React frontend
- `setup-nginx.sh` - Configure Nginx

## Quick Deploy Commands

### Deploy Backend
```bash
rsync -avz -e "ssh -i SSH_Key/.ssh/deploy_key" --exclude '.git' --exclude 'venv' --exclude '__pycache__' server/ root@206.189.210.203:/home/bunkercolab/Bunkercolab/server/

ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'systemctl restart bunkercolab-api'
```

### Run Database Migrations
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'cd /home/bunkercolab/Bunkercolab/server && source venv/bin/activate && alembic upgrade head'
```

## Environment Files

### Server .env (Production)
Location: `/home/bunkercolab/Bunkercolab/server/.env`
```env
DATABASE_URL=postgresql+asyncpg://bunkercolab_user:Bunker123@localhost/bunkercolab
SECRET_KEY=change-me-in-production
CORS_ORIGINS=http://206.189.210.203,http://localhost:3000,http://localhost:5173
LOG_LEVEL=INFO
```

## Firewall Rules

- Port 22 (SSH): Open
- Port 80 (HTTP): Open
- Port 443 (HTTPS): Open (for future SSL)
- Port 5432 (PostgreSQL): Closed externally (localhost only)
- Port 8000 (FastAPI): Closed externally (proxied through Nginx)

## Endpoints

- **Health Check:** http://206.189.210.203/api/healthz
- **API Base:** http://206.189.210.203/api/
- **Web Root:** http://206.189.210.203/

## Database Schema

Tables created (Story 1.2):
- `users` - User authentication
- `bunkers` - Grain storage facilities
- `devices` - ESP32 fan controllers
- `device_status` - Real-time device telemetry
- `time_window_overrides` - Scheduled overrides
- `weather_data` - Current weather cache
- `global_config` - System configuration
- `alembic_version` - Migration tracking

## Troubleshooting

### Check API is running
```bash
curl http://206.189.210.203/api/healthz
# Should return: {"status":"ok"}
```

### Check backend service logs
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'journalctl -u bunkercolab-api -n 50'
```

### Check database tables
```bash
ssh -i SSH_Key/.ssh/deploy_key root@206.189.210.203 'su - postgres -c "psql -d bunkercolab -c \"\\dt\""'
```

---

**Last Updated:** October 23, 2025
**Stories Completed:** 1.1 (Scaffolding), 1.2 (Database Schema)
