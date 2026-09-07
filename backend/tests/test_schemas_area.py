from datetime import datetime, timezone
import uuid

from pydantic import ValidationError
import pytest

from app.models.area import LifeArea
from app.schemas.area import AreaBase, AreaCreate, AreaRead, AreaUpdate


def test_area_base():
    """AreaBase should initialize with default visible=True."""
    base = AreaBase(name="Base Area", color="#112233")
    assert base.name == "Base Area"
    assert base.color == "#112233"
    assert base.visible is True


def test_area_create_valid():
    """AreaCreate should accept valid names and hex colors."""
    area = AreaCreate(name="Trabajo & Carrera", color="#0284c7")
    assert area.name == "Trabajo & Carrera"
    assert area.color == "#0284c7"
    assert area.visible is True  # default

    # Mixed case and uppercase hex colors
    area_upper = AreaCreate(name="Salud", color="#A1B2C3", visible=False)
    assert area_upper.name == "Salud"
    assert area_upper.color == "#A1B2C3"
    assert area_upper.visible is False

    # Name stripping
    area_stripped = AreaCreate(name="  Espacios Alrededor  ", color="#123456")
    assert area_stripped.name == "Espacios Alrededor"


@pytest.mark.parametrize(
    "invalid_color",
    [
        "red",
        "blue",
        "#fff",
        "#FFF",
        "0284c7",
        "#1234567",
        "#12345",
        "#gggggg",
        "#12345z",
        "",
        "# 12345",
    ],
)
def test_area_create_invalid_color_raises_validation_error(invalid_color: str):
    """AreaCreate must reject invalid color formats with ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        AreaCreate(name="Test Area", color=invalid_color)

    errors = exc_info.value.errors()
    assert any(err["loc"] == ("color",) for err in errors)


@pytest.mark.parametrize(
    "invalid_name",
    [
        "",
        "   ",
        "\t\n",
        "a" * 61,
    ],
)
def test_area_create_invalid_name_raises_validation_error(invalid_name: str):
    """AreaCreate must reject empty, whitespace-only, or overly long names."""
    with pytest.raises(ValidationError) as exc_info:
        AreaCreate(name=invalid_name, color="#0284c7")

    errors = exc_info.value.errors()
    assert any(err["loc"] == ("name",) for err in errors)


def test_area_update_valid_partial():
    """AreaUpdate should allow partial field updates."""
    # Empty update
    update_empty = AreaUpdate()
    assert update_empty.name is None
    assert update_empty.color is None
    assert update_empty.visible is None

    # Only name
    update_name = AreaUpdate(name="  Nuevo Nombre  ")
    assert update_name.name == "Nuevo Nombre"
    assert update_name.color is None
    assert update_name.visible is None

    # Only color
    update_color = AreaUpdate(color="#ff00aa")
    assert update_color.name is None
    assert update_color.color == "#ff00aa"
    assert update_color.visible is None

    # Only visible
    update_visible = AreaUpdate(visible=False)
    assert update_visible.visible is False


def test_area_update_invalid_color_raises_validation_error():
    """AreaUpdate must reject invalid hex color if supplied."""
    with pytest.raises(ValidationError):
        AreaUpdate(color="invalid-color")


@pytest.mark.parametrize("invalid_name", ["", "   ", "a" * 61])
def test_area_update_invalid_name_raises_validation_error(invalid_name: str):
    """AreaUpdate must reject invalid name if supplied."""
    with pytest.raises(ValidationError):
        AreaUpdate(name=invalid_name)


def test_area_read_from_attributes():
    """AreaRead should validate and read directly from LifeArea ORM model."""
    area_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    life_area = LifeArea(
        id=area_id,
        user_id=user_id,
        name="Ocio & Calma",
        color="#f97316",
        visible=True,
        created_at=now,
    )

    area_read = AreaRead.model_validate(life_area)
    assert area_read.id == area_id
    assert area_read.user_id == user_id
    assert area_read.name == "Ocio & Calma"
    assert area_read.color == "#f97316"
    assert area_read.visible is True
    assert area_read.created_at == now
