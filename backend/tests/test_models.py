from datetime import date
import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, select

from app.database import close_db, get_session, init_db
from app.models import Activity, ActivityAreaLink, LifeArea, User


@pytest.fixture(autouse=True)
async def prepare_database():
    await init_db()
    yield
    await close_db()


def test_models_metadata_registered():
    tables = SQLModel.metadata.tables
    expected_tables = ["users", "activities", "life_areas", "activity_areas"]
    for table_name in expected_tables:
        assert table_name in tables

    # Check composite PK on activity_areas
    link_table = tables["activity_areas"]
    pk_cols = [c.name for c in link_table.primary_key.columns]
    assert sorted(pk_cols) == ["activity_id", "area_id"]

    # Check unique constraint on activities
    act_table = tables["activities"]
    constraint_names = [c.name for c in act_table.constraints if c.name is not None]
    assert "uq_activities_user_date_name_norm" in constraint_names

    # Check composite performance indexes on activities
    index_names = [ix.name for ix in act_table.indexes]
    assert "ix_activities_user_date_name" in index_names
    assert "ix_activities_user_date" in index_names


def test_user_model_instantiation():
    user = User(email="test@sharink.app")
    assert isinstance(user.id, uuid.UUID)
    assert user.email == "test@sharink.app"
    assert user.created_at is not None


@pytest.mark.asyncio
async def test_user_db_persistence():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@sharink.app"
    user = User(email=unique_email)

    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)

        assert user.id is not None

        stmt = select(User).where(User.email == unique_email)
        result = await session.exec(stmt)
        persisted_user = result.first()

        assert persisted_user is not None
        assert persisted_user.id == user.id
        assert persisted_user.email == unique_email


@pytest.mark.asyncio
async def test_user_email_unique_constraint():
    dup_email = f"dup_{uuid.uuid4().hex[:8]}@sharink.app"
    user1 = User(email=dup_email)
    user2 = User(email=dup_email)

    async for session in get_session():
        session.add(user1)
        await session.commit()

        session.add(user2)
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()


@pytest.mark.asyncio
async def test_activity_and_area_relationship():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@sharink.app"
    user = User(email=unique_email)

    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)

        area1 = LifeArea(
            user_id=user.id,
            name="Trabajo & Carrera",
            color="#0284c7",
            visible=True,
        )
        area2 = LifeArea(
            user_id=user.id,
            name="Salud & Deporte",
            color="#22c55e",
            visible=True,
        )
        session.add_all([area1, area2])
        await session.commit()
        await session.refresh(area1)
        await session.refresh(area2)

        activity = Activity(
            user_id=user.id,
            name="Programación de Backend",
            name_normalized="programacion de backend",
            hours=3.5,
            temperature=4.0,
            date=date(2026, 9, 7),
            notes="Configuración de SQLModel y PostgreSQL",
            areas=[area1, area2],
        )
        session.add(activity)
        await session.commit()
        await session.refresh(activity)

        assert activity.id is not None

        # Verify links in activity_areas table
        links_stmt = select(ActivityAreaLink).where(
            ActivityAreaLink.activity_id == activity.id
        )
        links = (await session.exec(links_stmt)).all()
        assert len(links) == 2
        linked_area_ids = {link.area_id for link in links}
        assert linked_area_ids == {area1.id, area2.id}


@pytest.mark.asyncio
async def test_activity_unique_constraint_user_date_name():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@sharink.app"
    user = User(email=unique_email)

    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)

        act1 = Activity(
            user_id=user.id,
            name="Meditación Matutina",
            name_normalized="meditacion matutina",
            hours=0.5,
            temperature=3.5,
            date=date(2026, 9, 7),
        )
        session.add(act1)
        await session.commit()

        # Duplicate entry with same user_id, date, and name_normalized
        act2 = Activity(
            user_id=user.id,
            name="Meditación Matutina",
            name_normalized="meditacion matutina",
            hours=1.0,
            temperature=4.0,
            date=date(2026, 9, 7),
        )
        session.add(act2)
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()
