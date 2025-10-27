"""add hysteresis config for anti cycling

Revision ID: 20251026195443
Revises: df67cfc1edce
Create Date: 2025-10-26 19:54:43.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251026195443'
down_revision: Union[str, None] = 'df67cfc1edce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hysteresis column to bunkers table
    op.add_column('bunkers',
        sa.Column('wind_threshold_hysteresis_mph', sa.Float(), nullable=True)
    )

    # Add hysteresis column to global_config table
    op.add_column('global_config',
        sa.Column('default_wind_threshold_hysteresis_mph', sa.Float(), nullable=True)
    )

    # Set default hysteresis values
    op.execute("UPDATE bunkers SET wind_threshold_hysteresis_mph = 3.0 WHERE wind_threshold_hysteresis_mph IS NULL")
    op.execute("UPDATE global_config SET default_wind_threshold_hysteresis_mph = 3.0 WHERE default_wind_threshold_hysteresis_mph IS NULL")


def downgrade() -> None:
    # Remove hysteresis columns
    op.drop_column('bunkers', 'wind_threshold_hysteresis_mph')
    op.drop_column('global_config', 'default_wind_threshold_hysteresis_mph')