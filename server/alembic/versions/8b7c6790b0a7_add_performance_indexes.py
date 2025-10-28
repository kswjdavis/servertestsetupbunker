"""Add database indexes to improve query performance.

Revision ID: 8b7c6790b0a7
Revises: df67cfc1edce
Create Date: 2025-10-27 17:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "8b7c6790b0a7"
down_revision: Union[str, Sequence[str], None] = "df67cfc1edce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply performance-related indexes."""
    op.create_index("ix_devices_fan_position", "devices", ["fan_position"], unique=False)
    op.create_index(
        "idx_time_window_overrides_bunker_id",
        "time_window_overrides",
        ["bunker_id"],
        unique=False,
    )
    op.create_index(
        "idx_time_window_overrides_created_by",
        "time_window_overrides",
        ["created_by"],
        unique=False,
    )
    op.create_index(
        "idx_time_window_overrides_window",
        "time_window_overrides",
        ["start_time", "end_time"],
        unique=False,
    )


def downgrade() -> None:
    """Remove performance-related indexes."""
    op.drop_index("idx_time_window_overrides_window", table_name="time_window_overrides")
    op.drop_index("idx_time_window_overrides_created_by", table_name="time_window_overrides")
    op.drop_index("idx_time_window_overrides_bunker_id", table_name="time_window_overrides")
    op.drop_index("ix_devices_fan_position", table_name="devices")

