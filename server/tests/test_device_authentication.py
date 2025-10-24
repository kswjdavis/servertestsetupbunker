"""Integration tests for device authentication (Story 1.7)."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device


async def create_bunker_and_device(
    session: AsyncSession,
    bunker_name: str = "Test Bunker",
) -> tuple[UUID, UUID, UUID]:
    """
    Create test bunker and device with auth token.

    Returns:
        Tuple of (bunker_id, device_id, auth_token)
    """
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
        mac_address="AA:BB:CC:DD:EE:FF",
        led_flash_sequence=1,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)

    return bunker.id, device.id, device.auth_token


def valid_status_payload() -> dict:
    """Return a valid device status request payload."""
    return {
        "relay_state": "ON",
        "uptime_seconds": 3600,
        "wifi_rssi": -45,
        "countdown_timer_remaining": 0,
        "firmware_version": "1.0.0",
    }


@pytest.mark.asyncio
async def test_valid_token_returns_200_ok(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """
    1.7-INT-007: Valid device token returns 200 OK.

    Tests AC3: Server validates token and returns 200 OK for valid requests.
    """
    _, _, auth_token = await create_bunker_and_device(async_session, "Valid Token Bunker")

    headers = {"Authorization": f"Bearer {auth_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert "shutdown_allowed" in body
    assert "reset_countdown" in body
    assert "server_time" in body


@pytest.mark.asyncio
async def test_missing_authorization_header_returns_401(
    client: AsyncClient,
) -> None:
    """
    1.7-INT-009: Missing Authorization header returns 401.

    Tests AC4: Server returns 401 Unauthorized for missing tokens.
    """
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        # No Authorization header
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_malformed_token_returns_401(
    client: AsyncClient,
) -> None:
    """
    1.7-INT-010: Malformed token (invalid UUID) returns 401.

    Tests AC4: Server returns 401 Unauthorized for malformed tokens.
    Tests token format validation before DB lookup.
    """
    # Test various malformed token formats
    malformed_tokens = [
        "not-a-uuid",
        "12345",
        "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",  # Invalid hex chars
        "null",
    ]

    for bad_token in malformed_tokens:
        headers = {"Authorization": f"Bearer {bad_token}"}
        response = await client.post(
            "/api/v1/control/status",
            json=valid_status_payload(),
            headers=headers,
        )

        assert response.status_code == 401, f"Failed for token: {bad_token}"
        # All malformed tokens should return 401, regardless of exact message
        assert response.json()["detail"] in [
            "Invalid device authentication token",
            "Not authenticated",
        ]


@pytest.mark.asyncio
async def test_nonexistent_token_returns_401(
    client: AsyncClient,
) -> None:
    """
    1.7-INT-011: Valid UUID format but non-existent token returns 401.

    Tests AC4: Server returns 401 Unauthorized for tokens not in database.
    Tests database lookup validation after format check.
    """
    # Valid UUID format but doesn't exist in database
    fake_token = uuid4()

    headers = {"Authorization": f"Bearer {fake_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid device authentication token"


@pytest.mark.asyncio
async def test_invalid_bearer_scheme_returns_401(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """
    Additional security test: Non-Bearer authentication scheme returns 401.

    Ensures only Bearer tokens are accepted.
    """
    _, _, auth_token = await create_bunker_and_device(async_session, "Scheme Test Bunker")

    # Test with "Basic" scheme instead of "Bearer"
    headers = {"Authorization": f"Basic {auth_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 401
    # HTTPBearer with auto_error=False returns None for invalid schemes,
    # triggering "Not authenticated" rather than "Invalid authentication scheme"
    assert response.json()["detail"] in [
        "Invalid authentication scheme",
        "Not authenticated",
    ]


@pytest.mark.asyncio
async def test_device_last_seen_updated_on_successful_auth(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """
    Additional test: Device last_seen timestamp updated on successful auth.

    Verifies authentication updates device heartbeat.
    """
    _, device_id, auth_token = await create_bunker_and_device(
        async_session, "Heartbeat Bunker"
    )

    # Get initial last_seen (should be None)
    device = await async_session.get(Device, device_id)
    assert device is not None
    initial_last_seen = device.last_seen

    # Send status with valid auth
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 200

    # Verify last_seen was updated
    await async_session.refresh(device)
    assert device.last_seen is not None
    assert device.last_seen != initial_last_seen


@pytest.mark.asyncio
async def test_firmware_version_updated_on_status_report(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """
    Additional test: Firmware version updated during status reporting.

    Verifies device metadata updated alongside authentication.
    """
    _, device_id, auth_token = await create_bunker_and_device(
        async_session, "Firmware Version Bunker"
    )

    # Initial firmware version should be None
    device = await async_session.get(Device, device_id)
    assert device is not None
    assert device.firmware_version is None

    # Send status with firmware version
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = valid_status_payload()
    payload["firmware_version"] = "2.3.1"

    response = await client.post(
        "/api/v1/control/status",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200

    # Verify firmware version was updated
    await async_session.refresh(device)
    assert device.firmware_version == "2.3.1"


@pytest.mark.asyncio
async def test_case_sensitive_bearer_scheme(
    async_session: AsyncSession,
    client: AsyncClient,
) -> None:
    """
    Additional test: Bearer scheme is case-insensitive.

    Tests AC2: Authorization header parsing flexibility.
    """
    _, _, auth_token = await create_bunker_and_device(
        async_session, "Case Sensitivity Bunker"
    )

    # Test lowercase "bearer"
    headers = {"Authorization": f"bearer {auth_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 200, "lowercase 'bearer' should be accepted"

    # Test uppercase "BEARER"
    headers = {"Authorization": f"BEARER {auth_token}"}
    response = await client.post(
        "/api/v1/control/status",
        json=valid_status_payload(),
        headers=headers,
    )

    assert response.status_code == 200, "uppercase 'BEARER' should be accepted"
