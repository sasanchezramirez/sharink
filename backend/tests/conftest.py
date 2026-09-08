from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

from app.database import close_db, get_session, init_db
from app.main import app
from app.models import LifeArea, User
from httpx import ASGITransport, AsyncClient
import pytest


@pytest.fixture(autouse=True)
async def prepare_database() -> AsyncGenerator[None, None]:
    """Ensure database schema is initialized before each test session and closed after."""
    await init_db()
    yield
    await close_db()


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Reusable httpx AsyncClient pointing to the FastAPI test application."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def create_user_in_db(email_prefix: str = "user") -> User:
    """Helper to persist a test user in the database."""
    uid = uuid4()
    user = User(id=uid, email=f"{email_prefix}_{uid.hex[:8]}@sharink.app")
    async for session in get_session():
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def create_area_in_db(
    user_id: UUID, name: str = "Enfoque", color: str = "#0284c7"
) -> LifeArea:
    """Helper to persist a test life area in the database."""
    area = LifeArea(user_id=user_id, name=name, color=color)
    async for session in get_session():
        session.add(area)
        await session.commit()
        await session.refresh(area)
        return area


@pytest.fixture
async def test_user() -> User:
    """Fixture providing a persisted test user."""
    return await create_user_in_db("fixture_user")


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    """Fixture providing default authentication headers for test_user."""
    return {"X-User-Id": str(test_user.id)}
