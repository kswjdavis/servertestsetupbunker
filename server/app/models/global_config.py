"""GlobalConfig model for system-wide configuration (singleton)."""

from sqlalchemy import Boolean, CheckConstraint, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class GlobalConfig(Base):
    """
    GlobalConfig model for system-wide configuration (singleton table).

    This table MUST contain exactly one row with id=1.

    Attributes:
        id: Integer primary key (must equal 1)
        default_wind_threshold_mph: Default wind threshold for new bunkers
        default_electricity_cost_kwh: Default electricity cost for new bunkers
        default_fan_power_watts: Default fan power consumption for new bunkers
        weather_station_id: Weather station identifier to use (e.g., 'KOKC')
        weather_poll_interval_seconds: How often to poll weather API (seconds)
        shutdown_broadcast_interval_seconds: How often to broadcast shutdown commands (seconds)
        device_offline_threshold_seconds: When to consider a device offline (seconds)
    """

    __tablename__ = "global_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    default_wind_threshold_mph: Mapped[float] = mapped_column(Float, nullable=False, default=15.0)
    default_electricity_cost_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.12)
    default_fan_power_watts: Mapped[int] = mapped_column(Integer, nullable=False, default=1500)
    weather_station_id: Mapped[str] = mapped_column(String(10), nullable=False, default="KOKC")
    weather_poll_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    shutdown_broadcast_interval_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    device_offline_threshold_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=120
    )
    emergency_on_global: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (CheckConstraint("id = 1", name="check_singleton"),)

    def __repr__(self) -> str:
        return f"<GlobalConfig(id={self.id}, station={self.weather_station_id}, wind_threshold={self.default_wind_threshold_mph}mph)>"
