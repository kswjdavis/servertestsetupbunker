"""Device control endpoints for ESP32 status reporting."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_device
from app.models import utc_now
from app.models.device import Device
from app.repositories.device_status_repository import DeviceStatusRepository
from app.schemas.device import DeviceStatusRequest, DeviceStatusResponse
from app.services.control_logic_engine import control_logic_engine

router = APIRouter(prefix="/control", tags=["control"])

logger = logging.getLogger(__name__)


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
    with shutdown guidance determined by the control logic engine.
    """
    received_at = utc_now()
    device.last_seen = received_at
    device.firmware_version = payload.firmware_version
    await session.commit()

    status_repository = DeviceStatusRepository(session)
    try:
        await status_repository.upsert_status(
            device_id=device.id,
            relay_state=payload.relay_state.value,
            uptime_seconds=payload.uptime_seconds,
            wifi_rssi=payload.wifi_rssi,
            countdown_timer_remaining=payload.countdown_timer_remaining,
            reported_at=received_at,
        )

        decision = await control_logic_engine.should_shutdown_fans(
            device_id=device.id,
            session=session,
        )
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Database failure while processing device status: %s", exc)
        return DeviceStatusResponse(
            shutdown_allowed=False,
            reset_countdown=False,
            reason="db_error_fail_safe",
            server_time=received_at,
        )

    return DeviceStatusResponse(
        shutdown_allowed=decision.shutdown_allowed,
        reset_countdown=decision.reset_countdown,
        reason=decision.reason,
        server_time=received_at,
    )
