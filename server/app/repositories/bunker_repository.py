"""Bunker repository for grain storage facility management."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bunker import Bunker
from app.repositories.base import BaseRepository


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
