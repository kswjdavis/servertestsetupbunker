"""Bunker management API endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole
from app.repositories.bunker_repository import BunkerRepository
from app.repositories.device_repository import DeviceRepository
from app.repositories.device_status_repository import DeviceStatusRepository
from app.schemas.bunker import (
    BunkerCreate,
    BunkerDeviceStatus,
    BunkerListResponse,
    BunkerResponse,
    BunkerStatusResponse,
    BunkerUpdate,
)
from app.schemas.weather import WeatherData

router = APIRouter(prefix="/bunkers", tags=["bunkers"])
AdminUser = Annotated[User, Depends(require_roles([UserRole.ADMIN.value]))]
OperatorOrAdminUser = Annotated[
    User,
    Depends(require_roles([UserRole.ADMIN.value, UserRole.OPERATOR.value])),
]


@router.post(
    "",
    response_model=BunkerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bunker(
    payload: BunkerCreate,
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> BunkerResponse:
    """Create a new bunker configuration."""
    repository = BunkerRepository(session)
    bunker = await repository.create_bunker(**payload.model_dump())
    return BunkerResponse.model_validate(bunker, from_attributes=True)


@router.get(
    "",
    response_model=BunkerListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_bunkers(
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of bunkers to return"),
    offset: int = Query(0, ge=0, description="Number of bunkers to skip before returning results"),
) -> BunkerListResponse:
    """List all bunker configurations with device counts."""
    repository = BunkerRepository(session)
    bunkers = await repository.list_bunkers(limit=limit, offset=offset)
    return BunkerListResponse(
        bunkers=[
            BunkerResponse.model_validate(bunker, from_attributes=True)
            for bunker in bunkers
        ]
    )


@router.get(
    "/{bunker_id}",
    response_model=BunkerResponse,
    status_code=status.HTTP_200_OK,
)
async def get_bunker(
    bunker_id: UUID,
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> BunkerResponse:
    """Retrieve bunker details including device counts."""
    repository = BunkerRepository(session)
    bunker = await repository.get_bunker(bunker_id)
    if bunker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bunker not found",
        )
    return BunkerResponse.model_validate(bunker, from_attributes=True)


@router.put(
    "/{bunker_id}",
    response_model=BunkerResponse,
    status_code=status.HTTP_200_OK,
)
async def update_bunker(
    bunker_id: UUID,
    payload: BunkerUpdate,
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> BunkerResponse:
    """Update bunker configuration values."""
    repository = BunkerRepository(session)
    bunker = await repository.update_bunker(
        bunker_id,
        **payload.model_dump(exclude_unset=True),
    )
    return BunkerResponse.model_validate(bunker, from_attributes=True)


@router.delete(
    "/{bunker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_bunker(
    bunker_id: UUID,
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a bunker and cascade associated devices."""
    repository = BunkerRepository(session)
    await repository.delete_bunker(bunker_id)


@router.get(
    "/{bunker_id}/status",
    response_model=BunkerStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_bunker_status(
    bunker_id: UUID,
    _: OperatorOrAdminUser,
    session: AsyncSession = Depends(get_db),
) -> BunkerStatusResponse:
    """Get detailed status for a bunker including all devices and current weather."""
    bunker_repo = BunkerRepository(session)
    bunker = await bunker_repo.get_bunker(bunker_id)
    if bunker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bunker not found",
        )

    device_repo = DeviceRepository(session)
    devices = await device_repo.get_devices_by_bunker(bunker_id)

    status_repo = DeviceStatusRepository(session)
    statuses = {
        status.device_id: status
        for status in await status_repo.get_status_for_bunker(bunker_id)
    }

    def device_is_online(last_seen: datetime | None) -> bool:
        if last_seen is None:
            return False
        current_time = datetime.now(timezone.utc)
        return current_time - last_seen <= timedelta(minutes=2)

    device_payload: list[BunkerDeviceStatus] = []
    for device in devices:
        telemetry = statuses.get(device.id)
        device_payload.append(
            BunkerDeviceStatus(
                device_id=device.id,
                fan_position=device.fan_position,
                mac_address=device.mac_address,
                relay_state=telemetry.relay_state if telemetry else "UNKNOWN",
                is_online=device_is_online(device.last_seen),
                wifi_rssi=telemetry.wifi_rssi if telemetry else None,
                uptime_seconds=telemetry.uptime_seconds if telemetry else None,
                countdown_timer_remaining=(
                    telemetry.countdown_timer_remaining if telemetry else None
                ),
                last_seen=device.last_seen,
                reported_at=telemetry.reported_at if telemetry else None,
                server_received_at=telemetry.server_received_at if telemetry else None,
                free_heap_bytes=telemetry.free_heap_bytes if telemetry else None,
                wifi_ps_mode=telemetry.wifi_ps_mode if telemetry else None,
                cpu_freq_mhz=telemetry.cpu_freq_mhz if telemetry else None,
                watchdog_reset_count=telemetry.watchdog_reset_count if telemetry else None,
                last_reset_reason=telemetry.last_reset_reason if telemetry else None,
            )
        )

    from app.services.weather_service import weather_service

    weather: WeatherData | None = None
    try:
        weather = weather_service.get_current_weather()
    except ValueError:
        weather = None

    return BunkerStatusResponse(
        bunker=BunkerResponse.model_validate(bunker, from_attributes=True),
        devices=device_payload,
        weather=weather,
    )


__all__ = ["router"]
