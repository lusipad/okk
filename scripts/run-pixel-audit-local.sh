#!/usr/bin/env bash
set -euo pipefail

BACKEND_LOG="output/pixel/backend.log"
FRONTEND_LOG="output/pixel/frontend.log"
BACKEND_PORT="${OKCLAW_BACKEND_PORT:-3301}"
UI_PORT="${OKCLAW_UI_PORT:-5199}"
UI_URL="http://127.0.0.1:5199"
API_URL="http://127.0.0.1:${BACKEND_PORT}"
WS_URL="ws://127.0.0.1:${BACKEND_PORT}"

mkdir -p "output/pixel"

UI_URL="http://127.0.0.1:${UI_PORT}"

PORT="$BACKEND_PORT" npm run dev -w @okclaw/web-backend > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
VITE_API_BASE_URL="$API_URL" VITE_WS_BASE_URL="$WS_URL" \
  npm run dev -w @okclaw/web-frontend -- --port "$UI_PORT" > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
  kill "$FRONTEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
for ((i=0; i<240; i+=1)); do
  if curl -fsS "${API_URL}/healthz" >/dev/null && curl -fsS "$UI_URL" >/dev/null; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "pixel audit servers not ready"
  tail -n 80 "$BACKEND_LOG" || true
  tail -n 80 "$FRONTEND_LOG" || true
  exit 1
fi

OKCLAW_UI_URL="$UI_URL" npm run ui:pixel:audit
