"""API router configuration."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    bunkers,
    control,
    devices,
    firmware,
    system,
    weather,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(bunkers.router, prefix="/api/v1")
api_router.include_router(devices.router, prefix="/api/v1")
api_router.include_router(control.router, prefix="/api/v1")
api_router.include_router(weather.router, prefix="/api/v1")
api_router.include_router(firmware.router, prefix="/api/v1")
api_router.include_router(system.router, prefix="/api/v1")

__all__ = ["api_router"]
