#!/usr/bin/env bash
# check-suiteloader-identity.sh
#
# CI byte-identity guard for SuiteLoader.tsx.
# Fails if this repo's copy diverges from the canonical reference hash.
#
# Canonical source: studio src/components/system/SuiteLoader.tsx
# Copy byte-identical to: tasks / roadmap / notes / analytics
# Rationale: DECISIONS.md D3 — "copied byte-identical to the other 4"
# Reference hash sealed at Phase 3.6 remediation (B5).
#
# Usage: bash scripts/check-suiteloader-identity.sh
# Wired via package.json "test" script so drift fails CI.

set -euo pipefail

CANONICAL_SHA="aaa5246e3daba6edd289dd4742e5faddf3698e1daa989e9b55bebf9d8175f789"
FILE="src/components/system/SuiteLoader.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Run from repo root." >&2
  exit 1
fi

# Portable SHA-256: macOS ships shasum, Linux ships sha256sum.
if command -v sha256sum &>/dev/null; then
  ACTUAL=$(sha256sum "$FILE" | awk '{print $1}')
elif command -v shasum &>/dev/null; then
  ACTUAL=$(shasum -a 256 "$FILE" | awk '{print $1}')
else
  echo "ERROR: neither sha256sum nor shasum found." >&2
  exit 1
fi

if [ "$ACTUAL" = "$CANONICAL_SHA" ]; then
  echo "OK: SuiteLoader.tsx is byte-identical to canonical reference."
  exit 0
else
  echo "FAIL: SuiteLoader.tsx has drifted from canonical reference." >&2
  echo "  Expected: $CANONICAL_SHA" >&2
  echo "  Actual:   $ACTUAL" >&2
  echo "  Fix: copy studio/src/components/system/SuiteLoader.tsx byte-identical to this repo." >&2
  exit 1
fi
