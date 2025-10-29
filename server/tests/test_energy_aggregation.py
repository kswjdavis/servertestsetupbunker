"""Tests for energy savings aggregation (Story 5.10)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models.bunker import Bunker
from app.models.device import Device
from app.models.device_runtime_log import RuntimeSource, RuntimeState
from app.repositories.bunker_repository import BunkerRepository
from app.repositories.device_repository import DeviceRepository
from app.repositories.global_config_repository import GlobalConfigRepository
from app.repositories.runtime_log_repository import RuntimeLogRepository
from app.services.system_health_service import SystemHealthService


pytestmark = pytest.mark.asyncio


async def seed_bunker(session, name: str = "Test Bunker", fan_power_watts: int = 1500) -> Bunker:
    """Create a bunker for energy aggregation tests."""
    repo = BunkerRepository(session)
    return await repo.create(
        name=name,
        latitude=35.5,
        longitude=-97.5,
        orientation_degrees=180.0,
        fan_count=4,
        electricity_cost_kwh=0.12,
        fan_power_watts=fan_power_watts,
    )


async def seed_device(session, bunker_id, fan_position: int = 1, mac: str = "AA:BB:CC:DD:EE:FF") -> Device:
    """Provision a device for tests."""
    repo = DeviceRepository(session)
    return await repo.provision_device(
        bunker_id=bunker_id,
        fan_position=fan_position,
        mac_address=mac,
    )


async def test_zero_data_returns_zero_savings(async_session):
    """AC6: Zero data scenario returns 0 kWh and 0 USD."""
    service = SystemHealthService(async_session)

    # No devices or runtime logs exist
    metrics = await service.get_health_metrics()

    assert metrics.total_energy_saved_kwh == 0.0
    assert metrics.total_energy_cost_saved_usd == 0.0


async def test_no_runtime_logs_returns_zero(async_session):
    """AC6: Devices exist but no runtime logs returns 0."""
    bunker = await seed_bunker(async_session, "Bunker A")
    await seed_device(async_session, bunker.id, fan_position=1, mac="AA:BB:CC:DD:EE:01")
    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    assert metrics.total_energy_saved_kwh == 0.0
    assert metrics.total_energy_cost_saved_usd == 0.0


async def test_single_device_runtime_calculation(async_session):
    """AC6: Single device with ON time calculates correct kWh and USD."""
    # Setup: Device provisioned 10 hours ago, ran for 2 hours
    bunker = await seed_bunker(async_session, "Bunker B", fan_power_watts=1500)
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="BB:BB:CC:DD:EE:02")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=10)

    # Add runtime log: device ON for 2 hours, 8 hours ago
    runtime_repo = RuntimeLogRepository(async_session)
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=8),
        ended_at=now - timedelta(hours=6),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )
    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected calculation:
    # Baseline runtime = 10 hours (device lifetime)
    # Actual ON time = 2 hours
    # Saved runtime = 10 - 2 = 8 hours
    # Saved kWh = (1500 watts × 8 hours) / 1000 = 12.0 kWh
    # Cost saved = 12.0 × 0.12 = 1.44 USD

    assert metrics.total_energy_saved_kwh == 12.0
    assert metrics.total_energy_cost_saved_usd == 1.44


async def test_multiple_devices_aggregation(async_session):
    """AC6: Multiple devices across bunkers aggregate correctly."""
    # Bunker A: 2 devices, 1500W each
    bunker_a = await seed_bunker(async_session, "Bunker A", fan_power_watts=1500)
    device_a1 = await seed_device(async_session, bunker_a.id, fan_position=1, mac="AA:AA:AA:AA:AA:01")
    device_a2 = await seed_device(async_session, bunker_a.id, fan_position=2, mac="AA:AA:AA:AA:AA:02")

    # Bunker B: 1 device, 2000W
    bunker_b = await seed_bunker(async_session, "Bunker B", fan_power_watts=2000)
    device_b1 = await seed_device(async_session, bunker_b.id, fan_position=1, mac="BB:BB:BB:BB:BB:01")

    now = datetime.now(timezone.utc)

    # Device A1: provisioned 10h ago, ran 3h
    device_a1.provisioned_at = now - timedelta(hours=10)
    # Device A2: provisioned 10h ago, ran 4h
    device_a2.provisioned_at = now - timedelta(hours=10)
    # Device B1: provisioned 5h ago, ran 2h
    device_b1.provisioned_at = now - timedelta(hours=5)

    runtime_repo = RuntimeLogRepository(async_session)

    # Device A1: ON for 3 hours
    await runtime_repo.create_runtime_log(
        device_id=device_a1.id,
        started_at=now - timedelta(hours=8),
        ended_at=now - timedelta(hours=5),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    # Device A2: ON for 4 hours
    await runtime_repo.create_runtime_log(
        device_id=device_a2.id,
        started_at=now - timedelta(hours=9),
        ended_at=now - timedelta(hours=5),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    # Device B1: ON for 2 hours
    await runtime_repo.create_runtime_log(
        device_id=device_b1.id,
        started_at=now - timedelta(hours=4),
        ended_at=now - timedelta(hours=2),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected calculation:
    # Device A1: (10h - 3h) × 1500W = 7h × 1500W = 10.5 kWh saved
    # Device A2: (10h - 4h) × 1500W = 6h × 1500W = 9.0 kWh saved
    # Device B1: (5h - 2h) × 2000W = 3h × 2000W = 6.0 kWh saved
    # Total: 10.5 + 9.0 + 6.0 = 25.5 kWh
    # Cost: 25.5 × 0.12 = 3.06 USD

    assert metrics.total_energy_saved_kwh == 25.5
    assert metrics.total_energy_cost_saved_usd == 3.06


async def test_partial_overlapping_intervals(async_session):
    """AC6: Multiple intervals for same device accumulate correctly without double counting."""
    bunker = await seed_bunker(async_session, "Bunker C", fan_power_watts=1500)
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="CC:CC:CC:CC:CC:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=10)

    runtime_repo = RuntimeLogRepository(async_session)

    # Add multiple ON intervals: 1h, 2h, 1.5h = 4.5h total
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=9),
        ended_at=now - timedelta(hours=8),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=6),
        ended_at=now - timedelta(hours=4),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=2),
        ended_at=now - timedelta(hours=0.5),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected: (10h - 4.5h) × 1500W = 5.5h × 1500W = 8.25 kWh
    # Cost: 8.25 × 0.12 = 0.99 USD

    assert metrics.total_energy_saved_kwh == 8.25
    assert metrics.total_energy_cost_saved_usd == 0.99


async def test_large_intervals_no_overflow(async_session):
    """AC6: Large intervals (days) calculate correctly without overflow."""
    bunker = await seed_bunker(async_session, "Bunker D", fan_power_watts=1500)
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="DD:DD:DD:DD:DD:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(days=30)  # 30 days ago

    runtime_repo = RuntimeLogRepository(async_session)

    # Device ran for 10 days (240 hours)
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(days=25),
        ended_at=now - timedelta(days=15),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected: (720h - 240h) × 1500W = 480h × 1500W = 720 kWh
    # Cost: 720 × 0.12 = 86.40 USD

    assert metrics.total_energy_saved_kwh == 720.0
    assert metrics.total_energy_cost_saved_usd == 86.4


async def test_uses_global_default_power_when_bunker_zero(async_session):
    """AC4: Uses global default when bunker fan_power_watts is 0 (misconfigured)."""
    # Set global default to 1800W
    config_repo = GlobalConfigRepository(async_session)
    config = await config_repo.get_or_create_default()
    config.default_fan_power_watts = 1800

    bunker = await seed_bunker(async_session, "Bunker E", fan_power_watts=0)  # Misconfigured bunker

    device = await seed_device(async_session, bunker.id, fan_position=1, mac="EE:EE:EE:EE:EE:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=10)

    runtime_repo = RuntimeLogRepository(async_session)
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=8),
        ended_at=now - timedelta(hours=6),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected: (10h - 2h) × 1800W = 8h × 1800W = 14.4 kWh
    # Cost: 14.4 × 0.12 = 1.73 USD (rounded)

    assert metrics.total_energy_saved_kwh == 14.4
    assert metrics.total_energy_cost_saved_usd == 1.73


async def test_rounding_to_two_decimals(async_session):
    """AC6: Results are rounded to 2 decimal places."""
    bunker = await seed_bunker(async_session, "Bunker F", fan_power_watts=1333)  # Odd power
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="FF:FF:FF:FF:FF:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=7.777)  # Fractional hours

    runtime_repo = RuntimeLogRepository(async_session)
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=5.555),
        ended_at=now - timedelta(hours=3.333),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Check that values are rounded to 2 decimals
    assert isinstance(metrics.total_energy_saved_kwh, float)
    assert len(str(metrics.total_energy_saved_kwh).split('.')[-1]) <= 2
    assert isinstance(metrics.total_energy_cost_saved_usd, float)
    assert len(str(metrics.total_energy_cost_saved_usd).split('.')[-1]) <= 2


async def test_currently_active_logs_handled(async_session):
    """Test that currently active (unclosed) logs are handled correctly."""
    bunker = await seed_bunker(async_session, "Bunker G", fan_power_watts=1500)
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="GG:GG:GG:GG:GG:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=10)

    runtime_repo = RuntimeLogRepository(async_session)

    # Add active (unclosed) log: started 2h ago, still running
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=2),
        ended_at=None,  # Currently active
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected: Active log counts as 2h ON time
    # (10h - 2h) × 1500W = 8h × 1500W = 12.0 kWh

    assert metrics.total_energy_saved_kwh == 12.0
    assert metrics.total_energy_cost_saved_usd == 1.44


async def test_off_state_logs_ignored(async_session):
    """Test that OFF state logs don't contribute to ON time."""
    bunker = await seed_bunker(async_session, "Bunker H", fan_power_watts=1500)
    device = await seed_device(async_session, bunker.id, fan_position=1, mac="HH:HH:HH:HH:HH:01")

    now = datetime.now(timezone.utc)
    device.provisioned_at = now - timedelta(hours=10)

    runtime_repo = RuntimeLogRepository(async_session)

    # Add ON log: 2h
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=8),
        ended_at=now - timedelta(hours=6),
        state=RuntimeState.ON,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    # Add OFF log: 3h (should be ignored in ON time calculation)
    await runtime_repo.create_runtime_log(
        device_id=device.id,
        started_at=now - timedelta(hours=5),
        ended_at=now - timedelta(hours=2),
        state=RuntimeState.OFF,
        source=RuntimeSource.CONTROL_LOGIC,
    )

    await async_session.commit()

    service = SystemHealthService(async_session)
    metrics = await service.get_health_metrics()

    # Expected: Only 2h ON time counts
    # (10h - 2h) × 1500W = 8h × 1500W = 12.0 kWh

    assert metrics.total_energy_saved_kwh == 12.0
