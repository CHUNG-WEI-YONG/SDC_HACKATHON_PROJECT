#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Use the checked-in lockfile and Replit's managed Python environment.
# Never create a virtual environment or modify the Firestore database here.
poetry install --no-root --no-interaction --no-ansi
bash ./replit-build.sh
