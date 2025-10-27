"""Pydantic schema definitions for API contracts."""

from .auth import TokenResponse, UserCreate, UserLogin, UserResponse
from .bunker import (
    BunkerCreate,
    BunkerListResponse,
    BunkerResponse,
    BunkerUpdate,
)
from .control import ShutdownDecision
from .device import (
    DeviceListResponse,
    DeviceProvisionRequest,
    DeviceProvisionResponse,
    DeviceResponse,
)
from .system_health import (
    DatabaseStatus,
    HealthAlert,
    OverallStatus,
    ServiceState,
    SystemHealthSummary,
    WeatherConditions,
    WeatherServiceStatus,
)
from .weather import WeatherData

__all__ = [
    "TokenResponse",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "BunkerCreate",
    "BunkerUpdate",
    "BunkerResponse",
    "BunkerListResponse",
    "DeviceProvisionRequest",
    "DeviceProvisionResponse",
    "DeviceResponse",
    "DeviceListResponse",
    "ShutdownDecision",
    "WeatherData",
    "DatabaseStatus",
    "HealthAlert",
    "OverallStatus",
    "ServiceState",
    "SystemHealthSummary",
    "WeatherConditions",
    "WeatherServiceStatus",
]
