"""Core control logic determining shutdown decisions."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.global_config import GlobalConfig
from app.repositories.global_config_repository import GlobalConfigRepository
from app.repositories.time_window_override_repository import (
    TimeWindowOverrideRepository,
)
from app.schemas.control import ShutdownDecision
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)


class ControlLogicError(RuntimeError):
    """Raised when control logic evaluation cannot proceed."""


class ControlLogicEngine:
    """Encapsulates shutdown decision making."""

    async def should_shutdown_fans(
        self, device_id: UUID, session: AsyncSession
    ) -> ShutdownDecision:
        """
        Evaluate shutdown decision for the bunker containing the given device.

        Args:
            device_id: Identifier for the device requesting guidance.
            session: Active database session.
        """
        device = await session.get(Device, device_id)
        if device is None:
            raise ControlLogicError(f"Device {device_id} not found")

        bunker = await session.get(Bunker, device.bunker_id)
        if bunker is None:
            raise ControlLogicError(f"Bunker {device.bunker_id} not found")

        config = await self._get_global_config(session)

        if await self._check_emergency_mode(bunker, config):
            decision = self._make_decision(False, False, "emergency_on")
        elif await self._check_time_overrides(bunker.id, session):
            decision = self._make_decision(False, False, "time_window_override")
        elif self._check_wind_conditions(bunker, config):
            decision = self._make_decision(True, True, "wind_conditions_favorable")
        else:
            decision = self._make_decision(False, False, "default_safe")

        logger.info(
            "Shutdown decision for device %s in bunker %s: allowed=%s reason=%s",
            device.id,
            bunker.id,
            decision.shutdown_allowed,
            decision.reason,
        )
        return decision

    @staticmethod
    def _make_decision(
        shutdown_allowed: bool, reset_countdown: bool, reason: str
    ) -> ShutdownDecision:
        return ShutdownDecision(
            shutdown_allowed=shutdown_allowed,
            reset_countdown=reset_countdown,
            reason=reason,
        )

    async def _check_emergency_mode(self, bunker: Bunker, config) -> bool:
        """Return True when global or bunker emergency overrides are active."""
        if bunker.emergency_on:
            return True
        return bool(getattr(config, "emergency_on_global", False))

    async def _check_time_overrides(
        self, bunker_id: UUID, session: AsyncSession
    ) -> bool:
        """Return True if a global or bunker-specific time override is active."""
        repository = TimeWindowOverrideRepository(session)
        return await repository.has_active_override(bunker_id)

    def _check_wind_conditions(self, bunker: Bunker, config) -> bool:
        """
        Evaluate wind threshold conditions.

        Returns True when current wind speed meets or exceeds the effective threshold.
        """
        try:
            weather = weather_service.get_current_weather()
        except ValueError as exc:
            logger.warning("Weather data unavailable: %s", exc)
            return False

        speed = weather.wind_speed_mph
        if speed is None:
            return False

        threshold = bunker.wind_threshold_mph
        if threshold is None:
            threshold = getattr(config, "default_wind_threshold_mph", 0.0)

        # Ensure non-negative threshold
        threshold = threshold or 0.0
        return speed >= threshold

    async def _get_global_config(self, session: AsyncSession) -> GlobalConfig:
        """Fetch the singleton global configuration."""
        repository = GlobalConfigRepository(session)
        return await repository.get_or_create_default()


control_logic_engine = ControlLogicEngine()

__all__ = ["ControlLogicEngine", "ControlLogicError", "control_logic_engine"]
