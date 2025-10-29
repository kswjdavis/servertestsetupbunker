# Story 2.9 – End-to-End Integration Test Report

## Test Artifact
- Implementation: `server/tests/test_end_to_end_integration.py`
- Scope: Exercises provisioning, authentication, control loop decisions, database persistence, and weather integration using a simulated ESP32 device.

## Execution Summary
- Backend initialized with stubbed weather data (25 mph wind) to avoid external HTTP calls.
- Admin user is registered and authenticated, confirming auth endpoints and JWT issuance.
- Bunker is created, listed, and later updated to adjust the wind threshold mid-run.
- Device is provisioned and listed; bearer token authenticates all control/status calls.
- Simulated device posts telemetry 60 times (representing one hour of operation) and receives alternating shutdown guidance as weather and thresholds change.
- Database `device_status` row validates countdown, relay state, and uptime snapshots each cycle.
- Final device and bunker queries confirm live heartbeat, firmware version, and applied configuration changes.

## Sample Decision Log
| Minute | Wind (mph) | Shutdown Allowed | Reset Countdown | Reason |
|--------|------------|------------------|-----------------|--------|
| 01 | 25.0 | true | true | wind_conditions_favorable |
| 15 | 25.0 | true | true | wind_conditions_favorable |
| 30 | 25.0 | true | true | wind_conditions_favorable |
| 31 | 5.0 | false | false | default_safe |
| 45 | 5.0 | false | false | default_safe |
| 60 | 5.0 | false | false | default_safe |

## Running the Test
1. `cd server`
2. Ensure Python 3.10+ is active (Python 3.9 lacks support for `typing` union syntax used by FastAPI models).
3. Start a PostgreSQL instance and set `TEST_DATABASE_URL` (e.g. run `docker compose up db` from repo root; database URL defaults to `postgresql+asyncpg://bunker:bunker@localhost:5432/bunkercolab_test`).
4. `python3 -m pytest tests/test_end_to_end_integration.py`
5. Review pytest output for the per-minute decision stream noted above (captured via assertions).
