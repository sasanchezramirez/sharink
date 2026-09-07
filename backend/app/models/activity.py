from datetime import date as DateType, datetime
from typing import TYPE_CHECKING
import uuid

from sqlmodel import Field, Index, Relationship, SQLModel, UniqueConstraint

from app.models.user import get_utc_now

if TYPE_CHECKING:
    from app.models.area import LifeArea


class ActivityAreaLink(SQLModel, table=True):
    """Many-to-many relationship link between activities and life areas."""

    __tablename__ = "activity_areas"

    activity_id: uuid.UUID = Field(
        foreign_key="activities.id",
        primary_key=True,
        ondelete="CASCADE",
        description="Foreign key to activities table",
    )
    area_id: uuid.UUID = Field(
        foreign_key="life_areas.id",
        primary_key=True,
        ondelete="CASCADE",
        description="Foreign key to life_areas table",
    )


class Activity(SQLModel, table=True):
    """Daily logged activity with duration and electromagnetic scale temperature."""

    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "date",
            "name_normalized",
            name="uq_activities_user_date_name_norm",
        ),
        Index(
            "ix_activities_user_date_name",
            "user_id",
            "date",
            "name_normalized",
        ),
        Index(
            "ix_activities_user_date",
            "user_id",
            "date",
        ),
    )

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        description="Unique identifier for the activity",
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        index=True,
        nullable=False,
        description="User who owns this activity",
    )
    name: str = Field(
        max_length=120,
        nullable=False,
        description="Display name of the activity",
    )
    name_normalized: str = Field(
        index=True,
        max_length=120,
        nullable=False,
        description="Normalized lowercase and stripped name for deduplication and grouping",
    )
    hours: float = Field(
        ge=0.1,
        le=24.0,
        nullable=False,
        description="Duration in hours (0.1 - 24.0)",
    )
    temperature: float = Field(
        ge=-5.0,
        le=5.0,
        nullable=False,
        description="Electromagnetic vital temperature scale (-5.0 draining to +5.0 inspiring)",
    )
    date: DateType = Field(
        index=True,
        nullable=False,
        description="Calendar date of the activity",
    )
    notes: str | None = Field(
        default=None,
        description="Optional notes or context about the activity",
    )
    created_at: datetime = Field(
        default_factory=get_utc_now,
        nullable=False,
        description="Timestamp when the entry was created",
    )

    areas: list["LifeArea"] = Relationship(
        back_populates="activities",
        link_model=ActivityAreaLink,
    )
