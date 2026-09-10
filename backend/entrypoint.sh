#!/bin/sh
set -e

echo "Applying database migrations to 'sharink' schema..."
alembic upgrade head

if [ "$ENV" = "dev" ]; then
    echo "Seeding initial development data (idempotent)..."
    python -m app.seed || echo "Seed skipped or already applied"
fi

PORT="${PORT:-8000}"
echo "Starting Uvicorn server on port $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
