"""Database session management with async SQLAlchemy."""

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://user:password@localhost/bunkercolab_dev"
)

# Create async engine with connection pooling
# Detect if running in pytest
is_testing = "pytest" in os.getenv("_", "") or "PYTEST_CURRENT_TEST" in os.environ

if is_testing:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        poolclass=NullPool,  # Disable pooling for tests
    )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,  # Set to True for SQL query logging
        pool_pre_ping=True,  # Enable connection health checks
        pool_size=5,  # Maximum number of connections in pool
        max_overflow=10,  # Maximum overflow connections beyond pool_size
    )

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent DetachedInstanceError
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database sessions.

    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            ...

    Yields:
        AsyncSession: Database session that auto-closes on exit
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
