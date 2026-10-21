# Independent receipt rebind review — composed Ping capture

Reviewer: `/root/r2_independent_review`  
Date: 21 October 2026  
Decision: **Approve the five capture-evidence field updates only.**

The preparation matrix is `receipt-refresh-matrix-final.json` (SHA-256 `dbae098fbefc5833d58e1ff6b0e997e1e5e799070b8ad7559cc975752d6bd18a`). I verified its attestation and raw-evidence file hashes against the downloaded hosted artifact and confirmed the candidate commit and tree match the review target. The capture has 188 tests, 188 passes, and zero unexpected outcomes.

The matrix selects exactly the 18 receipt paths currently named by the candidate registry: 17 Files Sources Shelf receipts and the Ping app-messages receipt. All 18 source/materiality bindings and prior-attestation hashes match. All 72 case/project tuples were compared with the fresh attestation; each case title maps exactly and there are zero tuple differences. The actual receipt review identity, date, decision, reviewed-change text, and coverage-field absence match the matrix and remain unchanged.

Only these fields are approved to be mechanically rebound inside each receipt's `playwrightEvidence` object:

- `attestationPath`
- `attestationSha256`
- `runId`
- `canonicalEvidenceSha256`
- `rawArtifactSha256`

Keep every other receipt field and all registry source/materiality fields unchanged. Preserve missing coverage as missing; do not add coverage or change review judgments. Files dedicated-operator evidence is outside this comparison and remains a separate gate. This is a receipt-binding decision only, not model evaluation, production receiving, or release acceptance.

Machine-readable decision: `independent-review.json`.