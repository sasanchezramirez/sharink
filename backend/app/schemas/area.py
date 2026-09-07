from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AreaBase(BaseModel):
    """Base schema for life area data."""

    name: str = Field(
        min_length=1,
        max_length=60,
        description="Name of the life area",
    )
    color: str = Field(
        pattern=r"^#[0-9a-fA-F]{6}$",
        description="Hex color code (e.g. #0284c7) for spatial visualization",
    )
    visible: bool = Field(
        default=True,
        description="Visibility flag in the graph",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be empty or whitespace only")
        return stripped


class AreaCreate(AreaBase):
    """Payload for creating a new life area."""

    pass


class AreaUpdate(BaseModel):
    """Payload for updating an existing life area (partial update)."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=60,
        description="Updated name of the life area",
    )
    color: str | None = Field(
        default=None,
        pattern=r"^#[0-9a-fA-F]{6}$",
        description="Updated hex color code",
    )
    visible: bool | None = Field(
        default=None,
        description="Updated visibility flag",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Name cannot be empty or whitespace only")
            return stripped
        return v


class AreaRead(AreaBase):
    """Response schema for a life area."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
