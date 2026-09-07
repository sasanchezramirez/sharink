import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import DEV_SECRET_KEY, Settings, get_settings


def test_get_settings_cache():
    get_settings.cache_clear()
    settings_1 = get_settings()
    settings_2 = get_settings()
    assert settings_1 is settings_2
    get_settings.cache_clear()


def test_settings_defaults(monkeypatch):
    # Ensure environment is clean for testing defaults
    for var in ("DATABASE_URL", "SECRET_KEY", "CORS_ORIGINS", "ENV", "DEFAULT_USER_ID"):
        monkeypatch.delenv(var, raising=False)

    settings = Settings(_env_file=None)
    assert (
        settings.DATABASE_URL
        == "postgresql+asyncpg://sharink:sharink@localhost:5432/sharink"
    )
    assert settings.ENV == "dev"
    assert settings.SECRET_KEY == DEV_SECRET_KEY
    assert settings.DEFAULT_USER_ID == uuid.UUID("00000000-0000-0000-0000-000000000001")
    assert settings.CORS_ORIGINS == ["http://localhost:5173", "http://localhost:3000"]


def test_cors_origins_from_env_comma_separated(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://example.com, https://test.local")
    settings = Settings(_env_file=None)
    assert settings.CORS_ORIGINS == ["http://example.com", "https://test.local"]


def test_cors_origins_from_env_json_array(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", '["http://alpha.com", "http://beta.com"]')
    settings = Settings(_env_file=None)
    assert settings.CORS_ORIGINS == ["http://alpha.com", "http://beta.com"]


def test_env_restriction(monkeypatch):
    monkeypatch.setenv("ENV", "produccionn")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)

    for valid_env in ("dev", "test", "prod"):
        monkeypatch.setenv("ENV", valid_env)
        if valid_env == "prod":
            monkeypatch.setenv(
                "SECRET_KEY", "a" * 32
            )  # prod requires a non-default valid secret key
        settings = Settings(_env_file=None)
        assert settings.ENV == valid_env


def test_database_url_validation(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "no-es-una-url")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)

    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/testdb"
    )
    settings = Settings(_env_file=None)
    assert (
        settings.DATABASE_URL == "postgresql+asyncpg://user:pass@localhost:5432/testdb"
    )


def test_prod_secret_key_cannot_be_dev_default(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="default development key"):
        Settings(_env_file=None)


def test_prod_secret_key_minimum_length(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("SECRET_KEY", "short-secret")
    with pytest.raises(ValidationError, match="at least 32 characters"):
        Settings(_env_file=None)


def test_prod_secret_key_valid(monkeypatch):
    valid_key = "secure-production-secret-key-that-is-long-enough"
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("SECRET_KEY", valid_key)
    settings = Settings(_env_file=None)
    assert settings.ENV == "prod"
    assert settings.SECRET_KEY == valid_key


def test_cwd_does_not_hijack_env_file(tmp_path: Path, monkeypatch):
    # Simulate an external directory with a malicious or stray .env file
    hijack_env = tmp_path / ".env"
    hijack_env.write_text("SECRET_KEY=SECUESTRADA\nENV=dev\n")

    monkeypatch.chdir(tmp_path)
    # Even when running from tmp_path, Settings should not load tmp_path/.env
    settings = Settings()
    assert settings.SECRET_KEY != "SECUESTRADA"
