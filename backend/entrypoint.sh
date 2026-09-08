#!/bin/sh
set -e

echo "Applying database migrations..."
alembic upgrade head

echo "Seeding initial development data (idempotent)..."
python -m app.seed || echo "Seed skipped or already applied"

echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
