#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/url-expiry-tracker}"
BRANCH="${BRANCH:-main}"

cd "$REPO_DIR"

echo "[deploy] fetching latest code for branch $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] rebuilding containers"
docker compose down
docker compose up -d --build

echo "[deploy] done"
