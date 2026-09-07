from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import select

from app.deps import SessionDep, UserIdDep
from app.models.area import LifeArea
from app.schemas.area import AreaCreate, AreaRead, AreaUpdate

router = APIRouter(prefix="/api/areas", tags=["Life Areas"])


@router.get(
    "",
    response_model=list[AreaRead],
    summary="List life areas",
    description="Retrieve all life areas belonging to the authenticated user.",
)
async def list_areas(
    user_id: UserIdDep,
    session: SessionDep,
) -> list[LifeArea]:
    stmt = (
        select(LifeArea)
        .where(LifeArea.user_id == user_id)
        .order_by(LifeArea.created_at.asc())
    )
    result = await session.exec(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=AreaRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create life area",
    description="Create a new life area with color palette assignment.",
)
async def create_area(
    payload: AreaCreate,
    user_id: UserIdDep,
    session: SessionDep,
) -> LifeArea:
    area = LifeArea(
        user_id=user_id,
        name=payload.name,
        color=payload.color,
        visible=payload.visible,
    )
    session.add(area)
    await session.commit()
    await session.refresh(area)
    return area


@router.put(
    "/{id}",
    response_model=AreaRead,
    summary="Update life area",
    description="Update an existing life area. Returns 404 if not found or owned by another user.",
)
async def update_area(
    id: UUID,
    payload: AreaUpdate,
    user_id: UserIdDep,
    session: SessionDep,
) -> LifeArea:
    stmt = select(LifeArea).where(LifeArea.id == id, LifeArea.user_id == user_id)
    result = await session.exec(stmt)
    area = result.first()

    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Life area '{id}' not found.",
        )

    if payload.name is not None:
        area.name = payload.name
    if payload.color is not None:
        area.color = payload.color
    if payload.visible is not None:
        area.visible = payload.visible

    session.add(area)
    await session.commit()
    await session.refresh(area)
    return area


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete life area",
    description="Delete a life area. Returns 404 if not found or owned by another user.",
)
async def delete_area(
    id: UUID,
    user_id: UserIdDep,
    session: SessionDep,
) -> Response:
    stmt = select(LifeArea).where(LifeArea.id == id, LifeArea.user_id == user_id)
    result = await session.exec(stmt)
    area = result.first()

    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Life area '{id}' not found.",
        )

    await session.delete(area)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
