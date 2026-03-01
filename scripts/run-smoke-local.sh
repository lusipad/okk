#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="output/dev-full.log"

npm run dev > "$LOG_FILE" &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
UI_URL=""
for ((i=0; i<180; i+=1)); do
  if curl -fsS "http://127.0.0.1:3000/healthz" >/dev/null; then
    for port in 5173 5174 5175 5176 5177; do
      if curl -fsS "http://127.0.0.1:${port}" >/dev/null; then
        UI_URL="http://127.0.0.1:${port}"
        break
      fi
    done
  fi
  if [[ -n "$UI_URL" ]]; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "dev servers not ready"
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

OKCLAW_UI_URL="$UI_URL" npm exec -- node scripts/smoke-e2e.mjs
