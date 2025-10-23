"""Shared pytest fixtures for server tests."""

from __future__ import annotations

import os
from typing import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure deterministic security settings before importing application modules
os.environ.setdefault(
    "SECRET_KEY",
    "unit-test-secret-key-that-is-long-enough-123456",
)

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limiter import clear_rate_limits
from app.main import app
from app.models import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
def configure_settings() -> AsyncGenerator[None, None]:
    """Provide predictable security configuration during tests."""
    original_secret = settings.SECRET_KEY
    original_expire = settings.ACCESS_TOKEN_EXPIRE_HOURS
    settings.SECRET_KEY = "unit-test-secret-key-that-is-long-enough-123456"
    settings.ACCESS_TOKEN_EXPIRE_HOURS = 24
    clear_rate_limits()
    yield
    settings.SECRET_KEY = original_secret
    settings.ACCESS_TOKEN_EXPIRE_HOURS = original_expire
    clear_rate_limits()


@pytest_asyncio.fixture()
async def async_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated in-memory database session for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with TestingSessionLocal() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture()
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client with overridden database dependency."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield async_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()

