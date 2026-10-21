# Ping Release 2 canonical experience evidence

This folder retains compact provenance and review material; large raw browser outputs and trace artifacts live outside the repository under `D:\Codex-scratch\project-ping\release2-proof-oct21`.

## Historical capture (superseded by the final Chat identity correction)

- Run ID: `tasks-playwright-4da6219e5a70697f23901917`
- Result: 188/188 passed, but this predates the final Chat identity fix and is historical only.
- Raw report path and SHA256: see `historical-capture-index.json`; digest `9c594cd1e3e9e67443292edbf431e278d153fd09e1e5420d2202112267134969`.
- Historical attestation: `experience/evidence-runs/tasks-playwright-4da6219e5a70697f23901917-9c594cd1e3e9e674.json`.
- The test setup captures screenshots on failure only; this passing run has no rendered success screenshots.

## Aborted attempt

A run was deliberately stopped at 24/188 so the final identity fix could be applied before the UI freeze. It produced no canonical report or attestation. Its 1,133 per-test artifacts are preserved externally; see `aborted-run-archive.json` for the absolute path and sorted-file integrity hash.

## Current final candidate capture

- Run ID: `tasks-playwright-1f4724792bd3db9cde25f4f8`
- Result: 188/188 Playwright cases passed across mobile, tablet, desktop and wide.
- Attestation: `experience/evidence-runs/tasks-playwright-1f4724792bd3db9cde25f4f8-2f7d16e3929ee02f.json`.
- Raw report SHA256: `2f7d16e3929ee02fba5a2a5294f5c51d809cb170626adabe769d1ade5d54d091`; external copy path is in `final-capture-index.json`.
- Manifest SHA256: `b33f9894bef03495afc569ed2769d670c0b3e251c0b8b4afd1dde5db47bfaf33`.
- The full `experience:test` command reached receipt verification and failed because an existing materiality receipt still references the prior manifest. This does not change the 188/188 Playwright result or its attestation. The receipt must be replaced only after independent review.
- Successful runs capture screenshots only on failure, so this all-pass run has no success screenshots.

The source inventory includes 13 previously stale inputs, 16 new Release 2 source files, and 3 final identity corrections. The approved Ping `sourceReviewedAt: 2026-10-18` remains unchanged. Independent review is still required for app-messages/Ping materiality and must not be inferred from browser test results.
