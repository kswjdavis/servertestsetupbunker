"""Integration tests for device provisioning API endpoints."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker


async def create_bunker(
    session: AsyncSession,
    name: str = "North Field",
    fan_count: int = 12,
) -> UUID:
    """Persist a bunker record for provisioning tests."""
    bunker = Bunker(
        name=name,
        latitude=45.0,
        longitude=-93.0,
        orientation_degrees=90.0,
        fan_count=fan_count,
        wind_threshold_mph=30.0,
        electricity_cost_kwh=0.12,
        fan_power_watts=750,
    )
    session.add(bunker)
    await session.commit()
    await session.refresh(bunker)
    return bunker.id


async def auth_headers(client: AsyncClient, username: str = "operator") -> dict[str, str]:
    """Register and authenticate a user, returning bearer headers."""
    register_payload = {
        "username": username,
        "password": "password123",
        "email": f"{username}@example.com",
        "role": "operator",
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
async def test_provision_device_success(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """Provisioning returns auth token and LED sequence."""
    headers = await auth_headers(client)
    bunker_id = await create_bunker(async_session)

    payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:01",
    }
    response = await client.post(
        "/api/v1/devices/provision",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert UUID(body["device_id"])
    assert UUID(body["auth_token"])
    assert body["led_flash_sequence"] == 1
    assert "auth_token" in body
    assert "message" in body


@pytest.mark.asyncio
async def test_duplicate_mac_address_conflict(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """Provisioning with duplicate MAC address returns HTTP 409."""
    headers = await auth_headers(client, username="operator_mac")
    bunker_id = await create_bunker(async_session, name="South Field")

    payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:02",
    }
    first = await client.post(
        "/api/v1/devices/provision", json=payload, headers=headers
    )
    assert first.status_code == 201, first.text

    duplicate = await client.post(
        "/api/v1/devices/provision", json=payload, headers=headers
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "MAC address already provisioned"


@pytest.mark.asyncio
async def test_duplicate_fan_position_conflict(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """Provisioning with duplicate fan position returns HTTP 409."""
    headers = await auth_headers(client, username="operator_fan")
    bunker_id = await create_bunker(async_session, name="East Field")

    first_payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:03",
    }
    second_payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:04",
    }

    first = await client.post(
        "/api/v1/devices/provision", json=first_payload, headers=headers
    )
    assert first.status_code == 201, first.text

    conflict = await client.post(
        "/api/v1/devices/provision", json=second_payload, headers=headers
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Fan position already assigned for bunker"


@pytest.mark.asyncio
async def test_invalid_bunker_returns_not_found(
    client: AsyncClient,
) -> None:
    """Provisioning with unknown bunker triggers 404."""
    headers = await auth_headers(client, username="operator_invalid")
    payload = {
        "bunker_id": str(uuid4()),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:05",
    }
    response = await client.post(
        "/api/v1/devices/provision",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Bunker not found"


@pytest.mark.asyncio
async def test_led_flash_sequence_auto_increments(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """LED flash sequence increments per bunker and caps at 10."""
    headers = await auth_headers(client, username="operator_led")
    bunker_id = await create_bunker(async_session, name="West Field")

    first_payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:06",
    }
    second_payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 2,
        "mac_address": "AA:BB:CC:DD:EE:07",
    }

    first = await client.post(
        "/api/v1/devices/provision", json=first_payload, headers=headers
    )
    second = await client.post(
        "/api/v1/devices/provision", json=second_payload, headers=headers
    )

    assert first.json()["led_flash_sequence"] == 1
    assert second.json()["led_flash_sequence"] == 2


@pytest.mark.asyncio
async def test_led_flash_sequence_limit_enforced(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """Provisioning more than 10 devices in a bunker returns HTTP 400."""
    headers = await auth_headers(client, username="operator_limit")
    bunker_id = await create_bunker(async_session, name="Limit Field", fan_count=12)

    for idx in range(1, 11):
        payload = {
            "bunker_id": str(bunker_id),
            "fan_position": idx,
            "mac_address": f"AA:BB:CC:DD:EE:{idx:02X}",
        }
        response = await client.post(
            "/api/v1/devices/provision",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 201, response.text
        assert response.json()["led_flash_sequence"] == idx

    overflow_payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 11,
        "mac_address": "AA:BB:CC:DD:EE:64",
    }
    overflow_response = await client.post(
        "/api/v1/devices/provision",
        json=overflow_payload,
        headers=headers,
    )
    assert overflow_response.status_code == 400
    assert overflow_response.json()["detail"] == "Maximum of 10 devices per bunker"


@pytest.mark.asyncio
async def test_list_devices_excludes_auth_token(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """GET /devices returns device details without auth token."""
    headers = await auth_headers(client, username="operator_list")
    bunker_id = await create_bunker(async_session, name="Listing Field")

    payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:08",
    }
    post_response = await client.post(
        "/api/v1/devices/provision", json=payload, headers=headers
    )
    device_id = post_response.json()["device_id"]

    list_response = await client.get("/api/v1/devices", headers=headers)
    assert list_response.status_code == 200, list_response.text
    body = list_response.json()

    assert "devices" in body
    assert len(body["devices"]) == 1
    device = body["devices"][0]
    assert device["id"] == device_id
    assert "auth_token" not in device
    assert device["is_online"] is False


@pytest.mark.asyncio
async def test_get_device_returns_details(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """GET /devices/{id} returns device metadata without auth token."""
    headers = await auth_headers(client, username="operator_get")
    bunker_id = await create_bunker(async_session, name="Detail Field")

    payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:09",
    }
    provision_response = await client.post(
        "/api/v1/devices/provision", json=payload, headers=headers
    )
    device_id = provision_response.json()["device_id"]

    detail_response = await client.get(
        f"/api/v1/devices/{device_id}", headers=headers
    )
    assert detail_response.status_code == 200, detail_response.text
    device = detail_response.json()

    assert device["id"] == device_id
    assert device["mac_address"] == payload["mac_address"]
    assert device["led_flash_sequence"] == 1
    assert "auth_token" not in device


@pytest.mark.asyncio
async def test_delete_device_deprovisions(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """DELETE /devices/{id} removes the device."""
    headers = await auth_headers(client, username="operator_delete")
    bunker_id = await create_bunker(async_session, name="Delete Field")

    payload = {
        "bunker_id": str(bunker_id),
        "fan_position": 1,
        "mac_address": "AA:BB:CC:DD:EE:10",
    }
    provision_response = await client.post(
        "/api/v1/devices/provision", json=payload, headers=headers
    )
    device_id = provision_response.json()["device_id"]

    delete_response = await client.delete(
        f"/api/v1/devices/{device_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    missing = await client.get(f"/api/v1/devices/{device_id}", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Device not found"
