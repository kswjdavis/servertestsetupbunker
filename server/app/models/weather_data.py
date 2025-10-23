"""WeatherData model for current weather conditions cache."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class WeatherData(Base):
    """
    WeatherData model for current weather conditions (not historical).

    This is a singleton per weather station - one row per station, updated periodically.

    Attributes:
        station_id: Weather station identifier (primary key, e.g., 'KOKC')
        wind_speed_mph: Current wind speed in mph
        wind_direction_degrees: Wind direction (0-360, 0=North, 90=East)
        temperature_f: Temperature in Fahrenheit
        fetched_at: When server fetched the weather data
        observation_time: When weather station observed the conditions
    """

    __tablename__ = "weather_data"

    station_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    wind_speed_mph: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    wind_direction_degrees: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    temperature_f: Mapped[float] = mapped_column(Float, nullable=False, default=32.0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    observation_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "wind_direction_degrees >= 0 AND wind_direction_degrees < 360",
            name="check_wind_direction",
        ),
    )

    def __repr__(self) -> str:
        return f"<WeatherData(station={self.station_id}, wind_speed={self.wind_speed_mph}mph, temp={self.temperature_f}F)>"
