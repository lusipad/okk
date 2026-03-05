#!/usr/bin/env bash
set -euo pipefail

FRONTEND_LOG="output/playwright/chrome-compare/frontend.log"
UI_PORT="${OKK_UI_PORT:-5201}"
UI_URL="http://127.0.0.1:${UI_PORT}"

mkdir -p "output/playwright/chrome-compare"

npm run dev -w @okk/web-frontend -- --port "$UI_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

sleep 1
if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
  echo "chrome compare frontend failed to start"
  tail -n 80 "$FRONTEND_LOG" || true
  exit 1
fi

cleanup() {
  kill "$FRONTEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
for ((i=0; i<240; i+=1)); do
  if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    echo "chrome compare frontend exited before ready"
    tail -n 80 "$FRONTEND_LOG" || true
    exit 1
  fi
  if curl -fsS "$UI_URL" >/dev/null; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "chrome compare frontend not ready"
  tail -n 80 "$FRONTEND_LOG" || true
  exit 1
fi

export OKK_UI_URL="$UI_URL"
export OKK_COMPARE_FAIL_ON_ANY=0
npm run ui:chrome:compare
