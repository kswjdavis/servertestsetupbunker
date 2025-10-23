"""API router configuration."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, devices

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(devices.router, prefix="/api/v1")

__all__ = ["api_router"]
