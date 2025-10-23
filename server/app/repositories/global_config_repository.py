"""GlobalConfig repository for singleton system configuration."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.global_config import GlobalConfig
from app.repositories.base import BaseRepository


class GlobalConfigRepository(BaseRepository[GlobalConfig]):
    """Repository for GlobalConfig singleton model."""

    def __init__(self, session: AsyncSession):
        super().__init__(GlobalConfig, session)

    async def get_config(self) -> GlobalConfig | None:
        """
        Get the global configuration singleton (id=1).

        Returns:
            GlobalConfig instance or None if not initialized
        """
        result = await self.session.execute(
            select(GlobalConfig).where(GlobalConfig.id == 1)
        )
        return result.scalar_one_or_none()

    async def update_config(self, **kwargs) -> GlobalConfig:
        """
        Update global configuration fields.

        Creates the singleton record if it doesn't exist.

        Args:
            **kwargs: Configuration fields to update

        Returns:
            Updated GlobalConfig instance
        """
        config = await self.get_config()

        if config is None:
            # Create singleton record with id=1 if it doesn't exist
            config = GlobalConfig(id=1, **kwargs)
            self.session.add(config)
        else:
            # Update existing record
            for key, value in kwargs.items():
                if hasattr(config, key):
                    setattr(config, key, value)

        await self.session.commit()
        await self.session.refresh(config)
        return config

    async def get_or_create_default(self) -> GlobalConfig:
        """
        Get global config or create with default values if not exists.

        Returns:
            GlobalConfig instance with default or existing values
        """
        config = await self.get_config()

        if config is None:
            # Create with defaults from model definition
            config = GlobalConfig(id=1)
            self.session.add(config)
            await self.session.commit()
            await self.session.refresh(config)

        return config
