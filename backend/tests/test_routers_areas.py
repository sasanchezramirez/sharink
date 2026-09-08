from uuid import uuid4

from app.database import close_db, get_session, init_db
from app.main import app
from app.models import User
from httpx import ASGITransport, AsyncClient
import pytest


@pytest.fixture(autouse=True)
async def prepare_database():
    await init_db()
    yield
    await close_db()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def create_test_user() -> User:
    """Helper to persist a test user with unique email in the database."""
    uid = uuid4()
    user = User(id=uid, email=f"user_{uid.hex[:8]}@sharink.app")
    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.mark.asyncio
async def test_areas_crud_full_flow(async_client: AsyncClient):
    """Verify complete CRUD flow for life areas: create -> list -> update -> delete."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}

    # 1. Initially empty for new user
    res_initial = await async_client.get("/api/areas", headers=headers)
    assert res_initial.status_code == 200
    assert res_initial.json() == []

    # 2. Create Area
    create_payload = {
        "name": "Trabajo & Proyectos",
        "color": "#0284c7",
        "visible": True,
    }
    res_create = await async_client.post(
        "/api/areas", json=create_payload, headers=headers
    )
    assert res_create.status_code == 201
    created_area = res_create.json()
    area_id = created_area["id"]
    assert created_area["name"] == "Trabajo & Proyectos"
    assert created_area["color"] == "#0284c7"
    assert created_area["visible"] is True
    assert created_area["user_id"] == str(user.id)

    # 3. List areas includes newly created
    res_list = await async_client.get("/api/areas", headers=headers)
    assert res_list.status_code == 200
    areas_list = res_list.json()
    assert len(areas_list) == 1
    assert areas_list[0]["id"] == area_id

    # 4. Update Area (partial: only color and name)
    update_payload = {
        "name": "Carrera Profesional",
        "color": "#0369a1",
    }
    res_update = await async_client.put(
        f"/api/areas/{area_id}", json=update_payload, headers=headers
    )
    assert res_update.status_code == 200
    updated_area = res_update.json()
    assert updated_area["id"] == area_id
    assert updated_area["name"] == "Carrera Profesional"
    assert updated_area["color"] == "#0369a1"
    assert updated_area["visible"] is True  # preserved

    # 5. Delete Area
    res_delete = await async_client.delete(f"/api/areas/{area_id}", headers=headers)
    assert res_delete.status_code == 204

    # 6. Verify deleted
    res_after = await async_client.get("/api/areas", headers=headers)
    assert res_after.status_code == 200
    assert res_after.json() == []


@pytest.mark.asyncio
async def test_areas_ownership_isolation(async_client: AsyncClient):
    """Users cannot view, modify, or delete another user's life areas (returns 404)."""
    user_a = await create_test_user()
    user_b = await create_test_user()

    headers_a = {"X-User-Id": str(user_a.id)}
    headers_b = {"X-User-Id": str(user_b.id)}

    # User A creates an area
    res_a = await async_client.post(
        "/api/areas",
        json={"name": "Salud de User A", "color": "#22c55e", "visible": True},
        headers=headers_a,
    )
    assert res_a.status_code == 201
    area_a_id = res_a.json()["id"]

    # User B lists areas -> should NOT see User A's area
    res_b_list = await async_client.get("/api/areas", headers=headers_b)
    assert res_b_list.status_code == 200
    assert not any(a["id"] == area_a_id for a in res_b_list.json())

    # User B attempts to UPDATE User A's area -> 404
    res_b_update = await async_client.put(
        f"/api/areas/{area_a_id}",
        json={"name": "Hacked"},
        headers=headers_b,
    )
    assert res_b_update.status_code == 404
    assert res_b_update.json()["code"] == 404

    # User B attempts to DELETE User A's area -> 404
    res_b_delete = await async_client.delete(
        f"/api/areas/{area_a_id}",
        headers=headers_b,
    )
    assert res_b_delete.status_code == 404
    assert res_b_delete.json()["code"] == 404

    # Ensure User A's area is still intact
    res_a_check = await async_client.get("/api/areas", headers=headers_a)
    assert any(a["id"] == area_a_id for a in res_a_check.json())


@pytest.mark.asyncio
async def test_areas_validation_errors(async_client: AsyncClient):
    """Invalid payloads should return 422 with uniform {detail, code: 422}."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}

    # Invalid hex color
    res_invalid_color = await async_client.post(
        "/api/areas",
        json={"name": "Test", "color": "blue"},
        headers=headers,
    )
    assert res_invalid_color.status_code == 422
    assert res_invalid_color.json()["code"] == 422

    # Empty name
    res_invalid_name = await async_client.post(
        "/api/areas",
        json={"name": "   ", "color": "#123456"},
        headers=headers,
    )
    assert res_invalid_name.status_code == 422
    assert res_invalid_name.json()["code"] == 422


@pytest.mark.asyncio
async def test_areas_endpoints_registered_in_openapi(async_client: AsyncClient):
    """Verify /api/areas endpoints are documented in OpenAPI schema."""
    res = await async_client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]

    assert "/api/areas" in paths
    assert "get" in paths["/api/areas"]
    assert "post" in paths["/api/areas"]

    assert "/api/areas/{id}" in paths
    assert "put" in paths["/api/areas/{id}"]
    assert "delete" in paths["/api/areas/{id}"]
