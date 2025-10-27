"""Model for revoked JWT access tokens."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, utc_now


class RevokedToken(Base):
    """Persisted record of a revoked JWT access token."""

    __tablename__ = "revoked_tokens"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    jti: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self) -> str:
        return f"<RevokedToken(jti={self.jti}, user_id={self.user_id})>"
