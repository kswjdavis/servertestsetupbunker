"""Fail-safe regression tests for Story 2.8 scenarios."""

from __future__ import annotations

from typing import Tuple

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device


async def create_bunker_and_device(
    session: AsyncSession,
    *,
    bunker_name: str = "Fail Safe Test Bunker",
) -> Tuple[Bunker, Device]:
    """Create a bunker/device pair for status reporting tests."""
    bunker = Bunker(
        name=bunker_name,
        latitude=45.0,
        longitude=-93.0,
        orientation_degrees=90.0,
        fan_count=12,
        wind_threshold_mph=30.0,
        electricity_cost_kwh=0.12,
        fan_power_watts=750,
    )
    session.add(bunker)
    await session.commit()
    await session.refresh(bunker)

    device = Device(
        bunker_id=bunker.id,
        fan_position=1,
        mac_address="00:11:22:33:44:55",
        led_flash_sequence=1,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)

    return bunker, device


@pytest.mark.asyncio
async def test_database_failure_returns_fail_safe_response(
    async_session: AsyncSession,
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Simulate database outage and ensure API defaults to fail-safe response."""

    _, device = await create_bunker_and_device(async_session)
    headers = {"Authorization": f"Bearer {device.auth_token}"}

    async def fail_upsert(*_args, **_kwargs):
        raise OperationalError("INSERT", {}, Exception("database offline"))

    monkeypatch.setattr(
        "app.api.v1.endpoints.control.DeviceStatusRepository.upsert_status",
        fail_upsert,
    )

    response = await client.post(
        "/api/v1/control/status",
        json={
            "relay_state": "OFF",
            "uptime_seconds": 120,
            "wifi_rssi": -60,
            "countdown_timer_remaining": 120,
            "firmware_version": "1.0.0-test",
        },
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["shutdown_allowed"] is False
    assert body["reset_countdown"] is False
    assert body["reason"] == "db_error_fail_safe"
    assert "server_time" in body
