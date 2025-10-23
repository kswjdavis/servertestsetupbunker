"""Device provisioning and management API endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.repositories.device_repository import DeviceRepository
from app.schemas.device import (
    DeviceListResponse,
    DeviceProvisionRequest,
    DeviceProvisionResponse,
    DeviceResponse,
)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post(
    "/provision",
    response_model=DeviceProvisionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def provision_device(
    payload: DeviceProvisionRequest,
    session: AsyncSession = Depends(get_db),
    _: Annotated[User, Depends(get_current_user)],
) -> DeviceProvisionResponse:
    """Provision a new ESP32 device and return the auth token exactly once."""
    repository = DeviceRepository(session)
    device = await repository.provision_device(
        bunker_id=payload.bunker_id,
        fan_position=payload.fan_position,
        mac_address=payload.mac_address,
    )
    return DeviceProvisionResponse(
        device_id=device.id,
        auth_token=device.auth_token,
        led_flash_sequence=device.led_flash_sequence,
        message="Device provisioned successfully. Store auth_token securely; it will not be shown again.",
    )


@router.get(
    "",
    response_model=DeviceListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_devices(
    session: AsyncSession = Depends(get_db),
    _: Annotated[User, Depends(get_current_user)],
) -> DeviceListResponse:
    """List all provisioned devices (auth token excluded)."""
    repository = DeviceRepository(session)
    devices = await repository.list_devices()
    return DeviceListResponse(
        devices=[DeviceResponse.model_validate(device) for device in devices]
    )


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    status_code=status.HTTP_200_OK,
)
async def get_device(
    device_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: Annotated[User, Depends(get_current_user)],
) -> DeviceResponse:
    """Fetch a single device by its identifier."""
    repository = DeviceRepository(session)
    device = await repository.get_device(device_id)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return DeviceResponse.model_validate(device)


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_device(
    device_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: Annotated[User, Depends(get_current_user)],
) -> None:
    """Deprovision a device from the system."""
    repository = DeviceRepository(session)
    await repository.delete_device(device_id)
