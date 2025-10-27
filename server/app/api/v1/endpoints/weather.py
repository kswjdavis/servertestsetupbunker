"""Weather observation API endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.weather import WeatherData
from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["weather"])
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get(
    "/current",
    response_model=WeatherData,
    status_code=status.HTTP_200_OK,
)
async def read_current_weather(_: CurrentUser) -> WeatherData:
    """Return the most recent cached weather observation."""
    try:
        return weather_service.get_current_weather()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Weather data unavailable",
        ) from exc
