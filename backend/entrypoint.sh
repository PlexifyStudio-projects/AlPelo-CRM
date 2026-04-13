#!/bin/bash

echo "=== AlPelo Backend ==="
echo "Environment: ${ENVIRONMENT:-development}"

if [ "$WAIT_FOR_DB" = "true" ]; then
  echo "Waiting for PostgreSQL..."
  export PGPASSWORD="$POSTGRES_PASSWORD"

  until psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' > /dev/null 2>&1; do
    sleep 2
  done
  echo "PostgreSQL ready"
fi

APP_PORT="${PORT:-8000}"
echo "Starting API on port $APP_PORT..."
if [ "$ENVIRONMENT" = "production" ]; then
  echo "Mode: Production (1 worker, debug startup)"
  exec uvicorn main:app --host 0.0.0.0 --port "$APP_PORT" \
    --workers 1 \
    --proxy-headers \
    --forwarded-allow-ips="*" \
    --log-level info
else
  echo "Mode: Development (auto-reload enabled)"
  exec uvicorn main:app --host 0.0.0.0 --port "$APP_PORT" --reload
fi
