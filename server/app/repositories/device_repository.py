"""Device repository for ESP32 fan controller management."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.repositories.base import BaseRepository


class DeviceRepository(BaseRepository[Device]):
    """Repository for Device model with provisioning methods."""

    def __init__(self, session: AsyncSession):
        super().__init__(Device, session)

    async def get_by_auth_token(self, auth_token: UUID) -> Device | None:
        """
        Get device by authentication token.

        Args:
            auth_token: Device authentication token (UUID)

        Returns:
            Device instance or None if not found
        """
        result = await self.session.execute(
            select(Device).where(Device.auth_token == auth_token)
        )
        return result.scalar_one_or_none()

    async def get_by_mac_address(self, mac_address: str) -> Device | None:
        """
        Get device by MAC address.

        Args:
            mac_address: Device MAC address (XX:XX:XX:XX:XX:XX)

        Returns:
            Device instance or None if not found
        """
        result = await self.session.execute(
            select(Device).where(Device.mac_address == mac_address)
        )
        return result.scalar_one_or_none()

    async def get_devices_by_bunker(self, bunker_id: UUID) -> list[Device]:
        """
        Get all devices for a specific bunker.

        Args:
            bunker_id: Bunker UUID

        Returns:
            List of devices for the bunker
        """
        result = await self.session.execute(
            select(Device).where(Device.bunker_id == bunker_id).order_by(Device.fan_position)
        )
        return list(result.scalars().all())

    async def update_last_seen(self, device_id: UUID) -> Device | None:
        """
        Update device's last_seen timestamp to current UTC time.

        Args:
            device_id: Device UUID

        Returns:
            Updated device instance or None if not found
        """
        device = await self.get(device_id)
        if device is None:
            return None

        device.last_seen = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(device)
        return device

    async def update_last_seen_by_token(self, auth_token: UUID) -> Device | None:
        """
        Update device's last_seen timestamp by auth token.

        Args:
            auth_token: Device authentication token

        Returns:
            Updated device instance or None if not found
        """
        device = await self.get_by_auth_token(auth_token)
        if device is None:
            return None

        device.last_seen = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(device)
        return device

    async def get_offline_devices(self, threshold_seconds: int = 120) -> list[Device]:
        """
        Get devices that haven't reported in within threshold.

        Args:
            threshold_seconds: Seconds before considering device offline (default 120)

        Returns:
            List of offline devices
        """
        cutoff_time = datetime.now(timezone.utc).timestamp() - threshold_seconds

        result = await self.session.execute(
            select(Device).where(
                Device.last_seen.is_not(None),
                Device.last_seen < datetime.fromtimestamp(cutoff_time, tz=timezone.utc),
            )
        )
        return list(result.scalars().all())
