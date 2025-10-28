"""Degraded/offline path tests for system health monitoring."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.schemas.weather import WeatherData
from app.services.weather_service import weather_service


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
async def test_weather_stale_generates_warning_and_degraded_status(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When weather is stale, service reports degraded and adds a warning alert."""
    now = datetime.now(timezone.utc)
    # Configure cached weather and make it stale
    stale_time = now - timedelta(minutes=settings.WEATHER_STALE_THRESHOLD_MINUTES + 5)
    cached = WeatherData(
        station_id=weather_service.station_id,
        wind_speed_mph=10.0,
        wind_direction_degrees=180.0,
        temperature_f=72.0,
        fetched_at=stale_time,
        observation_time=stale_time,
    )
    monkeypatch.setattr(weather_service, "cached_weather", cached)
    monkeypatch.setattr(weather_service, "last_successful_fetch", stale_time)

    headers = await register_admin(client)
    response = await client.get("/api/v1/system/health", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["weather_service"]["status"] == "degraded"
    assert body["weather_service"]["stale"] is True
    assert any(
        a["id"] == "weather-stale" and a["severity"] == "warning" for a in body["alerts"]
    )


@pytest.mark.asyncio
async def test_weather_unavailable_generates_warning_and_offline_status(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When no cached weather exists, service reports offline and adds warning alert."""
    monkeypatch.setattr(weather_service, "cached_weather", None)
    monkeypatch.setattr(weather_service, "last_successful_fetch", None)

    headers = await register_admin(client)
    response = await client.get("/api/v1/system/health", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["weather_service"]["status"] == "offline"
    assert any(
        a["id"] == "weather-unavailable" and a["severity"] == "warning"
        for a in body["alerts"]
    )


@pytest.mark.asyncio
async def test_database_latency_degraded_alert(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Database latency above threshold marks DB degraded and creates warning alert."""
    # Patch perf_counter used inside SystemHealthService to simulate >250ms latency
    import app.services.system_health_service as shs

    calls = {"n": 0}

    def fake_perf_counter() -> float:  # type: ignore[override]
        calls["n"] += 1
        # First call at 0.0, second call at 0.35s → 350ms
        return 0.0 if calls["n"] == 1 else 0.35

    monkeypatch.setattr(shs, "perf_counter", fake_perf_counter)

    headers = await register_admin(client)
    response = await client.get("/api/v1/system/health", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["database"]["status"] == "degraded"
    assert any(
        a["id"] == "database-latency" and a["severity"] == "warning"
        for a in body["alerts"]
    )

