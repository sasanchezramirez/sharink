# Stage 1: Dependency builder
FROM python:3.12-slim AS builder

WORKDIR /app

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_CREATE=true \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir "poetry>=2.0,<3.0"

COPY pyproject.toml poetry.lock ./

RUN poetry install --no-root --without dev

# Stage 2: Runtime image
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

# Create non-root system user and group
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/sh -m appuser

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy migration configuration, entrypoint, and application source
COPY alembic.ini entrypoint.sh ./
COPY migrations ./migrations
COPY app ./app

RUN chmod +x /app/entrypoint.sh && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
