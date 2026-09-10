"""Migra las tablas del esquema 'public' al esquema 'sharink' de forma idempotente en PostgreSQL."""

import asyncio
import logging

from app.database import async_session_maker, engine
from sqlmodel import text

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("sharink.migration")

TABLES = [
    "alembic_version",
    "users",
    "life_areas",
    "activities",
    "activity_areas",
]


async def migrate_public_to_sharink() -> None:
    """Mueve tablas existentes en 'public' al esquema 'sharink' si aún no se han reubicado."""
    async with async_session_maker() as session:
        # 1. Crear el esquema sharink de manera idempotente
        await session.exec(text("CREATE SCHEMA IF NOT EXISTS sharink;"))
        await session.commit()

        # 2. Revisar cada tabla y reubicarla si aún se encuentra en public
        for table in TABLES:
            check_query = text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table_name;"
            )
            result = (
                await session.exec(check_query.bindparams(table_name=table))
            ).first()

            if result:
                logger.info(
                    "Moviendo tabla 'public.%s' -> 'sharink.%s'...", table, table
                )
                await session.exec(
                    text(f"ALTER TABLE public.{table} SET SCHEMA sharink;")
                )
                await session.commit()
            else:
                logger.info(
                    "Tabla '%s': ya está en el esquema 'sharink' o no existe en 'public'.",
                    table,
                )

    logger.info("Verificación de esquema 'sharink' completada exitosamente.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate_public_to_sharink())
