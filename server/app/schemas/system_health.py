"""Pydantic schemas for system health monitoring."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

HealthSeverity = Literal["info", "warning", "critical"]
ServiceState = Literal["online", "degraded", "offline"]
OverallStatus = Literal["green", "yellow", "red"]


class HealthAlert(BaseModel):
    """Represents a recent system alert or warning message."""

    id: str
    type: str
    message: str
    severity: HealthSeverity
    timestamp: datetime


class WeatherConditions(BaseModel):
    """Snapshot of the most recent weather observation."""

    wind_speed_mph: float | None = Field(default=None)
    wind_direction_degrees: float | None = Field(default=None)
    temperature_f: float | None = Field(default=None)
    observation_time: datetime | None = Field(default=None)


class WeatherServiceStatus(BaseModel):
    """Health status of the weather integration service."""

    status: ServiceState
    station_id: str
    last_successful_fetch: datetime | None = None
    stale: bool = False
    message: str | None = None
    conditions: WeatherConditions | None = None


class DatabaseStatus(BaseModel):
    """Represents connectivity status to the primary database."""

    status: ServiceState
    latency_ms: float | None = None
    message: str | None = None


class SystemHealthSummary(BaseModel):
    """Aggregated health metrics returned to the frontend dashboard."""

    model_config = ConfigDict(populate_by_name=True)

    total_devices: int
    online_devices: int
    offline_devices: int
    system_uptime_seconds: int
    backend_uptime_seconds: int
    weather_service: WeatherServiceStatus
    database: DatabaseStatus
    alerts: list[HealthAlert]
    overall_status: OverallStatus
    last_updated: datetime
    total_energy_saved_kwh: float = Field(default=0.0)
    total_energy_cost_saved_usd: float | None = Field(default=None)
