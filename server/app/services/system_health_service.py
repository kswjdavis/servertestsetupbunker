"""Service that aggregates overall system health metrics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.repositories.device_repository import DeviceRepository
from app.repositories.global_config_repository import GlobalConfigRepository
from app.repositories.runtime_log_repository import RuntimeLogRepository
from app.schemas.system_health import (
    DatabaseStatus,
    HealthAlert,
    OverallStatus,
    SystemHealthSummary,
    WeatherConditions,
    WeatherServiceStatus,
)
from app.services.weather_service import weather_service

DEFAULT_OFFLINE_THRESHOLD_SECONDS = 120
SERVICE_START_TIME = datetime.now(timezone.utc)


@dataclass(slots=True)
class OfflineDevice:
    """Captures metadata about an offline device for alert generation."""

    device: Device
    offline_duration: timedelta | None


class SystemHealthService:
    """Aggregate multiple data sources into a system health snapshot."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.device_repository = DeviceRepository(session)
        self.config_repository = GlobalConfigRepository(session)
        self.runtime_log_repository = RuntimeLogRepository(session)

    async def get_health_metrics(self) -> SystemHealthSummary:
        """Return aggregated health metrics for the dashboard."""
        now = datetime.now(timezone.utc)
        config = await self.config_repository.get_or_create_default()
        offline_threshold_seconds = getattr(
            config,
            "device_offline_threshold_seconds",
            DEFAULT_OFFLINE_THRESHOLD_SECONDS,
        ) or DEFAULT_OFFLINE_THRESHOLD_SECONDS

        device_bunker_tuples = await self.device_repository.list_devices()
        # Extract just the Device objects from tuples
        devices = [device for device, _bunker in device_bunker_tuples]
        total_devices = len(devices)
        offline_devices = self._get_offline_devices(
            devices, offline_threshold_seconds, now
        )
        online_devices = total_devices - len(offline_devices)

        alerts: list[HealthAlert] = []
        alerts.extend(self._build_offline_alerts(offline_devices, now))

        weather_status = self._build_weather_status(now, alerts)
        database_status = await self._build_database_status(now, alerts)

        total_energy_saved_kwh = await self._calculate_energy_savings()
        total_energy_cost_saved_usd = (
            round(total_energy_saved_kwh * config.default_electricity_cost_kwh, 2)
            if total_energy_saved_kwh > 0
            else 0.0
        )

        system_uptime_seconds = int(
            (now - SERVICE_START_TIME).total_seconds()
        )

        overall_status = self._determine_overall_status(alerts)

        return SystemHealthSummary(
            total_devices=total_devices,
            online_devices=max(0, online_devices),
            offline_devices=len(offline_devices),
            system_uptime_seconds=max(system_uptime_seconds, 0),
            backend_uptime_seconds=max(system_uptime_seconds, 0),
            weather_service=weather_status,
            database=database_status,
            alerts=alerts,
            overall_status=overall_status,
            last_updated=now,
            total_energy_saved_kwh=round(total_energy_saved_kwh, 2),
            total_energy_cost_saved_usd=round(total_energy_cost_saved_usd, 2)
            if total_energy_cost_saved_usd is not None
            else None,
        )

    def _get_offline_devices(
        self,
        devices: Iterable[Device],
        threshold_seconds: int,
        reference_time: datetime,
    ) -> list[OfflineDevice]:
        """Return devices considered offline based on last_seen timestamp."""
        offline: list[OfflineDevice] = []
        threshold = timedelta(seconds=threshold_seconds)
        for device in devices:
            if device.last_seen is None:
                offline.append(OfflineDevice(device=device, offline_duration=None))
                continue

            if reference_time - device.last_seen > threshold:
                offline.append(
                    OfflineDevice(
                        device=device,
                        offline_duration=reference_time - device.last_seen,
                    )
                )
        return offline

    def _build_offline_alerts(
        self,
        offline_devices: Iterable[OfflineDevice],
        reference_time: datetime,
    ) -> list[HealthAlert]:
        """Create alert entries for offline devices."""
        alerts: list[HealthAlert] = []
        for entry in offline_devices:
            device = entry.device
            if entry.offline_duration is None:
                message = (
                    f"Device {device.mac_address} has not reported since provisioning."
                )
            else:
                minutes = entry.offline_duration.total_seconds() / 60
                message = (
                    f"Device {device.mac_address} offline for {minutes:.1f} minutes."
                )
            alerts.append(
                HealthAlert(
                    id=f"device-offline-{device.id}",
                    type="device_offline",
                    message=message,
                    severity="critical",
                    timestamp=reference_time,
                )
            )
        return alerts

    def _build_weather_status(
        self,
        reference_time: datetime,
        alerts: list[HealthAlert],
    ) -> WeatherServiceStatus:
        """Generate the weather service status and related alerts."""
        last_successful_fetch = weather_service.last_successful_fetch
        try:
            weather = weather_service.get_current_weather()
            stale = weather_service.is_weather_stale()
            status: WeatherServiceStatus
            if stale:
                status_state = "degraded"
                message = "Weather data is stale; last update exceeded freshness threshold."
                alerts.append(
                    HealthAlert(
                        id="weather-stale",
                        type="weather",
                        message=message,
                        severity="warning",
                        timestamp=reference_time,
                    )
                )
            else:
                status_state = "online"
                message = None

            conditions = WeatherConditions(
                wind_speed_mph=weather.wind_speed_mph,
                wind_direction_degrees=weather.wind_direction_degrees,
                temperature_f=weather.temperature_f,
                observation_time=weather.observation_time,
            )
            status = WeatherServiceStatus(
                status=status_state,
                station_id=weather_service.station_id,
                last_successful_fetch=last_successful_fetch,
                stale=stale,
                message=message,
                conditions=conditions,
            )
        except ValueError:
            message = "Weather service unavailable; awaiting successful fetch."
            alerts.append(
                HealthAlert(
                    id="weather-unavailable",
                    type="weather",
                    message=message,
                    severity="warning",
                    timestamp=reference_time,
                )
            )
            status = WeatherServiceStatus(
                status="offline",
                station_id=weather_service.station_id,
                last_successful_fetch=last_successful_fetch,
                stale=True,
                message=message,
                conditions=None,
            )
        return status

    async def _build_database_status(
        self,
        reference_time: datetime,
        alerts: list[HealthAlert],
    ) -> DatabaseStatus:
        """Run a lightweight query to verify database connectivity."""
        latency_ms: float | None = None
        message: str | None = None
        state: str = "online"

        try:
            start = perf_counter()
            await self.session.execute(select(1))
            latency_ms = (perf_counter() - start) * 1000
            if latency_ms > 250:
                state = "degraded"
                message = "Database latency above 250 ms threshold."
                alerts.append(
                    HealthAlert(
                        id="database-latency",
                        type="database",
                        message=message,
                        severity="warning",
                        timestamp=reference_time,
                    )
                )
        except SQLAlchemyError:
            state = "offline"
            message = "Database connectivity check failed."
            alerts.append(
                HealthAlert(
                    id="database-unavailable",
                    type="database",
                    message=message,
                    severity="critical",
                    timestamp=reference_time,
                )
            )

        return DatabaseStatus(
            status=state,
            latency_ms=round(latency_ms, 2) if latency_ms is not None else None,
            message=message,
        )

    async def _calculate_energy_savings(self) -> float:
        """
        Calculate total energy savings across all devices (lifetime).

        This method computes energy savings by comparing baseline power consumption
        (if fans ran continuously) against actual measured runtime from logs.

        Algorithm:
        1. For each device, calculate baseline runtime (100% duty cycle from first log to now)
        2. Subtract actual ON time from runtime logs
        3. Calculate saved kWh using device power consumption
        4. Aggregate across all devices

        Returns:
            float: Total energy saved in kWh across all devices (lifetime).
        """
        config = await self.config_repository.get_or_create_default()
        devices = await self.device_repository.list_devices()

        if not devices:
            return 0.0

        total_kwh_saved = 0.0

        # Get ON times for all devices (lifetime)
        device_on_times = await self.runtime_log_repository.get_all_device_on_times(
            start_time=None,  # Lifetime
            end_time=None,
        )

        if not device_on_times:
            # No runtime logs exist yet
            return 0.0

        now = datetime.now(timezone.utc)

        for device in devices:
            # Get bunker to determine power consumption
            bunker = device.bunker
            if bunker is None:
                continue

            # Determine power consumption (bunker-specific or global default)
            fan_power_watts = bunker.fan_power_watts or config.default_fan_power_watts

            # Get actual ON time for this device
            actual_on_seconds = device_on_times.get(device.id, 0.0)

            if actual_on_seconds == 0.0:
                # No runtime data for this device
                continue

            # Calculate baseline: device could have run from first log to now
            # For simplicity in POC, baseline = time since provisioning
            # A more sophisticated approach would track "applicable" time windows
            device_lifetime_seconds = (now - device.provisioned_at).total_seconds()

            if device_lifetime_seconds <= 0:
                continue

            # Baseline runtime (100% duty cycle)
            baseline_runtime_seconds = device_lifetime_seconds

            # Savings = baseline - actual (clamped to >= 0)
            saved_runtime_seconds = max(0.0, baseline_runtime_seconds - actual_on_seconds)

            # Convert to kWh: (watts × hours) / 1000
            saved_hours = saved_runtime_seconds / 3600.0
            saved_kwh = (fan_power_watts * saved_hours) / 1000.0

            total_kwh_saved += saved_kwh

        return total_kwh_saved

    def _determine_overall_status(self, alerts: Iterable[HealthAlert]) -> OverallStatus:
        """Derive overall status severity based on alerts."""
        has_critical = any(alert.severity == "critical" for alert in alerts)
        if has_critical:
            return "red"
        has_warning = any(alert.severity == "warning" for alert in alerts)
        if has_warning:
            return "yellow"
        return "green"
