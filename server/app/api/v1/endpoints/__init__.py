"""API endpoint routers."""

from .auth import router as auth_router
from .bunkers import router as bunkers_router
from .control import router as control_router
from .devices import router as devices_router
from .firmware import router as firmware_router
from .system import router as system_router
from .weather import router as weather_router

__all__ = [
    "auth_router",
    "bunkers_router",
    "control_router",
    "devices_router",
    "firmware_router",
    "system_router",
    "weather_router",
]
