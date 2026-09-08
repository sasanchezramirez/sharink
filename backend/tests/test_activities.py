from uuid import UUID

from app.database import get_session
from app.models import Activity, ActivityAreaLink, LifeArea, User
from httpx import AsyncClient
import pytest
from sqlmodel import select

from tests.conftest import create_user_in_db


@pytest.mark.asyncio
async def test_full_activity_lifecycle_flow(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict[str, str],
):
    """
    T22 acceptance requirement: Full lifecycle flow
    1. Crear área
    2. Crear actividad vinculada al área
    3. Acumular mediante segundo POST (mismo nombre y fecha)
    4. Consultar vista week (nodo consolidado)
    5. Editar actividad (PUT)
    6. Consultar vista week tras edición
    7. Borrar actividad (DELETE)
    8. Consultar vista week tras borrado (vacía)
    9. Borrar área (DELETE)
    """
    focal_date = "2026-09-07"

    # 1. Crear área (POST /api/areas) -> 201 Created
    area_payload = {
        "name": "Desarrollo Personal",
        "color": "#6366f1",
        "visible": True,
    }
    res_area = await async_client.post(
        "/api/areas", json=area_payload, headers=auth_headers
    )
    assert res_area.status_code == 201
    area_data = res_area.json()
    area_id = area_data["id"]
    assert area_data["name"] == "Desarrollo Personal"

    # 2. Crear actividad vinculada al área (POST /api/activities) -> 201 Created
    act_payload_1 = {
        "name": "Lectura Técnica",
        "hours": 1.5,
        "temperature": 4.0,
        "date": focal_date,
        "notes": "Capítulo 1: Fundamentos",
        "area_ids": [area_id],
    }
    res_act1 = await async_client.post(
        "/api/activities", json=act_payload_1, headers=auth_headers
    )
    assert res_act1.status_code == 201
    act_data_1 = res_act1.json()
    activity_id = act_data_1["id"]
    assert act_data_1["name"] == "Lectura Técnica"
    assert act_data_1["name_normalized"] == "lectura técnica"
    assert act_data_1["hours"] == 1.5
    assert act_data_1["temperature"] == 4.0
    assert act_data_1["area_ids"] == [area_id]

    # 3. Acumular intra-día mediante segundo POST -> 200 OK
    act_payload_2 = {
        "name": "  lectura   técnica  ",
        "hours": 2.0,
        "temperature": 2.0,
        "date": focal_date,
        "notes": "Capítulo 2: Arquitectura",
        "area_ids": [area_id],
    }
    res_act2 = await async_client.post(
        "/api/activities", json=act_payload_2, headers=auth_headers
    )
    assert res_act2.status_code == 200
    act_data_2 = res_act2.json()
    assert act_data_2["id"] == activity_id
    assert act_data_2["hours"] == 3.5
    # Weighted temperature: (1.5*4.0 + 2.0*2.0) / 3.5 = (6.0 + 4.0) / 3.5 = 10 / 3.5 = 2.86
    assert act_data_2["temperature"] == 2.86
    assert act_data_2["notes"] == "Capítulo 1: Fundamentos · Capítulo 2: Arquitectura"

    # 4. Consultar vista week (GET /api/activities?view=week&date=...) -> 200 OK
    res_week_1 = await async_client.get(
        f"/api/activities?view=week&date={focal_date}", headers=auth_headers
    )
    assert res_week_1.status_code == 200
    nodes_week_1 = res_week_1.json()
    assert len(nodes_week_1) == 1
    node_1 = nodes_week_1[0]
    assert node_1["name_normalized"] == "lectura técnica"
    assert node_1["total_hours"] == 3.5
    assert node_1["weighted_temperature"] == 2.86
    assert node_1["entry_count"] == 1
    assert area_id in node_1["area_ids"]

    # 5. Editar actividad (PUT /api/activities/{id}) -> 200 OK
    update_payload = {
        "hours": 4.0,
        "temperature": 3.5,
        "notes": "Lectura completa revisada",
    }
    res_put = await async_client.put(
        f"/api/activities/{activity_id}", json=update_payload, headers=auth_headers
    )
    assert res_put.status_code == 200
    updated_act = res_put.json()
    assert updated_act["hours"] == 4.0
    assert updated_act["temperature"] == 3.5
    assert updated_act["notes"] == "Lectura completa revisada"
    assert updated_act["area_ids"] == [area_id]

    # 6. Consultar vista week tras edición -> 200 OK
    res_week_2 = await async_client.get(
        f"/api/activities?view=week&date={focal_date}", headers=auth_headers
    )
    assert res_week_2.status_code == 200
    nodes_week_2 = res_week_2.json()
    assert len(nodes_week_2) == 1
    node_2 = nodes_week_2[0]
    assert node_2["total_hours"] == 4.0
    assert node_2["weighted_temperature"] == 3.5
    assert node_2["entry_count"] == 1

    # 7. Borrar actividad (DELETE /api/activities/{id}) -> 204 No Content
    res_del_act = await async_client.delete(
        f"/api/activities/{activity_id}", headers=auth_headers
    )
    assert res_del_act.status_code == 204

    # 8. Consultar vista week tras borrado -> lista vacía
    res_week_3 = await async_client.get(
        f"/api/activities?view=week&date={focal_date}", headers=auth_headers
    )
    assert res_week_3.status_code == 200
    assert res_week_3.json() == []

    # Verify activity is completely gone from DB and junction
    async for session in get_session():
        db_act = await session.get(Activity, UUID(activity_id))
        assert db_act is None
        links = (
            await session.exec(
                select(ActivityAreaLink).where(
                    ActivityAreaLink.activity_id == UUID(activity_id)
                )
            )
        ).all()
        assert len(links) == 0

    # 9. Borrar área (DELETE /api/areas/{id}) -> 204 No Content
    res_del_area = await async_client.delete(
        f"/api/areas/{area_id}", headers=auth_headers
    )
    assert res_del_area.status_code == 204

    # Verify area is gone from DB
    async for session in get_session():
        db_area = await session.get(LifeArea, UUID(area_id))
        assert db_area is None


@pytest.mark.asyncio
async def test_multi_day_weekly_consolidation(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict[str, str],
):
    """
    Verify that activities with same normalized name logged on different days
    within the same week consolidate properly into a single ConsolidatedNode.
    """
    # Create an area
    res_area = await async_client.post(
        "/api/areas",
        json={"name": "Salud & Fitness", "color": "#10b981"},
        headers=auth_headers,
    )
    area_id = res_area.json()["id"]

    # Monday: 1.5h, temp=4.0
    await async_client.post(
        "/api/activities",
        json={
            "name": "Entrenamiento Funcional",
            "hours": 1.5,
            "temperature": 4.0,
            "date": "2026-09-07",
            "area_ids": [area_id],
        },
        headers=auth_headers,
    )
    # Wednesday: 2.0h, temp=2.0
    await async_client.post(
        "/api/activities",
        json={
            "name": "  entrenamiento   funcional  ",
            "hours": 2.0,
            "temperature": 2.0,
            "date": "2026-09-09",
            "area_ids": [area_id],
        },
        headers=auth_headers,
    )
    # Friday: 1.5h, temp=5.0
    await async_client.post(
        "/api/activities",
        json={
            "name": "ENTRENAMIENTO FUNCIONAL",
            "hours": 1.5,
            "temperature": 5.0,
            "date": "2026-09-11",
            "area_ids": [area_id],
        },
        headers=auth_headers,
    )

    # Query week view (Wednesday 2026-09-09)
    res_week = await async_client.get(
        "/api/activities?view=week&date=2026-09-09",
        headers=auth_headers,
    )
    assert res_week.status_code == 200
    nodes = res_week.json()
    assert len(nodes) == 1
    node = nodes[0]
    assert node["name_normalized"] == "entrenamiento funcional"
    # Total hours: 1.5 + 2.0 + 1.5 = 5.0
    assert node["total_hours"] == 5.0
    # Weighted temperature: (1.5*4 + 2.0*2 + 1.5*5) / 5.0 = (6.0 + 4.0 + 7.5) / 5.0 = 17.5 / 5.0 = 3.5
    assert node["weighted_temperature"] == 3.5
    assert node["entry_count"] == 3
    assert node["area_ids"] == [area_id]

    # Query day view on Wednesday returns only Wednesday's node
    res_day = await async_client.get(
        "/api/activities?view=day&date=2026-09-09",
        headers=auth_headers,
    )
    assert res_day.status_code == 200
    day_nodes = res_day.json()
    assert len(day_nodes) == 1
    assert day_nodes[0]["total_hours"] == 2.0
    assert day_nodes[0]["weighted_temperature"] == 2.0
    assert day_nodes[0]["entry_count"] == 1

    # Query day view on Friday returns only Friday's node
    res_friday = await async_client.get(
        "/api/activities?view=day&date=2026-09-11",
        headers=auth_headers,
    )
    assert res_friday.status_code == 200
    friday_nodes = res_friday.json()
    assert len(friday_nodes) == 1
    assert friday_nodes[0]["total_hours"] == 1.5
    assert friday_nodes[0]["weighted_temperature"] == 5.0
    assert friday_nodes[0]["entry_count"] == 1


@pytest.mark.asyncio
async def test_cross_user_complete_isolation(async_client: AsyncClient):
    """
    Verify complete isolation between two users throughout activity logging,
    accumulation, listing, editing, and deletion.
    """
    user_a = await create_user_in_db("isolation_a")
    user_b = await create_user_in_db("isolation_b")
    headers_a = {"X-User-Id": str(user_a.id)}
    headers_b = {"X-User-Id": str(user_b.id)}
    test_date = "2026-09-07"

    # User A creates activity
    res_a = await async_client.post(
        "/api/activities",
        json={
            "name": "Meditación Zen",
            "hours": 1.0,
            "temperature": 5.0,
            "date": test_date,
        },
        headers=headers_a,
    )
    act_a_id = res_a.json()["id"]

    # User B creates activity with identical name and date
    res_b = await async_client.post(
        "/api/activities",
        json={
            "name": "Meditación Zen",
            "hours": 0.5,
            "temperature": 3.0,
            "date": test_date,
        },
        headers=headers_b,
    )
    act_b_id = res_b.json()["id"]

    # Distinct records, no accumulation across users
    assert act_a_id != act_b_id

    # User B cannot update User A's activity (404)
    res_b_put = await async_client.put(
        f"/api/activities/{act_a_id}",
        json={"hours": 10.0},
        headers=headers_b,
    )
    assert res_b_put.status_code == 404

    # User B cannot delete User A's activity (404)
    res_b_del = await async_client.delete(
        f"/api/activities/{act_a_id}",
        headers=headers_b,
    )
    assert res_b_del.status_code == 404

    # User A's weekly view contains only User A's node (1.0h)
    res_a_week = await async_client.get(
        f"/api/activities?view=week&date={test_date}",
        headers=headers_a,
    )
    assert res_a_week.status_code == 200
    assert len(res_a_week.json()) == 1
    assert res_a_week.json()[0]["total_hours"] == 1.0

    # User B's weekly view contains only User B's node (0.5h)
    res_b_week = await async_client.get(
        f"/api/activities?view=week&date={test_date}",
        headers=headers_b,
    )
    assert res_b_week.status_code == 200
    assert len(res_b_week.json()) == 1
    assert res_b_week.json()[0]["total_hours"] == 0.5

    # User A deletes their activity
    res_a_del = await async_client.delete(
        f"/api/activities/{act_a_id}",
        headers=headers_a,
    )
    assert res_a_del.status_code == 204

    # User B's activity remains intact
    res_b_check = await async_client.get(
        f"/api/activities?view=week&date={test_date}",
        headers=headers_b,
    )
    assert res_b_check.status_code == 200
    assert len(res_b_check.json()) == 1
    assert res_b_check.json()[0]["total_hours"] == 0.5


@pytest.mark.asyncio
async def test_accumulation_max_daily_cap(
    async_client: AsyncClient,
    test_user: User,
    auth_headers: dict[str, str],
):
    """
    Verify that intraday accumulation caps hours at 24.0.
    """
    test_date = "2026-09-07"

    # First POST: 16.0 hours
    res1 = await async_client.post(
        "/api/activities",
        json={
            "name": "Maratón de Código",
            "hours": 16.0,
            "temperature": 2.0,
            "date": test_date,
        },
        headers=auth_headers,
    )
    assert res1.status_code == 201
    assert res1.json()["hours"] == 16.0

    # Second POST: 10.0 hours -> capped at 24.0
    res2 = await async_client.post(
        "/api/activities",
        json={
            "name": "maratón de código",
            "hours": 10.0,
            "temperature": 1.0,
            "date": test_date,
        },
        headers=auth_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["hours"] == 24.0
