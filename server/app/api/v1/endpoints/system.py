"""System-wide health monitoring API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.system_health import SystemHealthSummary
from app.services.system_health_service import SystemHealthService

router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/health",
    response_model=SystemHealthSummary,
    status_code=status.HTTP_200_OK,
)
async def read_system_health(
    session: AsyncSession = Depends(get_db),
) -> SystemHealthSummary:
    """Return aggregated metrics describing overall system health.

    Public endpoint - no authentication required.
    """
    service = SystemHealthService(session)
    return await service.get_health_metrics()
