"""add emergency control columns

Revision ID: df67cfc1edce
Revises: 2b6b6f8d23f0
Create Date: 2025-10-24 22:06:09.999963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df67cfc1edce'
down_revision: Union[str, Sequence[str], None] = '2b6b6f8d23f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add emergency_on column to bunkers table
    op.add_column('bunkers', sa.Column('emergency_on', sa.Boolean(), nullable=False, server_default='false'))

    # Add emergency_on_global column to global_config table
    op.add_column('global_config', sa.Column('emergency_on_global', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove emergency_on_global column from global_config table
    op.drop_column('global_config', 'emergency_on_global')

    # Remove emergency_on column from bunkers table
    op.drop_column('bunkers', 'emergency_on')
