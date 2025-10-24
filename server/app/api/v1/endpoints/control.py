"""Device control endpoints for ESP32 status reporting."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_device
from app.models import utc_now
from app.models.device import Device
from app.repositories.device_status_repository import DeviceStatusRepository
from app.schemas.device import DeviceStatusRequest, DeviceStatusResponse

router = APIRouter(prefix="/control", tags=["control"])


@router.post(
    "/status",
    response_model=DeviceStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def report_device_status(
    payload: DeviceStatusRequest,
    device: Device = Depends(get_current_device),
    session: AsyncSession = Depends(get_db),
) -> DeviceStatusResponse:
    """
    Accept device telemetry, persist it, and return server control decision.

    The device authenticates using its provisioned bearer token. Upon receipt we
    update the device heartbeat, upsert its latest telemetry snapshot, and reply
    with shutdown guidance. Control logic integration will arrive in later
    stories; for now the decision defaults to keeping fans running.
    """
    received_at = utc_now()
    device.last_seen = received_at
    device.firmware_version = payload.firmware_version
    await session.commit()

    status_repository = DeviceStatusRepository(session)
    await status_repository.upsert_status(
        device_id=device.id,
        relay_state=payload.relay_state.value,
        uptime_seconds=payload.uptime_seconds,
        wifi_rssi=payload.wifi_rssi,
        countdown_timer_remaining=payload.countdown_timer_remaining,
        reported_at=received_at,
    )

    # Placeholder logic until Story 2.5 implements the control logic engine.
    return DeviceStatusResponse(
        shutdown_allowed=False,
        reset_countdown=False,
        server_time=received_at,
    )
