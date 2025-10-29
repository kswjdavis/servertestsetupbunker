# Relay Cycling & Duration Tracking

**Implemented:** October 29, 2025
**Purpose:** Track fan ON/OFF durations and cycling patterns for energy savings analysis

---

## ✅ What You Can Now Track

### 1. **Total Runtime**
```
- Hours fans were ON
- Hours fans were OFF
- % time ON vs OFF
```

### 2. **Cycling Frequency**
```
- Total state changes
- Changes per hour
- Changes to ON vs changes to OFF
```

### 3. **Duration Distribution (5-Minute Buckets)**
```
For both ON and OFF states:
- 0-5 minutes
- 5-10 minutes
- 10-15 minutes
- 15-20 minutes
- 20-30 minutes
- 30-60 minutes
- 1-2 hours
- 2-4 hours
- 4+ hours
```

### 4. **Individual State Durations**
```
- Every state change with exact duration
- Longest ON period
- Longest OFF period
- Average ON duration
- Average OFF duration
```

### 5. **Energy Savings**
```
- Total kWh saved (fans OFF time × 1.5 kW)
- Dollar savings ($0.12/kWh)
```

---

## 📊 Sample Output

### From Relay Analytics Script

```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/relay_analytics.sh'
```

**Example Output:**
```
⏱️  TOTAL FAN RUNTIME
hours_ON  hours_OFF  total_hours  pct_ON
--------  ---------  -----------  ------
0.42      0.0        0.42         100.0%

🔄 CYCLING FREQUENCY
total_changes  changes_to_ON  changes_to_OFF  changes_per_hour
-------------  -------------  --------------  ----------------
2              1              1               0.08

📊 DURATION DISTRIBUTION (5-minute buckets)
State: ON (Fans Running)
duration_range  occurrences  total_hours
--------------  -----------  -----------
20-30 min       1            0.42

State: OFF (Fans Stopped)
duration_range  occurrences  total_hours
--------------  -----------  -----------
Current State   1            0.0

📜 RECENT STATE CHANGES (Last 10)
state_change_at             state  triggered_by    duration
--------------------------  -----  --------------  --------
2025-10-29T14:53:21+00:00Z  OFF    server_command  Current
2025-10-29T14:28:00+00:00Z  ON     server_command  25.4 min

🏆 LONGEST DURATIONS
Longest ON period:
state_change_at             hours  triggered_by
--------------------------  -----  --------------
2025-10-29T14:28:00+00:00Z  0.42   server_command

📈 AVERAGE DURATIONS
state  cycles  avg_minutes  min_minutes  max_minutes
-----  ------  -----------  -----------  -----------
ON     1       25.4         25.4         25.4

💰 ENERGY SAVINGS ESTIMATE
(Based on 1.5 kW fan, $0.12/kWh)
hours_saved  kWh_saved  dollars_saved
-----------  ---------  -------------
0.0          0.0        $0.00
```

---

## 🎯 Use Cases

### 1. **Detect Excessive Cycling**
**Problem:** Too many short ON/OFF cycles wear out relay
**Solution:** Look at duration distribution
```
If most durations are in "0-5 min" bucket → Excessive cycling
If most durations are in "30-60 min" bucket → Good cycling
```

### 2. **Calculate Energy Savings**
**Problem:** Need to justify system cost
**Solution:** Use energy savings estimate
```
After 30 days:
hours_OFF × 1.5 kW × $0.12/kWh = Total savings
```

### 3. **Verify Server Control**
**Problem:** Is server actually controlling the fan?
**Solution:** Check triggered_by field
```
If all = "fail_safe" → Server not working
If mix of "server_command" and "fail_safe" → Working as designed
```

### 4. **Identify Optimal Wind Thresholds**
**Problem:** Are wind thresholds set correctly?
**Solution:** Analyze duration patterns
```
If lots of 0-5 min cycles → Threshold too sensitive
If fans never turn OFF → Threshold too high
```

---

## 📈 Expected Patterns

### **Healthy Operation**
```
✅ Duration distribution: Mix of time ranges
✅ Average ON: 30-120 minutes
✅ Average OFF: 15-60 minutes
✅ Cycling: 10-20 changes per day
✅ Triggered by: Mix of server_command and occasional fail_safe
```

### **Excessive Cycling (Problem)**
```
⚠️ Duration distribution: Mostly 0-5 min bucket
⚠️ Average ON: <10 minutes
⚠️ Average OFF: <5 minutes
⚠️ Cycling: >50 changes per day
⚠️ Cause: Wind threshold too sensitive
```

### **No Control (Problem)**
```
❌ Duration distribution: All in "4+ hours" bucket
❌ Average ON: Hours
❌ Average OFF: Never
❌ Cycling: <2 changes per day
❌ Cause: Wind threshold too high or server not responding
```

---

## 🔍 Key Queries

### Total Runtime Summary
```sql
SELECT
    SUM(CASE WHEN new_state = 1 THEN duration_seconds ELSE 0 END) / 3600.0 as hours_ON,
    SUM(CASE WHEN new_state = 0 THEN duration_seconds ELSE 0 END) / 3600.0 as hours_OFF
FROM relay_operations
WHERE duration_seconds IS NOT NULL;
```

### Cycling by Day
```sql
SELECT
    DATE(state_change_at) as date,
    COUNT(*) as cycles,
    SUM(CASE WHEN new_state=0 THEN duration_seconds ELSE 0 END)/3600.0 as hours_saved
FROM relay_operations
GROUP BY DATE(state_change_at)
ORDER BY date;
```

### Short Cycles (Potential Problem)
```sql
SELECT
    state_change_at,
    CASE WHEN new_state=1 THEN 'ON' ELSE 'OFF' END as state,
    duration_seconds / 60.0 as minutes
FROM relay_operations
WHERE duration_seconds < 300  -- Less than 5 minutes
ORDER BY state_change_at DESC;
```

### Energy Savings by Week
```sql
SELECT
    strftime('%Y-W%W', state_change_at) as week,
    SUM(CASE WHEN new_state=0 THEN duration_seconds ELSE 0 END)/3600.0 * 1.5 * 0.12 as dollars_saved
FROM relay_operations
WHERE duration_seconds IS NOT NULL
GROUP BY week
ORDER BY week;
```

---

## 📊 Dashboard Integration

The main dashboard now includes relay runtime summary:

```
⚡ RELAY RUNTIME SUMMARY
hours_ON  hours_OFF  total_changes  pct_ON
--------  ---------  -------------  ------
0.42      0.0        2              100.0%

⚡ RECENT RELAY OPERATIONS
state_change_at             state  triggered_by    duration
--------------------------  -----  --------------  --------
2025-10-29T14:53:21+00:00Z  OFF    server_command  Current
2025-10-29T14:28:00+00:00Z  ON     server_command  25.4 min
```

---

## 🚀 Quick Commands

### View Full Relay Analytics
```bash
ssh bunker@192.168.1.187 '/opt/bunker-monitor/relay_analytics.sh'
```

### Export Relay Data to CSV
```bash
ssh bunker@192.168.1.187 'sqlite3 -header -csv /var/log/bunker/bunker_monitor.db "
SELECT
    state_change_at,
    CASE WHEN new_state=1 THEN \"ON\" ELSE \"OFF\" END as state,
    duration_seconds / 60.0 as duration_minutes,
    duration_seconds / 3600.0 as duration_hours,
    triggered_by,
    notes
FROM relay_operations
ORDER BY state_change_at;
"' > relay_timeline.csv
```

### Total Energy Saved
```bash
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "
SELECT
    ROUND(SUM(CASE WHEN new_state=0 THEN duration_seconds ELSE 0 END)/3600.0, 2) as hours_saved,
    ROUND(SUM(CASE WHEN new_state=0 THEN duration_seconds ELSE 0 END)/3600.0 * 1.5 * 0.12, 2) as dollars_saved
FROM relay_operations;
"'
```

---

## 💡 Analysis Tips

### 1. **After First Week**
Look for:
- Is average ON duration reasonable? (30-90 min typical)
- Are there any cycles < 5 minutes? (may indicate threshold issues)
- What % of time are fans OFF? (target: 20-40% for good savings)

### 2. **After First Month**
Calculate:
- Total dollars saved
- Average cycles per day
- Longest continuous ON period (reliability check)
- Distribution of durations (cycling pattern)

### 3. **Compare to Baseline**
```
Baseline: Fans always ON = 720 hours/month
Actual: Fans ON = X hours/month
Savings: (720 - X) hours × 1.5 kW × $0.12/kWh
```

---

## 📝 Database Schema

### relay_operations Table
```sql
CREATE TABLE relay_operations (
    id INTEGER PRIMARY KEY,
    state_change_at TEXT NOT NULL,        -- When state changed
    new_state INTEGER NOT NULL,           -- 0=OFF, 1=ON
    triggered_by TEXT,                    -- "server_command" or "fail_safe"
    notes TEXT,                           -- Original log message
    duration_seconds INTEGER              -- How long this state lasted
);
```

**Notes:**
- `duration_seconds` is calculated when the NEXT state change occurs
- Current state has `duration_seconds = NULL` (still in progress)
- Duration is backwards-looking (how long were we in this state before changing)

---

## ✅ Validation

**Test the system is working:**
```bash
# Check relay operations exist
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT COUNT(*) FROM relay_operations;"'

# Should show at least 2 records

# Check durations are being calculated
ssh bunker@192.168.1.187 'sqlite3 /var/log/bunker/bunker_monitor.db "SELECT state_change_at, duration_seconds FROM relay_operations ORDER BY state_change_at;"'

# Earlier records should have duration_seconds
# Current state should have NULL
```

---

## 🎯 Success Metrics (After 30 Days)

### **Excellent Performance**
- Energy Savings: 30-50% (fans OFF 30-50% of the time)
- Average Cycle Duration: 30-90 minutes
- Cycling Frequency: 10-20 changes/day
- Fail-Safe Activations: <5% of changes

### **Good Performance**
- Energy Savings: 20-30%
- Average Cycle Duration: 15-60 minutes
- Cycling Frequency: 20-30 changes/day
- Fail-Safe Activations: <10% of changes

### **Needs Improvement**
- Energy Savings: <20%
- Average Cycle Duration: <10 minutes
- Cycling Frequency: >40 changes/day
- Fail-Safe Activations: >20% of changes

---

**Ready for long-term tracking!** 🎉

The system will automatically track every relay state change with precise duration measurement, giving you complete visibility into fan cycling patterns and energy savings.
