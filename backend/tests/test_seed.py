from app.database import close_db, get_session
from app.models import Activity, LifeArea, User
from app.seed import DEMO_USER_ID, seed_data
import pytest
from sqlmodel import col, func, select


@pytest.fixture(autouse=True)
async def cleanup_db():
    yield
    await close_db()


@pytest.mark.asyncio
async def test_seed_data_idempotency():
    async for session in get_session():
        # First seed pass
        count1 = await seed_data(session)
        assert count1 == 20

        # Second seed pass
        count2 = await seed_data(session)
        assert count2 == 20

        # Verify demo user
        user = (await session.exec(select(User).where(User.id == DEMO_USER_ID))).first()
        assert user is not None
        assert user.email == "demo@sharink.app"

        # Verify areas count
        areas_count = (
            await session.exec(
                select(func.count(col(LifeArea.id))).where(
                    LifeArea.user_id == DEMO_USER_ID
                )
            )
        ).one()
        assert areas_count == 5

        # Verify activities count
        acts_count = (
            await session.exec(
                select(func.count(col(Activity.id))).where(
                    Activity.user_id == DEMO_USER_ID
                )
            )
        ).one()
        assert acts_count == 20
