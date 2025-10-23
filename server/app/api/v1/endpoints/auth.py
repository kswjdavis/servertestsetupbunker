"""Authentication API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
async def login_user(
    credentials: UserLogin,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate user credentials and return an access token."""
    auth_service = AuthService(session)
    try:
        user = await auth_service.authenticate_user(credentials.username, credentials.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from exc

    token, expires_at = auth_service.create_access_token(user.id)
    expires_in = max(
        0,
        int((expires_at - datetime.now(timezone.utc)).total_seconds()),
    )
    return TokenResponse(access_token=token, token_type="bearer", expires_in=expires_in)


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
    _ = current_user  # Ensures dependency executes for authentication
    auth_service = AuthService(session)
    await auth_service.logout(token)
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
