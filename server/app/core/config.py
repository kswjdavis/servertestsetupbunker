"""Application configuration settings."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List


class Settings:
    """Configuration values sourced from environment variables."""

    def __init__(self) -> None:
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
        self._validate_secret_key()
        self.ACCESS_TOKEN_EXPIRE_HOURS: int = self._get_int_env(
            "ACCESS_TOKEN_EXPIRE_HOURS", 24
        )
        self.CORS_ORIGINS: str = os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        )
        self.ALGORITHM: str = "HS256"
        self.WEATHER_STATION_ID: str = os.getenv("WEATHER_STATION_ID", "KMSP")
        self._validate_weather_station_id()
        self.WEATHER_API_TIMEOUT_SECONDS: int = self._get_int_env(
            "WEATHER_API_TIMEOUT_SECONDS", 10
        )
        self.WEATHER_POLL_INTERVAL_SECONDS: int = self._get_int_env(
            "WEATHER_POLL_INTERVAL_SECONDS", 60
        )
        self.WEATHER_STALE_THRESHOLD_MINUTES: int = self._get_int_env(
            "WEATHER_STALE_THRESHOLD_MINUTES", 10
        )
        self.WEATHER_USER_AGENT: str = os.getenv(
            "WEATHER_USER_AGENT", "BunkerColab/1.0 (contact@yourdomain.com)"
        )
        firmware_storage = os.getenv("FIRMWARE_STORAGE_DIR")
        if firmware_storage:
            self.FIRMWARE_STORAGE_DIR: Path = Path(firmware_storage).expanduser().resolve()
        else:
            self.FIRMWARE_STORAGE_DIR = (Path(__file__).resolve().parent.parent / "firmware_storage").resolve()
        self.FIRMWARE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _get_int_env(name: str, default: int) -> int:
        """Return integer environment variable with safe fallback."""
        value = os.getenv(name)
        if value is None:
            return default
        try:
            return int(value)
        except ValueError:
            return default

    @property
    def cors_origin_list(self) -> List[str]:
        """Parse the comma-separated CORS origins into a sanitized list."""
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    def _validate_secret_key(self) -> None:
        """Ensure SECRET_KEY meets security requirements."""
        if self.SECRET_KEY == "change-me-in-production":
            raise RuntimeError(
                "SECRET_KEY environment variable must be set to a secure random value "
                "before starting the server."
            )
        if len(self.SECRET_KEY) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 characters long.")

    def _validate_weather_station_id(self) -> None:
        """Ensure WEATHER_STATION_ID is configured."""
        if not self.WEATHER_STATION_ID or not self.WEATHER_STATION_ID.strip():
            raise RuntimeError(
                "WEATHER_STATION_ID environment variable must be set to a valid "
                "weather.gov station identifier (e.g., KMSP)."
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()

__all__ = ["Settings", "get_settings", "settings"]
