"""Security utilities and authentication dependencies."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

# HTTP Bearer auth scheme
http_bearer = HTTPBearer(auto_error=False)

# In-memory revoked token registry with expiration timestamps
_revoked_tokens: dict[str, datetime] = {}


def _cleanup_revoked_tokens(now: datetime | None = None) -> None:
    """Remove expired entries from the revoked token registry."""
    current_time = now or datetime.now(timezone.utc)
    expired_tokens = [
        token for token, expires_at in _revoked_tokens.items() if expires_at <= current_time
    ]
    for token in expired_tokens:
        _revoked_tokens.pop(token, None)


def revoke_token(token: str, expires_at: datetime) -> None:
    """Mark a token as revoked until its natural expiration time."""
    _cleanup_revoked_tokens()
    _revoked_tokens[token] = expires_at


def is_token_revoked(token: str) -> bool:
    """Return True if the token has been revoked."""
    _cleanup_revoked_tokens()
    return token in _revoked_tokens


def clear_revoked_tokens() -> None:
    """Reset revoked token state (primarily for tests)."""
    _revoked_tokens.clear()


async def get_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> str:
    """Extract bearer token from the Authorization header."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme",
        )
    return credentials.credentials


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc


async def get_current_user(
    token: Annotated[str, Depends(get_access_token)],
    session: AsyncSession = Depends(get_db),
) -> User:
    """Return the authenticated user for the provided bearer token."""
    if is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    try:
        user_uuid = UUID(str(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc

    user_repo = UserRepository(session)
    user = await user_repo.get(user_uuid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


__all__ = [
    "clear_revoked_tokens",
    "decode_access_token",
    "get_access_token",
    "get_current_user",
    "http_bearer",
    "is_token_revoked",
    "revoke_token",
]
