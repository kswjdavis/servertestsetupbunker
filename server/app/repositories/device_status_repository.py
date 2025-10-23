"""DeviceStatus repository for real-time device telemetry."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_status import DeviceStatus
from app.repositories.base import BaseRepository


class DeviceStatusRepository(BaseRepository[DeviceStatus]):
    """Repository for DeviceStatus model with upsert operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(DeviceStatus, session)

    async def get_by_device_id(self, device_id: UUID) -> DeviceStatus | None:
        """
        Get device status by device ID.

        Args:
            device_id: Device UUID

        Returns:
            DeviceStatus instance or None if not found
        """
        result = await self.session.execute(
            select(DeviceStatus).where(DeviceStatus.device_id == device_id)
        )
        return result.scalar_one_or_none()

    async def upsert_status(
        self,
        device_id: UUID,
        relay_state: str,
        uptime_seconds: int,
        wifi_rssi: int,
        countdown_timer_remaining: int,
        reported_at: datetime,
    ) -> DeviceStatus:
        """
        Insert or update device status (upsert operation).

        Uses PostgreSQL INSERT ... ON CONFLICT DO UPDATE.

        Args:
            device_id: Device UUID
            relay_state: Relay state ('ON' or 'OFF')
            uptime_seconds: Device uptime in seconds
            wifi_rssi: WiFi signal strength in dBm
            countdown_timer_remaining: Countdown timer remaining (0-300 seconds)
            reported_at: Timestamp from device when status was generated

        Returns:
            Created or updated DeviceStatus instance
        """
        stmt = insert(DeviceStatus).values(
            device_id=device_id,
            relay_state=relay_state,
            uptime_seconds=uptime_seconds,
            wifi_rssi=wifi_rssi,
            countdown_timer_remaining=countdown_timer_remaining,
            reported_at=reported_at,
        )

        # On conflict (device_id already exists), update all fields
        stmt = stmt.on_conflict_do_update(
            index_elements=["device_id"],
            set_={
                "relay_state": relay_state,
                "uptime_seconds": uptime_seconds,
                "wifi_rssi": wifi_rssi,
                "countdown_timer_remaining": countdown_timer_remaining,
                "reported_at": reported_at,
                "server_received_at": datetime.utcnow(),
            },
        )

        await self.session.execute(stmt)
        await self.session.commit()

        # Fetch and return the updated/created record
        return await self.get_by_device_id(device_id)

    async def get_status_for_bunker(self, bunker_id: UUID) -> list[DeviceStatus]:
        """
        Get all device statuses for devices in a specific bunker.

        Args:
            bunker_id: Bunker UUID

        Returns:
            List of DeviceStatus instances for the bunker's devices
        """
        # Join with devices table to filter by bunker_id
        from app.models.device import Device

        result = await self.session.execute(
            select(DeviceStatus)
            .join(Device, DeviceStatus.device_id == Device.id)
            .where(Device.bunker_id == bunker_id)
        )
        return list(result.scalars().all())
