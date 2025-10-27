"""Device provisioning and management schemas."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.device_status import RelayState


class DeviceProvisionRequest(BaseModel):
    """Request payload for provisioning a new device."""

    bunker_id: UUID
    fan_position: int = Field(ge=1, description="Fan position within bunker (1-based)")
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
        """
        Devices seen within the last two minutes are considered online.

        Note: Uses current UTC time at field computation. For consistent results
        across multiple accesses, consider caching the response model.
        """
        if self.last_seen is None:
            return False
        # Use a single datetime.now() call for deterministic behavior within this computation
        current_time = datetime.now(timezone.utc)
        return current_time - self.last_seen <= timedelta(minutes=2)


class DeviceListResponse(BaseModel):
    """Response model for listing devices."""

    devices: list[DeviceResponse]


class DeviceStatusRequest(BaseModel):
    """Request payload sent by ESP32 for periodic status reporting."""

    relay_state: RelayState = Field(description="Current relay state reported by the device")
    uptime_seconds: int = Field(
        ge=0,
        description="Device uptime in whole seconds as measured via esp_timer_get_time()",
    )
    wifi_rssi: int = Field(
        ge=-120,
        le=0,
        description="WiFi signal strength in dBm reported by esp_wifi_sta_get_rssi()",
    )
    countdown_timer_remaining: int = Field(
        ge=0,
        le=300,
        description="Seconds remaining on the local shutdown countdown timer",
    )
    firmware_version: str = Field(
        min_length=1,
        max_length=50,
        description="Firmware semantic version string",
    )


class DeviceStatusResponse(BaseModel):
    """Server response containing shutdown decision and synchronization data."""

    shutdown_allowed: bool = Field(description="True when the device should shutdown fan operations")
    reset_countdown: bool = Field(description="Signals whether the local countdown timer should reset")
    reason: str = Field(description="Machine-readable explanation of the shutdown decision")
    server_time: datetime = Field(description="Current server time in ISO 8601 format (UTC)")
