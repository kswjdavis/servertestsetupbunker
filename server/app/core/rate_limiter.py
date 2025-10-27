"""Simple in-memory rate limiter utilities."""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Deque, Dict

from fastapi import HTTPException, status


_login_attempts: Dict[str, Deque[datetime]] = defaultdict(deque)
DEFAULT_WINDOW_SECONDS = 60
DEFAULT_MAX_ATTEMPTS = 5


def check_rate_limit(identifier: str, *, max_attempts: int = DEFAULT_MAX_ATTEMPTS) -> None:
    """
    Track and enforce rate limits for the provided identifier.

    Args:
        identifier: Unique key for the client (e.g., IP address)
        max_attempts: Maximum allowed attempts within the rolling window
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=DEFAULT_WINDOW_SECONDS)
    attempts = _login_attempts[identifier]

    while attempts and attempts[0] < window_start:
        attempts.popleft()

    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    attempts.append(now)


def clear_rate_limits() -> None:
    """Reset stored rate limiting data (intended for tests)."""
    _login_attempts.clear()
