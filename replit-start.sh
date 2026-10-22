#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Preparing Liggy for Replit..."

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Add Node.js to the Replit environment, then run again." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to run the invoice agent. Add Python 3 to the Replit environment, then run again." >&2
  exit 1
fi

if [[ ! -d server/node_modules/@google-cloud/firestore ]]; then
  echo "Installing backend packages..."
  npm ci --prefix server
fi

if [[ ! -d client/node_modules ]]; then
  echo "Installing frontend packages..."
  npm ci --prefix client
fi

# Liggy's Vite config proxies browser /api requests to this local backend port.
export PORT=3001
export PYTHON_EXECUTABLE="${PYTHON_EXECUTABLE:-$(command -v python3)}"
export CLIENT_ORIGIN="${CLIENT_ORIGIN:-http://localhost:5000}"
# Use the system trust store, including the environment's trusted CA certificates.
# Python HTTP clients otherwise use certifi's separate bundle.
if [[ -z "${SSL_CERT_FILE:-}" && -f /etc/ssl/certs/ca-certificates.crt ]]; then
  export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
fi

npm start --prefix server &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Liggy API on internal port 3001 and website on port 5000..."
npm run dev --prefix client -- --host 0.0.0.0 --port 5000 --strictPort
