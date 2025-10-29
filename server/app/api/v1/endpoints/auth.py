"""Authentication API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import check_rate_limit
from app.core.security import get_access_token, get_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db),
) -> User:
    """Register a new user account."""
    auth_service = AuthService(session)
    try:
        return await auth_service.register_user(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


async def enforce_login_rate_limit(request: Request) -> None:
    """Guard the login endpoint against brute force attacks."""
    identifier = request.client.host if request.client else "unknown"
    check_rate_limit(identifier)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
async def login_user(
    credentials: UserLogin,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(enforce_login_rate_limit),
) -> TokenResponse:
    """Authenticate user credentials and return an access token."""
    auth_service = AuthService(session)
    try:
        user = await auth_service.authenticate_user(
            credentials.username, credentials.password
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from exc

    token, expires_at, _ = auth_service.create_access_token(user.id)
    expires_in = max(
        0,
        int((expires_at - datetime.now(timezone.utc)).total_seconds()),
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(user)
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout_user(
    token: Annotated[str, Depends(get_access_token)],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Invalidate the current user's session by revoking the token."""
    auth_service = AuthService(session)
    try:
        await auth_service.logout(token, current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def get_current_user_details(
    current_user: User = Depends(get_current_user),
) -> User:
    """Return the authenticated user's profile."""
    return current_user
