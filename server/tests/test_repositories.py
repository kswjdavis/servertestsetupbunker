"""Tests for repository layer defined in Story 1.2."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.models.bunker import Bunker
from app.models.device import Device
from app.repositories.bunker_repository import BunkerRepository
from app.repositories.device_repository import DeviceRepository
from app.repositories.device_status_repository import DeviceStatusRepository
from app.repositories.global_config_repository import GlobalConfigRepository
from app.repositories.user_repository import UserRepository


pytestmark = pytest.mark.asyncio


async def seed_bunker(session, name: str = "Repo Bunker") -> Bunker:
    """Create a bunker record for repository tests."""
    repo = BunkerRepository(session)
    return await repo.create(
        name=name,
        latitude=35.5,
        longitude=-97.5,
        orientation_degrees=180.0,
        fan_count=4,
        electricity_cost_kwh=0.12,
        fan_power_watts=1500,
    )


async def seed_device(session, bunker_id: UUID, fan_position: int = 1, mac: str = "AA:BB:CC:DD:EE:FF") -> Device:
    """Provision a device using the repository to ensure consistent defaults."""
    repo = DeviceRepository(session)
    return await repo.provision_device(
        bunker_id=bunker_id,
        fan_position=fan_position,
        mac_address=mac,
    )


async def test_bunker_repository_crud(async_session):
    """BunkerRepository supports full CRUD lifecycle."""
    repo = BunkerRepository(async_session)

    created = await repo.create(
        name="South Bunker",
        latitude=34.7,
        longitude=-98.2,
        orientation_degrees=90.0,
        fan_count=3,
        electricity_cost_kwh=0.10,
        fan_power_watts=1400,
    )
    assert created.id is not None

    fetched = await repo.get(created.id)
    assert fetched is not None and fetched.name == "South Bunker"

    by_name = await repo.get_by_name("South Bunker")
    assert by_name is not None and by_name.id == created.id

    updated = await repo.update(created.id, fan_count=5)
    assert updated is not None and updated.fan_count == 5

    all_bunkers = await repo.get_all()
    assert len(all_bunkers) == 1

    exists = await repo.exists(created.id)
    assert exists is True

    deleted = await repo.delete(created.id)
    assert deleted is True
    missing = await repo.get(created.id)
    assert missing is None


async def test_user_repository_password_flow(async_session):
    """UserRepository handles hashing, authentication, and password changes."""
    repo = UserRepository(async_session)
    user = await repo.create_user(username="testuser", password="super-secret", email="user@example.com")
    assert user.password_hash != "super-secret"

    auth_user = await repo.authenticate("testuser", "super-secret")
    assert auth_user is not None
    assert auth_user.last_login is not None

    bad_auth = await repo.authenticate("testuser", "wrong-password")
    assert bad_auth is None

    await repo.change_password(user.id, "new-secret")
    new_auth = await repo.authenticate("testuser", "new-secret")
    assert new_auth is not None


async def test_device_repository_provision_and_conflicts(async_session):
    """DeviceRepository provisions devices and enforces uniqueness rules."""
    bunker = await seed_bunker(async_session, name="Provision Bunker")
    repo = DeviceRepository(async_session)

    device_one = await repo.provision_device(bunker.id, fan_position=1, mac_address="AA:BB:CC:DD:EE:01")
    assert device_one.led_flash_sequence == 1

    device_two = await repo.provision_device(bunker.id, fan_position=2, mac_address="AA:BB:CC:DD:EE:02")
    assert device_two.led_flash_sequence == 2

    with pytest.raises(HTTPException) as excinfo:
        await repo.provision_device(bunker.id, fan_position=3, mac_address="AA:BB:CC:DD:EE:02")
    assert excinfo.value.status_code == 409

    with pytest.raises(HTTPException) as excinfo_position:
        await repo.provision_device(bunker.id, fan_position=2, mac_address="AA:BB:CC:DD:EE:03")
    assert excinfo_position.value.status_code == 409

    updated = await repo.update_last_seen(device_one.id)
    assert updated is not None and updated.last_seen is not None

    updated_by_token = await repo.update_last_seen_by_token(device_two.auth_token)
    assert updated_by_token is not None and updated_by_token.last_seen is not None

    devices = await repo.get_devices_by_bunker(bunker.id)
    assert len(devices) == 2

    all_devices = await repo.list_devices()
    assert len(all_devices) == 2


async def test_device_status_repository_upsert(async_session):
    """DeviceStatusRepository performs insert and update via upsert."""
    bunker = await seed_bunker(async_session, name="Status Repo Bunker")
    device = await seed_device(async_session, bunker.id, mac="AA:BB:CC:DD:EE:10")
    repo = DeviceStatusRepository(async_session)

    reported_at = datetime.now(timezone.utc)
    first_status = await repo.upsert_status(
        device_id=device.id,
        relay_state="ON",
        uptime_seconds=10,
        wifi_rssi=-40,
        countdown_timer_remaining=60,
        reported_at=reported_at,
    )
    assert first_status is not None
    assert first_status.relay_state == "ON"

    later_reported = reported_at + timedelta(seconds=5)
    updated_status = await repo.upsert_status(
        device_id=device.id,
        relay_state="OFF",
        uptime_seconds=20,
        wifi_rssi=-35,
        countdown_timer_remaining=45,
        reported_at=later_reported,
    )
    assert updated_status.relay_state == "OFF"
    assert updated_status.uptime_seconds == 20
    normalized_reported = (
        updated_status.reported_at.replace(tzinfo=timezone.utc)
        if updated_status.reported_at.tzinfo is None
        else updated_status.reported_at
    )
    assert normalized_reported == later_reported
    assert updated_status.server_received_at >= first_status.server_received_at


async def test_global_config_repository_defaults(async_session):
    """GlobalConfigRepository returns and updates singleton configuration."""
    repo = GlobalConfigRepository(async_session)

    config = await repo.get_or_create_default()
    assert config.id == 1
    assert config.default_wind_threshold_mph == 15.0

    updated = await repo.update_config(default_wind_threshold_mph=22.5, weather_station_id="KOKC2")
    assert updated.default_wind_threshold_mph == 22.5
    assert updated.weather_station_id == "KOKC2"

    fetched = await repo.get_config()
    assert fetched is not None and fetched.id == 1
