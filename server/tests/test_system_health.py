"""Tests for the system health monitoring endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device


async def create_bunker(session: AsyncSession) -> UUID:
    """Persist a bunker record for health monitoring tests."""
    bunker = Bunker(
        name="Central Yard",
        latitude=35.0,
        longitude=-97.0,
        orientation_degrees=45.0,
        fan_count=4,
        wind_threshold_mph=25.0,
        electricity_cost_kwh=0.12,
        fan_power_watts=900,
    )
    session.add(bunker)
    await session.commit()
    await session.refresh(bunker)
    return bunker.id


async def register_admin(client: AsyncClient) -> dict[str, str]:
    """Register and authenticate an admin user, returning bearer headers."""
    username = f"admin_{uuid4().hex[:8]}"
    register_payload = {
        "username": username,
        "password": "password123",
        "email": f"{username}@example.com",
        "role": "admin",
    }
    register_response = await client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201, register_response.text

    login_payload = {"username": username, "password": "password123"}
    login_response = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_system_health_reports_device_counts(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """System health endpoint returns accurate device counts and alerts."""
    headers = await register_admin(client)
    bunker_id = await create_bunker(async_session)

    now = datetime.now(timezone.utc)
    online_device = Device(
        bunker_id=bunker_id,
        fan_position=1,
        mac_address="AA:BB:CC:DD:EE:01",
        firmware_version="1.0.0",
        last_seen=now - timedelta(seconds=30),
        provisioned_at=now - timedelta(hours=1),
        led_flash_sequence=1,
    )
    offline_device = Device(
        bunker_id=bunker_id,
        fan_position=2,
        mac_address="AA:BB:CC:DD:EE:02",
        firmware_version="1.0.0",
        last_seen=now - timedelta(minutes=10),
        provisioned_at=now - timedelta(hours=1),
        led_flash_sequence=2,
    )
    async_session.add_all([online_device, offline_device])
    await async_session.commit()

    response = await client.get("/api/v1/system/health", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["total_devices"] == 2
    assert body["online_devices"] == 1
    assert body["offline_devices"] == 1
    assert isinstance(body["alerts"], list)
    assert any(alert["type"] == "device_offline" for alert in body["alerts"])
    assert body["system_uptime_seconds"] >= 0
    assert body["backend_uptime_seconds"] >= 0
    assert "status" in body["weather_service"]
    assert "status" in body["database"]
