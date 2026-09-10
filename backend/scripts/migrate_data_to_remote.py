"""Script para migrar datos locales del esquema 'sharink' al esquema 'sharink' remoto en Neon.tech."""

import argparse
import asyncio
import logging
import os
import sys

from app.models.activity import Activity, ActivityAreaLink
from app.models.area import LifeArea
from app.models.user import User
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("sharink.data_migration")

DEFAULT_LOCAL_URL = "postgresql+asyncpg://sharink:sharink@localhost:5432/sharink"


def normalize_asyncpg_url(url: str) -> str:
    """Asegura que la URL use el driver postgresql+asyncpg y ssl=require."""
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if "sslmode=require" in url and "ssl=require" not in url:
        url = url.replace("sslmode=require", "ssl=require")
    return url


async def migrate_data(local_url: str, remote_url: str) -> None:
    """Extrae datos del esquema local sharink y los inserta en el esquema remoto sharink."""
    logger.info("Iniciando motores de base de datos con search_path=sharink,public...")

    local_engine = create_async_engine(
        local_url,
        connect_args={"server_settings": {"search_path": "sharink,public"}},
    )
    remote_engine = create_async_engine(
        remote_url,
        connect_args={"server_settings": {"search_path": "sharink,public"}},
    )

    local_session_maker = async_sessionmaker(
        local_engine, class_=AsyncSession, expire_on_commit=False
    )
    remote_session_maker = async_sessionmaker(
        remote_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with (
        local_session_maker() as local_session,
        remote_session_maker() as remote_session,
    ):
        # Limpiar datos previos si existieran para evitar colisiones
        from sqlmodel import text

        await remote_session.exec(
            text(
                "TRUNCATE sharink.activity_areas, sharink.activities, sharink.life_areas, sharink.users CASCADE;"
            )
        )
        await remote_session.commit()

        # 1. Migrar Usuarios
        users = (await local_session.exec(select(User))).all()
        logger.info("Migrando %d usuarios en bloque...", len(users))
        remote_session.add_all(
            [User(id=u.id, email=u.email, created_at=u.created_at) for u in users]
        )
        await remote_session.commit()
        logger.info("✓ %d usuarios migrados exitosamente.", len(users))

        # 2. Migrar Aspectos de Vida (Life Areas)
        areas = (await local_session.exec(select(LifeArea))).all()
        logger.info("Migrando %d aspectos de vida en bloque...", len(areas))
        remote_session.add_all(
            [
                LifeArea(
                    id=a.id,
                    user_id=a.user_id,
                    name=a.name,
                    color=a.color,
                    visible=a.visible,
                    created_at=a.created_at,
                )
                for a in areas
            ]
        )
        await remote_session.commit()
        logger.info("✓ %d aspectos de vida migrados exitosamente.", len(areas))

        # 3. Migrar Actividades
        activities = (await local_session.exec(select(Activity))).all()
        logger.info("Migrando %d actividades en bloque...", len(activities))
        remote_session.add_all(
            [
                Activity(
                    id=act.id,
                    user_id=act.user_id,
                    name=act.name,
                    name_normalized=act.name_normalized,
                    hours=act.hours,
                    temperature=act.temperature,
                    date=act.date,
                    notes=act.notes,
                    created_at=act.created_at,
                )
                for act in activities
            ]
        )
        await remote_session.commit()
        logger.info("✓ %d actividades migradas exitosamente.", len(activities))

        # 4. Migrar Enlaces Actividad-Área
        links = (await local_session.exec(select(ActivityAreaLink))).all()
        logger.info("Migrando %d enlaces actividad-área en bloque...", len(links))
        remote_session.add_all(
            [
                ActivityAreaLink(activity_id=link.activity_id, area_id=link.area_id)
                for link in links
            ]
        )
        await remote_session.commit()
        logger.info("✓ %d enlaces actividad-área migrados exitosamente.", len(links))

    await local_engine.dispose()
    await remote_engine.dispose()
    logger.info(
        "🎉 ¡Migración de datos completada exitosamente en el esquema 'sharink' remoto!"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migración de datos locales a remotos en esquema sharink."
    )
    parser.add_argument(
        "--remote-url",
        default=os.getenv("REMOTE_DATABASE_URL"),
        help="Cadena de conexión a PostgreSQL remoto (Neon.tech)",
    )
    parser.add_argument(
        "--local-url",
        default=os.getenv("LOCAL_DATABASE_URL", DEFAULT_LOCAL_URL),
        help="Cadena de conexión a PostgreSQL local",
    )
    args = parser.parse_args()

    if not args.remote_url:
        logger.error(
            "Debe proporcionar --remote-url o definir la variable de entorno REMOTE_DATABASE_URL."
        )
        sys.exit(1)

    local_url = normalize_asyncpg_url(args.local_url)
    remote_url = normalize_asyncpg_url(args.remote_url)

    asyncio.run(migrate_data(local_url, remote_url))


if __name__ == "__main__":
    main()
