from datetime import date, datetime, timezone
import uuid

from pydantic import ValidationError
import pytest

from app.models.activity import Activity
from app.models.area import LifeArea
from app.schemas.activity import (
    ActivityBase,
    ActivityCreate,
    ActivityRead,
    ActivityUpdate,
    ConsolidatedNode,
)
from app.schemas.area import AreaRead


def test_activity_base():
    """ActivityBase should initialize with valid fields."""
    base = ActivityBase(
        name="Study",
        hours=1.5,
        temperature=3.5,
        date=date(2026, 9, 7),
    )
    assert base.name == "Study"
    assert base.hours == 1.5
    assert base.temperature == 3.5
    assert base.date == date(2026, 9, 7)
    assert base.notes is None


def test_activity_create_valid():
    """ActivityCreate accepts valid data and sanitizes name/notes."""
    area_id = uuid.uuid4()
    activity = ActivityCreate(
        name="  Deep Work Arquitectura  ",
        hours=4.0,
        temperature=4.8,
        date=date(2026, 9, 7),
        notes="  Diseño técnico y contratos de API  ",
        area_ids=[area_id],
    )
    assert activity.name == "Deep Work Arquitectura"
    assert activity.hours == 4.0
    assert activity.temperature == 4.8
    assert activity.notes == "Diseño técnico y contratos de API"
    assert activity.area_ids == [area_id]


# Acceptance test: temperature=5.1 and hours=0 fail; temperature=-5.0 passes
def test_acceptance_criteria_temperature_and_hours_limits():
    """Verify exact acceptance criteria from BACKEND_SPEC.md T12."""
    today = date(2026, 9, 7)

    # temperature=5.1 must fail
    with pytest.raises(ValidationError) as exc_temp_high:
        ActivityCreate(
            name="Test",
            hours=2.0,
            temperature=5.1,
            date=today,
        )
    assert any(err["loc"] == ("temperature",) for err in exc_temp_high.value.errors())

    # hours=0 must fail
    with pytest.raises(ValidationError) as exc_hours_zero:
        ActivityCreate(
            name="Test",
            hours=0.0,
            temperature=2.0,
            date=today,
        )
    assert any(err["loc"] == ("hours",) for err in exc_hours_zero.value.errors())

    # temperature=-5.0 must pass
    valid_min_temp = ActivityCreate(
        name="Test Min Temp",
        hours=1.0,
        temperature=-5.0,
        date=today,
    )
    assert valid_min_temp.temperature == -5.0

    # temperature=5.0 and hours=0.1, hours=24.0 must pass
    valid_boundaries = ActivityCreate(
        name="Test Max Boundaries",
        hours=24.0,
        temperature=5.0,
        date=today,
    )
    assert valid_boundaries.hours == 24.0
    assert valid_boundaries.temperature == 5.0

    # temperature=-5.1 must fail
    with pytest.raises(ValidationError):
        ActivityCreate(name="Test", hours=1.0, temperature=-5.1, date=today)

    # hours=24.1 must fail
    with pytest.raises(ValidationError):
        ActivityCreate(name="Test", hours=24.1, temperature=0.0, date=today)


@pytest.mark.parametrize(
    "invalid_name",
    [
        "",
        "   ",
        "\t\n",
        "a" * 121,
    ],
)
def test_activity_create_invalid_name_raises_validation_error(invalid_name: str):
    """ActivityCreate rejects empty, whitespace-only, or overly long names."""
    with pytest.raises(ValidationError) as exc_info:
        ActivityCreate(
            name=invalid_name,
            hours=1.0,
            temperature=0.0,
            date=date(2026, 9, 7),
        )
    assert any(err["loc"] == ("name",) for err in exc_info.value.errors())


def test_activity_notes_sanitization():
    """Notes with whitespace only should be converted to None."""
    act1 = ActivityCreate(
        name="Test",
        hours=1.0,
        temperature=0.0,
        date=date(2026, 9, 7),
        notes="   ",
    )
    assert act1.notes is None

    act2 = ActivityCreate(
        name="Test",
        hours=1.0,
        temperature=0.0,
        date=date(2026, 9, 7),
        notes="  Clean note  ",
    )
    assert act2.notes == "Clean note"


def test_activity_update_valid_partial():
    """ActivityUpdate allows all fields to be optional and updates partially."""
    # Empty update
    update_empty = ActivityUpdate()
    assert update_empty.name is None
    assert update_empty.hours is None
    assert update_empty.temperature is None
    assert update_empty.date is None
    assert update_empty.notes is None
    assert update_empty.area_ids is None

    # Partial update with name and hours
    update_partial = ActivityUpdate(name="  Refactored  ", hours=3.5)
    assert update_partial.name == "Refactored"
    assert update_partial.hours == 3.5
    assert update_partial.temperature is None

    # Partial update with temperature boundary
    update_temp = ActivityUpdate(temperature=-5.0)
    assert update_temp.temperature == -5.0


def test_activity_update_invalid_limits():
    """ActivityUpdate rejects out-of-bounds values when provided."""
    with pytest.raises(ValidationError):
        ActivityUpdate(hours=0.0)

    with pytest.raises(ValidationError):
        ActivityUpdate(hours=25.0)

    with pytest.raises(ValidationError):
        ActivityUpdate(temperature=5.1)

    with pytest.raises(ValidationError):
        ActivityUpdate(temperature=-5.1)

    with pytest.raises(ValidationError):
        ActivityUpdate(name="   ")

    with pytest.raises(ValidationError):
        ActivityUpdate(name="a" * 121)


def test_activity_read_from_attributes():
    """ActivityRead serializes ORM models and exposes embedded areas and area_ids."""
    u_id = uuid.uuid4()
    act_id = uuid.uuid4()
    area_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    today = date(2026, 9, 7)

    life_area = LifeArea(
        id=area_id,
        user_id=u_id,
        name="Salud & Cuerpo",
        color="#22c55e",
        visible=True,
        created_at=now,
    )

    act = Activity(
        id=act_id,
        user_id=u_id,
        name="Corrida Matutina",
        name_normalized="corrida matutina",
        hours=0.8,
        temperature=5.0,
        date=today,
        notes="5k a ritmo constante",
        created_at=now,
        areas=[life_area],
    )

    act_read = ActivityRead.model_validate(act)
    assert act_read.id == act_id
    assert act_read.user_id == u_id
    assert act_read.name == "Corrida Matutina"
    assert act_read.name_normalized == "corrida matutina"
    assert act_read.hours == 0.8
    assert act_read.temperature == 5.0
    assert act_read.date == today
    assert act_read.notes == "5k a ritmo constante"
    assert len(act_read.areas) == 1
    assert isinstance(act_read.areas[0], AreaRead)
    assert act_read.areas[0].id == area_id
    assert act_read.area_ids == [area_id]


def test_consolidated_node_valid():
    """ConsolidatedNode holds aggregated activity statistics."""
    area1 = uuid.uuid4()
    area2 = uuid.uuid4()

    node = ConsolidatedNode(
        name="Deep Work Arquitectura",
        name_normalized="deep work arquitectura",
        total_hours=10.5,
        weighted_temperature=4.43,
        area_ids=[area1, area2, None],  # None should be filtered out
        entry_count=3,
    )

    assert node.name == "Deep Work Arquitectura"
    assert node.name_normalized == "deep work arquitectura"
    assert node.total_hours == 10.5
    assert node.weighted_temperature == 4.43
    assert node.area_ids == [area1, area2]
    assert node.entry_count == 3


def test_consolidated_node_invalid():
    """ConsolidatedNode rejects negative hours or invalid temperatures."""
    with pytest.raises(ValidationError):
        ConsolidatedNode(
            name="Invalid",
            name_normalized="invalid",
            total_hours=-1.0,
            weighted_temperature=0.0,
        )

    with pytest.raises(ValidationError):
        ConsolidatedNode(
            name="Invalid",
            name_normalized="invalid",
            total_hours=2.0,
            weighted_temperature=5.1,
        )

    with pytest.raises(ValidationError):
        ConsolidatedNode(
            name="Invalid",
            name_normalized="invalid",
            total_hours=2.0,
            weighted_temperature=-5.1,
        )

    with pytest.raises(ValidationError):
        ConsolidatedNode(
            name="Invalid",
            name_normalized="invalid",
            total_hours=2.0,
            weighted_temperature=0.0,
            entry_count=0,
        )
