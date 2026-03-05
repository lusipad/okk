#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE="${1:-}"
if [[ "${STRICT_MODE}" == "--strict" ]]; then
  export OKK_PIXEL_REFERENCE_REQUIRED=1
  export OKK_PIXEL_REFERENCE_EXACT_DIMENSIONS=1
  echo "[pixel-gate] strict reference mode enabled"
fi

echo "[pixel-gate] frontend test/build"
npm run test -w @okk/web-frontend
npm run build -w @okk/web-frontend

echo "[pixel-gate] backend/core test/build"
npm run test -w @okk/web-backend
npm run build -w @okk/web-backend
npm run test -w @okk/core
npm run build -w @okk/core

echo "[pixel-gate] pixel audit/diff/report"
bash scripts/run-pixel-audit-local.sh
npm run ui:pixel:diff
npm run ui:pixel:reference-diff
npm run ui:pixel:report

echo "[pixel-gate] smoke e2e"
bash scripts/run-smoke-local.sh

echo "[pixel-gate] all checks passed"
