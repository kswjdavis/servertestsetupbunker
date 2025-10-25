"""Bunker repository for grain storage facility management."""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bunker import Bunker
from app.repositories.base import BaseRepository
from app.repositories.global_config_repository import GlobalConfigRepository


class BunkerRepository(BaseRepository[Bunker]):
    """Repository for Bunker model with CRUD operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(Bunker, session)

    async def get_by_name(self, name: str) -> Bunker | None:
        """
        Get bunker by name.

        Args:
            name: Bunker name

        Returns:
            Bunker instance or None if not found
        """
        result = await self.session.execute(
            select(Bunker).where(Bunker.name == name)
        )
        return result.scalar_one_or_none()

    async def get_all_bunkers(self) -> list[Bunker]:
        """
        Get all bunkers (no pagination for POC).

        Returns:
            List of all bunker instances
        """
        result = await self.session.execute(select(Bunker))
        return list(result.scalars().all())

    async def create_bunker(self, **kwargs: Any) -> Bunker:
        """
        Create a bunker, applying GlobalConfig defaults when needed.

        Args:
            **kwargs: Bunker field values

        Returns:
            Newly created bunker
        """
        payload = dict(kwargs)

        # Apply defaults from global configuration when optional fields are missing
        config = None
        for field, default_attr in (
            ("wind_threshold_mph", "default_wind_threshold_mph"),
            ("electricity_cost_kwh", "default_electricity_cost_kwh"),
            ("fan_power_watts", "default_fan_power_watts"),
        ):
            if payload.get(field) is None:
                if config is None:
                    config_repo = GlobalConfigRepository(self.session)
                    config = await config_repo.get_or_create_default()
                payload[field] = getattr(config, default_attr)

        bunker = await super().create(**payload)
        # Refresh with relationships for downstream serializers
        await self.session.refresh(bunker)
        return bunker

    async def list_bunkers(self, *, limit: int = 100, offset: int = 0) -> list[Bunker]:
        """
        List all bunkers ordered by name, preloading device relationships.

        Returns:
            List of bunker instances
        """
        result = await self.session.execute(
            select(Bunker)
            .options(selectinload(Bunker.devices))
            .order_by(Bunker.name)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_bunker(self, bunker_id: UUID) -> Bunker | None:
        """
        Retrieve a single bunker by identifier.

        Args:
            bunker_id: Bunker UUID

        Returns:
            Bunker instance or None if not found
        """
        result = await self.session.execute(
            select(Bunker)
                .options(selectinload(Bunker.devices))
                .where(Bunker.id == bunker_id)
        )
        return result.scalar_one_or_none()

    async def update_bunker(self, bunker_id: UUID, **kwargs: Any) -> Bunker:
        """
        Update bunker attributes, applying defaults when fields set to None.

        Args:
            bunker_id: Bunker UUID
            **kwargs: Fields to update

        Returns:
            Updated bunker instance

        Raises:
            HTTPException: If bunker does not exist
        """
        bunker = await self.get_bunker(bunker_id)
        if bunker is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bunker not found",
            )

        payload = dict(kwargs)
        config = None
        for field, default_attr in (
            ("wind_threshold_mph", "default_wind_threshold_mph"),
            ("electricity_cost_kwh", "default_electricity_cost_kwh"),
            ("fan_power_watts", "default_fan_power_watts"),
        ):
            if field in payload and payload[field] is None:
                if config is None:
                    config_repo = GlobalConfigRepository(self.session)
                    config = await config_repo.get_or_create_default()
                payload[field] = getattr(config, default_attr)

        for key, value in payload.items():
            if value is None:
                continue
            if hasattr(bunker, key):
                setattr(bunker, key, value)

        await self.session.commit()
        await self.session.refresh(bunker)
        return bunker

    async def delete_bunker(self, bunker_id: UUID) -> None:
        """
        Delete a bunker and cascade related entities (devices, overrides).

        Args:
            bunker_id: Bunker UUID

        Raises:
            HTTPException: If bunker does not exist
        """
        bunker = await self.get_bunker(bunker_id)
        if bunker is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bunker not found",
            )

        await self.session.delete(bunker)
        await self.session.commit()

    async def get_bunkers_near_location(
        self, latitude: float, longitude: float, radius_miles: float = 50.0
    ) -> list[Bunker]:
        """
        Get bunkers within a radius of a location.

        Note: This is a simple bounding box calculation for POC.
        Production should use PostGIS with proper spherical distance calculations.

        Args:
            latitude: Center latitude
            longitude: Center longitude
            radius_miles: Radius in miles (default 50)

        Returns:
            List of bunkers within the approximate radius
        """
        # Approximate degrees per mile (varies by latitude)
        # 1 degree latitude ≈ 69 miles
        # 1 degree longitude ≈ 69 miles * cos(latitude)
        lat_delta = radius_miles / 69.0
        lon_delta = radius_miles / (69.0 * abs(latitude) if latitude != 0 else 69.0)

        result = await self.session.execute(
            select(Bunker).where(
                Bunker.latitude.between(latitude - lat_delta, latitude + lat_delta),
                Bunker.longitude.between(longitude - lon_delta, longitude + lon_delta),
            )
        )
        return list(result.scalars().all())
