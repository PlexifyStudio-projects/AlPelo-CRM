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

echo "Starting API..."
if [ "$ENVIRONMENT" = "production" ]; then
  echo "Mode: Production (4 workers, proxy headers)"
  exec uvicorn main:app --host 0.0.0.0 --port 8000 \
    --workers 4 \
    --proxy-headers \
    --forwarded-allow-ips="*" \
    --log-level warning
else
  echo "Mode: Development (auto-reload enabled)"
  exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
fi
