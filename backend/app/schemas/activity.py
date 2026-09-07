from datetime import date as DateType, datetime
from enum import Enum
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.area import AreaRead


class TemporalView(str, Enum):
    """Supported temporal views for activity aggregation."""

    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    GLOBAL = "global"


class ActivityBase(BaseModel):
    """Base schema for activity data."""

    name: str = Field(
        min_length=1,
        max_length=120,
        description="Display name of the activity",
    )
    hours: float = Field(
        ge=0.1,
        le=24.0,
        description="Duration in hours (0.1 to 24.0)",
    )
    temperature: float = Field(
        ge=-5.0,
        le=5.0,
        description="Electromagnetic vital temperature scale (-5.0 draining to +5.0 inspiring)",
    )
    date: DateType = Field(
        description="Calendar date of the activity",
    )
    notes: str | None = Field(
        default=None,
        description="Optional notes or reflections",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be empty or whitespace only")
        return stripped

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            return stripped if stripped else None
        return None


class ActivityCreate(ActivityBase):
    """Payload for creating or logging an activity."""

    area_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="List of life area IDs associated with this activity",
    )


class ActivityUpdate(BaseModel):
    """Payload for updating an existing activity (all fields optional)."""

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
        description="Updated activity name",
    )
    hours: float | None = Field(
        default=None,
        ge=0.1,
        le=24.0,
        description="Updated duration in hours (0.1 - 24.0)",
    )
    temperature: float | None = Field(
        default=None,
        ge=-5.0,
        le=5.0,
        description="Updated temperature (-5.0 to +5.0)",
    )
    date: DateType | None = Field(
        default=None,
        description="Updated calendar date",
    )
    notes: str | None = Field(
        default=None,
        description="Updated notes",
    )
    area_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Updated life area IDs",
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

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            return stripped if stripped else None
        return None


class ActivityRead(ActivityBase):
    """Complete activity representation with embedded life areas."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name_normalized: str
    created_at: datetime
    areas: list[AreaRead] = Field(
        default_factory=list,
        description="Life areas associated with this activity",
    )

    @computed_field
    @property
    def area_ids(self) -> list[uuid.UUID]:
        """Convenience list of area IDs extracted from embedded areas."""
        return [area.id for area in self.areas]


class ConsolidatedNode(BaseModel):
    """Consolidated activity node for spatial graph and periodic views."""

    name: str = Field(description="Display name of the activity")
    name_normalized: str = Field(description="Normalized key used for aggregation")
    total_hours: float = Field(
        ge=0.0,
        description="Total hours aggregated in the focal period",
    )
    weighted_temperature: float = Field(
        ge=-5.0,
        le=5.0,
        description="Weighted average temperature across aggregated occurrences",
    )
    area_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="List of distinct life area IDs associated with this activity",
    )
    entry_count: int = Field(
        default=1,
        ge=1,
        description="Number of individual entries aggregated into this node",
    )

    @field_validator("area_ids", mode="before")
    @classmethod
    def clean_area_ids(cls, v: Any) -> list[Any]:
        if v is None:
            return []
        if isinstance(v, (list, set, tuple)):
            return [item for item in v if item is not None]
        return v
