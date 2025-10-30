"""Core control logic determining shutdown decisions."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.device_status import DeviceStatus, RelayState
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
            # Emergency mode: fans forced ON, reset countdown (server is healthy)
            decision = self._make_decision(False, True, "emergency_on")
        elif await self._check_time_overrides(bunker.id, session):
            # Time override: fans forced ON, reset countdown (server is healthy)
            decision = self._make_decision(False, True, "time_window_override")
        else:
            # Check wind conditions with hysteresis logic
            decision = await self._check_wind_conditions_with_hysteresis(device_id, bunker, config, session)

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

    async def _check_wind_conditions_with_hysteresis(
        self, device_id: UUID, bunker: Bunker, config, session: AsyncSession
    ) -> ShutdownDecision:
        """
        Evaluate wind threshold conditions with hysteresis to prevent rapid cycling.

        Hysteresis Logic:
        - FANS ON → Wind ≥ shutdown_threshold → FANS OFF
        - FANS OFF → Wind < restart_threshold → FANS ON
        - FANS OFF + Wind in hysteresis band → Stay OFF

        Args:
            device_id: Device ID for getting current relay state
            bunker: Bunker configuration
            config: Global configuration
            session: Database session

        Returns:
            ShutdownDecision with appropriate action
        """
        try:
            weather = weather_service.get_current_weather()
        except ValueError as exc:
            logger.warning("Weather data unavailable: %s", exc)
            return self._make_decision(False, False, "weather_unavailable")

        # Get staleness threshold from global config (default to 3 minutes if not set)
        staleness_minutes = getattr(config, "weather_staleness_minutes", 3)
        if weather_service.is_weather_stale(staleness_minutes=staleness_minutes):
            logger.warning("Weather data stale (threshold: %d minutes); defaulting to fail-safe decision.", staleness_minutes)
            return self._make_decision(False, False, "weather_stale")

        speed = weather.wind_speed_mph
        if speed is None:
            return self._make_decision(False, False, "wind_speed_null")

        # Get thresholds
        shutdown_threshold = bunker.wind_threshold_mph
        if shutdown_threshold is None:
            shutdown_threshold = getattr(config, "default_wind_threshold_mph", 15.0)

        hysteresis = bunker.wind_threshold_hysteresis_mph
        if hysteresis is None:
            hysteresis = getattr(config, "default_wind_threshold_hysteresis_mph", 3.0)

        restart_threshold = shutdown_threshold - hysteresis

        # Get current relay state from device status
        device_status = await session.get(DeviceStatus, device_id)
        current_relay_state = device_status.relay_state if device_status else RelayState.ON

        logger.info(
            "Hysteresis logic: device=%s wind=%.1f mph, shutdown_threshold=%.1f mph, "
            "restart_threshold=%.1f mph, current_state=%s",
            device_id, speed, shutdown_threshold, restart_threshold, current_relay_state
        )

        # State machine logic
        if current_relay_state == RelayState.ON:
            # Currently ON - check if we should turn OFF
            if speed < restart_threshold:
                logger.info(
                    "Hysteresis: Wind %.1f mph < restart threshold %.1f mph - allowing shutdown",
                    speed, restart_threshold
                )
                return self._make_decision(
                    True, True, f"wind_below_restart_threshold_{restart_threshold}mph"
                )
            else:
                logger.info(
                    "Hysteresis: Wind %.1f mph >= restart threshold %.1f mph - fans stay ON",
                    speed, restart_threshold
                )
                return self._make_decision(
                    False, True, f"wind_above_restart_threshold_{restart_threshold}mph"
                )
        else:  # current_relay_state == RelayState.OFF
            # Currently OFF - check if we should turn back ON
            if speed >= shutdown_threshold:
                logger.info(
                    "Hysteresis: Wind %.1f mph >= shutdown threshold %.1f mph - fans turn ON",
                    speed, shutdown_threshold
                )
                return self._make_decision(
                    False, True, f"wind_exceeds_threshold_{shutdown_threshold}mph"
                )
            else:
                # Wind is between restart and shutdown thresholds - maintain current state (OFF)
                logger.info(
                    "Hysteresis: Wind %.1f mph in hysteresis band (%.1f-%.1f mph) - maintain OFF state",
                    speed, restart_threshold, shutdown_threshold
                )
                return self._make_decision(
                    True, True, f"wind_in_hysteresis_band_maintain_off"
                )

    async def _get_global_config(self, session: AsyncSession) -> GlobalConfig:
        """Fetch the singleton global configuration."""
        repository = GlobalConfigRepository(session)
        return await repository.get_or_create_default()


control_logic_engine = ControlLogicEngine()

__all__ = ["ControlLogicEngine", "ControlLogicError", "control_logic_engine"]
