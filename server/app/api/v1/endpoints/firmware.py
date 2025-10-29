"""Firmware management endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Dict, Union
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import require_roles
from app.models.user import User, UserRole

router = APIRouter(prefix="/firmware", tags=["firmware"])

AdminUser = Annotated[User, Depends(require_roles([UserRole.ADMIN.value]))]

MAX_FIRMWARE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB safety ceiling for OTA binaries


def _ensure_storage_dir() -> Path:
    """Return the firmware storage directory, creating it if necessary."""
    storage_dir = settings.FIRMWARE_STORAGE_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_firmware_binary(
    _: AdminUser,
    file: UploadFile = File(...),
) -> Dict[str, Union[str, int]]:
    """Upload a new firmware binary and promote it as the latest image."""
    if file.content_type not in ("application/octet-stream", "application/x-binary"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firmware upload must be a binary file.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded firmware file is empty.",
        )

    if len(data) > MAX_FIRMWARE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Firmware image exceeds maximum allowed size (8 MB).",
        )

    storage_dir = _ensure_storage_dir()
    temp_name = storage_dir / f"{uuid4().hex}.upload"
    latest_path = storage_dir / "latest.bin"

    temp_name.write_bytes(data)
    temp_name.replace(latest_path)

    return {
        "status": "uploaded",
        "filename": "latest.bin",
        "size_bytes": len(data),
    }


@router.get(
    "/latest.bin",
    response_class=FileResponse,
    status_code=status.HTTP_200_OK,
)
async def download_latest_firmware() -> FileResponse:
    """Return the latest firmware binary for OTA updates."""
    storage_dir = _ensure_storage_dir()
    latest_path = storage_dir / "latest.bin"
    if not latest_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No firmware image uploaded yet.",
        )

    return FileResponse(
        latest_path,
        media_type="application/octet-stream",
        filename="latest.bin",
    )
