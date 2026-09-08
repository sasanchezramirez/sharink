from datetime import date
import uuid

from app.database import close_db, get_session, init_db
from app.models import Activity, LifeArea, User
from app.schemas.activity import ActivityCreate
from app.services.accumulator import (
    merge_notes,
    normalize_name,
    upsert_activity,
    weighted_temperature,
)
import pytest
from sqlmodel import select


@pytest.fixture(autouse=True)
async def prepare_database():
    await init_db()
    yield
    await close_db()


def test_normalize_name():
    """normalize_name should lowercase, strip, and collapse multiple whitespace."""
    assert normalize_name("  Deep    Work   Arquitectura  ") == "deep work arquitectura"
    assert normalize_name("Meditación\t\nMatutina") == "meditación matutina"
    assert normalize_name("RUN") == "run"


def test_weighted_temperature():
    """weighted_temperature calculates duration-weighted average clamped to [-5, 5]."""
    # Acceptance criteria: (4.0 * 1 + (-2.0) * 3) / 4 = -2.0 / 4 = -0.5
    assert weighted_temperature(4.0, 1.0, -2.0, 3.0) == -0.5

    # Equal hours
    assert weighted_temperature(2.0, 2.0, 4.0, 2.0) == 3.0

    # Rounding to 2 decimals: (1.0 * 1 + 2.0 * 2) / 3 = 5.0 / 3 = 1.6666... -> 1.67
    assert weighted_temperature(1.0, 1.0, 2.0, 2.0) == 1.67

    # Clamping upper bound
    assert weighted_temperature(5.0, 10.0, 6.0, 10.0) == 5.0

    # Clamping lower bound
    assert weighted_temperature(-5.0, 10.0, -6.0, 10.0) == -5.0

    # Zero total hours
    assert weighted_temperature(3.0, 0.0, 4.0, 0.0) == 0.0


def test_merge_notes():
    """merge_notes merges note strings with ' · ' without duplicate segments."""
    assert merge_notes(None, None) is None
    assert merge_notes("", "   ") is None
    assert merge_notes("Primera sesión", None) == "Primera sesión"
    assert merge_notes(None, "Segunda sesión") == "Segunda sesión"
    assert merge_notes("Nota A", "Nota A") == "Nota A"
    assert merge_notes("Nota A", "Nota B") == "Nota A · Nota B"
    assert merge_notes("Nota A · Nota B", "Nota B") == "Nota A · Nota B"
    assert merge_notes("Nota A · Nota B", "Nota C") == "Nota A · Nota B · Nota C"


@pytest.mark.asyncio
async def test_upsert_activity_accumulates_same_day():
    """upsert_activity should create on first call and accumulate without duplicates on second call."""
    unique_email = f"acc_{uuid.uuid4().hex[:8]}@sharink.app"
    test_date = date(2026, 9, 7)

    async for session in get_session():
        # 1. Setup User and two Life Areas
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        area1 = LifeArea(user_id=user.id, name="Trabajo", color="#0284c7")
        area2 = LifeArea(user_id=user.id, name="Salud", color="#22c55e")
        session.add_all([area1, area2])
        await session.commit()
        await session.refresh(area1)
        await session.refresh(area2)

        # 2. First insert: 2.0 hours, temp 4.0
        payload1 = ActivityCreate(
            name="Deep Work",
            hours=2.0,
            temperature=4.0,
            date=test_date,
            notes="Sesión matutina",
            area_ids=[area1.id],
        )
        act1 = await upsert_activity(session, user.id, payload1)
        await session.commit()

        assert act1.id is not None
        assert act1.hours == 2.0
        assert act1.temperature == 4.0
        assert act1.name_normalized == "deep work"
        assert len(act1.areas) == 1
        assert act1.areas[0].id == area1.id

        # 3. Second insert: same day, different casing/spacing: 3.0 hours, temp 2.0
        payload2 = ActivityCreate(
            name="  deep   work  ",
            hours=3.0,
            temperature=2.0,
            date=test_date,
            notes="Sesión vespertina",
            area_ids=[area2.id],
        )
        act2 = await upsert_activity(session, user.id, payload2)
        await session.commit()

        # Must be the same record (accumulated)
        assert act2.id == act1.id
        assert act2.hours == 5.0  # 2.0 + 3.0
        # (4.0 * 2 + 2.0 * 3) / 5 = 14 / 5 = 2.8
        assert act2.temperature == 2.8
        assert act2.notes == "Sesión matutina · Sesión vespertina"

        # Areas must be merged: both area1 and area2
        area_ids_in_act = {a.id for a in act2.areas}
        assert area_ids_in_act == {area1.id, area2.id}

        # Verify DB contains exactly 1 activity row for this user and date
        count_stmt = select(Activity).where(
            Activity.user_id == user.id,
            Activity.date == test_date,
        )
        activities = (await session.exec(count_stmt)).all()
        assert len(activities) == 1


@pytest.mark.asyncio
async def test_upsert_activity_hours_cap_24():
    """upsert_activity should cap accumulated hours at 24.0."""
    unique_email = f"cap_{uuid.uuid4().hex[:8]}@sharink.app"
    test_date = date(2026, 9, 8)

    async for session in get_session():
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        payload1 = ActivityCreate(
            name="Estudio Intenso",
            hours=15.0,
            temperature=3.0,
            date=test_date,
        )
        await upsert_activity(session, user.id, payload1)
        await session.commit()

        payload2 = ActivityCreate(
            name="Estudio Intenso",
            hours=12.0,
            temperature=4.0,
            date=test_date,
        )
        act = await upsert_activity(session, user.id, payload2)
        await session.commit()

        # 15.0 + 12.0 = 27.0 -> capped at 24.0
        assert act.hours == 24.0


@pytest.mark.asyncio
async def test_upsert_multiple_distinct_activities_same_day():
    """upsert_activity should keep distinct activities on the same day separate."""
    unique_email = f"dist_{uuid.uuid4().hex[:8]}@sharink.app"
    test_date = date(2026, 9, 9)

    async for session in get_session():
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        act1 = await upsert_activity(
            session,
            user.id,
            ActivityCreate(
                name="Lectura",
                hours=1.5,
                temperature=4.0,
                date=test_date,
            ),
        )
        act2 = await upsert_activity(
            session,
            user.id,
            ActivityCreate(
                name="Gimnasio",
                hours=1.0,
                temperature=5.0,
                date=test_date,
            ),
        )
        await session.commit()

        assert act1.id != act2.id
        assert act1.name_normalized == "lectura"
        assert act2.name_normalized == "gimnasio"

        count_stmt = select(Activity).where(
            Activity.user_id == user.id,
            Activity.date == test_date,
        )
        activities = (await session.exec(count_stmt)).all()
        assert len(activities) == 2
