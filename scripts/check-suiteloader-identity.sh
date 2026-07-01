#!/usr/bin/env bash
# check-suiteloader-identity.sh
#
# CI byte-identity guard for SuiteLoader.tsx.
# Fails if this repo's copy diverges from the canonical reference hash.
#
# Canonical source: studio src/components/system/SuiteLoader.tsx
# Copy byte-identical to: tasks / roadmap / notes / analytics
# Rationale: DECISIONS.md D3 — "copied byte-identical to the other 4"
#
# The hash is computed over line-ending-NORMALIZED content (CR stripped).
# Git stores the file with LF but checks it out with CRLF on Windows, so
# a raw byte hash can never match on both a Windows working copy and a
# Linux CI runner — the original seal was taken from a CRLF checkout and
# failed on every CI run. Normalizing first makes the guard test what it
# means to test (the code), not the platform's line endings.
# Re-sealed 2026-07-01 from git blob 1d2dc6760dce997823401f655e4fd32fcc13acf5,
# identical across all five suite repos at the time of sealing.
#
# Usage: bash scripts/check-suiteloader-identity.sh
# Wired via package.json "test" script so drift fails CI.

set -euo pipefail

CANONICAL_SHA="19c43b0315a719804900a3fd8c154a979abff45edc69ab48039be4bacaf947fe"
FILE="src/components/system/SuiteLoader.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Run from repo root." >&2
  exit 1
fi

# Portable SHA-256: macOS ships shasum, Linux ships sha256sum.
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
  echo "FAIL: SuiteLoader.tsx has drifted from canonical reference." >&2
  echo "  Expected: $CANONICAL_SHA" >&2
  echo "  Actual:   $ACTUAL" >&2
  echo "  Fix: copy studio/src/components/system/SuiteLoader.tsx byte-identical to this repo." >&2
  exit 1
fi
