from uuid import uuid4

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
import pytest

from app.config import get_settings
from app.deps import UserIdDep, get_current_user_id

settings = get_settings()


@pytest.mark.asyncio
async def test_get_current_user_id_pure_function():
    """get_current_user_id should parse valid UUID or fall back to DEFAULT_USER_ID."""
    # Fallback when None or empty
    assert await get_current_user_id(None) == settings.DEFAULT_USER_ID
    assert await get_current_user_id("") == settings.DEFAULT_USER_ID

    # Custom valid UUID
    custom_uuid = uuid4()
    assert await get_current_user_id(str(custom_uuid)) == custom_uuid

    # Valid UUID with leading/trailing spaces
    assert await get_current_user_id(f"  {custom_uuid}  ") == custom_uuid

    # Invalid UUID string raises 400
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user_id("not-a-valid-uuid")

    assert exc_info.value.status_code == 400
    assert "Invalid X-User-Id header format" in exc_info.value.detail


@pytest.mark.asyncio
async def test_user_id_dep_in_fastapi_route():
    """Injected user_id dependency should properly extract header or use default."""
    test_app = FastAPI()

    @test_app.get("/api/test-user")
    async def get_test_user(user_id: UserIdDep):
        return {"user_id": str(user_id)}

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. No header -> DEFAULT_USER_ID
        res_default = await client.get("/api/test-user")
        assert res_default.status_code == 200
        assert res_default.json() == {"user_id": str(settings.DEFAULT_USER_ID)}

        # 2. Provided X-User-Id -> parsed UUID
        custom_id = uuid4()
        res_custom = await client.get(
            "/api/test-user",
            headers={"X-User-Id": str(custom_id)},
        )
        assert res_custom.status_code == 200
        assert res_custom.json() == {"user_id": str(custom_id)}

        # 3. Invalid X-User-Id -> 400 Bad Request
        res_invalid = await client.get(
            "/api/test-user",
            headers={"X-User-Id": "invalid-uuid"},
        )
        assert res_invalid.status_code == 400
