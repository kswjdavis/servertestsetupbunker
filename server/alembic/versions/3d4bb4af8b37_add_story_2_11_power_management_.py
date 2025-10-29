"""Add Story 2.11 power management telemetry fields to device_status

Revision ID: 3d4bb4af8b37
Revises: a1b2c3d4e5f6
Create Date: 2025-10-29 09:46:06.864133

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d4bb4af8b37'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Story 2.11 power management and health telemetry columns."""
    # Add new telemetry columns (all nullable for backward compatibility)
    op.add_column('device_status', sa.Column('free_heap_bytes', sa.Integer(), nullable=True))
    op.add_column('device_status', sa.Column('wifi_ps_mode', sa.SmallInteger(), nullable=True))
    op.add_column('device_status', sa.Column('cpu_freq_mhz', sa.SmallInteger(), nullable=True))
    op.add_column('device_status', sa.Column('watchdog_reset_count', sa.SmallInteger(), nullable=True))
    op.add_column('device_status', sa.Column('last_reset_reason', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Remove Story 2.11 telemetry columns."""
    op.drop_column('device_status', 'last_reset_reason')
    op.drop_column('device_status', 'watchdog_reset_count')
    op.drop_column('device_status', 'cpu_freq_mhz')
    op.drop_column('device_status', 'wifi_ps_mode')
    op.drop_column('device_status', 'free_heap_bytes')
