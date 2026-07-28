#!/usr/bin/env bash
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Loading seed data (idempotent)..."
python manage.py seed_budget

echo "Starting uvicorn (ASGI) on :8000..."
exec uvicorn config.asgi:application --host 0.0.0.0 --port 8000
