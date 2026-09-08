from datetime import date
from uuid import uuid4

from app.config import get_settings
from app.database import close_db, get_session, init_db
from app.main import app
from app.models import Activity, ActivityAreaLink, LifeArea, User
from app.seed import seed_data
from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import select

settings = get_settings()


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
    """Helper to persist a test user in the database."""
    uid = uuid4()
    user = User(id=uid, email=f"act_user_{uid.hex[:8]}@sharink.app")
    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def create_test_area(user_id) -> LifeArea:
    """Helper to persist a test life area in the database."""
    area = LifeArea(user_id=user_id, name="Enfoque", color="#0284c7")
    async for session in get_session():
        session.add(area)
        await session.commit()
        await session.refresh(area)
        return area


@pytest.mark.asyncio
async def test_post_activity_creates_and_accumulates(async_client: AsyncClient):
    """Acceptance criterion: Two POSTs with same name and date return 201 then 200 with summed hours."""
    user = await create_test_user()
    area = await create_test_area(user.id)
    headers = {"X-User-Id": str(user.id)}
    test_date = "2026-09-07"

    # 1. First POST: Creation (201 Created)
    payload1 = {
        "name": "Deep Work",
        "hours": 2.0,
        "temperature": 4.0,
        "date": test_date,
        "notes": "Sesión matutina",
        "area_ids": [str(area.id)],
    }
    res1 = await async_client.post("/api/activities", json=payload1, headers=headers)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["hours"] == 2.0
    assert data1["temperature"] == 4.0
    assert data1["name"] == "Deep Work"
    assert data1["name_normalized"] == "deep work"
    assert len(data1["areas"]) == 1
    assert data1["area_ids"] == [str(area.id)]
    first_id = data1["id"]

    # 2. Second POST: Same name (different casing/spacing) & date -> Fusion/Accumulation (200 OK)
    payload2 = {
        "name": "  deep   work  ",
        "hours": 3.0,
        "temperature": 2.0,
        "date": test_date,
        "notes": "Sesión vespertina",
        "area_ids": [],
    }
    res2 = await async_client.post("/api/activities", json=payload2, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()

    # Same record
    assert data2["id"] == first_id
    # Hours summed: 2.0 + 3.0 = 5.0
    assert data2["hours"] == 5.0
    # Weighted temperature: (4.0*2 + 2.0*3) / 5 = 14 / 5 = 2.8
    assert data2["temperature"] == 2.8
    assert data2["notes"] == "Sesión matutina · Sesión vespertina"
    # Preserved area
    assert data2["area_ids"] == [str(area.id)]

    # 3. Verify exactly ONE database entry exists
    async for session in get_session():
        stmt = select(Activity).where(
            Activity.user_id == user.id,
            Activity.date == date(2026, 9, 7),
        )
        acts = (await session.exec(stmt)).all()
        assert len(acts) == 1
        assert acts[0].hours == 5.0


@pytest.mark.asyncio
async def test_post_activity_distinct_names_do_not_accumulate(
    async_client: AsyncClient,
):
    """Different activity names on the same date should create separate entries (201 Created each)."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}
    test_date = "2026-09-07"

    res1 = await async_client.post(
        "/api/activities",
        json={"name": "Lectura", "hours": 1.0, "temperature": 4.0, "date": test_date},
        headers=headers,
    )
    assert res1.status_code == 201

    res2 = await async_client.post(
        "/api/activities",
        json={
            "name": "Meditación",
            "hours": 0.5,
            "temperature": 5.0,
            "date": test_date,
        },
        headers=headers,
    )
    assert res2.status_code == 201

    assert res1.json()["id"] != res2.json()["id"]

    async for session in get_session():
        stmt = select(Activity).where(
            Activity.user_id == user.id,
            Activity.date == date(2026, 9, 7),
        )
        acts = (await session.exec(stmt)).all()
        assert len(acts) == 2


@pytest.mark.asyncio
async def test_post_activity_user_isolation(async_client: AsyncClient):
    """Different users logging the same activity name do not accumulate into each other."""
    user_a = await create_test_user()
    user_b = await create_test_user()
    test_date = "2026-09-07"

    res_a = await async_client.post(
        "/api/activities",
        json={"name": "Correr", "hours": 1.0, "temperature": 4.0, "date": test_date},
        headers={"X-User-Id": str(user_a.id)},
    )
    assert res_a.status_code == 201

    res_b = await async_client.post(
        "/api/activities",
        json={"name": "Correr", "hours": 1.5, "temperature": 5.0, "date": test_date},
        headers={"X-User-Id": str(user_b.id)},
    )
    assert res_b.status_code == 201

    assert res_a.json()["id"] != res_b.json()["id"]
    assert res_a.json()["hours"] == 1.0
    assert res_b.json()["hours"] == 1.5


@pytest.mark.asyncio
async def test_post_activity_validation_errors(async_client: AsyncClient):
    """Validation errors should return 422 with uniform {detail, code: 422}."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}

    # Invalid hours (hours=0)
    res_zero_hours = await async_client.post(
        "/api/activities",
        json={"name": "Test", "hours": 0.0, "temperature": 3.0, "date": "2026-09-07"},
        headers=headers,
    )
    assert res_zero_hours.status_code == 422
    assert res_zero_hours.json()["code"] == 422

    # Invalid temperature (temperature=5.1)
    res_high_temp = await async_client.post(
        "/api/activities",
        json={"name": "Test", "hours": 1.0, "temperature": 5.1, "date": "2026-09-07"},
        headers=headers,
    )
    assert res_high_temp.status_code == 422
    assert res_high_temp.json()["code"] == 422


@pytest.mark.asyncio
async def test_get_activities_default_params(async_client: AsyncClient):
    """GET /api/activities with default params (view=day, date=today)."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}

    res = await async_client.get("/api/activities", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_get_activities_global_view_acceptance_criteria(
    async_client: AsyncClient,
):
    """Acceptance criterion: view=global returns one node per normalized name in entire history."""
    async for session in get_session():
        await seed_data(session)

    headers = {"X-User-Id": str(settings.DEFAULT_USER_ID)}
    res = await async_client.get("/api/activities?view=global", headers=headers)
    assert res.status_code == 200
    nodes = res.json()

    # 20 weekly activities consolidate into 12 unique normalized names
    assert len(nodes) == 12

    # Verify each normalized name is unique
    norm_names = [n["name_normalized"] for n in nodes]
    assert len(norm_names) == len(set(norm_names))

    node_map = {n["name_normalized"]: n for n in nodes}
    # Deep Work Arquitectura appears 3 times in seed
    dw = node_map["deep work arquitectura"]
    assert dw["total_hours"] == 10.5
    assert dw["entry_count"] == 3


@pytest.mark.asyncio
async def test_get_activities_week_and_month_views(async_client: AsyncClient):
    """GET /api/activities supports week and month views with focal date."""
    async for session in get_session():
        await seed_data(session)

    headers = {"X-User-Id": str(settings.DEFAULT_USER_ID)}
    today_str = date.today().isoformat()

    # Week view
    res_week = await async_client.get(
        f"/api/activities?view=week&date={today_str}",
        headers=headers,
    )
    assert res_week.status_code == 200
    assert len(res_week.json()) == 12

    # Month view
    res_month = await async_client.get(
        f"/api/activities?view=month&date={today_str}",
        headers=headers,
    )
    assert res_month.status_code == 200
    assert len(res_month.json()) >= 12


@pytest.mark.asyncio
async def test_get_activities_invalid_view_returns_422(async_client: AsyncClient):
    """Invalid view enum value should return 422 with uniform {detail, code: 422}."""
    res = await async_client.get("/api/activities?view=century")
    assert res.status_code == 422
    assert res.json()["code"] == 422


@pytest.mark.asyncio
async def test_put_activity_updates_fields_and_areas(async_client: AsyncClient):
    """PUT /api/activities/{id} updates fields, normalizes name, and reassigns areas."""
    user = await create_test_user()
    area1 = await create_test_area(user.id)
    area2 = LifeArea(user_id=user.id, name="Salud", color="#22c55e")
    async for session in get_session():
        session.add(area2)
        await session.commit()
        await session.refresh(area2)

    headers = {"X-User-Id": str(user.id)}

    # Create initial activity
    res_create = await async_client.post(
        "/api/activities",
        json={
            "name": "Trabajo Inicial",
            "hours": 2.0,
            "temperature": 1.0,
            "date": "2026-09-07",
            "notes": "Nota inicial",
            "area_ids": [str(area1.id)],
        },
        headers=headers,
    )
    assert res_create.status_code == 201
    activity_id = res_create.json()["id"]

    # Update activity
    res_put = await async_client.put(
        f"/api/activities/{activity_id}",
        json={
            "name": "  Trabajo   Profundo  ",
            "hours": 4.5,
            "temperature": 3.5,
            "notes": "Nota actualizada",
            "area_ids": [str(area2.id)],
        },
        headers=headers,
    )
    assert res_put.status_code == 200
    data = res_put.json()
    assert data["name"] == "Trabajo   Profundo"
    assert data["name_normalized"] == "trabajo profundo"
    assert data["hours"] == 4.5
    assert data["temperature"] == 3.5
    assert data["notes"] == "Nota actualizada"
    assert data["area_ids"] == [str(area2.id)]
    assert len(data["areas"]) == 1
    assert data["areas"][0]["id"] == str(area2.id)

    # Verify DB persistence
    async for session in get_session():
        act = await session.get(Activity, activity_id)
        assert act is not None
        assert act.name_normalized == "trabajo profundo"
        assert act.hours == 4.5


@pytest.mark.asyncio
async def test_put_activity_reassign_empty_areas(async_client: AsyncClient):
    """PUT /api/activities/{id} with area_ids: [] clears all area links."""
    user = await create_test_user()
    area = await create_test_area(user.id)
    headers = {"X-User-Id": str(user.id)}

    res_create = await async_client.post(
        "/api/activities",
        json={
            "name": "Meditación",
            "hours": 1.0,
            "temperature": 4.0,
            "date": "2026-09-07",
            "area_ids": [str(area.id)],
        },
        headers=headers,
    )
    activity_id = res_create.json()["id"]

    res_put = await async_client.put(
        f"/api/activities/{activity_id}",
        json={"area_ids": []},
        headers=headers,
    )
    assert res_put.status_code == 200
    assert res_put.json()["area_ids"] == []
    assert res_put.json()["areas"] == []


@pytest.mark.asyncio
async def test_put_activity_alien_user_returns_404(async_client: AsyncClient):
    """Acceptance criterion: An ID belonging to another user returns 404, never 200 nor 500."""
    user_owner = await create_test_user()
    user_alien = await create_test_user()

    # Owner creates activity
    res_create = await async_client.post(
        "/api/activities",
        json={
            "name": "Actividad Privada",
            "hours": 1.0,
            "temperature": 2.0,
            "date": "2026-09-07",
        },
        headers={"X-User-Id": str(user_owner.id)},
    )
    activity_id = res_create.json()["id"]

    # Alien user attempts PUT
    res_alien = await async_client.put(
        f"/api/activities/{activity_id}",
        json={"hours": 5.0},
        headers={"X-User-Id": str(user_alien.id)},
    )
    assert res_alien.status_code == 404
    assert res_alien.json()["code"] == 404


@pytest.mark.asyncio
async def test_put_activity_collision_returns_409(async_client: AsyncClient):
    """Renaming an activity to match an existing activity on the same date returns 409 Conflict."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}
    test_date = "2026-09-07"

    await async_client.post(
        "/api/activities",
        json={"name": "Correr", "hours": 1.0, "temperature": 3.0, "date": test_date},
        headers=headers,
    )
    res2 = await async_client.post(
        "/api/activities",
        json={"name": "Nadar", "hours": 1.5, "temperature": 4.0, "date": test_date},
        headers=headers,
    )
    activity_id = res2.json()["id"]

    # Attempt to rename Nadar -> correr (collision on same date)
    res_put = await async_client.put(
        f"/api/activities/{activity_id}",
        json={"name": "  correr  "},
        headers=headers,
    )
    assert res_put.status_code == 409
    assert res_put.json()["code"] == 409


@pytest.mark.asyncio
async def test_put_activity_same_name_no_collision(async_client: AsyncClient):
    """Updating hours or keeping the normalized name does not trigger a collision with itself."""
    user = await create_test_user()
    headers = {"X-User-Id": str(user.id)}

    res = await async_client.post(
        "/api/activities",
        json={
            "name": "Estudio",
            "hours": 2.0,
            "temperature": 3.0,
            "date": "2026-09-07",
        },
        headers=headers,
    )
    activity_id = res.json()["id"]

    res_put = await async_client.put(
        f"/api/activities/{activity_id}",
        json={"name": "estudio", "hours": 3.0},
        headers=headers,
    )
    assert res_put.status_code == 200
    assert res_put.json()["hours"] == 3.0


@pytest.mark.asyncio
async def test_delete_activity_success_and_cascades(async_client: AsyncClient):
    """DELETE /api/activities/{id} removes the activity and cleans up activity_areas links."""
    user = await create_test_user()
    area = await create_test_area(user.id)
    headers = {"X-User-Id": str(user.id)}

    res_create = await async_client.post(
        "/api/activities",
        json={
            "name": "Gimnasio",
            "hours": 1.5,
            "temperature": 4.0,
            "date": "2026-09-07",
            "area_ids": [str(area.id)],
        },
        headers=headers,
    )
    activity_id = res_create.json()["id"]

    # Delete activity
    res_del = await async_client.delete(
        f"/api/activities/{activity_id}", headers=headers
    )
    assert res_del.status_code == 204

    # Verify deleted from DB
    async for session in get_session():
        act = await session.get(Activity, activity_id)
        assert act is None

        # Verify junction table cleanup
        link_stmt = select(ActivityAreaLink).where(
            ActivityAreaLink.activity_id == activity_id
        )
        links = (await session.exec(link_stmt)).all()
        assert len(links) == 0

    # Second DELETE returns 404
    res_del_again = await async_client.delete(
        f"/api/activities/{activity_id}", headers=headers
    )
    assert res_del_again.status_code == 404


@pytest.mark.asyncio
async def test_delete_activity_alien_user_returns_404(async_client: AsyncClient):
    """Acceptance criterion: An ID belonging to another user returns 404, never 200 nor 500."""
    user_owner = await create_test_user()
    user_alien = await create_test_user()

    res_create = await async_client.post(
        "/api/activities",
        json={
            "name": "Inviolable",
            "hours": 1.0,
            "temperature": 1.0,
            "date": "2026-09-07",
        },
        headers={"X-User-Id": str(user_owner.id)},
    )
    activity_id = res_create.json()["id"]

    # Alien user attempts DELETE
    res_del = await async_client.delete(
        f"/api/activities/{activity_id}",
        headers={"X-User-Id": str(user_alien.id)},
    )
    assert res_del.status_code == 404
    assert res_del.json()["code"] == 404

    # Verify record still exists in DB
    async for session in get_session():
        act = await session.get(Activity, activity_id)
        assert act is not None
