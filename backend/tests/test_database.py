import pytest
from sqlmodel import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import close_db, get_session, init_db


@pytest.fixture(autouse=True)
async def cleanup_db_pool():
    yield
    await close_db()


@pytest.mark.asyncio
async def test_database_connection_and_session():
    async for session in get_session():
        assert isinstance(session, AsyncSession)
        result = await session.exec(text("SELECT 1"))
        row = result.first()
        assert row is not None
        assert row[0] == 1


@pytest.mark.asyncio
async def test_init_db():
    await init_db()
