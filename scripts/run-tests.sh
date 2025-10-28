#!/usr/bin/env bash
#
# Test runner for deployment script BATS tests
# Checks for BATS installation and runs all test suites
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TESTS_DIR="${PROJECT_ROOT}/tests"

echo "=== Bunkercolab Deployment Script Tests ==="
echo

# Check for BATS
if ! command -v bats >/dev/null 2>&1; then
  echo "ERROR: BATS (Bash Automated Testing System) is not installed."
  echo
  echo "Install BATS:"
  echo "  macOS:         brew install bats-core"
  echo "  Ubuntu/Debian: sudo apt-get install bats"
  echo "  Manual:        https://github.com/bats-core/bats-core"
  echo
  exit 1
fi

BATS_VERSION=$(bats --version | head -n 1)
echo "✓ BATS found: $BATS_VERSION"
echo

# Check for test files
if [ ! -d "$TESTS_DIR" ] || [ -z "$(ls -A "$TESTS_DIR"/*.bats 2>/dev/null)" ]; then
  echo "ERROR: No test files found in $TESTS_DIR"
  exit 1
fi

TEST_FILES=$(find "$TESTS_DIR" -name "*.bats" | sort)
TEST_COUNT=$(echo "$TEST_FILES" | wc -l | tr -d ' ')

echo "Found $TEST_COUNT test suites:"
echo "$TEST_FILES" | sed 's/^/  - /'
echo

# Run tests
cd "$PROJECT_ROOT" || exit 1

echo "Running tests..."
echo "─────────────────────────────────────────────────"

if bats "$TESTS_DIR"/*.bats; then
  echo
  echo "─────────────────────────────────────────────────"
  echo "✓ All tests passed!"
  exit 0
else
  EXIT_CODE=$?
  echo
  echo "─────────────────────────────────────────────────"
  echo "✗ Tests failed (exit code: $EXIT_CODE)"
  exit "$EXIT_CODE"
fi
