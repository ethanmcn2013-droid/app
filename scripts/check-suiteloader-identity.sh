#!/usr/bin/env bash
# check-suiteloader-identity.sh
# Re-sealed 2026-07-02 (loading canon: boundary dot 10px, DESIGN.md S13).
# Hash computed over line-ending-NORMALIZED content (CR stripped).
set -euo pipefail
CANONICAL_SHA="d2a08019850e304f8218792436b9995cb8fa0d95effa010a101ce18ce3d6015e"
FILE="src/components/system/SuiteLoader.tsx"
if [ ! -f "$FILE" ]; then echo "ERROR: $FILE not found." >&2; exit 1; fi
if command -v sha256sum &>/dev/null; then
  ACTUAL=$(tr -d '\r' < "$FILE" | sha256sum | awk '{print $1}')
elif command -v shasum &>/dev/null; then
  ACTUAL=$(tr -d '\r' < "$FILE" | shasum -a 256 | awk '{print $1}')
else echo "ERROR: no sha tool." >&2; exit 1; fi
if [ "$ACTUAL" = "$CANONICAL_SHA" ]; then echo "OK"; exit 0; else echo "FAIL expected $CANONICAL_SHA got $ACTUAL" >&2; exit 1; fi