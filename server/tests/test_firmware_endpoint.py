"""Integration tests for firmware upload and download endpoints."""

from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import status
from httpx import AsyncClient

from app.core.config import settings


async def register_admin(client: AsyncClient) -> dict[str, str]:
    """Register and authenticate an admin user, returning auth headers."""
    username = f"admin_{uuid4().hex[:8]}"
    register_payload = {
        "username": username,
        "password": "password123",
        "email": f"{username}@example.com",
        "role": "admin",
    }
    register_response = await client.post("/api/v1/auth/register", json=register_payload)
    assert register_response.status_code == status.HTTP_201_CREATED, register_response.text

    login_payload = {"username": username, "password": "password123"}
    login_response = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == status.HTTP_200_OK, login_response.text
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_uploads_and_downloads_firmware(
    client: AsyncClient,
) -> None:
    """Admin users can upload a firmware image and devices can download it."""
    headers = await register_admin(client)

    original_storage = settings.FIRMWARE_STORAGE_DIR
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        settings.FIRMWARE_STORAGE_DIR = tmp_path
        try:
            firmware_bytes = b"\x01\x02\x03\x04"

            upload_response = await client.post(
                "/api/v1/firmware/upload",
                headers=headers,
                files={"file": ("firmware.bin", firmware_bytes, "application/octet-stream")},
            )
            assert upload_response.status_code == status.HTTP_201_CREATED, upload_response.text
            body = upload_response.json()
            assert body["filename"] == "latest.bin"
            assert body["size_bytes"] == len(firmware_bytes)

            stored_file = tmp_path / "latest.bin"
            assert stored_file.exists()
            assert stored_file.read_bytes() == firmware_bytes

            download_response = await client.get("/api/v1/firmware/latest.bin")
            assert download_response.status_code == status.HTTP_200_OK, download_response.text
            assert download_response.content == firmware_bytes
            assert download_response.headers["content-type"] == "application/octet-stream"
        finally:
            settings.FIRMWARE_STORAGE_DIR = original_storage


@pytest.mark.asyncio
async def test_download_without_firmware_returns_404(
    client: AsyncClient,
) -> None:
    """When no firmware is uploaded yet, download returns HTTP 404."""
    original_storage = settings.FIRMWARE_STORAGE_DIR
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        settings.FIRMWARE_STORAGE_DIR = tmp_path
        try:
            response = await client.get("/api/v1/firmware/latest.bin")
            assert response.status_code == status.HTTP_404_NOT_FOUND
        finally:
            settings.FIRMWARE_STORAGE_DIR = original_storage
