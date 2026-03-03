#!/usr/bin/env bash
set -euo pipefail

echo "[pixel-gate] frontend test/build"
npm run test -w @okclaw/web-frontend
npm run build -w @okclaw/web-frontend

echo "[pixel-gate] backend/core test/build"
npm run test -w @okclaw/web-backend
npm run build -w @okclaw/web-backend
npm run test -w @okclaw/core
npm run build -w @okclaw/core

echo "[pixel-gate] pixel audit/diff/report"
bash scripts/run-pixel-audit-local.sh
npm run ui:pixel:diff
npm run ui:pixel:reference-diff
npm run ui:pixel:report

echo "[pixel-gate] smoke e2e"
bash scripts/run-smoke-local.sh

echo "[pixel-gate] all checks passed"
