#!/bin/bash
# Relay Cycling Analytics - Track fan ON/OFF patterns and durations

DB="/var/log/bunker/bunker_monitor.db"

echo "========================================"
echo "  RELAY CYCLING & DURATION ANALYTICS"
echo "========================================"
echo

# Total ON/OFF Time
echo "⏱️  TOTAL FAN RUNTIME"
sqlite3 -column -header "$DB" "
SELECT
    SUM(CASE WHEN new_state = 1 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 as hours_ON,
    SUM(CASE WHEN new_state = 0 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 as hours_OFF,
    SUM(COALESCE(duration_seconds, 0)) / 3600.0 as total_hours,
    ROUND(100.0 * SUM(CASE WHEN new_state = 1 THEN COALESCE(duration_seconds, 0) ELSE 0 END) /
          NULLIF(SUM(COALESCE(duration_seconds, 0)), 0), 1) || '%' as pct_ON
FROM relay_operations;
"
echo

# State Change Count
echo "🔄 CYCLING FREQUENCY"
sqlite3 -column -header "$DB" "
SELECT
    COUNT(*) as total_changes,
    SUM(CASE WHEN new_state = 1 THEN 1 ELSE 0 END) as changes_to_ON,
    SUM(CASE WHEN new_state = 0 THEN 1 ELSE 0 END) as changes_to_OFF,
    ROUND(COUNT(*) * 1.0 / NULLIF((
        SELECT (JULIANDAY(MAX(state_change_at)) - JULIANDAY(MIN(state_change_at))) * 24
        FROM relay_operations
    ), 0), 2) as changes_per_hour
FROM relay_operations;
"
echo

# Duration Distribution (5-minute buckets)
echo "📊 DURATION DISTRIBUTION (5-minute buckets)"
echo "State: ON (Fans Running)"
sqlite3 -column -header "$DB" "
WITH buckets AS (
    SELECT
        CASE
            WHEN duration_seconds IS NULL THEN 'Current State'
            WHEN duration_seconds < 300 THEN '0-5 min'
            WHEN duration_seconds < 600 THEN '5-10 min'
            WHEN duration_seconds < 900 THEN '10-15 min'
            WHEN duration_seconds < 1200 THEN '15-20 min'
            WHEN duration_seconds < 1800 THEN '20-30 min'
            WHEN duration_seconds < 3600 THEN '30-60 min'
            WHEN duration_seconds < 7200 THEN '1-2 hours'
            WHEN duration_seconds < 14400 THEN '2-4 hours'
            ELSE '4+ hours'
        END as bucket,
        CASE
            WHEN duration_seconds IS NULL THEN 1
            WHEN duration_seconds < 300 THEN 1
            WHEN duration_seconds < 600 THEN 2
            WHEN duration_seconds < 900 THEN 3
            WHEN duration_seconds < 1200 THEN 4
            WHEN duration_seconds < 1800 THEN 5
            WHEN duration_seconds < 3600 THEN 6
            WHEN duration_seconds < 7200 THEN 7
            WHEN duration_seconds < 14400 THEN 8
            ELSE 9
        END as sort_order,
        duration_seconds
    FROM relay_operations
    WHERE new_state = 1
)
SELECT
    bucket as duration_range,
    COUNT(*) as occurrences,
    ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 2) as total_hours
FROM buckets
GROUP BY bucket, sort_order
ORDER BY sort_order;
"
echo

echo "State: OFF (Fans Stopped)"
sqlite3 -column -header "$DB" "
WITH buckets AS (
    SELECT
        CASE
            WHEN duration_seconds IS NULL THEN 'Current State'
            WHEN duration_seconds < 300 THEN '0-5 min'
            WHEN duration_seconds < 600 THEN '5-10 min'
            WHEN duration_seconds < 900 THEN '10-15 min'
            WHEN duration_seconds < 1200 THEN '15-20 min'
            WHEN duration_seconds < 1800 THEN '20-30 min'
            WHEN duration_seconds < 3600 THEN '30-60 min'
            WHEN duration_seconds < 7200 THEN '1-2 hours'
            WHEN duration_seconds < 14400 THEN '2-4 hours'
            ELSE '4+ hours'
        END as bucket,
        CASE
            WHEN duration_seconds IS NULL THEN 1
            WHEN duration_seconds < 300 THEN 1
            WHEN duration_seconds < 600 THEN 2
            WHEN duration_seconds < 900 THEN 3
            WHEN duration_seconds < 1200 THEN 4
            WHEN duration_seconds < 1800 THEN 5
            WHEN duration_seconds < 3600 THEN 6
            WHEN duration_seconds < 7200 THEN 7
            WHEN duration_seconds < 14400 THEN 8
            ELSE 9
        END as sort_order,
        duration_seconds
    FROM relay_operations
    WHERE new_state = 0
)
SELECT
    bucket as duration_range,
    COUNT(*) as occurrences,
    ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 2) as total_hours
FROM buckets
GROUP BY bucket, sort_order
ORDER BY sort_order;
"
echo

# Recent State Changes
echo "📜 RECENT STATE CHANGES (Last 10)"
sqlite3 -column -header "$DB" "
SELECT
    state_change_at,
    CASE WHEN new_state = 1 THEN 'ON' ELSE 'OFF' END as state,
    triggered_by,
    CASE
        WHEN duration_seconds IS NULL THEN 'Current'
        WHEN duration_seconds < 60 THEN duration_seconds || ' sec'
        WHEN duration_seconds < 3600 THEN ROUND(duration_seconds / 60.0, 1) || ' min'
        ELSE ROUND(duration_seconds / 3600.0, 2) || ' hrs'
    END as duration
FROM relay_operations
ORDER BY state_change_at DESC
LIMIT 10;
"
echo

# Longest ON/OFF Periods
echo "🏆 LONGEST DURATIONS"
echo "Longest ON period:"
sqlite3 -column -header "$DB" "
SELECT
    state_change_at,
    ROUND(duration_seconds / 3600.0, 2) as hours,
    triggered_by,
    SUBSTR(notes, 1, 40) as notes
FROM relay_operations
WHERE new_state = 1 AND duration_seconds IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 1;
"
echo

echo "Longest OFF period:"
sqlite3 -column -header "$DB" "
SELECT
    state_change_at,
    ROUND(duration_seconds / 3600.0, 2) as hours,
    triggered_by,
    SUBSTR(notes, 1, 40) as notes
FROM relay_operations
WHERE new_state = 0 AND duration_seconds IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 1;
"
echo

# Average Cycle Duration
echo "📈 AVERAGE DURATIONS"
sqlite3 -column -header "$DB" "
SELECT
    CASE WHEN new_state = 1 THEN 'ON' ELSE 'OFF' END as state,
    COUNT(*) as cycles,
    ROUND(AVG(duration_seconds) / 60.0, 1) as avg_minutes,
    ROUND(MIN(duration_seconds) / 60.0, 1) as min_minutes,
    ROUND(MAX(duration_seconds) / 60.0, 1) as max_minutes
FROM relay_operations
WHERE duration_seconds IS NOT NULL
GROUP BY new_state;
"
echo

# Energy Savings Estimate
echo "💰 ENERGY SAVINGS ESTIMATE"
echo "(Based on 1.5 kW fan, \$0.12/kWh)"
sqlite3 -column "$DB" "
SELECT
    ROUND(SUM(CASE WHEN new_state = 0 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0, 2) as hours_saved,
    ROUND(SUM(CASE WHEN new_state = 0 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 * 1.5, 2) as kWh_saved,
    ROUND(SUM(CASE WHEN new_state = 0 THEN COALESCE(duration_seconds, 0) ELSE 0 END) / 3600.0 * 1.5 * 0.12, 2) as dollars_saved
FROM relay_operations;
"
echo

echo "========================================"
echo "Report generated: $(date)"
echo "Database: $DB"
echo "========================================"
