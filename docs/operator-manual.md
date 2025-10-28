# Operator Manual

Step-by-step guide for operating the Bunker Colab dashboard and managing ESP32 controllers.

## Logging In
1. Navigate to the deployed web application (for example `https://bunkercolab.example.com`).
2. Enter a valid username and password supplied by the operations team.
3. Select **Login** to access the dashboard.

## Dashboard Overview
- **Bunker Map:** Displays all bunkers with colored status indicators.
  - Green – all devices reporting healthy.
  - Yellow – partial outage (some devices offline or stale telemetry).
  - Red – critical outage (>30% devices offline or safety timers expired).
- **Global Controls:** Provides high-level status (wind thresholds, last weather update, system alerts).
- **Energy Savings:** Summarizes estimated savings compared to continuous fan operation.
- **Alerts Panel:** Lists current warnings and recommended operator actions.

## Managing Bunkers
### Create a Bunker
1. Select **Add Bunker**.
2. Provide bunker name, latitude/longitude, orientation, and fan count.
3. Save to create the bunker record.

### Edit Bunker Settings
1. Open the bunker detail page.
2. Update capacity, wind thresholds, or orientation as needed.
3. Save changes; updates take effect immediately on the backend.

## Provisioning Devices
1. On the bunker detail page, choose **Add Device**.
2. Enter the ESP32 MAC address and assign a fan position.
3. Record the displayed authentication token — it is shown only once.
4. Flash the firmware to the ESP32 (see `firmware/README.md`).
5. Configure Wi-Fi credentials and the saved auth token through the provisioning workflow (serial CLI or captive portal).

## Monitoring & Control
- Dashboard auto-refreshes with backend polling; ensure SSE/polling is enabled in browser settings.
- Selecting a bunker reveals per-device heartbeat, relay state, and fan overrides.
- Use **Override Window** to schedule manual fan runs when maintenance is required.

## Energy Savings Reports
- Navigate to **Reports → Energy**.
- Choose daily, weekly, or monthly view.
- Export CSV via the **Download CSV** button for offline analysis.

## Troubleshooting
- Reference `docs/troubleshooting-guide.md` for detailed recovery steps.
- When issues persist, collect device logs (serial output) and backend logs (`journalctl -u bunkercolab`) before escalating.
