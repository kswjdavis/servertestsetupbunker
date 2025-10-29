"""Time window override management endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.time_window_override import TimeWindowOverride
from app.models.user import User
from app.repositories.time_window_override_repository import (
    TimeWindowOverrideRepository,
)

router = APIRouter(prefix="/overrides", tags=["overrides"])


class TimeWindowOverrideResponse(BaseModel):
    """Time window override response model."""

    id: UUID
    bunker_id: UUID | None
    start_time: datetime
    end_time: datetime
    reason: str
    is_global: bool
    created_by: UUID
    created_at: datetime

    @staticmethod
    def from_orm(override: TimeWindowOverride) -> TimeWindowOverrideResponse:
        """Convert ORM model to response."""
        return TimeWindowOverrideResponse(
            id=override.id,
            bunker_id=override.bunker_id,
            start_time=override.start_time,
            end_time=override.end_time,
            reason=override.reason,
            is_global=override.bunker_id is None,
            created_by=override.created_by,
            created_at=override.created_at,
        )

    model_config = {"from_attributes": True}


class CreateOverrideRequest(BaseModel):
    """Request model for creating a time window override."""

    bunker_id: UUID | None = None
    start_time: datetime
    end_time: datetime
    reason: str = Field(..., min_length=1, max_length=500)
    is_global: bool = False

    model_config = {"from_attributes": True}


@router.get("", response_model=list[TimeWindowOverrideResponse])
async def list_overrides(
    bunker_id: Annotated[UUID | None, Query()] = None,
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[TimeWindowOverrideResponse]:
    """
    List all time window overrides.

    Optionally filter by bunker_id to get bunker-specific overrides.
    Global overrides (bunker_id=null) are always included.
    """
    repo = TimeWindowOverrideRepository(session)

    # Build query based on filter
    if bunker_id:
        # Get overrides for specific bunker and global overrides
        overrides = await repo.get_all()
        filtered = [
            o
            for o in overrides
            if o.bunker_id is None or o.bunker_id == bunker_id
        ]
    else:
        # Get all overrides
        filtered = await repo.get_all()

    return [TimeWindowOverrideResponse.from_orm(o) for o in filtered]


@router.post(
    "", response_model=TimeWindowOverrideResponse, status_code=status.HTTP_201_CREATED
)
async def create_override(
    request: CreateOverrideRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TimeWindowOverrideResponse:
    """
    Create a new time window override.

    Validates that end_time > start_time.
    If is_global is True, bunker_id is set to None.
    """
    # Validate time window
    if request.end_time <= request.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be after start_time",
        )

    # If global override requested, ensure bunker_id is None
    bunker_id = None if request.is_global else request.bunker_id

    # Create override
    repo = TimeWindowOverrideRepository(session)
    override = TimeWindowOverride(
        bunker_id=bunker_id,
        start_time=request.start_time,
        end_time=request.end_time,
        reason=request.reason,
        created_by=current_user.id,
    )

    session.add(override)
    await session.commit()
    await session.refresh(override)

    return TimeWindowOverrideResponse.from_orm(override)


@router.delete("/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_override(
    override_id: UUID,
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a time window override by ID.

    Returns 404 if override not found.
    """
    repo = TimeWindowOverrideRepository(session)
    override = await repo.get(override_id)

    if not override:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Override not found"
        )

    await repo.delete(override_id)
    await session.commit()


__all__ = ["router"]
