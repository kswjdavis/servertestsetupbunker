# Control Logic Cycling Risk Assessment

## Date: 2025-10-26

## Identified By: Jeff (Product Owner)

## Status: DOCUMENTED - Awaiting Decision

---

## Issue Summary

**Critical Gap:** Story 2.5 (Control Logic Engine) uses a simple threshold comparison that will cause rapid fan ON/OFF cycling when wind speed fluctuates near the configured threshold value.

**Severity:** HIGH - Operational impact on hardware longevity and system reliability

**Affected Component:** `server/app/services/control_logic_engine.py:81`

**Current Behavior:**
```python
if weather.wind_speed_mph >= threshold:
    return ShutdownDecision(shutdown_allowed=True, ...)
```

---

## Problem Description

### Scenario
- **Configured Threshold:** 15 mph (shutdown allowed when wind >= 15 mph)
- **Actual Wind Pattern:** Fluctuates between 14-16 mph with 60-second weather API refresh
- **Result:** Fans cycle ON → OFF → ON → OFF every 1-2 minutes

### Example Timeline
```
Time    Wind (mph)   Decision         Relay State   Fan State
------  -----------  ---------------  ------------  ----------
00:00   14.8         No shutdown      De-energized  ON
01:00   15.2         Shutdown OK      Energized     OFF
02:00   14.9         No shutdown      De-energized  ON
03:00   15.1         Shutdown OK      Energized     OFF
04:00   14.7         No shutdown      De-energized  ON
05:00   15.3         Shutdown OK      Energized     OFF
```

**Cycle Rate:** Up to 30 cycles/hour in worst case

---

## Impact Assessment

### Hardware Consequences

1. **Fan Motor Wear**
   - Inrush current on startup: 4-6× running current
   - Mechanical stress from repeated start/stop
   - Bearing wear from cyclic loading
   - **Expected Impact:** Premature motor failure (months vs. years)

2. **Relay Contact Degradation**
   - Arc erosion on each switching event
   - Contact welding risk (high inrush current)
   - **Expected Impact:** Relay failure within weeks of deployment

3. **Electrical System Stress**
   - Voltage sag on each motor start
   - Harmonic distortion from repeated inrush
   - Potential circuit breaker nuisance trips
   - **Expected Impact:** Electrical component failures, operational disruptions

4. **Tarp Vacuum Stability**
   - Repeated pressure cycling stresses tarp attachment
   - Increased risk of tarp detachment during transitions
   - **Expected Impact:** Primary failure mode this system aims to prevent

### Operational Consequences

- **Energy Savings Negated:** Motor startup consumes more energy than steady-state operation
- **Reduced Uptime:** Hardware failures require maintenance, reducing system availability
- **Operator Confidence:** Visible cycling behavior undermines trust in automation
- **Safety Risk:** Rapid cycling increases probability of tarp loss during transition

---

## Root Cause Analysis

### Why This Wasn't Caught Earlier

1. **Story 2.5 Acceptance Criteria** did not include anti-cycling requirements
2. **Unit Tests** validated threshold logic but not temporal behavior
3. **Integration Testing (Story 2.9)** simulated weather changes but not oscillating patterns
4. **PRD FR2** states "broadcast every 60 seconds when conditions meet threshold" but doesn't specify hysteresis

### Design Assumptions

The original design assumed:
- Wind speed changes would be gradual and sustained
- Threshold crossings would be infrequent
- Weather API data would be stable between readings

**Reality:** Wind is inherently variable, especially in Great Plains environment

---

## Industry Standard Solutions

### Option 1: Hysteresis (Dual Threshold) ⭐ RECOMMENDED

**Approach:** Use different thresholds for turning OFF vs. turning back ON

**Configuration:**
- **Shutdown Threshold:** 15 mph (user-configured)
- **Restart Threshold:** 12 mph (shutdown threshold - hysteresis gap)
- **Hysteresis Gap:** 3 mph (configurable per bunker or global)

**State Machine:**
```
Current State: FANS ON
  └─> Wind >= 15 mph → Transition to FANS OFF

Current State: FANS OFF
  └─> Wind < 12 mph → Transition to FANS ON
```

**Example Behavior:**
```
Time    Wind (mph)   Current State   Decision           Transition?
------  -----------  --------------  -----------------  -----------
00:00   14.8         ON              Below shutdown     No (stay ON)
01:00   15.2         ON              Above shutdown     Yes → OFF
02:00   14.9         OFF             Above restart      No (stay OFF)
03:00   15.1         OFF             Above restart      No (stay OFF)
04:00   14.7         OFF             Above restart      No (stay OFF)
05:00   11.8         OFF             Below restart      Yes → ON
```

**Pros:**
- Industry-standard control system approach (HVAC, industrial automation)
- Prevents oscillation at threshold boundary
- Configurable per bunker (different risk tolerances)
- No delay in response to actual condition changes
- Simple state machine (2 states, 2 transitions)

**Cons:**
- Requires database schema changes (add `wind_threshold_hysteresis_mph` column)
- Control logic becomes stateful (must track current relay state)
- Operators must understand "shutdown at 15, restart at 12" paradigm

**Implementation Complexity:** MEDIUM

---

### Option 2: Minimum Duration Timer ⭐ SIMPLE ALTERNATIVE

**Approach:** Require minimum time in each state before allowing transition

**Configuration:**
- **Minimum OFF Duration:** 5 minutes (fans stay OFF for at least 5 min)
- **Minimum ON Duration:** 3 minutes (fans stay ON for at least 3 min)

**State Machine:**
```
Transition to OFF → Start timer (5 min)
  └─> Cannot transition back to ON until timer expires

Transition to ON → Start timer (3 min)
  └─> Cannot transition back to OFF until timer expires
```

**Example Behavior:**
```
Time    Wind (mph)   Decision       Last Change   Elapsed   Allowed?   Action
------  -----------  -------------  ------------  --------  ---------  ------
00:00   14.8         No shutdown    -             -         -          ON
01:00   15.2         Shutdown OK    -             -         Yes        OFF (start 5-min timer)
02:00   14.9         No shutdown    01:00         1 min     No         Stay OFF (timer)
03:00   14.7         No shutdown    01:00         2 min     No         Stay OFF (timer)
06:30   14.5         No shutdown    01:00         5.5 min   Yes        ON (start 3-min timer)
07:00   15.3         Shutdown OK    06:30         0.5 min   No         Stay ON (timer)
09:45   15.1         Shutdown OK    06:30         3.25 min  Yes        OFF (start 5-min timer)
```

**Pros:**
- Simpler to implement (no hysteresis calculation)
- Directly addresses cycling problem
- Easy to explain to operators ("fans stay OFF for at least 5 minutes")
- No schema changes needed (use existing `device_status.updated_at`)

**Cons:**
- Less responsive to actual conditions (forced delays)
- Fans may stay ON during favorable winds (waiting for timer)
- Fans may stay OFF during unfavorable winds (waiting for timer)
- Suboptimal energy savings vs. hysteresis

**Implementation Complexity:** LOW-MEDIUM

---

### Option 3: Moving Average / Debounce Filter

**Approach:** Require multiple consecutive readings above/below threshold

**Configuration:**
- **Debounce Count:** 3 consecutive readings
- **Shutdown Decision:** Wind >= 15 mph for 3 consecutive polls (3 minutes)
- **Restart Decision:** Wind < 15 mph for 3 consecutive polls (3 minutes)

**State Machine:**
```
Track last N readings in memory/database
  └─> Shutdown allowed if all N readings >= threshold
  └─> Shutdown denied if any reading < threshold
```

**Example Behavior:**
```
Time    Wind (mph)   Last 3 Readings   All >= 15?   Decision
------  -----------  -----------------  -----------  -------------
00:00   14.8         [-, -, 14.8]       No           No shutdown
01:00   15.2         [-, 14.8, 15.2]    No           No shutdown
02:00   14.9         [14.8, 15.2, 14.9] No           No shutdown
03:00   15.1         [15.2, 14.9, 15.1] No           No shutdown
04:00   15.3         [14.9, 15.1, 15.3] No           No shutdown
05:00   15.4         [15.1, 15.3, 15.4] Yes          Shutdown OK
```

**Pros:**
- No configuration parameters needed (uses existing threshold)
- Filters transient spikes/dips in wind data
- Responsive to sustained conditions

**Cons:**
- Requires storing recent readings (database or memory)
- 3-minute delay before any state change (3 × 60-sec polling)
- Complexity in managing historical data
- Still has oscillation risk if wind stabilizes near threshold

**Implementation Complexity:** MEDIUM-HIGH

---

### Option 4: Combination - Hysteresis + Minimum Duration ⭐ MOST ROBUST

**Approach:** Apply both hysteresis and minimum duration timers

**Configuration:**
- **Shutdown Threshold:** 15 mph
- **Restart Threshold:** 12 mph (hysteresis)
- **Minimum OFF Duration:** 5 minutes
- **Minimum ON Duration:** 3 minutes

**Behavior:**
- Hysteresis prevents boundary oscillation
- Minimum duration prevents rapid cycling from other causes (sensor noise, API errors)

**Pros:**
- Belt-and-suspenders protection against multiple failure modes
- Most robust solution for production deployment
- Handles edge cases (sensor errors, API glitches)

**Cons:**
- Most complex implementation
- Requires both schema changes and state tracking
- Potential for "locked" states in edge cases

**Implementation Complexity:** HIGH

---

## Recommended Solution

### For MVP (Epic 2): Option 1 - Hysteresis

**Rationale:**
- Industry-standard approach with proven track record
- Addresses root cause (threshold boundary oscillation)
- Configurable per bunker (matches existing wind threshold pattern)
- Minimal operational delay (instant response to actual conditions)
- Simple state machine (ON/OFF with dual thresholds)

**Configuration Recommendation:**
- **Default Hysteresis Gap:** 3.0 mph (20% of typical 15 mph threshold)
- **Conservative Option:** 5.0 mph (33% gap - wider safety margin)
- **Aggressive Option:** 2.0 mph (13% gap - more responsive)

**Justification for 3 mph Default:**
- Large enough to prevent oscillation in normal wind variability
- Small enough to remain responsive to actual condition changes
- Matches typical weather station measurement precision (±1-2 mph)

### For Future Enhancement (Epic 5): Add Minimum Duration

**Rationale:**
- Additional protection layer for edge cases
- Configurable via UI alongside other operator settings
- Low implementation cost after hysteresis is in place

---

## Implementation Plan

### Option 1 (Hysteresis) - Detailed Steps

#### 1. Database Schema Changes

**File:** `server/alembic/versions/YYYYMMDD_add_hysteresis_config.py`

**Migration:**
```python
# Upgrade
op.add_column('bunkers', sa.Column('wind_threshold_hysteresis_mph', sa.Float(), nullable=True))
op.add_column('global_config', sa.Column('wind_threshold_hysteresis_mph', sa.Float(), nullable=True))

# Set default values
op.execute("UPDATE bunkers SET wind_threshold_hysteresis_mph = 3.0 WHERE wind_threshold_hysteresis_mph IS NULL")
op.execute("UPDATE global_config SET wind_threshold_hysteresis_mph = 3.0 WHERE wind_threshold_hysteresis_mph IS NULL")

# Downgrade
op.drop_column('bunkers', 'wind_threshold_hysteresis_mph')
op.drop_column('global_config', 'wind_threshold_hysteresis_mph')
```

#### 2. Model Updates

**File:** `server/app/models/bunker.py`
```python
class Bunker(Base):
    # ... existing fields ...
    wind_threshold_mph: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wind_threshold_hysteresis_mph: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # NEW
```

**File:** `server/app/models/global_config.py`
```python
class GlobalConfig(Base):
    # ... existing fields ...
    wind_threshold_mph: Mapped[float] = mapped_column(Float, nullable=False, default=15.0)
    wind_threshold_hysteresis_mph: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)  # NEW
```

#### 3. Control Logic Changes

**File:** `server/app/services/control_logic_engine.py`

**Current Logic (Line 81):**
```python
if weather.wind_speed_mph >= threshold:
    return ShutdownDecision(shutdown_allowed=True, ...)
```

**New Logic:**
```python
async def should_shutdown_fans(self, device_id: UUID, session: AsyncSession) -> ShutdownDecision:
    # ... existing checks (emergency, overrides) ...

    # Get current relay state from device_status
    device_status = await session.get(DeviceStatus, device_id)
    current_relay_state = device_status.relay_state if device_status else "ON"  # Default ON (fail-safe)

    # Get thresholds
    threshold = bunker.wind_threshold_mph or await self._get_global_threshold(session)
    hysteresis = bunker.wind_threshold_hysteresis_mph or await self._get_global_hysteresis(session)

    # Calculate state-dependent thresholds
    shutdown_threshold = threshold  # e.g., 15 mph
    restart_threshold = threshold - hysteresis  # e.g., 12 mph

    weather = weather_service.get_current_weather()
    wind_speed = weather.wind_speed_mph

    # State machine logic
    if current_relay_state == "ON":
        # Currently ON - check if we should turn OFF
        if wind_speed >= shutdown_threshold:
            logger.info(f"Shutdown allowed: wind {wind_speed:.1f} mph >= shutdown threshold {shutdown_threshold} mph")
            return ShutdownDecision(
                shutdown_allowed=True,
                reset_countdown=True,
                reason=f"wind_conditions_favorable (>= {shutdown_threshold} mph)"
            )
    else:  # current_relay_state == "OFF"
        # Currently OFF - check if we should turn back ON
        if wind_speed < restart_threshold:
            logger.info(f"Shutdown denied: wind {wind_speed:.1f} mph < restart threshold {restart_threshold} mph")
            return ShutdownDecision(
                shutdown_allowed=False,
                reset_countdown=False,
                reason=f"wind_below_restart_threshold (< {restart_threshold} mph)"
            )
        else:
            # Wind is between restart and shutdown thresholds - maintain current state (OFF)
            logger.info(f"Shutdown maintained: wind {wind_speed:.1f} mph in hysteresis band ({restart_threshold}-{shutdown_threshold} mph)")
            return ShutdownDecision(
                shutdown_allowed=True,
                reset_countdown=True,
                reason=f"wind_in_hysteresis_band (maintaining OFF state)"
            )

    # Default: fail-safe (no shutdown)
    return ShutdownDecision(
        shutdown_allowed=False,
        reset_countdown=False,
        reason="default_safe"
    )
```

**Helper Method:**
```python
async def _get_global_hysteresis(self, session: AsyncSession) -> float:
    """Get global wind threshold hysteresis from configuration."""
    config = await self._get_global_config(session)
    return getattr(config, 'wind_threshold_hysteresis_mph', 3.0)
```

#### 4. Schema Updates (API Response)

**File:** `server/app/schemas/bunker.py`
```python
class BunkerResponse(BaseModel):
    # ... existing fields ...
    wind_threshold_mph: Optional[float] = None
    wind_threshold_hysteresis_mph: Optional[float] = None  # NEW
```

#### 5. Unit Test Updates

**File:** `server/tests/test_control_logic_engine.py`

**New Test Cases:**
```python
@pytest.mark.asyncio
async def test_hysteresis_prevents_cycling_when_fans_off(session, bunker, device):
    """Test that fans stay OFF when wind is in hysteresis band."""
    bunker.wind_threshold_mph = 15.0
    bunker.wind_threshold_hysteresis_mph = 3.0
    session.add(bunker)

    # Set device status to OFF
    device_status = DeviceStatus(device_id=device.id, relay_state="OFF")
    session.add(device_status)
    await session.commit()

    # Wind is 14 mph (between restart threshold 12 and shutdown threshold 15)
    monkeypatch.setattr(weather_service, 'get_current_weather',
                       lambda: WeatherData(wind_speed_mph=14.0, wind_direction_deg=180))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, session)

    assert decision.shutdown_allowed is True  # Stay OFF (maintain state)
    assert decision.reset_countdown is True
    assert "hysteresis" in decision.reason.lower()

@pytest.mark.asyncio
async def test_hysteresis_allows_shutdown_when_above_threshold(session, bunker, device):
    """Test that fans turn OFF when wind exceeds shutdown threshold."""
    bunker.wind_threshold_mph = 15.0
    bunker.wind_threshold_hysteresis_mph = 3.0
    session.add(bunker)

    # Set device status to ON
    device_status = DeviceStatus(device_id=device.id, relay_state="ON")
    session.add(device_status)
    await session.commit()

    # Wind is 16 mph (above shutdown threshold 15)
    monkeypatch.setattr(weather_service, 'get_current_weather',
                       lambda: WeatherData(wind_speed_mph=16.0, wind_direction_deg=180))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, session)

    assert decision.shutdown_allowed is True
    assert decision.reset_countdown is True
    assert "favorable" in decision.reason.lower()

@pytest.mark.asyncio
async def test_hysteresis_requires_restart_below_restart_threshold(session, bunker, device):
    """Test that fans turn back ON when wind drops below restart threshold."""
    bunker.wind_threshold_mph = 15.0
    bunker.wind_threshold_hysteresis_mph = 3.0
    session.add(bunker)

    # Set device status to OFF
    device_status = DeviceStatus(device_id=device.id, relay_state="OFF")
    session.add(device_status)
    await session.commit()

    # Wind is 11 mph (below restart threshold 12)
    monkeypatch.setattr(weather_service, 'get_current_weather',
                       lambda: WeatherData(wind_speed_mph=11.0, wind_direction_deg=180))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, session)

    assert decision.shutdown_allowed is False  # Turn back ON
    assert decision.reset_countdown is False
    assert "restart" in decision.reason.lower()
```

#### 6. API Endpoint Updates (If Needed)

**File:** `server/app/api/v1/endpoints/bunkers.py`

Ensure bunker creation/update endpoints accept `wind_threshold_hysteresis_mph` parameter.

---

## Testing Strategy

### Unit Tests (Expanded)
- ✅ Wind above shutdown threshold (fans ON → OFF)
- ✅ Wind below restart threshold (fans OFF → ON)
- ✅ Wind in hysteresis band, fans OFF (maintain OFF)
- ✅ Wind in hysteresis band, fans ON (maintain ON)
- ✅ Boundary conditions (exactly at thresholds)
- ✅ Null/missing hysteresis value (use global default)
- ✅ Emergency mode overrides hysteresis

### Integration Tests (Story 2.9 Extension)
- ✅ Simulate oscillating wind pattern (14-16 mph over 30 minutes)
- ✅ Verify no state changes occur in hysteresis band
- ✅ Verify state changes only at threshold crossings
- ✅ Count total state transitions (should be minimal)

### Hardware Validation (New Test Procedure)
- ✅ Load oscillating weather data into weather service
- ✅ Monitor relay state changes over 1-hour period
- ✅ Verify relay cycles < 3 times/hour (vs. potential 30 times/hour without hysteresis)
- ✅ Measure relay contact temperature (should remain cool)

---

## Configuration Recommendations

### Default Values (Production)

**Global Configuration:**
```yaml
wind_threshold_mph: 15.0
wind_threshold_hysteresis_mph: 3.0  # 20% of threshold
```

**Per-Bunker Override Examples:**

**Conservative Bunker (high-value grain, low risk tolerance):**
```yaml
wind_threshold_mph: 18.0  # Higher threshold (fans run more)
wind_threshold_hysteresis_mph: 5.0  # Wider band (less cycling)
```

**Aggressive Bunker (energy savings priority):**
```yaml
wind_threshold_mph: 12.0  # Lower threshold (fans off more)
wind_threshold_hysteresis_mph: 2.0  # Narrower band (more responsive)
```

### UI Presentation (Epic 5)

**Settings Page:**
```
Wind Control Settings
├─ Shutdown Threshold: [15.0] mph
│  └─ "Fans will turn OFF when wind speed reaches this value"
│
├─ Hysteresis Gap: [3.0] mph
│  └─ "Fans will turn back ON when wind drops [3.0] mph below shutdown threshold"
│  └─ "Restart Threshold: 12.0 mph (calculated)"
│
└─ Visual Aid: [Diagram showing threshold bands]
   15 mph ─────────────── Shutdown Threshold
        ▲ Hysteresis Band (maintain current state)
   12 mph ─────────────── Restart Threshold
```

---

## Risk Assessment

### Deployment Without Fix

**Risk Level:** HIGH

**Probability of Issue:** 90%+ (wind variability is guaranteed in Great Plains)

**Impact Scenarios:**
1. **Best Case:** Operators notice cycling, disable automation, system unused
2. **Likely Case:** Relay failure within 2-4 weeks of deployment
3. **Worst Case:** Fan motor failure + tarp loss during cycling transition

**Recommendation:** **DO NOT DEPLOY** to production without implementing anti-cycling protection

### Deployment With Hysteresis

**Risk Level:** LOW

**Residual Risks:**
- Hysteresis gap too narrow (still some cycling)
- Hysteresis gap too wide (fans stay ON unnecessarily)
- Operator confusion about dual thresholds

**Mitigation:**
- Configurable hysteresis (start conservative, tune based on data)
- Clear UI documentation of restart threshold
- Monitoring/alerting for rapid state changes (detect if hysteresis insufficient)

---

## Decision Required

### Questions for Stakeholders

1. **Which solution to implement for MVP?**
   - [ ] Option 1: Hysteresis (RECOMMENDED)
   - [ ] Option 2: Minimum Duration Timer
   - [ ] Option 3: Moving Average Filter
   - [ ] Option 4: Combination (Hysteresis + Duration)

2. **Default hysteresis gap?**
   - [ ] 2.0 mph (aggressive - 13% gap)
   - [ ] 3.0 mph (moderate - 20% gap) ← RECOMMENDED
   - [ ] 5.0 mph (conservative - 33% gap)

3. **How to track this work?**
   - [ ] New Story (2.12: Anti-Cycling Protection)
   - [ ] Bug Fix / Reopen Story 2.5
   - [ ] Defer to Epic 5 (post-MVP enhancement)

4. **Timeline urgency?**
   - [ ] Critical path - block Epic 2 completion until fixed
   - [ ] High priority - complete before field deployment
   - [ ] Medium priority - track for Epic 5

---

## Next Steps (Pending Decision)

### If Approved for Epic 2:
1. Create Story 2.12 (or reopen 2.5 as "In Progress")
2. Create database migration for hysteresis columns
3. Update models, control logic, and schemas
4. Write comprehensive unit tests (8+ new test cases)
5. Update Story 2.9 integration tests (oscillating wind scenario)
6. Create hardware validation test procedure
7. Update architecture documentation
8. Update PRD (clarify FR2 with hysteresis requirement)

### If Deferred to Epic 5:
1. Create Epic 5 story placeholder
2. Add warning to deployment documentation
3. Implement monitoring/alerting for rapid cycling detection
4. Plan field trial with close monitoring

---

## References

### Internal Documents
- **PRD:** `docs/prd.md` (FR2 - server shutdown command broadcast)
- **Story 2.5:** `docs/stories/2.5.control-logic-engine.md` (current implementation)
- **Story 2.9:** `docs/stories/2.9.end-to-end-integration-test.md` (integration testing)
- **Architecture:** `docs/architecture.md` (control flow diagrams)

### Code References
- **Control Logic:** `server/app/services/control_logic_engine.py:81`
- **Models:** `server/app/models/bunker.py`, `server/app/models/global_config.py`
- **Tests:** `server/tests/test_control_logic_engine.py`

### External Research
- **HVAC Control Systems:** Hysteresis is standard practice for thermostat control
- **Industrial Automation:** IEC 61131-3 PLCs use hysteresis for all threshold-based logic
- **Motor Protection:** NEMA standards recommend minimizing start/stop cycles

---

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-26 | 1.0 | Initial documentation of cycling risk | Sarah (PO) |