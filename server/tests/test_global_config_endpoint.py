"""API tests for global configuration endpoints (Story 3.7 backend)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.global_config_repository import GlobalConfigRepository


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


@pytest.mark.asyncio
async def test_read_global_config_returns_defaults(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """GET /config returns the singleton with default values when uninitialized."""
    headers = await auth_headers(client, "global_config_reader")

    response = await client.get("/api/v1/config", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["id"] == 1
    assert body["default_wind_threshold_mph"] == pytest.approx(15.0, rel=1e-3)
    assert body["default_electricity_cost_kwh"] == pytest.approx(0.12, rel=1e-3)
    assert body["default_fan_power_watts"] == 1500
    assert body["default_wind_threshold_hysteresis_mph"] == pytest.approx(3.0, rel=1e-3)
    assert body["weather_station_id"] == "KOKC"
    assert body["weather_poll_interval_seconds"] == 60
    assert body["shutdown_broadcast_interval_seconds"] == 60
    assert body["device_offline_threshold_seconds"] == 120
    assert body["emergency_on_global"] is False

    repository = GlobalConfigRepository(async_session)
    config = await repository.get_config()
    assert config is not None
    assert config.id == 1


@pytest.mark.asyncio
async def test_update_global_config_persists_changes(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """PUT /config updates persisted configuration fields."""
    headers = await auth_headers(client, "global_config_updater")

    payload = {
        "default_wind_threshold_mph": 18.5,
        "default_electricity_cost_kwh": 0.21,
        "default_fan_power_watts": 1650,
        "weather_station_id": "KOUN",
        "default_wind_threshold_hysteresis_mph": 2.5,
        "weather_poll_interval_seconds": 90,
        "shutdown_broadcast_interval_seconds": 45,
        "device_offline_threshold_seconds": 180,
        "emergency_on_global": True,
    }

    response = await client.put("/api/v1/config", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    for key, value in payload.items():
        if isinstance(value, float):
            assert body[key] == pytest.approx(value, rel=1e-3)
        else:
            assert body[key] == value

    repository = GlobalConfigRepository(async_session)
    config = await repository.get_config()
    assert config is not None
    assert config.default_wind_threshold_mph == pytest.approx(18.5, rel=1e-3)
    assert config.default_electricity_cost_kwh == pytest.approx(0.21, rel=1e-3)
    assert config.default_fan_power_watts == 1650
    assert config.weather_station_id == "KOUN"
    assert config.default_wind_threshold_hysteresis_mph == pytest.approx(2.5, rel=1e-3)
    assert config.weather_poll_interval_seconds == 90
    assert config.shutdown_broadcast_interval_seconds == 45
    assert config.device_offline_threshold_seconds == 180
    assert config.emergency_on_global is True


@pytest.mark.asyncio
async def test_non_admin_access_is_forbidden(
    client: AsyncClient,
) -> None:
    """Operators cannot read or update global configuration."""
    headers = await auth_headers(client, "global_config_operator", role="operator")

    get_response = await client.get("/api/v1/config", headers=headers)
    assert get_response.status_code == 403

    put_response = await client.put(
        "/api/v1/config",
        json={
            "default_wind_threshold_mph": 16.0,
            "default_electricity_cost_kwh": 0.15,
            "default_fan_power_watts": 1500,
            "weather_station_id": "KOKC",
        },
        headers=headers,
    )
    assert put_response.status_code == 403
