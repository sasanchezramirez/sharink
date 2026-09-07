from datetime import date as DateType
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.orm import selectinload
from sqlmodel import col, select

from app.deps import SessionDep, UserIdDep
from app.models.activity import Activity
from app.models.area import LifeArea
from app.schemas.activity import (
    ActivityCreate,
    ActivityRead,
    ActivityUpdate,
    ConsolidatedNode,
    TemporalView,
)
from app.services.accumulator import normalize_name, upsert_activity
from app.services.aggregator import fetch_nodes

router = APIRouter(prefix="/api/activities", tags=["Activities"])


@router.get(
    "",
    response_model=list[ConsolidatedNode],
    summary="List consolidated activities",
    description=(
        "Retrieve aggregated activity nodes for the specified temporal view (day, week, month, global). "
        "Consolidates hours and computes duration-weighted average temperature."
    ),
)
async def list_activities(
    user_id: UserIdDep,
    session: SessionDep,
    view: TemporalView = Query(
        default=TemporalView.DAY,
        description="Temporal view mode: 'day', 'week', 'month', or 'global'",
    ),
    date: DateType = Query(
        default_factory=DateType.today,
        description="Focal calendar date for temporal aggregation (defaults to today)",
    ),
) -> list[ConsolidatedNode]:
    return await fetch_nodes(
        session=session,
        user_id=user_id,
        view=view.value,
        focal_date=date,
        raw=False,
    )


@router.post(
    "",
    response_model=ActivityRead,
    summary="Log or accumulate activity",
    description=(
        "Log a new activity or intelligently accumulate hours and weighted temperature "
        "if an entry with the same normalized name exists on the same calendar date. "
        "Returns 201 Created on new entry, and 200 OK when accumulated."
    ),
)
async def log_activity(
    payload: ActivityCreate,
    user_id: UserIdDep,
    session: SessionDep,
    response: Response,
) -> Activity:
    activity = await upsert_activity(session, user_id, payload)
    await session.commit()
    await session.refresh(activity, ["areas"])

    if getattr(activity, "_is_created", False):
        response.status_code = status.HTTP_201_CREATED
    else:
        response.status_code = status.HTTP_200_OK

    return activity


@router.put(
    "/{id}",
    response_model=ActivityRead,
    summary="Update activity",
    description=(
        "Update an existing activity by ID. Recalculates normalized name and reassigns life areas. "
        "Returns 404 if the activity does not exist or belongs to another user."
    ),
)
async def update_activity(
    id: UUID,
    payload: ActivityUpdate,
    user_id: UserIdDep,
    session: SessionDep,
) -> Activity:
    stmt = (
        select(Activity)
        .where(Activity.id == id, Activity.user_id == user_id)
        .options(selectinload(Activity.areas))
    )
    result = await session.exec(stmt)
    activity = result.first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity '{id}' not found.",
        )

    # Check for name/date collisions with other activities for the same user
    new_norm_name = (
        normalize_name(payload.name)
        if payload.name is not None
        else activity.name_normalized
    )
    new_date = payload.date if payload.date is not None else activity.date

    if new_norm_name != activity.name_normalized or new_date != activity.date:
        collision_stmt = select(Activity).where(
            Activity.user_id == user_id,
            Activity.date == new_date,
            Activity.name_normalized == new_norm_name,
            Activity.id != id,
        )
        collision = (await session.exec(collision_stmt)).first()
        if collision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An activity named '{new_norm_name}' already exists on date {new_date}.",
            )

    if payload.name is not None:
        activity.name = payload.name
        activity.name_normalized = new_norm_name
    if payload.date is not None:
        activity.date = payload.date
    if payload.hours is not None:
        activity.hours = payload.hours
    if payload.temperature is not None:
        activity.temperature = payload.temperature
    if payload.notes is not None:
        activity.notes = payload.notes

    # Reassign areas if provided
    if payload.area_ids is not None:
        if payload.area_ids:
            area_stmt = select(LifeArea).where(
                col(LifeArea.id).in_(set(payload.area_ids)),
                LifeArea.user_id == user_id,
            )
            target_areas = list((await session.exec(area_stmt)).all())
        else:
            target_areas = []
        activity.areas = target_areas

    session.add(activity)
    await session.commit()
    await session.refresh(activity, ["areas"])
    return activity


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete activity",
    description=(
        "Delete an activity by ID. Returns 404 if the activity does not exist or belongs to another user."
    ),
)
async def delete_activity(
    id: UUID,
    user_id: UserIdDep,
    session: SessionDep,
) -> Response:
    stmt = select(Activity).where(Activity.id == id, Activity.user_id == user_id)
    result = await session.exec(stmt)
    activity = result.first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity '{id}' not found.",
        )

    await session.delete(activity)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
