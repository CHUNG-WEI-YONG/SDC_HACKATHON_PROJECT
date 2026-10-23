#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-development}"
if [[ "$MODE" != "development" && "$MODE" != "production" ]]; then
  echo "Usage: $0 [development|production]" >&2
  exit 2
fi

echo "Preparing Liggy for Replit..."

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Add Node.js to the Replit environment, then run again." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to run the invoice agent. Add Python 3 to the Replit environment, then run again." >&2
  exit 1
fi

if [[ ! -d src/server/node_modules/@google-cloud/firestore ]]; then
  echo "Installing backend packages..."
  npm ci --prefix src/server
fi

if [[ ! -d src/client/node_modules ]]; then
  echo "Installing frontend packages..."
  npm ci --prefix src/client
fi

export PYTHON_EXECUTABLE="${PYTHON_EXECUTABLE:-$(command -v python3)}"
# Use the system trust store, including the environment's trusted CA certificates.
# Python HTTP clients otherwise use certifi's separate bundle.
if [[ -z "${SSL_CERT_FILE:-}" && -f /etc/ssl/certs/ca-certificates.crt ]]; then
  export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
fi

if [[ "$MODE" == "production" ]]; then
  if [[ ! -f src/client/dist/index.html ]]; then
    echo "Production client build is missing. Run bash ./replit-build.sh before starting production." >&2
    exit 1
  fi

  export NODE_ENV=production
  export PORT="${PORT:-5000}"
  echo "Starting Liggy website and API in production mode on port ${PORT}..."
  exec node src/server/index.js
fi

# The Vite development server proxies /api requests to this local backend port.
export PORT=3001
export CLIENT_ORIGIN="${CLIENT_ORIGIN:-http://localhost:5000}"

node src/server/index.js &
SERVER_PID=$!
./src/client/node_modules/.bin/vite ./src/client --host 0.0.0.0 --port 5000 --strictPort &
CLIENT_PID=$!

cleanup() {
  trap - EXIT INT TERM
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  wait "$CLIENT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Liggy development API on port 3001 and Vite on port 5000..."

# Neither service is optional in development: stop the other and preserve the
# first child's exit status if either one exits unexpectedly.
set +e
wait -n "$SERVER_PID" "$CLIENT_PID"
STATUS=$?
set -e
if kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Vite development server stopped unexpectedly." >&2
else
  echo "Liggy API server stopped unexpectedly." >&2
fi
exit "$STATUS"
