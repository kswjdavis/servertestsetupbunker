"""SQLAlchemy ORM models for Bunkercolab."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(AsyncAttrs, DeclarativeBase):
    """
    Base class for all ORM models.

    Includes AsyncAttrs for async relationship loading.
    All models inherit from this class.
    """

    pass


def utc_now() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


# Import all models to ensure they're registered with Base.metadata
from app.models.user import User
from app.models.bunker import Bunker
from app.models.device import Device
from app.models.device_status import DeviceStatus
from app.models.device_runtime_log import DeviceRuntimeLog
from app.models.time_window_override import TimeWindowOverride
from app.models.revoked_token import RevokedToken
from app.models.weather_data import WeatherData
from app.models.global_config import GlobalConfig

__all__ = [
    "Base",
    "User",
    "Bunker",
    "Device",
    "DeviceStatus",
    "DeviceRuntimeLog",
    "TimeWindowOverride",
    "WeatherData",
    "GlobalConfig",
    "RevokedToken",
]
