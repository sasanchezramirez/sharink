import calendar
from datetime import date, timedelta
import uuid

from sqlalchemy.orm import selectinload
from sqlmodel import select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.activity import Activity
from app.schemas.activity import ConsolidatedNode


def resolve_range(view: str, focal_date: date) -> tuple[date | None, date | None]:
    """Calculate date boundaries for temporal aggregation views.

    Supported views:
    - 'day': single date (focal_date, focal_date)
    - 'week': Monday through Sunday enclosing focal_date
    - 'month': first day through last day of the focal_date's month
    - 'global': unbounded range (None, None)
    """
    view_lower = view.strip().lower()

    if view_lower == "day":
        return focal_date, focal_date
    elif view_lower == "week":
        start_of_week = focal_date - timedelta(days=focal_date.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        return start_of_week, end_of_week
    elif view_lower == "month":
        start_of_month = focal_date.replace(day=1)
        last_day = calendar.monthrange(focal_date.year, focal_date.month)[1]
        end_of_month = focal_date.replace(day=last_day)
        return start_of_month, end_of_month
    elif view_lower == "global":
        return None, None
    else:
        raise ValueError(
            f"Invalid view: '{view}'. Supported views are: 'day', 'week', 'month', 'global'."
        )


async def fetch_raw_activities(
    session: AsyncSession,
    user_id: uuid.UUID,
    focal_date: date,
) -> list[Activity]:
    """Retrieve raw activity entries with loaded life areas for a specific day."""
    stmt = (
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.date == focal_date,
        )
        .options(selectinload(Activity.areas))
        .order_by(Activity.created_at)
    )
    res = await session.exec(stmt)
    return list(res.all())


async def fetch_nodes(
    session: AsyncSession,
    user_id: uuid.UUID,
    view: str,
    focal_date: date,
    raw: bool = False,
) -> list[ConsolidatedNode] | tuple[list[ConsolidatedNode], list[Activity]]:
    """Aggregate activities into consolidated graph nodes for the specified temporal view.

    Uses CTE SQL aggregation with LEFT JOIN to activity_areas so activities without
    areas are preserved while preventing row multiplication when an activity has multiple areas.

    When view == 'day' and raw == True, returns a tuple of (nodes, raw_activities).
    Otherwise returns a list of ConsolidatedNode.
    """
    start_date, end_date = resolve_range(view, focal_date)

    # Dynamic date filtering to avoid AmbiguousParameterError with NULL parameters in asyncpg
    if start_date is not None and end_date is not None:
        date_filter = "AND a.date >= :start_date AND a.date <= :end_date"
        params = {
            "user_id": user_id,
            "start_date": start_date,
            "end_date": end_date,
        }
    else:
        date_filter = ""
        params = {"user_id": user_id}

    query = text(f"""
        WITH filtered_acts AS (
            SELECT
                a.id,
                a.name,
                a.name_normalized,
                a.hours,
                a.temperature
            FROM activities a
            WHERE a.user_id = :user_id
              {date_filter}
        ),
        act_stats AS (
            SELECT
                fa.name_normalized,
                MAX(fa.name) AS name,
                ROUND(SUM(fa.hours)::numeric, 2) AS total_hours,
                ROUND((SUM(fa.hours * fa.temperature) / NULLIF(SUM(fa.hours), 0))::numeric, 2) AS weighted_temperature,
                COUNT(fa.id) AS entry_count,
                (array_agg(fa.id))[1] AS id,
                array_agg(fa.id) AS activity_ids
            FROM filtered_acts fa
            GROUP BY fa.name_normalized
        ),
        act_areas AS (
            SELECT
                fa.name_normalized,
                array_agg(DISTINCT aa.area_id) FILTER (WHERE aa.area_id IS NOT NULL) AS area_ids
            FROM filtered_acts fa
            LEFT JOIN activity_areas aa ON fa.id = aa.activity_id
            GROUP BY fa.name_normalized
        )
        SELECT
            s.id,
            s.activity_ids,
            s.name,
            s.name_normalized,
            s.total_hours,
            COALESCE(s.weighted_temperature, 0.0) AS weighted_temperature,
            COALESCE(ar.area_ids, ARRAY[]::uuid[]) AS area_ids,
            s.entry_count
        FROM act_stats s
        LEFT JOIN act_areas ar ON s.name_normalized = ar.name_normalized
        ORDER BY s.total_hours DESC, s.name ASC;
    """)

    res = await session.exec(query.params(**params))
    rows = res.all()

    nodes: list[ConsolidatedNode] = [
        ConsolidatedNode(
            id=row.id,
            activity_ids=list(row.activity_ids or []),
            name=row.name,
            name_normalized=row.name_normalized,
            total_hours=float(row.total_hours),
            weighted_temperature=float(row.weighted_temperature),
            area_ids=list(row.area_ids or []),
            entry_count=int(row.entry_count),
        )
        for row in rows
    ]

    if raw and view.strip().lower() == "day":
        raw_activities = await fetch_raw_activities(session, user_id, focal_date)
        return nodes, raw_activities

    return nodes


class AggregationService:
    """Consolidation and temporal aggregation service."""

    resolve_range = staticmethod(resolve_range)
    fetch_nodes = staticmethod(fetch_nodes)
    fetch_raw_activities = staticmethod(fetch_raw_activities)
