#!/usr/bin/env bash
# Optional Coordinator hook. Usage: publish-dashboard.sh <team-name>
# Refreshes only curated dashboard data from durable workspace summaries,
# rebuilds the isolated public/ export, and republishes the fixed Surge URL.
# A failure here must not alter a completed/evaluated harness run.
set -euo pipefail

TEAM_NAME="${1:?usage: publish-dashboard.sh <team-name>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

UVX_BIN="$(command -v uvx || true)"
if [ -z "$UVX_BIN" ]; then
  echo "dashboard hook: uvx not found" >&2
  exit 1
fi

"$UVX_BIN" fulcra-api file download "team/${TEAM_NAME}/status-summary.md" "$TMP/status-summary.md" >/dev/null
"$UVX_BIN" fulcra-api file download "team/${TEAM_NAME}/milestone-progress.md" "$TMP/milestone-progress.md" >/dev/null || : > "$TMP/milestone-progress.md"
python3 "$ROOT/refresh_dashboard.py" "$TMP/status-summary.md" "$TMP/milestone-progress.md"

mkdir -p "$ROOT/public/data"
cp "$ROOT/index.html" "$ROOT/app.js" "$ROOT/styles.css" "$ROOT/public/"
cp "$ROOT/data/dashboard-data.json" "$ROOT/public/data/"

# Publish only public/ -- never the raw workspace downloads, credentials,
# source repo metadata, or any other local data.
cd "$ROOT"
surge ./public game-night-harness-a3af0fa39468.surge.sh

# Keep the private dashboard source repo aligned with the deployed curated
# state. Stage only files the hook owns; never sweep in unrelated local work.
if [ -n "$(git -C "$ROOT" status --porcelain -- data/dashboard-data.json public)" ]; then
  git -C "$ROOT" add data/dashboard-data.json public
  git -C "$ROOT" commit -m "chore: refresh dashboard from ${TEAM_NAME} status summary"
  git -C "$ROOT" push origin main
fi
