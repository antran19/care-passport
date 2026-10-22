#!/usr/bin/env bash
# scripts/test-api.sh — Run Care Passport backend security & policy test suite
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Running Care Passport Backend & Security Tests..."
npx -y tsx "$PROJECT_DIR/scripts/test-api.mjs"

