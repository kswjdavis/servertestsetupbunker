"""Global configuration schemas and validation rules."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GlobalConfigBase(BaseModel):
    """Shared validation logic for global configuration fields."""

    default_wind_threshold_mph: float = Field(
        gt=0,
        description="Default wind threshold in miles per hour; must be positive.",
    )
    default_electricity_cost_kwh: float = Field(
        gt=0,
        description="Electricity cost per kWh in USD; must be positive.",
    )
    default_fan_power_watts: int = Field(
        gt=0,
        description="Fan power consumption in watts; must be positive.",
    )
    weather_station_id: str = Field(
        min_length=4,
        max_length=5,
        description="NOAA weather station identifier (typically ICAO, e.g., 'KOKC').",
    )
    default_wind_threshold_hysteresis_mph: float | None = Field(
        default=None,
        ge=0,
        le=20,
        description="Optional hysteresis gap for wind threshold anti-cycling.",
    )
    weather_poll_interval_seconds: int | None = Field(
        default=None,
        ge=30,
        le=3600,
        description="How frequently to poll the weather API in seconds.",
    )
    shutdown_broadcast_interval_seconds: int | None = Field(
        default=None,
        ge=10,
        le=600,
        description="Interval for broadcasting shutdown commands in seconds.",
    )
    device_offline_threshold_seconds: int | None = Field(
        default=None,
        ge=30,
        le=3600,
        description="Threshold to mark devices as offline in seconds.",
    )
    emergency_on_global: bool | None = Field(
        default=None,
        description="Global emergency override flag applied to all bunkers.",
    )

    @field_validator("weather_station_id")
    @classmethod
    def validate_station_id(cls, value: str) -> str:
        """Ensure weather station IDs match expected ICAO-style formatting."""
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{4,5}", normalized):
            msg = "Weather station ID must be 4-5 alphanumeric characters (e.g., 'KOKC')."
            raise ValueError(msg)
        return normalized


class GlobalConfigResponse(GlobalConfigBase):
    """Serialized representation of the global configuration singleton."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    default_wind_threshold_hysteresis_mph: float
    weather_poll_interval_seconds: int
    shutdown_broadcast_interval_seconds: int
    device_offline_threshold_seconds: int
    emergency_on_global: bool


class GlobalConfigUpdate(GlobalConfigBase):
    """Payload for updating global configuration values."""

    pass


__all__ = ["GlobalConfigResponse", "GlobalConfigUpdate"]
