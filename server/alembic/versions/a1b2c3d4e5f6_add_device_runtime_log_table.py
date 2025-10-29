"""Add DeviceRuntimeLog table for energy tracking

Revision ID: a1b2c3d4e5f6
Revises: e2fd525d0c90
Create Date: 2025-10-28 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e2fd525d0c90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create device_runtime_logs table for energy savings tracking."""
    op.create_table(
        "device_runtime_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create composite index for efficient time-windowed queries
    op.create_index(
        "idx_device_runtime_logs_device_time",
        "device_runtime_logs",
        ["device_id", "started_at"],
        unique=False,
    )

    # Create index for finding active (unclosed) runtime logs
    op.create_index(
        "idx_device_runtime_logs_active",
        "device_runtime_logs",
        ["device_id", "ended_at"],
        unique=False,
    )

    # Create individual indexes for device_id
    op.create_index(
        op.f("ix_device_runtime_logs_device_id"),
        "device_runtime_logs",
        ["device_id"],
        unique=False,
    )

    # Create individual indexes for started_at
    op.create_index(
        op.f("ix_device_runtime_logs_started_at"),
        "device_runtime_logs",
        ["started_at"],
        unique=False,
    )

    # Create individual indexes for ended_at
    op.create_index(
        op.f("ix_device_runtime_logs_ended_at"),
        "device_runtime_logs",
        ["ended_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop device_runtime_logs table."""
    op.drop_index(op.f("ix_device_runtime_logs_ended_at"), table_name="device_runtime_logs")
    op.drop_index(op.f("ix_device_runtime_logs_started_at"), table_name="device_runtime_logs")
    op.drop_index(op.f("ix_device_runtime_logs_device_id"), table_name="device_runtime_logs")
    op.drop_index("idx_device_runtime_logs_active", table_name="device_runtime_logs")
    op.drop_index("idx_device_runtime_logs_device_time", table_name="device_runtime_logs")
    op.drop_table("device_runtime_logs")
