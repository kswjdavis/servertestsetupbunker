"""Bunker management schemas with validation rules."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class BunkerListResponse(BaseModel):
    """Response wrapper for listing bunkers."""

    bunkers: list[BunkerResponse]


__all__ = [
    "BunkerCreate",
    "BunkerListResponse",
    "BunkerResponse",
    "BunkerUpdate",
]
