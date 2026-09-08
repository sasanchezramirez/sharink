from functools import lru_cache
import json
from pathlib import Path
from typing import Literal, Self
from uuid import UUID

from pydantic import PostgresDsn, TypeAdapter, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DEV_SECRET_KEY = "dev-secret-key-change-in-production-min-32-chars-long"


class Settings(BaseSettings):
    """Application settings loaded from environment variables and backend/.env file."""

    DATABASE_URL: str = "postgresql+asyncpg://sharink:sharink@localhost:5432/sharink"
    SECRET_KEY: str = DEV_SECRET_KEY
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    ENV: Literal["dev", "test", "prod"] = "dev"
    DEFAULT_USER_ID: UUID = UUID("00000000-0000-0000-0000-000000000001")

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        TypeAdapter(PostgresDsn).validate_python(v)
        return v

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: list[str] | str) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_production_security(self) -> Self:
        if self.ENV == "prod":
            if self.SECRET_KEY == DEV_SECRET_KEY:
                raise ValueError(
                    "SECRET_KEY cannot use the default development key in production"
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be at least 32 characters long in production"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Returns a cached instance of the application settings."""
    return Settings()
