"""Add revoked_tokens table for JWT revocation tracking

Revision ID: 2b6b6f8d23f0
Revises: 78c833ebcaf5
Create Date: 2025-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2b6b6f8d23f0"
down_revision: Union[str, Sequence[str], None] = "78c833ebcaf5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create revoked_tokens table."""
    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("jti", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_revoked_tokens_jti"), "revoked_tokens", ["jti"], unique=True
    )


def downgrade() -> None:
    """Drop revoked_tokens table."""
    op.drop_index(op.f("ix_revoked_tokens_jti"), table_name="revoked_tokens")
    op.drop_table("revoked_tokens")
