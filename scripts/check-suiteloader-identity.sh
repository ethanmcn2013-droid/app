#!/usr/bin/env bash
# check-suiteloader-identity.sh
#
# CI byte-identity guard for SuiteLoader.tsx.
# Canonical source: studio src/components/system/SuiteLoader.tsx
# Re-sealed 2026-07-02 (loading canon: boundary dot 10px, DESIGN.md S13).
#
# The hash is computed over line-ending-NORMALIZED content (CR stripped).

set -euo pipefail

CANONICAL_SHA="c727838a56e61617d08f5a69c88ad9c6b8667d04c27622923030c39b26be3008"
FILE="src/components/system/SuiteLoader.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found." >&2
  exit 1
fi

if command -v sha256sum &>/dev/null; then
  ACTUAL=$(tr -d '\r' < "$FILE" | sha256sum | awk '{print $1}')
elif command -v shasum &>/dev/null; then
  ACTUAL=$(tr -d '\r' < "$FILE" | shasum -a 256 | awk '{print $1}')
else
  echo "ERROR: neither sha256sum nor shasum found." >&2
  exit 1
fi

if [ "$ACTUAL" = "$CANONICAL_SHA" ]; then
  echo "OK: SuiteLoader.tsx is byte-identical to canonical reference."
  exit 0
else
  echo "FAIL: SuiteLoader.tsx has drifted." >&2
  echo "  Expected: $CANONICAL_SHA" >&2
  echo "  Actual:   $ACTUAL" >&2
  exit 1
fi