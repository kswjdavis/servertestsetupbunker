"""Unit tests for ControlLogicEngine shutdown decisions (Story 2.5)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.global_config import GlobalConfig
from app.models.time_window_override import TimeWindowOverride
from app.models.user import User, UserRole
from app.schemas.weather import WeatherData
from app.services.control_logic_engine import ControlLogicEngine
from app.services import weather_service


async def _create_bunker_device_and_config(
    session: AsyncSession,
    *,
    wind_threshold: float | None = 10.0,
    bunker_emergency: bool = False,
    global_emergency: bool = False,
) -> tuple[GlobalConfig, Bunker, Device]:
    """Helper to seed test database with minimal configuration."""
    config = GlobalConfig(
        id=1,
        default_wind_threshold_mph=15.0,
        default_electricity_cost_kwh=0.12,
        default_fan_power_watts=1500,
        weather_station_id="KMSP",
        weather_poll_interval_seconds=60,
        shutdown_broadcast_interval_seconds=60,
        device_offline_threshold_seconds=120,
        emergency_on_global=global_emergency,
    )
    session.add(config)

    bunker = Bunker(
        name="Test Bunker",
        latitude=44.98,
        longitude=-93.26,
        orientation_degrees=0.0,
        fan_count=4,
        wind_threshold_mph=wind_threshold,
        electricity_cost_kwh=0.10,
        fan_power_watts=1200,
        emergency_on=bunker_emergency,
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
    return config, bunker, device


def _weather_payload(speed_mph: float | None) -> WeatherData:
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
async def test_allows_shutdown_when_wind_above_threshold(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fans may shut down when wind meets or exceeds threshold and no overrides apply."""
    _, bunker, device = await _create_bunker_device_and_config(async_session, wind_threshold=10.0)
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(18.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True
    assert decision.reset_countdown is True
    assert decision.reason == "wind_conditions_favorable"


@pytest.mark.asyncio()
async def test_blocks_shutdown_when_bunker_emergency_active(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Bunker emergency overrides always block shutdown."""
    _, bunker, device = await _create_bunker_device_and_config(
        async_session,
        bunker_emergency=True,
    )
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(25.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reason == "emergency_on"


@pytest.mark.asyncio()
async def test_blocks_shutdown_when_global_emergency_active(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Global emergency overrides block shutdown even if bunker is clear."""
    _, bunker, device = await _create_bunker_device_and_config(
        async_session,
        global_emergency=True,
    )
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(25.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reason == "emergency_on"


@pytest.mark.asyncio()
async def test_blocks_shutdown_when_time_override_active(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Active time window overrides block shutdown."""
    _, bunker, device = await _create_bunker_device_and_config(async_session)
    user = User(
        username="override_operator",
        password_hash="hashed-password",
        role=UserRole.ADMIN.value,
    )
    async_session.add(user)
    await async_session.flush()

    now = datetime.now(timezone.utc)
    override = TimeWindowOverride(
        bunker_id=bunker.id,
        start_time=now - timedelta(minutes=5),
        end_time=now + timedelta(minutes=5),
        reason="Scheduled drying cycle",
        created_by=user.id,
    )
    async_session.add(override)
    await async_session.commit()

    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(25.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reason == "time_window_override"


@pytest.mark.asyncio()
async def test_returns_default_safe_when_wind_below_threshold(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Decision remains fail-safe when wind speed is below the threshold."""
    _, bunker, device = await _create_bunker_device_and_config(async_session, wind_threshold=20.0)
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(12.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reset_countdown is False
    assert decision.reason == "default_safe"


@pytest.mark.asyncio()
async def test_returns_default_safe_when_weather_unavailable(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing weather data results in fail-safe decision."""
    _, bunker, device = await _create_bunker_device_and_config(async_session)

    def _raise_weather_error() -> WeatherData:
        raise ValueError("No weather data")

    monkeypatch.setattr(weather_service, "get_current_weather", _raise_weather_error)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reason == "default_safe"


@pytest.mark.asyncio()
async def test_returns_default_safe_when_wind_speed_is_none(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Null wind speed results in fail-safe decision."""
    _, bunker, device = await _create_bunker_device_and_config(async_session)
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(None))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reason == "default_safe"


@pytest.mark.asyncio()
async def test_returns_default_safe_when_weather_stale(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Stale weather data forces fail-safe behaviour."""
    _, bunker, device = await _create_bunker_device_and_config(async_session, wind_threshold=10.0)

    weather = _weather_payload(20.0)
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: weather)
    monkeypatch.setattr(weather_service, "is_weather_stale", lambda: True)

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is False
    assert decision.reset_countdown is False
    assert decision.reason == "default_safe"


@pytest.mark.asyncio()
async def test_allows_shutdown_at_exact_threshold(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Shutdown allowed when wind exactly equals threshold (boundary condition)."""
    _, bunker, device = await _create_bunker_device_and_config(async_session, wind_threshold=15.0)
    monkeypatch.setattr(weather_service, "get_current_weather", lambda: _weather_payload(15.0))

    engine = ControlLogicEngine()
    decision = await engine.should_shutdown_fans(device.id, async_session)

    assert decision.shutdown_allowed is True
    assert decision.reset_countdown is True
    assert decision.reason == "wind_conditions_favorable"
