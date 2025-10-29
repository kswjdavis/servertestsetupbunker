"""Device model for ESP32 fan controllers."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now


class Device(Base):
    """
    Device model representing an ESP32 fan controller.

    Attributes:
        id: UUID primary key
        auth_token: UUID authentication token for device
        bunker_id: Foreign key to bunkers table
        fan_position: Position of fan in bunker (1-indexed)
        mac_address: Unique MAC address (format: XX:XX:XX:XX:XX:XX)
        firmware_version: Firmware version string
        last_seen: Last contact timestamp
        provisioned_at: Provisioning timestamp
        led_flash_sequence: LED flash sequence for identification (1-10)
    """

    __tablename__ = "devices"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    auth_token: Mapped[UUID] = mapped_column(
        unique=True, nullable=False, default=uuid4, index=True
    )
    bunker_id: Mapped[UUID] = mapped_column(
        ForeignKey("bunkers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fan_position: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mac_address: Mapped[str] = mapped_column(String(17), unique=True, nullable=False, index=True)
    firmware_version: Mapped[str | None] = mapped_column(String(50))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    provisioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    led_flash_sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    bunker: Mapped["Bunker"] = relationship(back_populates="devices", lazy="selectin")
    device_status: Mapped["DeviceStatus | None"] = relationship(
        back_populates="device", lazy="selectin", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        UniqueConstraint("bunker_id", "fan_position", name="uq_bunker_fan_position"),
        CheckConstraint("led_flash_sequence BETWEEN 1 AND 10", name="check_led_flash_sequence"),
        Index("idx_devices_bunker_id", "bunker_id"),
        Index("idx_devices_last_seen", "last_seen"),
    )

    def __repr__(self) -> str:
        return f"<Device(id={self.id}, mac={self.mac_address}, bunker_id={self.bunker_id}, position={self.fan_position})>"
