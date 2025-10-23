"""Authentication service providing password and token utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Tuple
from uuid import UUID

from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import revoke_token
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserCreate


class AuthService:
    """Service layer for authentication-related operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a plaintext password using bcrypt."""
        return UserRepository.hash_password(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a plaintext password against a stored hash."""
        return UserRepository.verify_password(plain_password, hashed_password)

    def create_access_token(
        self, user_id: UUID, expires_delta: timedelta | None = None
    ) -> Tuple[str, datetime]:
        """Create a signed JWT access token."""
        if expires_delta is None:
            expires_delta = timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)

        expire_at = datetime.now(timezone.utc) + expires_delta
        payload = {"sub": str(user_id), "exp": expire_at}
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return token, expire_at

    async def authenticate_user(self, username: str, password: str) -> User:
        """Authenticate a user by username and password."""
        user = await self.user_repo.authenticate(username, password)
        if user is None:
            raise ValueError("Invalid username or password")
        return user

    async def register_user(self, user_create: UserCreate) -> User:
        """Register a new user with hashed password and uniqueness checks."""
        existing_user = await self.user_repo.get_by_username(user_create.username)
        if existing_user is not None:
            raise ValueError("Username already exists")

        return await self.user_repo.create_user(
            username=user_create.username,
            password=user_create.password,
            email=user_create.email,
            role=user_create.role,
        )

    async def logout(self, token: str) -> None:
        """Revoke a token to invalidate future requests."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except ExpiredSignatureError:
            # Token already expired; nothing additional to revoke
            return
        except JWTError as exc:
            raise ValueError("Invalid token") from exc

        expires_at_raw = payload.get("exp")
        if isinstance(expires_at_raw, (int, float)):
            expires_at = datetime.fromtimestamp(expires_at_raw, tz=timezone.utc)
        elif isinstance(expires_at_raw, datetime):
            expires_at = expires_at_raw
        else:
            expires_at = datetime.now(timezone.utc)

        revoke_token(token, expires_at)
