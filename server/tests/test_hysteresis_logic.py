"""Unit tests for hysteresis logic in ControlLogicEngine (Anti-Cycling Protection)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.device_status import DeviceStatus, RelayState
from app.models.global_config import GlobalConfig
from app.schemas.weather import WeatherData
from app.services.control_logic_engine import ControlLogicEngine
from app.services import weather_service


async def _create_bunker_device_and_config(
    session: AsyncSession,
    *,
    wind_threshold: float | None = 15.0,
    hysteresis: float | None = 3.0,
) -> tuple[Bunker, Device, GlobalConfig]:
    """Helper to seed test database with hysteresis configuration."""
    config = GlobalConfig(
        id=1,
        default_wind_threshold_mph=15.0,
        default_wind_threshold_hysteresis_mph=3.0,
        default_electricity_cost_kwh=0.12,
        default_fan_power_watts=1500,
        weather_station_id="KMSP",
        weather_poll_interval_seconds=60,
        shutdown_broadcast_interval_seconds=60,
        device_offline_threshold_seconds=120,
        emergency_on_global=False,
    )
    session.add(config)

    bunker = Bunker(
        name="Test Bunker",
        latitude=44.98,
        longitude=-93.26,
        orientation_degrees=0.0,
        fan_count=4,
        wind_threshold_mph=wind_threshold,
        wind_threshold_hysteresis_mph=hysteresis,
        electricity_cost_kwh=0.10,
        fan_power_watts=1200,
        emergency_on=False,
    )
    session.add(bunker)
    await session.flush()

    device = Device(
        bunker_id=bunker.id,
        fan_position=1,
        mac_address="AA:BB:CC:DD:EE:FF",
        led_flash_sequence=1,
    )
    session.add(device)

    await session.commit()
    await session.refresh(config)
    await session.refresh(bunker)
    await session.refresh(device)
    return bunker, device, config


def _weather_payload(speed_mph: float) -> WeatherData:
    """Create a WeatherData instance for tests."""
    now = datetime.now(timezone.utc)
    return WeatherData(
        station_id="KMSP",
        wind_speed_mph=speed_mph,
        wind_direction_degrees=180.0,
        temperature_f=72.0,
        fetched_at=now,
        observation_time=now,
    )


@pytest.mark.asyncio()
async def test_hysteresis_allows_shutdown_when_fans_on_above_threshold(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that fans turn OFF when wind exceeds shutdown threshold (fans currently ON)."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # Set device status to ON
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.ON)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is 16 mph (above shutdown threshold 15)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(16.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True
    assert decision.reset_countdown is True
    assert "wind_exceeds_threshold" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_blocks_shutdown_when_fans_on_below_threshold(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that fans stay ON when wind below shutdown threshold (fans currently ON)."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # Set device status to ON
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.ON)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is 14 mph (below shutdown threshold 15)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(14.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reset_countdown is True
    assert "wind_below_shutdown_threshold" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_fans_turn_on_when_off_below_restart_threshold(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that fans turn ON when wind drops below restart threshold (fans currently OFF)."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # Set device status to OFF
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.OFF)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is 11 mph (below restart threshold 12)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(11.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False  # Turn back ON
    assert decision.reset_countdown is True
    assert "wind_below_restart_threshold" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_maintains_off_state_in_hysteresis_band(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that fans stay OFF when wind is in hysteresis band (fans currently OFF)."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # Set device status to OFF
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.OFF)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is 14 mph (between restart threshold 12 and shutdown threshold 15)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(14.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True  # Stay OFF
    assert decision.reset_countdown is True
    assert "wind_in_hysteresis_band_maintain_off" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_uses_global_defaults_when_bunker_values_null(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that global defaults are used when bunker-specific values are null."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=None, hysteresis=None  # Use global defaults
    )

    # Set device status to ON
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.ON)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is 16 mph (above global default threshold 15)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(16.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True
    assert decision.reset_countdown is True
    assert "wind_exceeds_threshold" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_defaults_to_fans_on_when_no_device_status(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test that system defaults to fans ON (fail-safe) when no device status exists."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # No device status record (simulates first startup)

    # Wind is 14 mph (below shutdown threshold 15)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(14.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    # Should behave as if fans are ON (fail-safe default)
    assert decision.shutdown_allowed is False
    assert decision.reset_countdown is True
    assert "wind_below_shutdown_threshold" in decision.reason


@pytest.mark.asyncio()
async def test_hysteresis_boundary_conditions(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """Test boundary conditions: exactly at shutdown and restart thresholds."""
    bunker, device, config = await _create_bunker_device_and_config(
        async_session, wind_threshold=15.0, hysteresis=3.0
    )

    # Test 1: Fans ON, wind exactly at shutdown threshold
    device_status = DeviceStatus(device_id=device.id, relay_state=RelayState.ON)
    async_session.add(device_status)
    await async_session.commit()

    # Wind is exactly 15.0 mph (at shutdown threshold)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(15.0)
    )
    monkeypatch.setattr(weather_service, 'is_weather_stale', lambda: False)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True  # Should allow shutdown at exact threshold
    assert "wind_exceeds_threshold" in decision.reason

    # Test 2: Fans OFF, wind exactly at restart threshold
    device_status.relay_state = RelayState.OFF
    await async_session.commit()

    # Wind is exactly 12.0 mph (at restart threshold)
    monkeypatch.setattr(
        weather_service, 'get_current_weather',
        lambda: _weather_payload(12.0)
    )

    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True  # Should stay OFF at exact restart threshold
    assert "wind_in_hysteresis_band_maintain_off" in decision.reason