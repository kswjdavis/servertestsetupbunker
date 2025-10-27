"""Repository for revoked JWT tokens."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revoked_token import RevokedToken


class RevokedTokenRepository:
    """Data access layer for revoked tokens."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, jti: str, user_id: UUID, expires_at: datetime) -> None:
        """Persist a revoked token."""
        if await self.is_revoked(jti):
            return

        record = RevokedToken(jti=jti, user_id=user_id, expires_at=expires_at)
        self.session.add(record)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()

    async def is_revoked(self, jti: str) -> bool:
        """Return True if the token identifier has been revoked."""
        result = await self.session.execute(
            select(RevokedToken.id).where(RevokedToken.jti == jti)
        )
        return result.scalar_one_or_none() is not None

    async def purge_expired(self) -> None:
        """Delete expired revoked token records."""
        now = datetime.now(timezone.utc)
        await self.session.execute(
            delete(RevokedToken).where(RevokedToken.expires_at <= now)
        )
        await self.session.commit()
