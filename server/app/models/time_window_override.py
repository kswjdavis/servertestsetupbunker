"""TimeWindowOverride model for scheduled operational overrides."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now


class TimeWindowOverride(Base):
    """
    TimeWindowOverride model for scheduled overrides.

    Allows operators to force fans ON or OFF during specific time windows,
    overriding the normal control loop logic.

    Attributes:
        id: UUID primary key
        bunker_id: Foreign key to bunkers table (NULL means global override)
        start_time: Override start timestamp
        end_time: Override end timestamp
        reason: Human-readable reason for override
        created_by: Foreign key to users table (who created the override)
        created_at: Creation timestamp
    """

    __tablename__ = "time_window_overrides"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    bunker_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("bunkers.id", ondelete="CASCADE"), index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    bunker: Mapped["Bunker | None"] = relationship(
        back_populates="time_window_overrides", lazy="selectin"
    )
    created_by_user: Mapped["User"] = relationship(
        back_populates="time_window_overrides", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="check_time_window"),
        Index("idx_time_window_overrides_window", "start_time", "end_time"),
    )

    def __repr__(self) -> str:
        return f"<TimeWindowOverride(id={self.id}, bunker_id={self.bunker_id}, start={self.start_time}, end={self.end_time})>"
