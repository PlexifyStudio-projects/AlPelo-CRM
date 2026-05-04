#!/bin/bash
set -e

echo "=== AlPelo Backend ==="
echo "Environment: ${ENVIRONMENT:-development}"

# ---------------------------------------------------------------------------
# Optional Postgres wait
# ---------------------------------------------------------------------------
if [ "$WAIT_FOR_DB" = "true" ]; then
  echo "Waiting for PostgreSQL..."
  export PGPASSWORD="$POSTGRES_PASSWORD"
  until psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' > /dev/null 2>&1; do
    sleep 2
  done
  echo "PostgreSQL ready"
fi

# ---------------------------------------------------------------------------
# Start the embedded WhatsApp Web (Baileys) Node service.
# It binds to 127.0.0.1 only, so it is NOT reachable from outside the container.
# Python talks to it via http://127.0.0.1:3100 — fully internal.
# ---------------------------------------------------------------------------
WAWEB_DIR="/app/wa-web-service"
if [ -f "$WAWEB_DIR/src/index.js" ]; then
  export WA_WEB_PORT="${WA_WEB_PORT:-3100}"
  export WA_WEB_BIND="${WA_WEB_BIND:-127.0.0.1}"
  export SESSIONS_DIR="${SESSIONS_DIR:-/app/sessions}"

  # If no shared token was provided, derive a per-runtime random one. Both
  # processes share the same env so they agree without exposing it externally.
  if [ -z "$WA_WEB_SERVICE_TOKEN" ]; then
    export WA_WEB_SERVICE_TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    echo "[wa-web] generated runtime token (32 bytes)"
  fi

  # Default the Python-side URL to localhost. Can be overridden via env if needed.
  if [ -z "$WA_WEB_SERVICE_URL" ]; then
    export WA_WEB_SERVICE_URL="http://127.0.0.1:${WA_WEB_PORT}"
  fi

  echo "[wa-web] starting Node service on ${WA_WEB_BIND}:${WA_WEB_PORT}..."
  (cd "$WAWEB_DIR" && PORT="$WA_WEB_PORT" BIND_HOST="$WA_WEB_BIND" node src/index.js > /tmp/wa-web.log 2>&1) &
  WA_WEB_PID=$!
  echo "[wa-web] pid=$WA_WEB_PID — logs at /tmp/wa-web.log"

  # Trap so we don't leave zombies if uvicorn dies
  trap "echo '[entrypoint] shutting down...'; kill $WA_WEB_PID 2>/dev/null; exit 0" SIGTERM SIGINT
else
  echo "[wa-web] service not bundled in this image (skipping)"
fi

# ---------------------------------------------------------------------------
# Start uvicorn (foreground / PID 1)
# ---------------------------------------------------------------------------
APP_PORT="${PORT:-8000}"
echo "Starting API on port $APP_PORT..."
if [ "$ENVIRONMENT" = "production" ]; then
  echo "Mode: Production (2 workers, proxy headers)"
  exec uvicorn main:app --host 0.0.0.0 --port "$APP_PORT" \
    --workers 2 \
    --proxy-headers \
    --forwarded-allow-ips="*" \
    --log-level warning
else
  echo "Mode: Development (auto-reload enabled)"
  exec uvicorn main:app --host 0.0.0.0 --port "$APP_PORT" --reload
fi
