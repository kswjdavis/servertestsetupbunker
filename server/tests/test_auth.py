"""Unit tests for authentication workflows."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import get_db
from app.core.security import clear_revoked_tokens, decode_access_token
from app.main import app
from app.models import Base
from app.schemas.auth import UserCreate
from app.services.auth_service import AuthService

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
def configure_settings() -> None:
    """Ensure deterministic security configuration for tests."""
    original_secret = settings.SECRET_KEY
    original_expire = settings.ACCESS_TOKEN_EXPIRE_HOURS
    settings.SECRET_KEY = "test-secret-key"
    settings.ACCESS_TOKEN_EXPIRE_HOURS = 24
    clear_revoked_tokens()
    yield
    settings.SECRET_KEY = original_secret
    settings.ACCESS_TOKEN_EXPIRE_HOURS = original_expire
    clear_revoked_tokens()


@pytest_asyncio.fixture()
async def async_session() -> AsyncSession:
    """Provide an isolated in-memory database session."""
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with TestingSessionLocal() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture()
async def client(async_session: AsyncSession) -> AsyncClient:
    """HTTP client with overridden database dependency."""

    async def override_get_db() -> AsyncSession:
        yield async_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_password_hashing_and_verification() -> None:
    """Password hashing produces salted hash and verifies correctly."""
    password = "supersafepassword"
    hashed = AuthService.hash_password(password)

    assert hashed != password
    assert AuthService.verify_password(password, hashed)
    assert not AuthService.verify_password("wrongpass", hashed)


@pytest.mark.asyncio
async def test_token_contains_user_id(async_session: AsyncSession) -> None:
    """Created tokens encode the correct subject identifier."""
    service = AuthService(async_session)
    user = await service.register_user(
        UserCreate(
            username="token_user",
            password="password123",
            email="token@example.com",
            role="operator",
        )
    )

    token, _ = service.create_access_token(user.id, expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert payload["sub"] == str(user.id)


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient) -> None:
    """End-to-end registration and login workflow."""
    register_payload = {
        "username": "auth_user",
        "password": "password123",
        "email": "auth@example.com",
        "role": "operator",
    }
    register_response = await client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == 201, register_response.text

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "auth_user", "password": "password123"},
    )
    assert login_response.status_code == 200, login_response.text

    token_data = login_response.json()
    assert token_data["token_type"] == "bearer"
    assert token_data["expires_in"] > 0

    auth_header = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_response = await client.get("/api/v1/auth/me", headers=auth_header)
    assert me_response.status_code == 200, me_response.text

    me_payload = me_response.json()
    assert me_payload["username"] == register_payload["username"]
    assert me_payload["email"] == register_payload["email"]


@pytest.mark.asyncio
async def test_protected_route_requires_token(client: AsyncClient) -> None:
    """Protected endpoints require a bearer token."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_logout_revokes_token(client: AsyncClient) -> None:
    """Logout invalidates token for subsequent requests."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "username": "logout_user",
            "password": "password123",
            "email": "logout@example.com",
            "role": "operator",
        },
    )

    login_response = await client.post(
        "/api/v1/auth/login",
        json={"username": "logout_user", "password": "password123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    logout_response = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_response.status_code == 204

    protected_response = await client.get("/api/v1/auth/me", headers=headers)
    assert protected_response.status_code == 401
    assert protected_response.json()["detail"] == "Token has been revoked"


@pytest.mark.asyncio
async def test_token_expiration_handling(
    client: AsyncClient,
    async_session: AsyncSession,
) -> None:
    """Expired tokens are rejected by protected endpoints."""
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "expiry_user",
            "password": "password123",
            "email": "expiry@example.com",
            "role": "operator",
        },
    )
    user_id = UUID(register_response.json()["id"])

    service = AuthService(async_session)
    token, _ = service.create_access_token(user_id, expires_delta=timedelta(seconds=1))
    await asyncio.sleep(1.1)

    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired"
