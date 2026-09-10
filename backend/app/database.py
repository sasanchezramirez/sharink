from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings

settings = get_settings()

connect_args: dict = {}
if "postgresql" in settings.DATABASE_URL:
    connect_args["server_settings"] = {"search_path": "sharink,public"}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.ENV == "dev"),
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    pool_recycle=300,
    connect_args=connect_args,
)

async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing an async database session per request."""
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    """Initialize database tables defined in SQLModel metadata within 'sharink' schema."""
    async with engine.begin() as conn:
        if "postgresql" in settings.DATABASE_URL:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS sharink;"))
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_db() -> None:
    """Dispose database engine connections."""
    await engine.dispose()
