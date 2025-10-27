"""Security utilities and authentication dependencies."""

from __future__ import annotations

from typing import Annotated, Any, Awaitable, Callable, Iterable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.device import Device
from app.models.user import User
from app.repositories.device_repository import DeviceRepository
from app.repositories.revoked_token_repository import RevokedTokenRepository
from app.repositories.user_repository import UserRepository

# HTTP Bearer auth scheme
http_bearer = HTTPBearer(auto_error=False)


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


async def get_device_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> UUID:
    """Extract and validate a device authentication token from the Authorization header."""
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
    try:
        return UUID(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device authentication token",
        ) from exc


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
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    jti = payload.get("jti")
    if jti is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    revoked_repo = RevokedTokenRepository(session)
    if await revoked_repo.is_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
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
    "decode_access_token",
    "get_access_token",
    "get_current_device",
    "get_current_user",
    "get_device_token",
    "http_bearer",
    "require_roles",
]


async def get_current_device(
    token: Annotated[UUID, Depends(get_device_token)],
    session: AsyncSession = Depends(get_db),
) -> Device:
    """Return the authenticated device for the provided bearer token."""
    repository = DeviceRepository(session)
    device = await repository.get_by_auth_token(token)
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device authentication token",
        )
    return device


def require_roles(roles: Iterable[str]) -> Callable[..., Awaitable[User]]:
    """
    Dependency factory enforcing that the authenticated user has an allowed role.

    Args:
        roles: Iterable of role names permitted to access the endpoint.

    Returns:
        Dependency function that yields the current user when authorized.

    Raises:
        HTTPException: If the user's role is not in the allowed set.
    """
    allowed_roles = {role.lower() for role in roles}

    async def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role.lower() not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return dependency
