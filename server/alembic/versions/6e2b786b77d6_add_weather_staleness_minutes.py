"""add_weather_staleness_minutes

Revision ID: 6e2b786b77d6
Revises: 3d4bb4af8b37
Create Date: 2025-10-29 22:34:18.955429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e2b786b77d6'
down_revision: Union[str, Sequence[str], None] = '3d4bb4af8b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('global_config', sa.Column('weather_staleness_minutes', sa.Integer(), nullable=False, server_default='3'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('global_config', 'weather_staleness_minutes')
