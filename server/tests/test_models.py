"""Tests for SQLAlchemy models defined in Story 1.2."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.device_status import DeviceStatus
from app.models.global_config import GlobalConfig
from app.models.time_window_override import TimeWindowOverride
from app.models.user import User, UserRole
from app.models.weather_data import WeatherData


pytestmark = pytest.mark.asyncio


async def create_user(
    session, username: str = "alice", password_hash: str = "hashed-password"
) -> User:
    """Helper to insert a user for relational tests."""
    user = User(username=username, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def create_bunker(
    session,
    name: str = "North Bunker",
    *,
    latitude: float = 35.4676,
    longitude: float = -97.5164,
    orientation_degrees: float = 180.0,
    fan_count: int = 4,
) -> Bunker:
    """Helper to insert a bunker for relational tests."""
    bunker = Bunker(
        name=name,
        latitude=latitude,
        longitude=longitude,
        orientation_degrees=orientation_degrees,
        fan_count=fan_count,
        electricity_cost_kwh=0.11,
        fan_power_watts=1500,
    )
    session.add(bunker)
    await session.commit()
    await session.refresh(bunker)
    return bunker


async def create_device(
    session, bunker_id: UUID, mac_address: str = "AA:BB:CC:DD:EE:01", fan_position: int = 1
) -> Device:
    """Helper to insert a device for relational tests."""
    device = Device(
        bunker_id=bunker_id,
        fan_position=fan_position,
        mac_address=mac_address,
        led_flash_sequence=fan_position,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return device


async def test_user_model_defaults(async_session):
    """Users default to viewer role and timezone-aware timestamps."""
    user = User(username="viewer-user", password_hash="hashed")
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    assert user.role == UserRole.VIEWER.value
    assert isinstance(user.created_at, datetime)
    normalized_created = (
        user.created_at.replace(tzinfo=timezone.utc)
        if user.created_at.tzinfo is None
        else user.created_at
    )
    assert (datetime.now(timezone.utc) - normalized_created).total_seconds() < 5
    assert user.last_login is None


async def test_bunker_orientation_constraint(async_session):
    """Orientation must be within [0, 360)."""
    bunker = await create_bunker(async_session, orientation_degrees=90.0)
    assert bunker.orientation_degrees == 90.0

    invalid_bunker = Bunker(
        name="Invalid Orientation",
        latitude=35.0,
        longitude=-97.0,
        orientation_degrees=360.0,
        fan_count=2,
        electricity_cost_kwh=0.10,
        fan_power_watts=1400,
    )
    async_session.add(invalid_bunker)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()


async def test_device_unique_constraints(async_session):
    """Devices enforce unique MAC addresses and per-bunker fan positions."""
    bunker = await create_bunker(async_session, name="Device Bunker")
    bunker_id = bunker.id
    device = await create_device(
        async_session, bunker_id, mac_address="AA:AA:AA:AA:AA:01", fan_position=1
    )
    assert device.mac_address == "AA:AA:AA:AA:AA:01"

    duplicate_mac = Device(
        bunker_id=bunker_id,
        fan_position=2,
        mac_address="AA:AA:AA:AA:AA:01",
        led_flash_sequence=2,
    )
    async_session.add(duplicate_mac)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()

    duplicate_position = Device(
        bunker_id=bunker_id,
        fan_position=1,
        mac_address="AA:AA:AA:AA:AA:02",
        led_flash_sequence=1,
    )
    async_session.add(duplicate_position)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()


async def test_device_status_defaults(async_session):
    """DeviceStatus records auto-populate server_received_at and enforce constraints."""
    bunker = await create_bunker(async_session, name="Status Bunker")
    device = await create_device(async_session, bunker.id, mac_address="AA:BB:CC:DD:EE:02", fan_position=1)

    status = DeviceStatus(
        device_id=device.id,
        relay_state="ON",
        uptime_seconds=120,
        wifi_rssi=-45,
        countdown_timer_remaining=30,
        reported_at=datetime.now(timezone.utc),
    )
    async_session.add(status)
    await async_session.commit()
    await async_session.refresh(status)

    assert status.server_received_at is not None
    normalized_received = (
        status.server_received_at.replace(tzinfo=timezone.utc)
        if status.server_received_at.tzinfo is None
        else status.server_received_at
    )
    assert (datetime.now(timezone.utc) - normalized_received).total_seconds() < 5
    assert status.relay_state == "ON"

    other_device = await create_device(
        async_session, bunker.id, mac_address="AA:BB:CC:DD:EE:03", fan_position=2
    )

    invalid_status = DeviceStatus(
        device_id=other_device.id,
        relay_state="OFF",
        uptime_seconds=0,
        wifi_rssi=-60,
        countdown_timer_remaining=400,  # exceeds constraint
        reported_at=datetime.now(timezone.utc),
    )
    async_session.add(invalid_status)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()


async def test_global_config_singleton(async_session):
    """GlobalConfig enforces singleton constraint and defaults."""
    config = GlobalConfig(id=1)
    async_session.add(config)
    await async_session.commit()
    await async_session.refresh(config)

    assert config.default_wind_threshold_mph == 15.0
    assert config.weather_station_id == "KOKC"

    second = GlobalConfig(id=2)
    async_session.add(second)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()


async def test_time_window_override_constraints(async_session):
    """TimeWindowOverride requires end_time to be after start_time."""
    user = await create_user(async_session, username="override_user")
    bunker = await create_bunker(async_session, name="Override Bunker")
    start = datetime.now(timezone.utc)
    end = start + timedelta(hours=1)

    override = TimeWindowOverride(
        bunker_id=bunker.id,
        start_time=start,
        end_time=end,
        reason="Wind event",
        created_by=user.id,
    )
    async_session.add(override)
    await async_session.commit()
    await async_session.refresh(override)

    assert override.created_at is not None
    normalized_created = (
        override.created_at.replace(tzinfo=timezone.utc)
        if override.created_at.tzinfo is None
        else override.created_at
    )
    assert (datetime.now(timezone.utc) - normalized_created).total_seconds() < 5
    assert override.created_by == user.id

    invalid_override = TimeWindowOverride(
        bunker_id=bunker.id,
        start_time=start,
        end_time=start - timedelta(minutes=5),
        reason="Invalid window",
        created_by=user.id,
    )
    async_session.add(invalid_override)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()


async def test_weather_data_direction_constraint(async_session):
    """WeatherData enforces wind direction bounds."""
    weather = WeatherData(
        station_id="KOKC",
        wind_speed_mph=12.5,
        wind_direction_degrees=180.0,
        temperature_f=72.0,
        fetched_at=datetime.now(timezone.utc),
        observation_time=datetime.now(timezone.utc),
    )
    async_session.add(weather)
    await async_session.commit()
    await async_session.refresh(weather)
    assert weather.wind_direction_degrees == 180.0

    invalid_weather = WeatherData(
        station_id="BAD1",
        wind_speed_mph=10.0,
        wind_direction_degrees=361.0,
        temperature_f=70.0,
        fetched_at=datetime.now(timezone.utc),
        observation_time=datetime.now(timezone.utc),
    )
    async_session.add(invalid_weather)
    with pytest.raises(IntegrityError):
        await async_session.commit()
    await async_session.rollback()
