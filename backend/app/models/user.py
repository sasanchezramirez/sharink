from datetime import UTC, datetime
import uuid

from sqlmodel import Field, SQLModel


def get_utc_now() -> datetime:
    """Return naive UTC datetime compatible with TIMESTAMP WITHOUT TIME ZONE."""
    return datetime.now(UTC).replace(tzinfo=None)


class User(SQLModel, table=True):
    """User account entity."""

    __tablename__ = "users"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        description="Unique identifier for the user",
    )
    email: str = Field(
        max_length=255,
        unique=True,
        index=True,
        nullable=False,
        description="User email address",
    )
    created_at: datetime = Field(
        default_factory=get_utc_now,
        nullable=False,
        description="Timestamp when the user was created",
    )
