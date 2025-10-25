"""End-to-end integration test covering full device-to-server workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable, List
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_status import DeviceStatus, RelayState
from app.schemas.device import DeviceStatusRequest


@pytest.fixture()
def weather_stub(monkeypatch: pytest.MonkeyPatch) -> Callable[[float], None]:
    """Provide controllable weather data without hitting the external API."""
    from app.schemas.weather import WeatherData
    from app.services.weather_service import weather_service

    def set_weather(wind_speed: float, temperature_f: float = 65.0) -> None:
        now = datetime.now(timezone.utc)
        weather = WeatherData(
            station_id=weather_service.station_id,
            wind_speed_mph=wind_speed,
            wind_direction_degrees=180.0,
            temperature_f=temperature_f,
            fetched_at=now,
            observation_time=now - timedelta(minutes=1),
        )
        weather_service.cached_weather = weather
        weather_service.last_successful_fetch = weather.fetched_at

    async def fake_fetch() -> WeatherData:
        if weather_service.cached_weather is None:
            set_weather(10.0)
        return weather_service.cached_weather

    monkeypatch.setattr(weather_service, "fetch_weather_from_api", fake_fetch)
    set_weather(25.0)
    yield set_weather
    weather_service.cached_weather = None
    weather_service.last_successful_fetch = None


def _parse_server_time(value: str) -> datetime:
    """Parse ISO8601 timestamp returned by the API into datetime."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@pytest.mark.asyncio
async def test_end_to_end_integration(
    client: AsyncClient,
    async_session: AsyncSession,
    weather_stub: Callable[[float], None],
) -> None:
    """Validate the complete provisioning and control loop lifecycle."""
    # Register and authenticate admin operator
    register_payload = {
        "username": "integration-admin",
        "password": "ComplexPass123!",
        "email": "integration-admin@example.com",
        "role": "admin",
    }
    register_response = await client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201

    login_payload = {
        "username": register_payload["username"],
        "password": register_payload["password"],
    }
    login_response = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
    admin_token = login_response.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Confirm weather endpoint responds using stubbed data
    weather_response = await client.get("/api/v1/weather/current", headers=admin_headers)
    assert weather_response.status_code == 200
    assert weather_response.json()["wind_speed_mph"] == 25.0

    # Create bunker required for device provisioning
    bunker_payload = {
        "name": "Integration Test Bunker",
        "latitude": 44.9778,
        "longitude": -93.2650,
        "orientation_degrees": 90.0,
        "fan_count": 2,
        "wind_threshold_mph": 15.0,
        "electricity_cost_kwh": 0.12,
        "fan_power_watts": 1500,
    }
    bunker_response = await client.post(
        "/api/v1/bunkers", headers=admin_headers, json=bunker_payload
    )
    assert bunker_response.status_code == 201
    bunker_id = bunker_response.json()["id"]

    # Provision ESP32 device for the bunker
    provision_payload = {
        "bunker_id": bunker_id,
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:FF",
    }
    provision_response = await client.post(
        "/api/v1/devices/provision", headers=admin_headers, json=provision_payload
    )
    assert provision_response.status_code == 201
    provision_data = provision_response.json()
    device_id = provision_data["device_id"]
    device_token = provision_data["auth_token"]
    device_headers = {"Authorization": f"Bearer {device_token}"}

    # Validate device listing endpoint
    list_response = await client.get("/api/v1/devices", headers=admin_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["devices"]) == 1

    device_uuid = UUID(device_id)
    status_history: List[dict[str, str | bool]] = []
    previous_server_time: datetime | None = None

    for minute in range(60):
        # Adjust control scenario halfway through the run
        if minute == 30:
            weather_stub(5.0)
            update_response = await client.put(
                f"/api/v1/bunkers/{bunker_id}",
                headers=admin_headers,
                json={"wind_threshold_mph": 12.0},
            )
            assert update_response.status_code == 200
            assert update_response.json()["wind_threshold_mph"] == 12.0

            refreshed_weather = await client.get(
                "/api/v1/weather/current", headers=admin_headers
            )
            assert refreshed_weather.json()["wind_speed_mph"] == 5.0

        payload = DeviceStatusRequest(
            relay_state=RelayState.ON if minute < 30 else RelayState.OFF,
            uptime_seconds=(minute + 1) * 60,
            wifi_rssi=-45,
            countdown_timer_remaining=max(0, 300 - minute * 5),
            firmware_version="1.0.0-integrated",
        ).model_dump(mode="json")

        status_response = await client.post(
            "/api/v1/control/status", headers=device_headers, json=payload
        )
        assert status_response.status_code == 200
        body = status_response.json()
        status_history.append(body)

        server_time = _parse_server_time(body["server_time"])
        if previous_server_time is not None:
            assert server_time > previous_server_time
        previous_server_time = server_time

        if minute < 30:
            assert body["shutdown_allowed"] is True
            assert body["reset_countdown"] is True
            assert body["reason"] == "wind_conditions_favorable"
        else:
            assert body["shutdown_allowed"] is False
            assert body["reset_countdown"] is False
            assert body["reason"] == "default_safe"

        # Device telemetry should be persisted and reflect the latest snapshot
        result = await async_session.execute(
            select(DeviceStatus).where(DeviceStatus.device_id == device_uuid)
        )
        device_status = result.scalar_one()
        expected_relay = RelayState.ON.value if minute < 30 else RelayState.OFF.value
        assert device_status.relay_state == expected_relay
        assert device_status.uptime_seconds == payload["uptime_seconds"]
        assert device_status.countdown_timer_remaining == payload[
            "countdown_timer_remaining"
        ]

    # Device details should reflect final status and online heartbeat
    device_detail_response = await client.get(
        f"/api/v1/devices/{device_id}", headers=admin_headers
    )
    assert device_detail_response.status_code == 200
    device_details = device_detail_response.json()
    assert device_details["firmware_version"] == "1.0.0-integrated"
    assert device_details["is_online"] is True
    assert device_details["last_seen"] is not None

    bunker_detail_response = await client.get(
        f"/api/v1/bunkers/{bunker_id}", headers=admin_headers
    )
    assert bunker_detail_response.status_code == 200
    assert bunker_detail_response.json()["wind_threshold_mph"] == 12.0

    # Control decisions should exercise both shutdown and safe paths
    favorable = sum(1 for entry in status_history if entry["reason"] == "wind_conditions_favorable")
    default_safe = sum(1 for entry in status_history if entry["reason"] == "default_safe")
    assert favorable == 30
    assert default_safe == 30
