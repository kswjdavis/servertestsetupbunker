"""Device provisioning and management schemas."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field


class DeviceProvisionRequest(BaseModel):
    """Request payload for provisioning a new device."""

    bunker_id: UUID
    fan_position: int = Field(ge=1, le=10, description="Fan position within bunker (1-10)")
    mac_address: str = Field(
        pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$",
        description="MAC address in hexadecimal colon-separated format",
    )


class DeviceProvisionResponse(BaseModel):
    """Response returned after successfully provisioning a device."""

    device_id: UUID
    auth_token: UUID
    led_flash_sequence: int
    message: str | None = None


class DeviceResponse(BaseModel):
    """Serialized representation of a device without exposing auth token."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bunker_id: UUID
    fan_position: int
    mac_address: str
    firmware_version: str | None = None
    last_seen: datetime | None = None
    provisioned_at: datetime
    led_flash_sequence: int

    @computed_field  # type: ignore[misc]
    @property
    def is_online(self) -> bool:
        """Devices seen within the last two minutes are considered online."""
        if self.last_seen is None:
            return False
        return datetime.now(timezone.utc) - self.last_seen <= timedelta(minutes=2)


class DeviceListResponse(BaseModel):
    """Response model for listing devices."""

    devices: list[DeviceResponse]

