from sqlmodel import SQLModel

from app.models.activity import Activity, ActivityAreaLink
from app.models.area import LifeArea
from app.models.user import User

# Configure default schema for all SQLModel models to 'sharink'
SQLModel.metadata.schema = "sharink"

__all__ = [
    "Activity",
    "ActivityAreaLink",
    "LifeArea",
    "User",
]
