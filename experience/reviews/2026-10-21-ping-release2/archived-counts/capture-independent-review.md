# Independent decision: archived-count capture receipt rebind

Date: 2026-10-21
Reviewer: `/root/r2_independent_review`

## Decision

**Approved for the exact five-field mechanical rebind only** for the 18 receipts in `receipt-refresh-matrix-final.json` (SHA256 `a5c7f8d8bbf07a9bd4f77533fca60c207e80fa528e1bf9b16642e5d224124b3f`). The only fields eligible for refresh are `attestationPath`, `attestationSha256`, `runId`, `canonicalEvidenceSha256`, and `rawArtifactSha256`.

The fresh canonical run `tasks-playwright-924697ff8bfadcb2a9725679` is bound to candidate `481c7da111cbe8fcda3b98f1d4f3dbe335e17696`, artifact `12384344275` (digest `sha256:d43dfc3a14e01c62a7cd5125e3396ac8fdf8bb64934aacbf40efec5d3b0c10c1`). I independently hashed the downloaded attestation and raw evidence against the matrix, confirmed their run and manifest bindings, and compared all 72 case/project result tuples. The attestation has 188 outcomes, all expected, with zero unexpected outcomes or errors.

I checked the actual current workspace receipts and registry against the matrix. All 18 receipts retain their old evidence binding and materiality, reviewer, review date, reviewed-change text, decision and coverage presence/absence. The complete registry hash matches the matrix. The matrix records all 18 source hashes unchanged and all 72 prior/current tuples equal. No receipt or registry file had been changed during matrix preparation.

Any refresh must preserve every non-evidence field exactly. This is an evidence relink only; it does not create a new source/design review, promote coverage, change the Ping score, or constitute product/release acceptance. No repository or receipt edits were made by this reviewer.