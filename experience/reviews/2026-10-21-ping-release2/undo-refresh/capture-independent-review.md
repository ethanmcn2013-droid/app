# Independent decision: Undo-refresh capture receipt rebind

Date: 2026-10-21
Reviewer: `/root/r2_independent_review`

## Decision

**Approved for the exact mechanical rebind of five Playwright evidence fields only** on the 18 receipts in `receipt-refresh-matrix-final.json` (SHA256 `e7921a27da86dfea3c27d30b907adf527afe5bdcfc0f59c0e7a34106414814de`). The allowed fields are `attestationPath`, `attestationSha256`, `runId`, `canonicalEvidenceSha256`, and `rawArtifactSha256`.

The fresh candidate run is `tasks-playwright-d775549c648bb865e05bddaf`, bound to commit `a1bbfa1daab3b70d735c722600350bb561c0c1ac`, artifact `12381162598` (digest `sha256:73fc28d15cb00ae9b90a4373b3ee271f28a4ac13d766eb69875affd921c6fd1c`). I verified the downloaded attestation and raw evidence SHA256 values against the matrix; run IDs and canonical evidence digests match, and the raw report records 188 expected, zero unexpected, and no errors. I independently compared the 72 (18 cases × 4 viewport projects) outcome tuples; all match the prior accepted tuples.

I also checked the current 18 receipt files and registry against the matrix: every receipt still has its prior evidence binding, materiality, reviewer, review date, and decision; all current registry materiality hashes match. The only registry materiality change is the explicitly permitted Ping hash update for the unreviewed Ping source. This refresh does not create a new review, change coverage, or make a product/release acceptance decision. Ping's recorded review date remains historical.

The rebind must preserve all other receipt and registry fields exactly. No receipt or registry edits were made by this reviewer.