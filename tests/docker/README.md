# Docker-Based Deployment Testing

This directory contains Docker infrastructure for testing deployment scripts locally before running on production DigitalOcean droplets.

## Quick Start

### Build and start test environment
```bash
cd tests/docker
docker-compose -f docker-compose.test.yml up -d
```

### Run integration test
```bash
docker exec -it bunkercolab-test-droplet bash /home/bunkercolab/Bunkercolab/tests/docker/test-deployment.sh
```

### Access the container
```bash
docker exec -it bunkercolab-test-droplet bash
```

### Stop and cleanup
```bash
docker-compose -f docker-compose.test.yml down
```

## What Gets Tested

1. **Database Setup** (`setup-db.sh`)
   - PostgreSQL user creation
   - Database creation
   - Permissions

2. **Environment Configuration**
   - `.env.production` file creation
   - Secret key generation
   - Database connection string

3. **Backend Deployment** (`deploy-server.sh`)
   - Python virtual environment
   - Dependencies installation
   - Alembic migrations
   - Systemd service configuration
   - Service startup

4. **Health Validation**
   - HTTP health endpoint check
   - Service status verification

5. **Frontend Build** (`build-web.sh`)
   - npm build execution
   - Asset deployment to nginx root

## Environment

- **OS**: Ubuntu 24.04 LTS
- **PostgreSQL**: Latest (via apt)
- **Python**: 3.12+
- **Nginx**: Latest (via apt)
- **User**: bunkercolab (with sudo)

## Notes

- The container runs with `privileged: true` to support systemctl
- Project directory is mounted as a volume (changes reflected immediately)
- PostgreSQL starts automatically on container boot
- Tests can be run multiple times without rebuilding

## Troubleshooting

### PostgreSQL not starting
```bash
docker exec -it bunkercolab-test-droplet sudo service postgresql start
```

### Systemd issues
The container needs privileged mode for systemctl to work properly.

### Port conflicts
If ports 8000 or 8080 are in use, modify `docker-compose.test.yml`
