#!/usr/bin/env python3
"""
Create a test user for development
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine, AsyncSessionLocal
from app.models.user import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_test_user():
    """Create a test admin user"""
    async with AsyncSessionLocal() as db:
        # Check if admin user exists
        from sqlalchemy import select

        result = await db.execute(select(User).where(User.username == "admin"))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print("Admin user already exists")
            return

        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@bunkercolab.com",
            hashed_password=pwd_context.hash("admin123"),
            role="admin",
            is_active=True
        )

        db.add(admin_user)
        await db.commit()

        print("Created admin user:")
        print("  Username: admin")
        print("  Password: admin123")
        print("  Role: admin")


if __name__ == "__main__":
    asyncio.run(create_test_user())