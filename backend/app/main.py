from contextlib import asynccontextmanager
import logging
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.database import close_db, get_session
from app.routers.activities import router as activities_router
from app.routers.areas import router as areas_router

logger = logging.getLogger("sharink.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager handling startup and shutdown events."""
    logger.info("Starting Sharink API (env=%s)...", settings.ENV)
    yield
    logger.info("Shutting down Sharink API, disposing database connections...")
    await close_db()


app = FastAPI(
    title="Sharink API",
    version="1.0.0",
    description="Backend API for Sharink — spatial activity visualizer and time allocation engine",
    lifespan=lifespan,
)

# CORS Configuration
origins = (
    settings.CORS_ORIGINS
    if isinstance(settings.CORS_ORIGINS, list)
    else [settings.CORS_ORIGINS]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers with uniform format: {"detail": ..., "code": ...}
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Format HTTP exceptions into uniform {detail, code} response."""
    code = getattr(exc, "code", exc.status_code)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": code},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Format request validation errors into uniform {detail, code} response."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors()), "code": 422},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Format unexpected errors into uniform {detail, code} response."""
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "code": 500},
    )


@app.get("/api/health", tags=["Health"])
async def health_check(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Health check endpoint verifying application and database readiness."""
    try:
        await session.exec(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        db_ok = False

    return {"status": "ok", "db": db_ok}


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    """Root redirect / information endpoint."""
    return {
        "title": "Sharink API",
        "version": "1.0.0",
        "docs": "/docs",
    }


# Include feature routers
app.include_router(activities_router)
app.include_router(areas_router)
