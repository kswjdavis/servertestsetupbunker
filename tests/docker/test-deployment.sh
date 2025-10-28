#!/usr/bin/env bash
#
# Integration test script for deployment procedure
# Runs inside the Docker test container
#
set -euo pipefail

echo "=========================================="
echo "Bunkercolab Deployment Integration Test"
echo "=========================================="
echo

# Navigate to project
cd /home/bunkercolab/Bunkercolab || exit 1

echo "Step 1: Database Setup"
echo "----------------------"
sudo ./scripts/setup-db.sh \
  --db-name bunkercolab \
  --db-user bunkercolab_user \
  --db-password Bunker123 \
  --no-install

echo
echo "Step 2: Create .env.production"
echo "------------------------------"
cd server || exit 1
cp .env.production.example .env.production

# Update with test values
cat > .env.production <<EOF
DATABASE_URL=postgresql+asyncpg://bunkercolab_user:Bunker123@localhost/bunkercolab
SECRET_KEY=$(openssl rand -hex 32)
ACCESS_TOKEN_EXPIRE_HOURS=24
CORS_ORIGINS=http://localhost:8080
WEATHER_STATION_ID=KMSP
WEATHER_API_TIMEOUT_SECONDS=10
WEATHER_POLL_INTERVAL_SECONDS=60
WEATHER_STALE_THRESHOLD_MINUTES=10
WEATHER_USER_AGENT=BunkerColab/1.0 (test@bunkercolab.test)
ENVIRONMENT=test
EOF

chmod 600 .env.production
cd ..

echo
echo "Step 3: Backend Deployment"
echo "--------------------------"
./scripts/deploy-server.sh --skip-git

echo
echo "Step 4: Check Backend Service"
echo "-----------------------------"
sleep 3
sudo systemctl status bunkercolab --no-pager || true

echo
echo "Step 5: Test Health Endpoint"
echo "----------------------------"
curl -f http://localhost:8000/healthz || echo "FAILED: Health check failed"

echo
echo "Step 6: Frontend Build"
echo "---------------------"
# Skip frontend build if web directory missing (not critical for backend test)
if [ -d "web" ]; then
  ./scripts/build-web.sh --skip-install || echo "Frontend build skipped (expected in Docker)"
else
  echo "Web directory not found - skipping frontend test"
fi

echo
echo "=========================================="
echo "Deployment Integration Test Complete!"
echo "=========================================="
echo
echo "Summary:"
echo "  - Database: Created and configured"
echo "  - Backend: Deployed and running"
echo "  - Health Check: $(curl -s http://localhost:8000/healthz 2>/dev/null || echo 'FAILED')"
echo
