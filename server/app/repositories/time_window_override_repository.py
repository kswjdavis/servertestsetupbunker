"""Repository for managing time window overrides."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.time_window_override import TimeWindowOverride
from app.repositories.base import BaseRepository


class TimeWindowOverrideRepository(BaseRepository[TimeWindowOverride]):
    """Repository providing helper queries for time window overrides."""

    def __init__(self, session: AsyncSession):
        super().__init__(TimeWindowOverride, session)

    async def has_active_override(self, bunker_id: UUID) -> bool:
        """
        Return True when a global or bunker-specific override is active.

        Args:
            bunker_id: Identifier of the bunker requesting the status.
        """
        now = datetime.now(timezone.utc)
        stmt = select(TimeWindowOverride.id).where(
            TimeWindowOverride.start_time <= now,
            TimeWindowOverride.end_time >= now,
            or_(
                TimeWindowOverride.bunker_id == bunker_id,
                TimeWindowOverride.bunker_id.is_(None),
            ),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None


__all__ = ["TimeWindowOverrideRepository"]
