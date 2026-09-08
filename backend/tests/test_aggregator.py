from datetime import date, timedelta
import uuid

from app.config import get_settings
from app.database import close_db, get_session, init_db
from app.models import Activity, User
from app.schemas.activity import ConsolidatedNode
from app.seed import seed_data
from app.services.aggregator import (
    AggregationService,
    fetch_nodes,
    fetch_raw_activities,
    resolve_range,
)
import pytest

settings = get_settings()


@pytest.fixture(autouse=True)
async def prepare_database():
    await init_db()
    yield
    await close_db()


def test_resolve_range_day():
    focal = date(2026, 9, 7)
    start, end = resolve_range("day", focal)
    assert start == focal
    assert end == focal


def test_resolve_range_week():
    # 2026-09-07 is Monday, 2026-09-13 is Sunday
    monday = date(2026, 9, 7)
    start, end = resolve_range("week", monday)
    assert start == date(2026, 9, 7)
    assert end == date(2026, 9, 13)

    # Mid-week Wednesday (2026-09-09)
    wednesday = date(2026, 9, 9)
    start, end = resolve_range("week", wednesday)
    assert start == date(2026, 9, 7)
    assert end == date(2026, 9, 13)

    # Sunday (2026-09-13)
    sunday = date(2026, 9, 13)
    start, end = resolve_range("week", sunday)
    assert start == date(2026, 9, 7)
    assert end == date(2026, 9, 13)


def test_resolve_range_month():
    # September has 30 days
    focal_sep = date(2026, 9, 15)
    start, end = resolve_range("month", focal_sep)
    assert start == date(2026, 9, 1)
    assert end == date(2026, 9, 30)

    # February in non-leap year (2025: 28 days)
    focal_feb = date(2025, 2, 10)
    start, end = resolve_range("month", focal_feb)
    assert start == date(2025, 2, 1)
    assert end == date(2025, 2, 28)

    # February in leap year (2024: 29 days)
    focal_leap = date(2024, 2, 5)
    start, end = resolve_range("month", focal_leap)
    assert start == date(2024, 2, 1)
    assert end == date(2024, 2, 29)


def test_resolve_range_global():
    focal = date(2026, 9, 7)
    start, end = resolve_range("global", focal)
    assert start is None
    assert end is None


def test_resolve_range_invalid():
    with pytest.raises(ValueError) as exc:
        resolve_range("year", date(2026, 9, 7))
    assert "Invalid view" in str(exc.value)


@pytest.mark.asyncio
async def test_fetch_nodes_week_consolidation_with_seed():
    """Acceptance criterion: with seed data, view=week consolidates repeated names with summed hours."""
    today = date.today()

    async for session in get_session():
        # Ensure demo seed exists
        await seed_data(session)

        nodes = await fetch_nodes(session, settings.DEFAULT_USER_ID, "week", today)
        assert isinstance(nodes, list)
        assert (
            len(nodes) == 12
        )  # 20 raw entries consolidated into 12 unique activity names

        node_map = {n.name_normalized: n for n in nodes}

        # Check 'Deep Work Arquitectura': Mon (4.0) + Wed (3.5) + Fri (3.0) = 10.5h, 3 entries
        deep_work = node_map["deep work arquitectura"]
        assert deep_work.total_hours == 10.5
        assert deep_work.entry_count == 3
        # Weighted temp: (4*4.8 + 3.5*4.5 + 3.0*4.0) / 10.5 = (19.2 + 15.75 + 12.0) / 10.5 = 46.95 / 10.5 = 4.47
        assert deep_work.weighted_temperature == 4.47

        # Check 'Cocina & Nutrición': Mon (1.0) + Tue (1.0) + Thu (1.5) = 3.5h, 3 entries
        cocina = node_map["cocina & nutrición"]
        assert cocina.total_hours == 3.5
        assert cocina.entry_count == 3

        # Check 'Lectura & Filosofía': Tue (1.5) + Thu (1.0) + Sun (2.0) = 4.5h, 3 entries
        lectura = node_map["lectura & filosofía"]
        assert lectura.total_hours == 4.5
        assert lectura.entry_count == 3

        # Check 'Guitarra & Creatividad': 1.5h, 2 areas linked, hours NOT multiplied!
        guitarra = node_map["guitarra & creatividad"]
        assert guitarra.total_hours == 1.5
        assert len(guitarra.area_ids) == 2
        assert guitarra.entry_count == 1


@pytest.mark.asyncio
async def test_fetch_nodes_day_view_and_raw_flag():
    """view=day should return only day nodes, and raw=true returns (nodes, raw_activities)."""
    monday = date.today() - timedelta(days=date.today().weekday())

    async for session in get_session():
        await seed_data(session)

        # 1. Day view without raw flag
        day_nodes = await fetch_nodes(session, settings.DEFAULT_USER_ID, "day", monday)
        assert len(day_nodes) == 3
        names = {n.name for n in day_nodes}
        assert names == {
            "Cocina & Nutrición",
            "Deep Work Arquitectura",
            "Entrenamiento de Fuerza",
        }

        # 2. Day view with raw=True
        result = await fetch_nodes(
            session, settings.DEFAULT_USER_ID, "day", monday, raw=True
        )
        assert isinstance(result, tuple)
        nodes, raw_acts = result
        assert len(nodes) == 3
        assert len(raw_acts) == 3
        assert all(isinstance(a, Activity) for a in raw_acts)
        assert all(len(a.areas) >= 1 for a in raw_acts)

        # 3. Direct fetch_raw_activities call
        direct_raw = await fetch_raw_activities(
            session, settings.DEFAULT_USER_ID, monday
        )
        assert len(direct_raw) == 3


@pytest.mark.asyncio
async def test_fetch_nodes_activity_without_areas():
    """Activities without linked areas should not be omitted by LEFT JOIN."""
    unique_email = f"no_area_{uuid.uuid4().hex[:8]}@sharink.app"
    test_date = date(2026, 9, 7)

    async for session in get_session():
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        act = Activity(
            user_id=user.id,
            name="Caminar sin Área",
            name_normalized="caminar sin área",
            hours=0.5,
            temperature=3.0,
            date=test_date,
            areas=[],
        )
        session.add(act)
        await session.commit()

        nodes = await fetch_nodes(session, user.id, "day", test_date)
        assert len(nodes) == 1
        assert nodes[0].name == "Caminar sin Área"
        assert nodes[0].total_hours == 0.5
        assert nodes[0].area_ids == []


@pytest.mark.asyncio
async def test_aggregation_service_class():
    """AggregationService class delegates to static methods."""
    focal = date(2026, 9, 7)
    s, e = AggregationService.resolve_range("day", focal)
    assert s == focal and e == focal

    async for session in get_session():
        nodes = await AggregationService.fetch_nodes(
            session, settings.DEFAULT_USER_ID, "day", focal
        )
        assert isinstance(nodes, list)
        assert all(isinstance(n, ConsolidatedNode) for n in nodes)

        raw_acts = await AggregationService.fetch_raw_activities(
            session, settings.DEFAULT_USER_ID, focal
        )
        assert isinstance(raw_acts, list)


@pytest.mark.asyncio
async def test_fetch_nodes_week_boundaries():
    """Verify that view=week strictly enforces Monday-Sunday boundaries."""
    unique_email = f"wbounds_{uuid.uuid4().hex[:8]}@sharink.app"
    # Target week: Monday 2026-09-07 to Sunday 2026-09-13
    mon = date(2026, 9, 7)
    sun = date(2026, 9, 13)
    prev_sun = date(2026, 9, 6)
    next_mon = date(2026, 9, 14)

    async for session in get_session():
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # 4 entries for the same activity on different dates
        acts = [
            Activity(
                user_id=user.id,
                name="Running",
                name_normalized="running",
                hours=1.0,
                temperature=4.0,
                date=prev_sun,  # outside (before)
            ),
            Activity(
                user_id=user.id,
                name="Running",
                name_normalized="running",
                hours=2.0,
                temperature=4.0,
                date=mon,  # inside (start boundary)
            ),
            Activity(
                user_id=user.id,
                name="Running",
                name_normalized="running",
                hours=3.0,
                temperature=4.0,
                date=sun,  # inside (end boundary)
            ),
            Activity(
                user_id=user.id,
                name="Running",
                name_normalized="running",
                hours=4.0,
                temperature=4.0,
                date=next_mon,  # outside (after)
            ),
        ]
        session.add_all(acts)
        await session.commit()

        nodes = await fetch_nodes(session, user.id, "week", date(2026, 9, 10))
        assert len(nodes) == 1
        # Only Monday (2.0h) + Sunday (3.0h) = 5.0h, entry_count = 2
        assert nodes[0].total_hours == 5.0
        assert nodes[0].entry_count == 2


@pytest.mark.asyncio
async def test_fetch_nodes_month_boundaries_and_multi_day():
    """Verify that view=month consolidates multi-day entries within month boundaries."""
    unique_email = f"mbounds_{uuid.uuid4().hex[:8]}@sharink.app"
    # Target month: September 2026 (2026-09-01 to 2026-09-30)
    aug_last = date(2026, 8, 31)
    sep_first = date(2026, 9, 1)
    sep_mid = date(2026, 9, 15)
    sep_last = date(2026, 9, 30)
    oct_first = date(2026, 10, 1)

    async for session in get_session():
        user = User(email=unique_email)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        acts = [
            Activity(
                user_id=user.id,
                name="Piano",
                name_normalized="piano",
                hours=1.0,
                temperature=5.0,
                date=aug_last,  # outside
            ),
            Activity(
                user_id=user.id,
                name="Piano",
                name_normalized="piano",
                hours=1.5,
                temperature=4.0,
                date=sep_first,  # inside
            ),
            Activity(
                user_id=user.id,
                name="Piano",
                name_normalized="piano",
                hours=2.0,
                temperature=3.0,
                date=sep_mid,  # inside
            ),
            Activity(
                user_id=user.id,
                name="Piano",
                name_normalized="piano",
                hours=1.5,
                temperature=5.0,
                date=sep_last,  # inside
            ),
            Activity(
                user_id=user.id,
                name="Piano",
                name_normalized="piano",
                hours=5.0,
                temperature=5.0,
                date=oct_first,  # outside
            ),
        ]
        session.add_all(acts)
        await session.commit()

        # Query month for September 2026
        nodes = await fetch_nodes(session, user.id, "month", date(2026, 9, 20))
        assert len(nodes) == 1
        # Sum: 1.5 + 2.0 + 1.5 = 5.0h, entry_count = 3
        assert nodes[0].total_hours == 5.0
        assert nodes[0].entry_count == 3
        # Weighted temp: (1.5*4.0 + 2.0*3.0 + 1.5*5.0) / 5.0 = (6.0 + 6.0 + 7.5) / 5.0 = 19.5 / 5.0 = 3.9
        assert nodes[0].weighted_temperature == 3.9
