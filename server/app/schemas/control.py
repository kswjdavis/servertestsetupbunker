"""Control decision schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ShutdownDecision(BaseModel):
    """Result of evaluating whether fans may safely shut down."""

    shutdown_allowed: bool = Field(
        description="True when conditions allow shutting down bunker fans."
    )
    reset_countdown: bool = Field(
        description="Instructs the device to reset its local shutdown countdown timer."
    )
    reason: str = Field(
        description="Short machine-readable reason describing the decision outcome."
    )


__all__ = ["ShutdownDecision"]
