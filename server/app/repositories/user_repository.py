"""User repository with authentication methods."""

from datetime import datetime, timezone
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import BaseRepository

# Bcrypt password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRepository(BaseRepository[User]):
    """Repository for User model with authentication methods."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a plaintext password using bcrypt.

        Args:
            password: Plaintext password

        Returns:
            Bcrypt password hash
        """
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.

        Args:
            plain_password: Plaintext password to verify
            hashed_password: Stored password hash

        Returns:
            True if password matches, False otherwise
        """
        return pwd_context.verify(plain_password, hashed_password)

    async def get_by_username(self, username: str) -> User | None:
        """
        Get user by username.

        Args:
            username: Username to search for

        Returns:
            User instance or None if not found
        """
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def create_user(
        self, username: str, password: str, email: str | None = None, role: str = "viewer"
    ) -> User:
        """
        Create a new user with hashed password.

        Args:
            username: Unique username
            password: Plaintext password (will be hashed)
            email: Optional email address
            role: User role (admin, operator, viewer)

        Returns:
            Created user instance
        """
        password_hash = self.hash_password(password)
        return await self.create(
            username=username,
            password_hash=password_hash,
            email=email,
            role=role,
        )

    async def authenticate(self, username: str, password: str) -> User | None:
        """
        Authenticate a user by username and password.

        Args:
            username: Username
            password: Plaintext password

        Returns:
            User instance if authentication succeeds, None otherwise
        """
        user = await self.get_by_username(username)
        if user is None:
            return None

        if not self.verify_password(password, user.password_hash):
            return None

        # Update last_login timestamp
        user.last_login = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def change_password(self, user_id: UUID, new_password: str) -> User | None:
        """
        Change a user's password.

        Args:
            user_id: User ID
            new_password: New plaintext password (will be hashed)

        Returns:
            Updated user instance or None if not found
        """
        password_hash = self.hash_password(new_password)
        return await self.update(user_id, password_hash=password_hash)
