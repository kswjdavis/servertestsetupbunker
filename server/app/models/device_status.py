"""DeviceStatus model for real-time device telemetry."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now


class RelayState(str, Enum):
    """Relay state enum."""

    ON = "ON"
    OFF = "OFF"


class DeviceStatus(Base):
    """
    DeviceStatus model for current device telemetry (not historical).

    This is a singleton per device - one row per device, updated on each status report.

    Attributes:
        device_id: Foreign key to devices table (primary key)
        relay_state: Current relay state (ON or OFF)
        uptime_seconds: Device uptime in seconds
        wifi_rssi: WiFi signal strength in dBm (negative value)
        countdown_timer_remaining: Countdown timer remaining (0-300 seconds)
        reported_at: Timestamp from device when status was generated
        server_received_at: Timestamp when server received the status
    """

    __tablename__ = "device_status"

    device_id: Mapped[UUID] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True
    )
    relay_state: Mapped[str] = mapped_column(String(10), nullable=False, default=RelayState.OFF.value)
    uptime_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wifi_rssi: Mapped[int] = mapped_column(Integer, nullable=False, default=-100)
    countdown_timer_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    server_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    device: Mapped["Device"] = relationship(back_populates="device_status", lazy="selectin")

    __table_args__ = (
        CheckConstraint("relay_state IN ('ON', 'OFF')", name="check_relay_state"),
        CheckConstraint(
            "countdown_timer_remaining BETWEEN 0 AND 300", name="check_countdown_timer"
        ),
    )

    def __repr__(self) -> str:
        return f"<DeviceStatus(device_id={self.device_id}, relay_state={self.relay_state}, uptime={self.uptime_seconds}s)>"
