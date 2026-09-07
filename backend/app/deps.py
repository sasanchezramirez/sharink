from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.database import get_session

settings = get_settings()


async def get_current_user_id(
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> UUID:
    """Retrieve the current user ID from the `X-User-Id` request header.

    If the header is omitted or empty, falls back to `settings.DEFAULT_USER_ID`.
    If the header value cannot be parsed into a valid UUID, raises HTTP 400 Bad Request.

    Note: This temporary header-based identity mechanism isolates data per user
    without blocking development with full authentication, and will be replaced
    by real JWT authentication in Phase 6 (T30).
    """
    if x_user_id:
        try:
            return UUID(x_user_id.strip())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-User-Id header format; must be a valid UUID.",
            )

    return settings.DEFAULT_USER_ID


# Type aliases for clean FastAPI dependency injection
UserIdDep = Annotated[UUID, Depends(get_current_user_id)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
