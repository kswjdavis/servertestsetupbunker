"""API tests for bunker status endpoint (Story 4.1 backend coverage)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.device_repository import DeviceRepository
from app.repositories.device_status_repository import DeviceStatusRepository
from app.schemas.weather import WeatherData
from app.services.weather_service import weather_service


async def auth_headers(
    client: AsyncClient,
    username: str,
    *,
    role: str = "admin",
) -> dict[str, str]:
    """Register and authenticate a user, returning bearer headers."""
    register_payload = {
        "username": username,
        "password": "password123",
        "email": f"{username}@example.com",
        "role": role,
    }
    register_response = await client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201, register_response.text

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "password123"},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _setup_bunker_with_device(
    *,
    async_session: AsyncSession,
    client: AsyncClient,
    headers: dict[str, str],
) -> tuple[str, UUID]:
    """Create a bunker and provision a device with telemetry for status tests."""
    bunker_payload = {
        "name": "Status Test Bunker",
        "latitude": 35.5,
        "longitude": -97.4,
        "orientation_degrees": 90.0,
        "fan_count": 4,
        "wind_threshold_mph": 18.0,
        "electricity_cost_kwh": 0.22,
        "fan_power_watts": 1600,
    }
    bunker_response = await client.post("/api/v1/bunkers", json=bunker_payload, headers=headers)
    assert bunker_response.status_code == 201, bunker_response.text
    bunker_id = bunker_response.json()["id"]

    device_response = await client.post(
        "/api/v1/devices/provision",
        json={
            "bunker_id": bunker_id,
            "fan_position": 1,
            "mac_address": "AA:BB:CC:DD:EE:01",
        },
        headers=headers,
    )
    assert device_response.status_code == 201, device_response.text
    device_id = UUID(device_response.json()["device_id"])

    device_repo = DeviceRepository(async_session)
    await device_repo.update_last_seen(device_id)

    status_repo = DeviceStatusRepository(async_session)
    now = datetime.now(timezone.utc)
    await status_repo.upsert_status(
        device_id=device_id,
        relay_state="ON",
        uptime_seconds=360,
        wifi_rssi=-45,
        countdown_timer_remaining=0,
        reported_at=now,
    )

    return bunker_id, device_id


@pytest.mark.asyncio
async def test_get_bunker_status_returns_devices_and_weather(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """GET /bunkers/{id}/status returns bunker info, devices, and cached weather."""
    original_cached_weather = weather_service.cached_weather
    original_last_fetch = weather_service.last_successful_fetch
    weather = WeatherData(
        station_id="KOKC",
        wind_speed_mph=12.3,
        wind_direction_degrees=180.0,
        temperature_f=72.5,
        fetched_at=datetime.now(timezone.utc),
        observation_time=datetime.now(timezone.utc),
    )
    weather_service.cached_weather = weather
    weather_service.last_successful_fetch = weather.fetched_at

    try:
        headers = await auth_headers(client, "status_admin")
        bunker_id, device_id = await _setup_bunker_with_device(
            async_session=async_session,
            client=client,
            headers=headers,
        )

        response = await client.get(f"/api/v1/bunkers/{bunker_id}/status", headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()

        assert body["bunker"]["id"] == bunker_id
        assert len(body["devices"]) == 1
        device_payload = body["devices"][0]
        assert device_payload["device_id"] == str(device_id)
        assert device_payload["relay_state"] == "ON"
        assert device_payload["is_online"] is True
        assert device_payload["wifi_rssi"] == -45
        assert device_payload["uptime_seconds"] == 360
        assert device_payload["countdown_timer_remaining"] == 0
        assert body["weather"]["station_id"] == "KOKC"
        assert body["weather"]["wind_speed_mph"] == pytest.approx(12.3, rel=1e-3)
    finally:
        weather_service.cached_weather = original_cached_weather
        weather_service.last_successful_fetch = original_last_fetch


@pytest.mark.asyncio
async def test_operator_role_can_access_status(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """Operators should be authorized to retrieve bunker status."""
    admin_headers = await auth_headers(client, "status_admin_operator")
    bunker_id, _ = await _setup_bunker_with_device(
        async_session=async_session,
        client=client,
        headers=admin_headers,
    )

    operator_headers = await auth_headers(client, "status_operator", role="operator")
    response = await client.get(
        f"/api/v1/bunkers/{bunker_id}/status",
        headers=operator_headers,
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_get_bunker_status_returns_404_for_missing_bunker(
    client: AsyncClient,
) -> None:
    """Requesting status for a non-existent bunker returns 404."""
    headers = await auth_headers(client, "status_missing")
    response = await client.get(
        f"/api/v1/bunkers/{uuid4()}/status",
        headers=headers,
    )
    assert response.status_code == 404
