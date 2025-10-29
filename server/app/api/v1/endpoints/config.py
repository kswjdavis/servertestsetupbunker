"""Global configuration API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole
from app.repositories.global_config_repository import GlobalConfigRepository
from app.schemas.config import GlobalConfigResponse, GlobalConfigUpdate

router = APIRouter(prefix="/config", tags=["config"])
AdminUser = Annotated[User, Depends(require_roles([UserRole.ADMIN.value]))]


@router.get(
    "",
    response_model=GlobalConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def read_global_config(
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> GlobalConfigResponse:
    """Return the singleton global configuration record (creates defaults if missing)."""
    repository = GlobalConfigRepository(session)
    config = await repository.get_or_create_default()
    return GlobalConfigResponse.model_validate(config, from_attributes=True)


@router.put(
    "",
    response_model=GlobalConfigResponse,
    status_code=status.HTTP_200_OK,
)
async def update_global_config(
    payload: GlobalConfigUpdate,
    _: AdminUser,
    session: AsyncSession = Depends(get_db),
) -> GlobalConfigResponse:
    """Update the global configuration singleton."""
    repository = GlobalConfigRepository(session)
    config = await repository.update_config(**payload.model_dump(exclude_none=True))
    return GlobalConfigResponse.model_validate(config, from_attributes=True)


__all__ = ["router"]
