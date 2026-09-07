import uuid

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import Activity
from app.models.area import LifeArea
from app.schemas.activity import ActivityCreate


def normalize_name(name: str) -> str:
    """Normalize activity name: lowercase, strip, and collapse multiple whitespace."""
    return " ".join(name.strip().lower().split())


def weighted_temperature(t1: float, h1: float, t2: float, h2: float) -> float:
    """Calculate the weighted average temperature between two activity entries.

    Formula:
        ((t1 * h1) + (t2 * h2)) / (h1 + h2)

    Result is rounded to 2 decimal places and clamped to [-5.0, 5.0].
    """
    total_hours = h1 + h2
    if total_hours <= 0:
        return 0.0

    raw_weighted = ((t1 * h1) + (t2 * h2)) / total_hours
    rounded = round(raw_weighted, 2)
    return min(5.0, max(-5.0, rounded))


def merge_notes(a: str | None, b: str | None) -> str | None:
    """Merge two note strings using ' · ' separator without duplicate segments."""
    parts: list[str] = []
    for note in (a, b):
        if not note:
            continue
        for segment in note.split(" · "):
            cleaned = segment.strip()
            if cleaned and cleaned not in parts:
                parts.append(cleaned)

    if not parts:
        return None
    return " · ".join(parts)


async def upsert_activity(
    session: AsyncSession,
    user_id: uuid.UUID,
    payload: ActivityCreate,
) -> Activity:
    """Insert or accumulate an activity entry for a user on a given date.

    Uses SELECT ... FOR UPDATE to lock existing rows and ensure atomic intra-day accumulation:
    - If entry exists: sums hours (capped at 24.0), recalculates weighted temperature,
      merges notes, and unites life areas.
    - If entry does not exist: creates a new activity record.
    """
    norm_name = normalize_name(payload.name)

    # 1. Row-level lock search for existing activity on the same date for this user
    stmt = (
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.date == payload.date,
            Activity.name_normalized == norm_name,
        )
        .with_for_update()
        .options(selectinload(Activity.areas))
    )
    existing = (await session.exec(stmt)).first()

    if existing:
        # Sum hours (capped at 24.0)
        new_hours = min(24.0, round(existing.hours + payload.hours, 2))

        # Recalculate weighted temperature
        new_temperature = weighted_temperature(
            existing.temperature,
            existing.hours,
            payload.temperature,
            payload.hours,
        )

        # Merge notes
        new_notes = merge_notes(existing.notes, payload.notes)

        # Merge life areas
        existing_area_ids = {area.id for area in existing.areas}
        combined_area_ids = existing_area_ids.union(set(payload.area_ids))

        if combined_area_ids:
            area_stmt = select(LifeArea).where(
                col(LifeArea.id).in_(combined_area_ids),
                LifeArea.user_id == user_id,
            )
            combined_areas = list((await session.exec(area_stmt)).all())
        else:
            combined_areas = []

        existing.name = payload.name
        existing.hours = new_hours
        existing.temperature = new_temperature
        existing.notes = new_notes
        existing.areas = combined_areas

        session.add(existing)
        await session.flush()
        await session.refresh(existing, ["areas"])
        existing._is_created = False
        return existing
    else:
        # Resolve initial areas
        if payload.area_ids:
            area_stmt = select(LifeArea).where(
                col(LifeArea.id).in_(set(payload.area_ids)),
                LifeArea.user_id == user_id,
            )
            target_areas = list((await session.exec(area_stmt)).all())
        else:
            target_areas = []

        new_activity = Activity(
            user_id=user_id,
            name=payload.name,
            name_normalized=norm_name,
            hours=min(24.0, round(payload.hours, 2)),
            temperature=payload.temperature,
            date=payload.date,
            notes=payload.notes,
            areas=target_areas,
        )
        session.add(new_activity)
        await session.flush()
        await session.refresh(new_activity, ["areas"])
        new_activity._is_created = True
        return new_activity
