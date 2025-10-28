# Performance Validation Playbook

Use this checklist to confirm Story 5.7 acceptance criteria before sign-off.

## Frontend
- Build and capture bundle metrics: `cd web && npm run analyze`
- Inspect `web/dist/analyze/bundle-report.json`; ensure gzip total for critical chunks < 500 KB
- Spot-check `dist/assets` file sizes after `npm run build`
- Run Lighthouse in Chrome DevTools (Performance panel) against `/dashboard`; target score >= 80

## Backend
- Apply latest migrations from `server.backup`: `cd server.backup && alembic upgrade head`
- From the repo root run the load test: `python scripts/load_test.py --base-url https://api.example.com --tokens-file tokens.txt --device-count 10 --interval 60 --duration 600 --latency-budget-ms 200`
- Review console output for error rate (must be 0%) and `p95` latency <= 200 ms

## Weather Caching
- Run targeted tests: `cd server.backup && pytest tests/test_weather_service.py -k cache`
- Confirm logs show cached responses when the external API is unavailable
- Observe `WeatherService` metrics in `/system-health` during load; status should remain `online`

## Memory Leak Check
- In Chrome, open dashboard and DevTools → Memory tab
- Record heap snapshot, then navigate between high-content pages (Dashboard → Devices → Bunker detail) for at least 5 minutes
- Take a second snapshot and compare retained sizes; there should be no monotonic growth trend
- Repeat while leaving tab idle for 10+ minutes to confirm timers and subscriptions clean up correctly
