"""Authentication related Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """Payload for registering a new user."""

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr | None = None
    role: str = "operator"


class UserLogin(BaseModel):
    """Credentials for user login."""

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    """Token response returned after successful authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """Serialized representation of a user without sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: EmailStr | None = None
    role: str
    created_at: datetime
    last_login: datetime | None = None
