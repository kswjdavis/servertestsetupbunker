"""Unit tests for the WeatherService integration."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest

from app.core.config import settings
from app.schemas.weather import WeatherData as WeatherDataSchema
from app.services.weather_service import (
    WeatherService,
    convert_c_to_f,
    convert_kmh_to_mph,
)


class MockAsyncClient:
    """Minimal async client stub for httpx.AsyncClient."""

    def __init__(self, response: httpx.Response | None = None, exception: Exception | None = None) -> None:
        self._response = response
        self._exception = exception

    async def __aenter__(self) -> "MockAsyncClient":
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    async def get(self, url: str, headers: dict[str, str] | None = None) -> httpx.Response:
        if self._exception is not None:
            raise self._exception
        if self._response is not None:
            return self._response
        request = httpx.Request("GET", url, headers=headers)
        return httpx.Response(200, json={}, request=request)


def make_response(json_payload: dict[str, Any], status_code: int = 200, url: str | None = None) -> httpx.Response:
    """Construct an httpx.Response with the provided payload."""
    request_url = url or "https://api.weather.gov/stations/KMSP/observations/latest"
    request = httpx.Request("GET", request_url)
    return httpx.Response(status_code, json=json_payload, request=request)


def test_convert_kmh_to_mph() -> None:
    """Kilometers per hour convert to miles per hour."""
    assert convert_kmh_to_mph(None) is None
    assert convert_kmh_to_mph(0) == 0
    assert pytest.approx(convert_kmh_to_mph(10)) == 6.21371


def test_convert_c_to_f() -> None:
    """Celsius convert to Fahrenheit."""
    assert convert_c_to_f(None) is None
    assert convert_c_to_f(0) == 32
    assert pytest.approx(convert_c_to_f(18.9)) == 66.02, "Should convert using standard formula"


@pytest.mark.asyncio()
async def test_fetch_weather_from_api_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """Service parses the weather.gov payload and performs unit conversions."""
    service = WeatherService()
    payload = {
        "properties": {
            "timestamp": "2025-10-21T20:54:00+00:00",
            "windSpeed": {"value": 22.224},
            "windDirection": {"value": 180},
            "temperature": {"value": 18.9},
        }
    }
    response = make_response(payload)
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: MockAsyncClient(response=response),
    )

    weather = await service.fetch_weather_from_api()

    assert weather.station_id == service.station_id
    expected_speed = 22.224 * 0.621371
    assert weather.wind_speed_mph == pytest.approx(expected_speed)
    assert weather.wind_direction_degrees == 180
    expected_temperature = 18.9 * 9 / 5 + 32
    assert weather.temperature_f == pytest.approx(expected_temperature)
    assert weather.observation_time.isoformat() == "2025-10-21T20:54:00+00:00"
    assert service.cached_weather is weather


@pytest.mark.asyncio()
async def test_fetch_weather_returns_cached_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """If weather.gov returns an HTTP error (e.g., 404), fall back to cached data."""
    service = WeatherService()
    cached = WeatherDataSchema(
        station_id=service.station_id,
        wind_speed_mph=12.0,
        wind_direction_degrees=90.0,
        temperature_f=70.0,
        fetched_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        observation_time=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    service.cached_weather = cached
    service.last_successful_fetch = cached.fetched_at
    request = httpx.Request("GET", "https://api.weather.gov/stations/KMSP/observations/latest")
    error = httpx.HTTPStatusError(
        "Not found",
        request=request,
        response=httpx.Response(404, request=request),
    )
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: MockAsyncClient(exception=error),
    )

    weather = await service.fetch_weather_from_api()

    assert weather is cached


@pytest.mark.asyncio()
async def test_fetch_weather_returns_cached_on_invalid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    """Invalid JSON payload should fall back to cached data."""
    service = WeatherService()
    cached = WeatherDataSchema(
        station_id=service.station_id,
        wind_speed_mph=8.0,
        wind_direction_degrees=45.0,
        temperature_f=60.0,
        fetched_at=datetime.now(timezone.utc) - timedelta(minutes=2),
        observation_time=datetime.now(timezone.utc) - timedelta(minutes=3),
    )
    service.cached_weather = cached
    service.last_successful_fetch = cached.fetched_at

    payload = {"properties": {"windSpeed": {"value": 10.0}}}  # Missing timestamp
    response = make_response(payload)

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: MockAsyncClient(response=response),
    )

    weather = await service.fetch_weather_from_api()

    assert weather is cached


@pytest.mark.asyncio()
async def test_fetch_weather_raises_without_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """If there is no cached data and the fetch fails, raise RuntimeError."""
    service = WeatherService()
    timeout_error = httpx.TimeoutException("timeout")
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: MockAsyncClient(exception=timeout_error),
    )

    with pytest.raises(RuntimeError):
        await service.fetch_weather_from_api()


@pytest.mark.asyncio()
async def test_fetch_weather_invalid_json_without_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """Invalid JSON without cached data should raise RuntimeError."""
    service = WeatherService()
    payload = {"properties": {"windSpeed": {"value": 12.0}}}  # Missing timestamp
    response = make_response(payload)
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: MockAsyncClient(response=response),
    )

    with pytest.raises(RuntimeError):
        await service.fetch_weather_from_api()


def test_weather_staleness_detection() -> None:
    """Detect stale weather data when last fetch exceeds threshold."""
    service = WeatherService()
    recent_time = datetime.now(timezone.utc)
    service.last_successful_fetch = recent_time
    assert service.is_weather_stale() is False
    stale_time = recent_time - timedelta(minutes=settings.WEATHER_STALE_THRESHOLD_MINUTES + 1)
    service.last_successful_fetch = stale_time
    assert service.is_weather_stale() is True


def test_get_current_weather_requires_cache() -> None:
    """Accessing current weather without a cache should raise ValueError."""
    service = WeatherService()
    with pytest.raises(ValueError):
        service.get_current_weather()
