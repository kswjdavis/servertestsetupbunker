"""API endpoint routers."""

from .auth import router as auth_router
from .bunkers import router as bunkers_router
from .control import router as control_router
from .devices import router as devices_router

__all__ = ["auth_router", "bunkers_router", "control_router", "devices_router"]
