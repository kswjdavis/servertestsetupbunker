"""Repository for DeviceRuntimeLog management and aggregation queries."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_runtime_log import DeviceRuntimeLog, RuntimeSource, RuntimeState
from app.repositories.base import BaseRepository


class RuntimeLogRepository(BaseRepository[DeviceRuntimeLog]):
    """Repository for DeviceRuntimeLog model with windowed query support."""

    def __init__(self, session: AsyncSession):
        super().__init__(DeviceRuntimeLog, session)

    async def create_runtime_log(
        self,
        device_id: UUID,
        started_at: datetime,
        state: RuntimeState,
        source: RuntimeSource,
        ended_at: datetime | None = None,
    ) -> DeviceRuntimeLog:
        """
        Create a new runtime log entry.

        Args:
            device_id: Device UUID
            started_at: When the state began
            state: Runtime state (on/off)
            source: Source of the state change
            ended_at: When the state ended (None if currently active)

        Returns:
            Created DeviceRuntimeLog instance
        """
        log = DeviceRuntimeLog(
            device_id=device_id,
            started_at=started_at,
            state=state,
            source=source,
            ended_at=ended_at,
        )
        self.session.add(log)
        await self.session.flush()
        await self.session.refresh(log)
        return log

    async def get_logs_by_device(
        self,
        device_id: UUID,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[DeviceRuntimeLog]:
        """
        Get runtime logs for a specific device within a time window.

        Args:
            device_id: Device UUID
            start_time: Beginning of time window (inclusive), defaults to all time
            end_time: End of time window (exclusive), defaults to now

        Returns:
            List of runtime logs ordered by started_at ascending
        """
        query = select(DeviceRuntimeLog).where(DeviceRuntimeLog.device_id == device_id)

        if start_time is not None:
            # Include logs that started before the window but may overlap
            query = query.where(
                (DeviceRuntimeLog.ended_at.is_(None))
                | (DeviceRuntimeLog.ended_at >= start_time)
            )

        if end_time is not None:
            # Exclude logs that started after the window
            query = query.where(DeviceRuntimeLog.started_at < end_time)

        query = query.order_by(DeviceRuntimeLog.started_at)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_total_on_time_seconds(
        self,
        device_id: UUID,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> float:
        """
        Calculate total ON time for a device within a time window.

        This method accounts for:
        - Logs fully within the window
        - Logs that overlap the window boundaries
        - Currently active (unclosed) logs

        Args:
            device_id: Device UUID
            start_time: Beginning of time window (inclusive)
            end_time: End of time window (exclusive), defaults to now

        Returns:
            Total ON time in seconds (0.0 if no data)
        """
        now = datetime.now(timezone.utc)
        if end_time is None:
            end_time = now

        logs = await self.get_logs_by_device(device_id, start_time, end_time)

        total_seconds = 0.0
        for log in logs:
            if log.state != RuntimeState.ON:
                continue

            # Determine effective start and end for this log within the window
            log_start = log.started_at
            log_end = log.ended_at if log.ended_at is not None else now

            # Clamp to the window boundaries
            if start_time is not None and log_start < start_time:
                log_start = start_time
            if log_end > end_time:
                log_end = end_time

            # Only count if there's overlap with the window
            if log_end > log_start:
                total_seconds += (log_end - log_start).total_seconds()

        return total_seconds

    async def get_all_device_on_times(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict[UUID, float]:
        """
        Calculate total ON time for all devices within a time window.

        Args:
            start_time: Beginning of time window (inclusive)
            end_time: End of time window (exclusive), defaults to now

        Returns:
            Dictionary mapping device_id to total ON time in seconds
        """
        now = datetime.now(timezone.utc)
        if end_time is None:
            end_time = now

        # Get all devices with runtime logs
        query = select(DeviceRuntimeLog.device_id).distinct()

        if start_time is not None:
            query = query.where(
                (DeviceRuntimeLog.ended_at.is_(None))
                | (DeviceRuntimeLog.ended_at >= start_time)
            )

        if end_time is not None:
            query = query.where(DeviceRuntimeLog.started_at < end_time)

        result = await self.session.execute(query)
        device_ids = list(result.scalars().all())

        # Calculate ON time for each device
        on_times: dict[UUID, float] = {}
        for device_id in device_ids:
            on_time = await self.get_total_on_time_seconds(device_id, start_time, end_time)
            on_times[device_id] = on_time

        return on_times

    async def close_active_log(
        self,
        device_id: UUID,
        ended_at: datetime | None = None,
    ) -> DeviceRuntimeLog | None:
        """
        Close the currently active (unclosed) runtime log for a device.

        Args:
            device_id: Device UUID
            ended_at: When the state ended, defaults to now

        Returns:
            Updated DeviceRuntimeLog if found, None otherwise
        """
        if ended_at is None:
            ended_at = datetime.now(timezone.utc)

        # Find the active log (ended_at is NULL)
        result = await self.session.execute(
            select(DeviceRuntimeLog)
            .where(
                and_(
                    DeviceRuntimeLog.device_id == device_id,
                    DeviceRuntimeLog.ended_at.is_(None),
                )
            )
            .order_by(DeviceRuntimeLog.started_at.desc())
            .limit(1)
        )
        log = result.scalar_one_or_none()

        if log is not None:
            log.ended_at = ended_at
            await self.session.flush()
            await self.session.refresh(log)

        return log
