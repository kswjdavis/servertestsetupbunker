"""FastAPI application entry point."""
# Test auto-deployment workflow - All Sudo Permissions Fixed

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.services.weather_service import weather_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def weather_polling_task() -> None:
    """Periodically refresh cached weather data from weather.gov."""
    interval = max(1, settings.WEATHER_POLL_INTERVAL_SECONDS)
    try:
        while True:
            try:
                await weather_service.fetch_weather_from_api()
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - keep loop alive
                logger.error("Weather polling error: %s", exc)
                await asyncio.sleep(interval)  # Sleep before retry on error
    except asyncio.CancelledError:
        logger.info("Weather polling task cancelled.")
        raise


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle hooks."""
    try:
        await weather_service.fetch_weather_from_api()
    except Exception as exc:  # noqa: BLE001 - log but continue
        logger.warning("Initial weather fetch failed: %s", exc)

    polling_task = asyncio.create_task(weather_polling_task())
    logger.info(
        "Weather polling task started for station %s",
        weather_service.station_id,
    )
    try:
        yield
    finally:
        polling_task.cancel()
        with suppress(asyncio.CancelledError):
            await polling_task
        logger.info("Weather polling task stopped")


app = FastAPI(title="Bunkercolab API", lifespan=lifespan)

# Configure CORS based on environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(api_router)


@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    """Basic health check endpoint for scaffolding validation."""
    return {"status": "ok"}
