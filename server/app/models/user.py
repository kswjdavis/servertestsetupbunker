"""User model for authentication and authorization."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, utc_now


class UserRole(str, Enum):
    """User role enum for role-based access control."""

    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class User(Base):
    """
    User model for authentication and authorization.

    Attributes:
        id: UUID primary key
        username: Unique username (max 50 chars)
        password_hash: Bcrypt password hash (max 255 chars)
        email: Optional email address
        role: User role (admin, operator, viewer)
        created_at: Account creation timestamp
        last_login: Last login timestamp
    """

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=UserRole.VIEWER.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    time_window_overrides: Mapped[list["TimeWindowOverride"]] = relationship(
        back_populates="created_by_user", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"
