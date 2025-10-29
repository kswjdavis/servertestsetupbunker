#!/bin/bash
# Raspberry Pi Database Query Helper
# Provides functions to query the Pi monitoring database via SSH

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$SCRIPT_DIR/config/hardware-test-config.json}"

# Load configuration
PI_HOST=$(jq -r '.raspberryPi.host' "$CONFIG_FILE")
PI_USER=$(jq -r '.raspberryPi.user' "$CONFIG_FILE")
PI_DB_PATH=$(jq -r '.raspberryPi.dbPath' "$CONFIG_FILE")

# Helper function to execute SQL query on Pi
query_pi_db() {
    local query="$1"
    ssh "${PI_USER}@${PI_HOST}" "sqlite3 -json ${PI_DB_PATH} \"${query}\""
}

# Get recent relay operations
get_relay_events() {
    local limit="${1:-10}"
    local since_minutes="${2:-60}"

    query_pi_db "
        SELECT
            state_change_at,
            new_state,
            triggered_by,
            server_decision,
            duration_seconds
        FROM relay_operations
        WHERE state_change_at > datetime('now', '-${since_minutes} minutes')
        ORDER BY state_change_at DESC
        LIMIT ${limit};
    "
}

# Get serial logs matching pattern
get_serial_logs() {
    local pattern="$1"
    local limit="${2:-20}"
    local since_minutes="${3:-60}"

    query_pi_db "
        SELECT
            recorded_at,
            tag,
            message
        FROM serial_logs
        WHERE message LIKE '%${pattern}%'
        AND recorded_at > datetime('now', '-${since_minutes} minutes')
        ORDER BY recorded_at DESC
        LIMIT ${limit};
    "
}

# Get ESP32 telemetry data
get_telemetry() {
    local limit="${1:-10}"

    query_pi_db "
        SELECT
            recorded_at,
            free_heap_bytes,
            wifi_rssi,
            countdown_timer_remaining,
            uptime_seconds
        FROM esp32_telemetry
        ORDER BY recorded_at DESC
        LIMIT ${limit};
    "
}

# Check for watchdog resets
get_watchdog_resets() {
    local since_minutes="${1:-1440}"  # Default 24 hours

    query_pi_db "
        SELECT
            reboot_at,
            reset_reason,
            reset_count
        FROM esp32_reboots
        WHERE reset_reason = 'watchdog_reset'
        AND reboot_at > datetime('now', '-${since_minutes} minutes')
        ORDER BY reboot_at DESC;
    "
}

# Get network failures
get_network_failures() {
    local limit="${1:-10}"
    local since_minutes="${2:-60}"

    query_pi_db "
        SELECT
            failure_at,
            failure_type,
            error_message
        FROM network_failures
        WHERE failure_at > datetime('now', '-${since_minutes} minutes')
        ORDER BY failure_at DESC
        LIMIT ${limit};
    "
}

# Get GPIO events (relay + LED state changes)
get_gpio_events() {
    local pin="${1:-17}"  # Default to relay pin
    local limit="${2:-20}"
    local since_minutes="${3:-60}"

    query_pi_db "
        SELECT
            event_at,
            bcm_pin,
            new_state,
            duration_seconds
        FROM gpio_events
        WHERE bcm_pin = ${pin}
        AND event_at > datetime('now', '-${since_minutes} minutes')
        ORDER BY event_at DESC
        LIMIT ${limit};
    "
}

# Get latest heartbeat
get_heartbeat() {
    query_pi_db "
        SELECT
            heartbeat_at,
            cpu_temp_c,
            memory_used_percent,
            disk_used_percent,
            wifi_rssi_dbm
        FROM heartbeats
        ORDER BY heartbeat_at DESC
        LIMIT 1;
    "
}

# Wait for specific GPIO state change (polling)
wait_for_gpio_change() {
    local pin="$1"
    local expected_state="$2"  # 0 or 1
    local timeout_seconds="${3:-65}"
    local poll_interval="${4:-2}"

    local start_time=$(date +%s)

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout_seconds ]; then
            echo "TIMEOUT: GPIO pin ${pin} did not change to state ${expected_state} within ${timeout_seconds}s"
            return 1
        fi

        # Check latest GPIO event
        local latest_state=$(query_pi_db "
            SELECT new_state
            FROM gpio_events
            WHERE bcm_pin = ${pin}
            ORDER BY event_at DESC
            LIMIT 1;
        " | jq -r '.[0].new_state // "null"')

        if [ "$latest_state" == "$expected_state" ]; then
            echo "SUCCESS: GPIO pin ${pin} changed to state ${expected_state} after ${elapsed}s"
            return 0
        fi

        sleep $poll_interval
    done
}

# Get full system status summary
get_system_status() {
    echo "=== ESP32 Telemetry (Latest) ==="
    get_telemetry 1 | jq '.'

    echo ""
    echo "=== Relay Operations (Last 5) ==="
    get_relay_events 5 10 | jq '.'

    echo ""
    echo "=== Watchdog Resets (Last 24h) ==="
    local resets=$(get_watchdog_resets 1440)
    if [ "$resets" == "[]" ]; then
        echo "No watchdog resets"
    else
        echo "$resets" | jq '.'
    fi

    echo ""
    echo "=== Network Failures (Last hour) ==="
    local failures=$(get_network_failures 10 60)
    if [ "$failures" == "[]" ]; then
        echo "No network failures"
    else
        echo "$failures" | jq '.'
    fi

    echo ""
    echo "=== Pi Heartbeat (Latest) ==="
    get_heartbeat | jq '.'
}

# Export functions if sourced
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    export -f query_pi_db get_relay_events get_serial_logs get_telemetry
    export -f get_watchdog_resets get_network_failures get_gpio_events
    export -f get_heartbeat wait_for_gpio_change get_system_status
fi

# If executed directly, run the command passed as argument
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <function_name> [args...]"
        echo "Available functions:"
        echo "  get_relay_events [limit] [since_minutes]"
        echo "  get_serial_logs <pattern> [limit] [since_minutes]"
        echo "  get_telemetry [limit]"
        echo "  get_watchdog_resets [since_minutes]"
        echo "  get_network_failures [limit] [since_minutes]"
        echo "  get_gpio_events [pin] [limit] [since_minutes]"
        echo "  get_heartbeat"
        echo "  wait_for_gpio_change <pin> <expected_state> [timeout] [poll_interval]"
        echo "  get_system_status"
        exit 1
    fi

    "$@"
fi
