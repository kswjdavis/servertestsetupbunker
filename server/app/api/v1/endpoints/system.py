"""System-wide health monitoring API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole
from app.schemas.system_health import SystemHealthSummary
from app.services.system_health_service import SystemHealthService

router = APIRouter(prefix="/system", tags=["system"])
AdminUser = Annotated[User, Depends(require_roles([UserRole.ADMIN.value]))]


@router.get(
    "/health",
    response_model=SystemHealthSummary,
    status_code=status.HTTP_200_OK,
)
async def read_system_health(
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> SystemHealthSummary:
    """Return aggregated metrics describing overall system health."""
    service = SystemHealthService(session)
    return await service.get_health_metrics()
