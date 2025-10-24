"""Bunker model for grain storage facilities."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now


class Bunker(Base):
    """
    Bunker model representing a grain storage facility.

    Attributes:
        id: UUID primary key
        name: Bunker name (max 100 chars)
        latitude: GPS latitude coordinate
        longitude: GPS longitude coordinate
        orientation_degrees: Bunker orientation (0-360)
        fan_count: Number of fans in bunker
        wind_threshold_mph: Wind speed threshold for activation
        electricity_cost_kwh: Cost per kWh for electricity
        fan_power_watts: Power consumption per fan in watts
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "bunkers"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    orientation_degrees: Mapped[float] = mapped_column(Float, nullable=False)
    fan_count: Mapped[int] = mapped_column(Integer, nullable=False)
    wind_threshold_mph: Mapped[float | None] = mapped_column(Float)
    electricity_cost_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    fan_power_watts: Mapped[int] = mapped_column(Integer, nullable=False)
    emergency_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    devices: Mapped[list["Device"]] = relationship(
        back_populates="bunker", lazy="selectin", cascade="all, delete-orphan"
    )
    time_window_overrides: Mapped[list["TimeWindowOverride"]] = relationship(
        back_populates="bunker", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("orientation_degrees >= 0 AND orientation_degrees < 360", name="check_orientation"),
        CheckConstraint("fan_count > 0", name="check_fan_count"),
    )

    def __repr__(self) -> str:
        return f"<Bunker(id={self.id}, name={self.name}, fan_count={self.fan_count})>"
