"""Device repository for ESP32 fan controller management."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
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

    async def provision_device(
        self,
        bunker_id: UUID,
        fan_position: int,
        mac_address: str,
    ) -> Device:
        """
        Provision a new device for a bunker.

        Args:
            bunker_id: UUID of the bunker to assign device to
            fan_position: Physical fan position (1-based)
            mac_address: Device MAC address (will be normalized to uppercase)

        Returns:
            Newly provisioned Device with generated auth_token

        Raises:
            HTTPException: 404 if bunker not found, 409 for conflicts, 400 for validation errors

        Security Note:
            Auth tokens are stored in plaintext (not hashed) because devices need
            to send the exact token for comparison. Tokens are UUID4 (cryptographically random).
        """
        # Normalize MAC address to uppercase for consistent storage
        mac_address = mac_address.upper()

        bunker = await self.session.get(Bunker, bunker_id)
        if bunker is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bunker not found",
            )

        if fan_position > bunker.fan_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fan position {fan_position} exceeds bunker fan count {bunker.fan_count}",
            )

        existing_device = await self.get_by_mac_address(mac_address)
        if existing_device is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="MAC address already provisioned",
            )

        existing_position = await self.session.execute(
            select(Device).where(
                Device.bunker_id == bunker_id,
                Device.fan_position == fan_position,
            )
        )
        if existing_position.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Fan position already assigned for bunker",
            )

        device_count_result = await self.session.execute(
            select(func.count(Device.id)).where(Device.bunker_id == bunker_id)
        )
        device_count = device_count_result.scalar_one()
        led_flash_sequence = device_count + 1

        if led_flash_sequence > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 10 devices per bunker",
            )

        device = Device(
            bunker_id=bunker_id,
            fan_position=fan_position,
            mac_address=mac_address,
            auth_token=uuid4(),
            led_flash_sequence=led_flash_sequence,
        )
        self.session.add(device)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Device provisioning conflict",
            ) from exc

        await self.session.refresh(device)
        return device

    async def list_devices(self) -> list[tuple[Device, Bunker]]:
        """Return all provisioned devices with bunker info, ordered by bunker and fan position."""
        result = await self.session.execute(
            select(Device, Bunker)
            .join(Bunker, Device.bunker_id == Bunker.id)
            .order_by(Device.bunker_id, Device.fan_position)
        )
        return list(result.all())

    async def get_device(self, device_id: UUID) -> Device | None:
        """Retrieve a device by its identifier."""
        return await self.get(device_id)

    async def delete_device(self, device_id: UUID) -> None:
        """
        Remove a device from the system.

        Raises 404 if the device does not exist.
        """
        device = await self.get(device_id)
        if device is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found",
            )

        await self.session.delete(device)
        await self.session.commit()

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
