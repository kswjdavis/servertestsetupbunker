"""merge performance indexes and hysteresis config

Revision ID: e2fd525d0c90
Revises: 20251026195443, 8b7c6790b0a7
Create Date: 2025-10-28 15:44:36.439407

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2fd525d0c90'
down_revision: Union[str, Sequence[str], None] = ('20251026195443', '8b7c6790b0a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
