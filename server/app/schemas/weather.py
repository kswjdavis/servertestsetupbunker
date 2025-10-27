"""Weather-related API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WeatherData(BaseModel):
    """Latest weather observation cached by the backend."""

    station_id: str
    wind_speed_mph: float | None = Field(
        default=None,
        ge=0,
        description="Wind speed converted from km/h to mph.",
    )
    wind_direction_degrees: float | None = Field(
        default=None,
        ge=0,
        le=360,
        description="Wind direction in degrees (0-360).",
    )
    temperature_f: float | None = Field(
        default=None,
        description="Temperature converted from Celsius to Fahrenheit.",
    )
    fetched_at: datetime = Field(
        description="Timestamp when the backend retrieved the observation."
    )
    observation_time: datetime = Field(
        description="Timestamp of the original observation."
    )

    model_config = ConfigDict(from_attributes=True)


__all__ = ["WeatherData"]
