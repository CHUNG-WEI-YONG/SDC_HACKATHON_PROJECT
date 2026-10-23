#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

command -v npm >/dev/null 2>&1 || {
  echo "npm is required to build Liggy." >&2
  exit 1
}

echo "Installing production server and client dependencies..."
npm ci --prefix server
npm ci --prefix client

echo "Building Liggy client..."
npm run build --prefix client
