"""Integration tests for bunker management API (Story 2.6)."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.bunker_repository import BunkerRepository
from app.repositories.device_repository import DeviceRepository
from app.repositories.global_config_repository import GlobalConfigRepository


async def auth_headers(
    client: AsyncClient,
    username: str = "bunker_admin",
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


def base_payload(**overrides: object) -> dict[str, object]:
    """Build a bunker payload with sensible defaults."""
    payload: dict[str, object] = {
        "name": "Central Yard",
        "latitude": 35.0,
        "longitude": -97.0,
        "orientation_degrees": 180.0,
        "fan_count": 4,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_bunker_applies_global_defaults(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """POST /bunkers uses GlobalConfig defaults when optional fields omitted."""
    config_repo = GlobalConfigRepository(async_session)
    await config_repo.update_config(
        default_wind_threshold_mph=18.5,
        default_electricity_cost_kwh=0.21,
        default_fan_power_watts=1650,
    )

    headers = await auth_headers(client)
    response = await client.post(
        "/api/v1/bunkers",
        json=base_payload(),
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["wind_threshold_mph"] == 18.5
    assert body["electricity_cost_kwh"] == 0.21
    assert body["fan_power_watts"] == 1650
    assert body["device_count"] == 0
    assert UUID(body["id"])


@pytest.mark.asyncio
async def test_list_and_get_bunker_include_device_count(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """GET endpoints return accurate device counts."""
    headers = await auth_headers(client, username="bunker_counter")

    create_response = await client.post(
        "/api/v1/bunkers",
        json=base_payload(name="Device Count Field"),
        headers=headers,
    )
    bunker_id = create_response.json()["id"]

    device_repo = DeviceRepository(async_session)
    await device_repo.provision_device(
        bunker_id=UUID(bunker_id),
        fan_position=1,
        mac_address="AA:BB:CC:DD:EE:11",
    )

    list_response = await client.get("/api/v1/bunkers", headers=headers)
    assert list_response.status_code == 200, list_response.text
    listed = list_response.json()["bunkers"]
    assert len(listed) == 1
    assert listed[0]["device_count"] == 1

    detail_response = await client.get(
        f"/api/v1/bunkers/{bunker_id}",
        headers=headers,
    )
    assert detail_response.status_code == 200, detail_response.text
    detail = detail_response.json()
    assert detail["device_count"] == 1
    assert detail["name"] == "Device Count Field"


@pytest.mark.asyncio
async def test_update_bunker_resets_optional_fields_with_null(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """PUT /bunkers/{id} accepts null to reapply GlobalConfig defaults."""
    config_repo = GlobalConfigRepository(async_session)
    await config_repo.update_config(
        default_wind_threshold_mph=25.0,
        default_electricity_cost_kwh=0.18,
        default_fan_power_watts=1450,
    )

    headers = await auth_headers(client, username="bunker_updater")
    create_response = await client.post(
        "/api/v1/bunkers",
        json=base_payload(
            name="Update Field",
            wind_threshold_mph=22.0,
            electricity_cost_kwh=0.15,
            fan_power_watts=1400,
        ),
        headers=headers,
    )
    bunker_id = create_response.json()["id"]

    update_payload = {
        "wind_threshold_mph": None,
        "electricity_cost_kwh": None,
        "fan_power_watts": None,
        "name": "Updated Field",
    }
    update_response = await client.put(
        f"/api/v1/bunkers/{bunker_id}",
        json=update_payload,
        headers=headers,
    )
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()

    assert updated["wind_threshold_mph"] == 25.0
    assert updated["electricity_cost_kwh"] == 0.18
    assert updated["fan_power_watts"] == 1450
    assert updated["name"] == "Updated Field"


@pytest.mark.asyncio
async def test_delete_bunker_cascades_devices(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """DELETE /bunkers/{id} removes bunker and subordinate devices."""
    headers = await auth_headers(client, username="bunker_deleter")
    create_response = await client.post(
        "/api/v1/bunkers",
        json=base_payload(name="Cascade Field"),
        headers=headers,
    )
    bunker_id = UUID(create_response.json()["id"])

    device_repo = DeviceRepository(async_session)
    device = await device_repo.provision_device(
        bunker_id=bunker_id,
        fan_position=1,
        mac_address="AA:BB:CC:DD:EE:21",
    )

    delete_response = await client.delete(
        f"/api/v1/bunkers/{bunker_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204, delete_response.text

    bunker_repo = BunkerRepository(async_session)
    assert await bunker_repo.get_bunker(bunker_id) is None
    assert await device_repo.get_device(device.id) is None


@pytest.mark.asyncio
async def test_create_bunker_validation_errors(
    client: AsyncClient,
) -> None:
    """Invalid bunker payloads are rejected with HTTP 422."""
    headers = await auth_headers(client, username="bunker_validator")
    invalid_payload = base_payload(
        orientation_degrees=400.0,
        latitude=120.0,
        fan_count=0,
    )

    response = await client.post(
        "/api/v1/bunkers",
        json=invalid_payload,
        headers=headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_non_admin_roles_cannot_manage_bunkers(
    client: AsyncClient,
) -> None:
    """Operator role receives 403 for bunker management endpoints."""
    for role, username in (("operator", "operator_denied"), ("viewer", "viewer_denied")):
        headers = await auth_headers(client, username=username, role=role)

        list_response = await client.get("/api/v1/bunkers", headers=headers)
        assert list_response.status_code == 403
        assert list_response.json()["detail"] == "Insufficient permissions"

        create_response = await client.post(
            "/api/v1/bunkers",
            json=base_payload(name=f"{role.title()} Bunker"),
            headers=headers,
        )
        assert create_response.status_code == 403
        assert create_response.json()["detail"] == "Insufficient permissions"


@pytest.mark.asyncio
async def test_list_bunkers_supports_pagination(
    client: AsyncClient,
) -> None:
    """Pagination parameters limit and offset bunker listings."""
    headers = await auth_headers(client, username="bunker_paginator")

    for index, name in enumerate(["Alpha", "Bravo", "Charlie", "Delta"]):
        payload = base_payload(name=name, longitude=-97.0 - index)
        response = await client.post(
            "/api/v1/bunkers",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 201, response.text

    response = await client.get(
        "/api/v1/bunkers",
        params={"limit": 2, "offset": 1},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    bunkers = response.json()["bunkers"]
    assert len(bunkers) == 2
    names = [bunker["name"] for bunker in bunkers]
    assert names == ["Bravo", "Charlie"]


@pytest.mark.asyncio
async def test_get_bunker_returns_404_for_missing_resource(
    client: AsyncClient,
) -> None:
    """GET /bunkers/{id} returns 404 when bunker does not exist."""
    headers = await auth_headers(client, username="missing_bunker_admin")
    missing_id = uuid4()

    response = await client.get(
        f"/api/v1/bunkers/{missing_id}",
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Bunker not found"
