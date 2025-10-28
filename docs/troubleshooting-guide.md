# Troubleshooting Guide

Common recovery steps for Bunker Colab deployments. Work from the top and document actions taken for handoff between teams.

## ESP32 Not Connecting to Wi-Fi
- Confirm SSID and password stored in NVS match the deployment site.
- Check Wi-Fi signal strength or move closer to the access point.
- Reboot the ESP32: issue `esp_restart()` from the serial console or power-cycle.
- Review serial logs for DHCP, TLS, or DNS failures.

## Device Appears Offline in the Dashboard
- Inspect the device row for `last_seen` — should be less than 120 seconds.
- Verify the controller has network connectivity (ping gateway, check RSSI).
- Ensure the backend is reachable: `curl https://<server>/api/healthz`.
- Examine ESP32 logs for watchdog resets or HTTP 401 responses.

## Authentication Failures
- Confirm the auth token stored in NVS matches the value in PostgreSQL.
- Check token expiration and regenerate via provisioning if necessary.
- Redeploy firmware and reprovision when field replacement is needed.

## Weather Data Not Updating
- Review aviation.weather.gov status for outages.
- Verify `WEATHER_STATION_ID` and API credentials in `server/.env`.
- Check FastAPI logs for 4xx/5xx responses from the weather service.

## Fans Not Turning Off
- Fail-safe design forces fans ON when communication is lost — verify timer expirations.
- Confirm wind speed is below the shutdown threshold and no manual overrides exist.
- Inspect dead-man timer metrics in the backend (`/api/control/status` endpoint).

## Deployment or Upgrade Issues
- Validate migrations ran: `alembic history --verbose` and `alembic current`.
- Check system services: `systemctl status bunkercolab` and `journalctl -u bunkercolab -f`.
- Confirm Nginx routing: `sudo nginx -t` and check `/var/log/nginx/bunkercolab.error.log`.

## Reporting
- Log issue summaries, steps taken, and resolution in `docs/stories/<story>.md` debug logs.
- When escalating, attach backend logs, device serial captures, and exact timestamps.
