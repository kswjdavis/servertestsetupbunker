"""Pydantic schema definitions for API contracts."""

from .auth import TokenResponse, UserCreate, UserLogin, UserResponse
from .bunker import (
    BunkerCreate,
    BunkerDeviceStatus,
    BunkerListResponse,
    BunkerResponse,
    BunkerStatusResponse,
    BunkerUpdate,
)
from .control import ShutdownDecision
from .config import GlobalConfigResponse, GlobalConfigUpdate
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
    "BunkerDeviceStatus",
    "BunkerUpdate",
    "BunkerResponse",
    "BunkerListResponse",
    "BunkerStatusResponse",
    "DeviceProvisionRequest",
    "DeviceProvisionResponse",
    "DeviceResponse",
    "DeviceListResponse",
    "ShutdownDecision",
    "GlobalConfigResponse",
    "GlobalConfigUpdate",
    "WeatherData",
    "DatabaseStatus",
    "HealthAlert",
    "OverallStatus",
    "ServiceState",
    "SystemHealthSummary",
    "WeatherConditions",
    "WeatherServiceStatus",
]
