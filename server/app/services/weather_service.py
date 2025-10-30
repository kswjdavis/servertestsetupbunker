"""Service responsible for retrieving and caching weather observations."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.weather import WeatherData as WeatherDataSchema

logger = logging.getLogger(__name__)


def convert_kmh_to_mph(value: float | None) -> float | None:
    """Convert kilometers per hour to miles per hour."""
    if value is None:
        return None
    return value * 0.621371


def convert_c_to_f(value: float | None) -> float | None:
    """Convert Celsius to Fahrenheit."""
    if value is None:
        return None
    return value * 9 / 5 + 32


def parse_timestamp(value: str | None) -> datetime:
    """Parse ISO 8601 timestamps returned by weather.gov into timezone-aware UTC."""
    if not value:
        raise ValueError("Observation timestamp missing from weather.gov response.")
    sanitized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(sanitized)


class WeatherService:
    """Encapsulates weather.gov integration with in-memory caching."""

    def __init__(self) -> None:
        self.base_url = "https://api.weather.gov"
        self.station_id = settings.WEATHER_STATION_ID
        self.cached_weather: WeatherDataSchema | None = None
        self.last_successful_fetch: datetime | None = None

    def _stale_threshold(self, staleness_minutes: int | None = None) -> timedelta:
        """Get staleness threshold, using provided value or falling back to settings."""
        minutes = staleness_minutes if staleness_minutes is not None else settings.WEATHER_STALE_THRESHOLD_MINUTES
        return timedelta(minutes=minutes)

    async def fetch_weather_from_api(self) -> WeatherDataSchema:
        """
        Retrieve the latest observation from weather.gov and refresh the cache.

        Returns:
            WeatherDataSchema: Parsed and converted weather observation.

        Raises:
            RuntimeError: If no cached data exists and the fetch fails.
        """
        url = (
            f"{self.base_url}/stations/{self.station_id}/observations/latest"
        )
        headers = {
            "User-Agent": settings.WEATHER_USER_AGENT,
            "Accept": "application/geo+json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=settings.WEATHER_API_TIMEOUT_SECONDS
            ) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                payload = response.json()

            properties = payload.get("properties", {})
            wind_speed_kmh = self._safe_float(
                properties.get("windSpeed", {}).get("value")
            )
            wind_direction = self._safe_float(
                properties.get("windDirection", {}).get("value")
            )
            temperature_c = self._safe_float(
                properties.get("temperature", {}).get("value")
            )
            observation_time = parse_timestamp(properties.get("timestamp"))

            weather = WeatherDataSchema(
                station_id=self.station_id,
                wind_speed_mph=convert_kmh_to_mph(wind_speed_kmh),
                wind_direction_degrees=wind_direction,
                temperature_f=convert_c_to_f(temperature_c),
                fetched_at=datetime.now(timezone.utc),
                observation_time=observation_time,
            )

            self.cached_weather = weather
            self.last_successful_fetch = weather.fetched_at
            logger.debug(
                "Weather fetched: %.2f mph @ %.0f°",
                weather.wind_speed_mph or 0.0,
                weather.wind_direction_degrees or 0.0,
            )
            return weather

        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning("Weather API fetch failed: %s", exc)
            if self.cached_weather is not None:
                logger.info("Returning cached weather data due to fetch failure.")
                return self.cached_weather
            raise RuntimeError("Weather data unavailable") from exc

    def get_current_weather(self) -> WeatherDataSchema:
        """
        Return the most recent weather observation from cache.

        Raises:
            ValueError: If no cached weather data is available.
        """
        if self.cached_weather is None:
            raise ValueError("No weather data available")

        if self.is_weather_stale():
            if self.last_successful_fetch is None:
                logger.warning("Weather data stale - no successful fetch recorded yet.")
            else:
                elapsed = datetime.now(timezone.utc) - self.last_successful_fetch
                minutes = elapsed.total_seconds() / 60
                logger.warning(
                    "Weather data stale - no update for %.1f minutes",
                    minutes,
                )

        return self.cached_weather

    def is_weather_stale(self, staleness_minutes: int | None = None) -> bool:
        """
        Determine whether the cached data has exceeded the stale threshold.

        Args:
            staleness_minutes: Optional override for staleness threshold in minutes.
                              If None, uses settings.WEATHER_STALE_THRESHOLD_MINUTES.
        """
        if self.last_successful_fetch is None:
            return True
        return datetime.now(timezone.utc) - self.last_successful_fetch > self._stale_threshold(staleness_minutes)

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


weather_service = WeatherService()

__all__ = [
    "WeatherService",
    "weather_service",
    "convert_c_to_f",
    "convert_kmh_to_mph",
]
