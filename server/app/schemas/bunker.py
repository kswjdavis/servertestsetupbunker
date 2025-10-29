"""Bunker management schemas with validation rules."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.weather import WeatherData


class BunkerBase(BaseModel):
    """Shared bunker attributes for create/update schemas."""

    name: str = Field(min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    orientation_degrees: float = Field(ge=0, lt=360)
    fan_count: int = Field(ge=1, le=10)
    wind_threshold_mph: float | None = Field(default=None, ge=0)
    electricity_cost_kwh: float | None = Field(default=None, gt=0)
    fan_power_watts: int | None = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Ensure bunker names do not contain leading/trailing whitespace."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must contain non-whitespace characters")
        return stripped


class BunkerCreate(BunkerBase):
    """Payload for creating a new bunker."""

    pass


class BunkerUpdate(BaseModel):
    """Payload for updating bunker configuration."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    orientation_degrees: float | None = Field(default=None, ge=0, lt=360)
    fan_count: int | None = Field(default=None, ge=1, le=10)
    wind_threshold_mph: float | None = Field(default=None, ge=0)
    electricity_cost_kwh: float | None = Field(default=None, gt=0)
    fan_power_watts: int | None = Field(default=None, gt=0)
    emergency_on: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        """Normalize optional bunker name input."""
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must contain non-whitespace characters")
        return stripped


class BunkerResponse(BunkerBase):
    """Serialized bunker representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    wind_threshold_mph: float
    electricity_cost_kwh: float
    fan_power_watts: int
    emergency_on: bool
    device_count: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime


class BunkerDeviceStatus(BaseModel):
    """Telemetry snapshot for a single device within a bunker."""

    model_config = ConfigDict(from_attributes=True)

    device_id: UUID
    fan_position: int = Field(ge=1, description="Fan position within the bunker (1-based).")
    mac_address: str = Field(description="Device MAC address in canonical format.")
    relay_state: Literal["ON", "OFF", "UNKNOWN"] = Field(
        description="Current relay state reported by the device or UNKNOWN if unavailable."
    )
    is_online: bool = Field(description="Derived online status based on last_seen timestamp.")
    wifi_rssi: int | None = Field(
        default=None,
        description="WiFi signal strength in dBm (negative).",
    )
    uptime_seconds: int | None = Field(
        default=None,
        description="Device uptime in seconds as reported by firmware.",
    )
    countdown_timer_remaining: int | None = Field(
        default=None,
        description="Seconds remaining on local shutdown countdown timer.",
    )
    last_seen: datetime | None = Field(
        default=None,
        description="Timestamp when the device last contacted the server.",
    )
    reported_at: datetime | None = Field(
        default=None,
        description="Timestamp reported by the device for the status payload.",
    )
    server_received_at: datetime | None = Field(
        default=None,
        description="Timestamp when the server persisted the status payload.",
    )
    free_heap_bytes: int | None = Field(
        default=None,
        description="Optional telemetry: free heap memory in bytes.",
    )
    wifi_ps_mode: int | None = Field(
        default=None,
        description="Optional telemetry: WiFi power save mode.",
    )
    cpu_freq_mhz: int | None = Field(
        default=None,
        description="Optional telemetry: CPU frequency in MHz.",
    )
    watchdog_reset_count: int | None = Field(
        default=None,
        description="Optional telemetry: Watchdog reset count.",
    )
    last_reset_reason: str | None = Field(
        default=None,
        description="Optional telemetry: Last reset reason string.",
    )


class BunkerStatusResponse(BaseModel):
    """Composite bunker status including devices and weather context."""

    bunker: BunkerResponse
    devices: list[BunkerDeviceStatus]
    weather: WeatherData | None = Field(
        default=None,
        description="Latest cached weather observation, or null if unavailable.",
    )


class BunkerListResponse(BaseModel):
    """Response wrapper for listing bunkers."""

    bunkers: list[BunkerResponse]


__all__ = [
    "BunkerCreate",
    "BunkerListResponse",
    "BunkerDeviceStatus",
    "BunkerResponse",
    "BunkerStatusResponse",
    "BunkerUpdate",
]
