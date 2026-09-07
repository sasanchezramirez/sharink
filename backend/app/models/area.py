from datetime import datetime
import uuid

from sqlmodel import Field, Relationship, SQLModel

from app.models.activity import Activity, ActivityAreaLink
from app.models.user import get_utc_now


class LifeArea(SQLModel, table=True):
    """Life area or dimension (e.g., Work, Health, Relationships)."""

    __tablename__ = "life_areas"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        description="Unique identifier for the life area",
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        index=True,
        nullable=False,
        description="User who owns this life area",
    )
    name: str = Field(
        max_length=60,
        nullable=False,
        description="Name of the life area",
    )
    color: str = Field(
        max_length=10,
        nullable=False,
        description="Hex color code for spatial and graph visualization",
    )
    visible: bool = Field(
        default=True,
        nullable=False,
        description="Visibility flag in the graph",
    )
    created_at: datetime = Field(
        default_factory=get_utc_now,
        nullable=False,
        description="Timestamp when the life area was created",
    )

    activities: list[Activity] = Relationship(
        back_populates="areas",
        link_model=ActivityAreaLink,
    )
