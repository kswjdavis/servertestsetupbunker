#!/bin/bash
# Docker Backend Log Collector
# Captures and filters backend service logs for E2E test evidence

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$SCRIPT_DIR/config/hardware-test-config.json}"

# Load configuration
DOCKER_SERVICE=$(jq -r '.docker.serviceName' "$CONFIG_FILE")
EVIDENCE_DIR=$(jq -r '.testSettings.evidenceDir' "$CONFIG_FILE")
EVIDENCE_DIR="${SCRIPT_DIR}/${EVIDENCE_DIR}"

# Create evidence directory
mkdir -p "$EVIDENCE_DIR"

# Get logs since specified time
get_logs_since() {
    local since="${1:-10m}"  # Default 10 minutes
    local output_file="${2:-}"

    if [ -z "$output_file" ]; then
        docker logs "$DOCKER_SERVICE" --since "$since" 2>&1
    else
        docker logs "$DOCKER_SERVICE" --since "$since" 2>&1 > "$output_file"
        echo "Logs saved to: $output_file"
    fi
}

# Get logs with timestamp filter
get_logs_between() {
    local start_time="$1"  # ISO format or relative like "1h ago"
    local end_time="${2:-now}"
    local output_file="${3:-}"

    # Docker doesn't support end time, so we filter manually
    local logs=$(docker logs "$DOCKER_SERVICE" --since "$start_time" 2>&1)

    if [ "$end_time" != "now" ]; then
        # Would need to parse and filter - for now just return all since start
        logs=$(echo "$logs")
    fi

    if [ -z "$output_file" ]; then
        echo "$logs"
    else
        echo "$logs" > "$output_file"
        echo "Logs saved to: $output_file"
    fi
}

# Filter logs for device-specific events
filter_device_logs() {
    local device_mac="$1"
    local input="${2:-/dev/stdin}"

    if [ "$input" == "/dev/stdin" ]; then
        grep -i "$device_mac"
    else
        grep -i "$device_mac" "$input"
    fi
}

# Filter logs for API endpoint
filter_endpoint_logs() {
    local endpoint="$1"  # e.g. "/api/v1/control/status"
    local input="${2:-/dev/stdin}"

    if [ "$input" == "/dev/stdin" ]; then
        grep "$endpoint"
    else
        grep "$endpoint" "$input"
    fi
}

# Get error logs only
get_error_logs() {
    local since="${1:-10m}"

    docker logs "$DOCKER_SERVICE" --since "$since" 2>&1 | \
        grep -iE "(error|exception|failed|failure|critical)"
}

# Get logs for test run
collect_test_run_logs() {
    local test_name="$1"
    local since="${2:-30m}"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_file="$EVIDENCE_DIR/${test_name}_backend_${timestamp}.log"
    local error_file="$EVIDENCE_DIR/${test_name}_errors_${timestamp}.log"

    echo "Collecting logs for test: $test_name"

    # Get all logs
    get_logs_since "$since" "$log_file"

    # Get error logs
    get_error_logs "$since" > "$error_file" 2>&1 || echo "No errors found" > "$error_file"

    echo "Logs collected:"
    echo "  Full logs: $log_file"
    echo "  Error logs: $error_file"

    # Return summary
    local total_lines=$(wc -l < "$log_file")
    local error_lines=$(wc -l < "$error_file")

    echo ""
    echo "Summary:"
    echo "  Total log lines: $total_lines"
    echo "  Error lines: $error_lines"
}

# Monitor logs in real-time
monitor_logs() {
    local filter_pattern="${1:-}"

    if [ -z "$filter_pattern" ]; then
        docker logs -f "$DOCKER_SERVICE"
    else
        docker logs -f "$DOCKER_SERVICE" 2>&1 | grep -i "$filter_pattern"
    fi
}

# Get service status
get_service_status() {
    echo "=== Docker Service Status ==="
    docker ps --filter "name=$DOCKER_SERVICE" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo "=== Service Health ==="
    docker inspect "$DOCKER_SERVICE" --format '{{.State.Health.Status}}' 2>/dev/null || echo "No health check configured"

    echo ""
    echo "=== Recent Restarts ==="
    local restart_count=$(docker inspect "$DOCKER_SERVICE" --format '{{.RestartCount}}')
    echo "Restart count: $restart_count"
}

# Analyze logs for patterns
analyze_logs() {
    local since="${1:-30m}"

    echo "=== Log Analysis (Last $since) ==="

    local logs=$(get_logs_since "$since")

    echo ""
    echo "Status Report Counts:"
    echo "$logs" | grep -c "/api/v1/control/status" 2>/dev/null || echo "0"

    echo ""
    echo "Authentication Events:"
    echo "$logs" | grep -c "auth" 2>/dev/null || echo "0"

    echo ""
    echo "Database Queries:"
    echo "$logs" | grep -c "SELECT\|INSERT\|UPDATE" 2>/dev/null || echo "0"

    echo ""
    echo "HTTP Status Codes:"
    echo "$logs" | grep -oE "HTTP/[0-9.]+ [0-9]{3}" | sort | uniq -c | sort -nr

    echo ""
    echo "Error Summary:"
    local errors=$(echo "$logs" | grep -iE "(error|exception|failed)" | wc -l)
    echo "Total errors: $errors"

    if [ "$errors" -gt 0 ]; then
        echo ""
        echo "Recent errors:"
        echo "$logs" | grep -iE "(error|exception|failed)" | tail -5
    fi
}

# Export functions if sourced
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    export -f get_logs_since get_logs_between filter_device_logs filter_endpoint_logs
    export -f get_error_logs collect_test_run_logs monitor_logs get_service_status analyze_logs
fi

# If executed directly, run the command passed as argument
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <function_name> [args...]"
        echo "Available functions:"
        echo "  get_logs_since [since] [output_file]"
        echo "  get_logs_between <start_time> [end_time] [output_file]"
        echo "  filter_device_logs <device_mac> [input_file]"
        echo "  filter_endpoint_logs <endpoint> [input_file]"
        echo "  get_error_logs [since]"
        echo "  collect_test_run_logs <test_name> [since]"
        echo "  monitor_logs [filter_pattern]"
        echo "  get_service_status"
        echo "  analyze_logs [since]"
        exit 1
    fi

    "$@"
fi
