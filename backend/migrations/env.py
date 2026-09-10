import asyncio
from logging.config import fileConfig

from alembic import context
from app.config import get_settings
import app.models  # noqa: F401 - ensure all models are registered in metadata
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

# Alembic Config object
config = context.config

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Logging setup
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        version_table="alembic_version",
        version_table_schema="sharink",
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    is_postgres = connection.dialect.name == "postgresql"
    schema_name = "sharink" if is_postgres else None

    if is_postgres:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS sharink;"))
        connection.execute(text("SET search_path TO sharink, public;"))

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        version_table="alembic_version",
        version_table_schema=schema_name,
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with an AsyncEngine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
        await connection.commit()

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
