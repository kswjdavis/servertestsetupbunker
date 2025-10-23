"""Application configuration settings."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List


class Settings:
    """Configuration values sourced from environment variables."""

    def __init__(self) -> None:
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
        self.ACCESS_TOKEN_EXPIRE_HOURS: int = self._get_int_env("ACCESS_TOKEN_EXPIRE_HOURS", 24)
        self.CORS_ORIGINS: str = os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        )
        self.ALGORITHM: str = "HS256"

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
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()

__all__ = ["Settings", "get_settings", "settings"]
