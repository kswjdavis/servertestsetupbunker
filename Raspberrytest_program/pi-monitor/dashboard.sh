#!/bin/bash
# ESP32 Long-Term Monitoring Dashboard
# Shows comprehensive status and analytics for extended testing

DB="/var/log/bunker/bunker_monitor.db"

echo "========================================"
echo "  ESP32 LONG-TERM MONITORING DASHBOARD"
echo "========================================"
echo

# Test Duration
echo "📅 TEST DURATION"
sqlite3 -column "$DB" "
SELECT
    MIN(recorded_at) as start_time,
    MAX(recorded_at) as last_activity,
    ROUND((JULIANDAY(MAX(recorded_at)) - JULIANDAY(MIN(recorded_at))) * 24, 2) || ' hours' as duration
FROM serial_logs;
"
echo

# Current Status
echo "🔍 CURRENT STATUS"
sqlite3 -column "$DB" "
SELECT
    CASE WHEN serial_connected=1 THEN '✅ Connected' ELSE '❌ Disconnected' END as serial,
    CASE WHEN gpio_ok=1 THEN '✅ Active' ELSE '❌ Inactive' END as gpio,
    recorded_at as last_heartbeat
FROM heartbeats
ORDER BY recorded_at DESC LIMIT 1;
"
echo

# Record Counts
echo "📊 DATA COLLECTED"
sqlite3 -column -header "$DB" "
SELECT
    (SELECT COUNT(*) FROM serial_logs) as serial_logs,
    (SELECT COUNT(*) FROM gpio_events) as gpio_events,
    (SELECT COUNT(*) FROM system_metrics) as pi_health,
    (SELECT COUNT(*) FROM heartbeats) as heartbeats,
    (SELECT COUNT(*) FROM esp32_telemetry) as telemetry,
    (SELECT COUNT(*) FROM esp32_reboots) as reboots,
    (SELECT COUNT(*) FROM network_failures) as net_failures,
    (SELECT COUNT(*) FROM relay_operations) as relay_ops;
"
echo

# ESP32 Health
echo "💚 ESP32 HEALTH"
sqlite3 -column -header "$DB" "
SELECT
    recorded_at,
    free_heap_bytes,
    uptime_seconds
FROM esp32_telemetry
ORDER BY recorded_at DESC LIMIT 5;
"
echo

# Reboots
REBOOT_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM esp32_reboots;")
if [ "$REBOOT_COUNT" -gt 0 ]; then
    echo "🔄 REBOOTS (Total: $REBOOT_COUNT)"
    sqlite3 -column -header "$DB" "
    SELECT
        detected_at,
        reset_reason,
        uptime_before_reboot,
        watchdog_reset_count,
        notes
    FROM esp32_reboots
    ORDER BY detected_at DESC LIMIT 10;
    "
    echo
else
    echo "🔄 REBOOTS: ✅ None detected"
    echo
fi

# Network Failures
FAILURE_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM network_failures;")
if [ "$FAILURE_COUNT" -gt 0 ]; then
    echo "🌐 NETWORK FAILURES (Total: $FAILURE_COUNT)"
    sqlite3 -column -header "$DB" "
    SELECT
        failure_at,
        failure_type,
        tag,
        SUBSTR(error_message, 1, 50) as error
    FROM network_failures
    ORDER BY failure_at DESC LIMIT 10;
    "
    echo
else
    echo "🌐 NETWORK FAILURES: ✅ None detected"
    echo
fi

# Relay Operations & Runtime
echo "⚡ RELAY RUNTIME SUMMARY"
sqlite3 -column -header "$DB" "
SELECT
    SUM(CASE WHEN new_state = 1 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 as hours_ON,
    SUM(CASE WHEN new_state = 0 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 as hours_OFF,
    COUNT(*) as total_changes,
    ROUND(100.0 * SUM(CASE WHEN new_state = 1 THEN COALESCE(duration_seconds, 0) ELSE 0 END) /
          NULLIF(SUM(COALESCE(duration_seconds, 0)), 0), 1) || '%' as pct_ON
FROM relay_operations;
"
echo

echo "⚡ RECENT RELAY OPERATIONS"
sqlite3 -column -header "$DB" "
SELECT
    state_change_at,
    CASE WHEN new_state=1 THEN 'ON' ELSE 'OFF' END as state,
    triggered_by,
    CASE
        WHEN duration_seconds IS NULL THEN 'Current'
        WHEN duration_seconds < 60 THEN duration_seconds || ' sec'
        WHEN duration_seconds < 3600 THEN ROUND(duration_seconds / 60.0, 1) || ' min'
        ELSE ROUND(duration_seconds / 3600.0, 2) || ' hrs'
    END as duration
FROM relay_operations
ORDER BY state_change_at DESC LIMIT 10;
"
echo

# Error Summary
echo "❌ ERROR SUMMARY"
sqlite3 -column -header "$DB" "
SELECT
    tag,
    COUNT(*) as count,
    SUBSTR(message, 1, 50) as sample_message
FROM serial_logs
WHERE level = 'E'
GROUP BY tag, message
ORDER BY count DESC
LIMIT 10;
"
echo

# Warning Summary
WARNING_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM serial_logs WHERE level='W';")
if [ "$WARNING_COUNT" -gt 0 ]; then
    echo "⚠️  WARNING SUMMARY (Total: $WARNING_COUNT)"
    sqlite3 -column -header "$DB" "
    SELECT
        tag,
        COUNT(*) as count,
        SUBSTR(message, 1, 50) as sample_message
    FROM serial_logs
    WHERE level = 'W'
    GROUP BY tag, message
    ORDER BY count DESC
    LIMIT 5;
    "
    echo
fi

# Pi Health Summary
echo "🥧 RASPBERRY PI HEALTH"
sqlite3 -column -header "$DB" "
SELECT
    ROUND(MIN(cpu_temp_c), 1) || '°C' as min_temp,
    ROUND(AVG(cpu_temp_c), 1) || '°C' as avg_temp,
    ROUND(MAX(cpu_temp_c), 1) || '°C' as max_temp,
    MIN(wifi_rssi_dbm) as worst_wifi,
    ROUND(AVG(wifi_rssi_dbm)) as avg_wifi,
    ROUND(AVG(mem_used_percent), 1) || '%' as avg_mem
FROM system_metrics;
"
echo

# Uptime Calculation
echo "⏱️  UPTIME ANALYSIS"
sqlite3 -column -header "$DB" "
SELECT
    ROUND(100.0 * SUM(CASE WHEN serial_connected=1 THEN 1 ELSE 0 END) / COUNT(*), 2) || '%' as uptime_pct,
    SUM(CASE WHEN serial_connected=0 THEN 1 ELSE 0 END) as downtime_periods,
    COUNT(*) as total_heartbeats
FROM heartbeats;
"
echo

# Most Active Components
echo "🔧 MOST ACTIVE COMPONENTS"
sqlite3 -column -header "$DB" "
SELECT
    tag,
    COUNT(*) as messages,
    SUM(CASE WHEN level='I' THEN 1 ELSE 0 END) as info,
    SUM(CASE WHEN level='W' THEN 1 ELSE 0 END) as warnings,
    SUM(CASE WHEN level='E' THEN 1 ELSE 0 END) as errors
FROM serial_logs
WHERE tag IS NOT NULL
GROUP BY tag
ORDER BY messages DESC
LIMIT 10;
"
echo

echo "========================================"
echo "Dashboard generated: $(date)"
echo "Database: $DB"
echo "========================================"
