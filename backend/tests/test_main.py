from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
import pytest

from app.database import close_db, init_db
from app.main import app


@pytest.fixture(autouse=True)
async def prepare_database():
    await init_db()
    yield
    await close_db()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_healthcheck_endpoint(async_client: AsyncClient):
    """GET /api/health must respond with 200 and {'status': 'ok', 'db': True}."""
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["db"] is True


@pytest.mark.asyncio
async def test_docs_and_openapi_endpoints(async_client: AsyncClient):
    """Swagger UI /docs and OpenAPI schema must be accessible."""
    docs_response = await async_client.get("/docs")
    assert docs_response.status_code == 200
    assert "html" in docs_response.headers.get("content-type", "")

    openapi_response = await async_client.get("/openapi.json")
    assert openapi_response.status_code == 200
    openapi_data = openapi_response.json()
    assert openapi_data["info"]["title"] == "Sharink API"
    assert openapi_data["info"]["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_cors_headers(async_client: AsyncClient):
    """CORS middleware should allow configured frontend origins like http://localhost:5173."""
    response = await async_client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert (
        response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    )


@pytest.mark.asyncio
async def test_http_exception_handler_format(async_client: AsyncClient):
    """HTTPException should return uniform format {detail, code}."""

    # Temporarily register a test route raising HTTPException
    @app.get("/api/test-http-error", include_in_schema=False)
    async def trigger_http_error():
        raise HTTPException(status_code=404, detail="Resource not found")

    response = await async_client.get("/api/test-http-error")
    assert response.status_code == 404
    data = response.json()
    assert data == {"detail": "Resource not found", "code": 404}


@pytest.mark.asyncio
async def test_unhandled_exception_handler_format(async_client: AsyncClient):
    """Unhandled exceptions should return uniform format {detail, code: 500}."""

    @app.get("/api/test-server-error", include_in_schema=False)
    async def trigger_server_error():
        raise RuntimeError("Unexpected server crash")

    response = await async_client.get("/api/test-server-error")
    assert response.status_code == 500
    data = response.json()
    assert data == {"detail": "Internal server error", "code": 500}
