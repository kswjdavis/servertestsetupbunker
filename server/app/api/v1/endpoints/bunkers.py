"""Bunker management API endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole
from app.repositories.bunker_repository import BunkerRepository
from app.schemas.bunker import (
    BunkerCreate,
    BunkerListResponse,
    BunkerResponse,
    BunkerUpdate,
)

router = APIRouter(prefix="/bunkers", tags=["bunkers"])
AdminUser = Annotated[User, Depends(require_roles([UserRole.ADMIN.value]))]


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


__all__ = ["router"]
