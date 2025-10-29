"""DeviceRuntimeLog model for tracking fan runtime intervals."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now

if TYPE_CHECKING:
    from app.models.device import Device


class RuntimeState(str, Enum):
    """Device runtime states."""

    ON = "on"
    OFF = "off"


class RuntimeSource(str, Enum):
    """Source of runtime state change."""

    CONTROL_LOGIC = "control_logic"
    MANUAL = "manual"
    EMERGENCY = "emergency"


class DeviceRuntimeLog(Base):
    """
    DeviceRuntimeLog model for tracking device on/off runtime intervals.

    This model stores interval-based logs to enable precise energy aggregation
    and analytics. Each log entry represents a state change or runtime period.

    Attributes:
        id: UUID primary key
        device_id: Foreign key to devices table
        started_at: Timestamp when the state began
        ended_at: Timestamp when the state ended (NULL if currently active)
        state: Runtime state (on/off)
        source: Source of the state change (control_logic/manual/emergency)
        created_at: Record creation timestamp
        updated_at: Record update timestamp
    """

    __tablename__ = "device_runtime_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    device_id: Mapped[UUID] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    state: Mapped[RuntimeState] = mapped_column(String(20), nullable=False)
    source: Mapped[RuntimeSource] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    device: Mapped["Device"] = relationship(lazy="selectin")

    __table_args__ = (
        # Composite index for efficient time-windowed queries by device
        Index("idx_device_runtime_logs_device_time", "device_id", "started_at"),
        # Index for finding active (unclosed) runtime logs
        Index("idx_device_runtime_logs_active", "device_id", "ended_at"),
    )

    def __repr__(self) -> str:
        return f"<DeviceRuntimeLog(id={self.id}, device_id={self.device_id}, state={self.state}, started_at={self.started_at})>"

    @property
    def duration_seconds(self) -> float | None:
        """
        Calculate the duration of this runtime log entry in seconds.

        Returns:
            float | None: Duration in seconds, or None if the log is still active (ended_at is None).
        """
        if self.ended_at is None:
            return None
        return (self.ended_at - self.started_at).total_seconds()
