# Bounded ledger proof review

Reviewed immutable commit `3d8a36e14b1fb58142cb898b6115ad7bf404a36e` against parent `ac9321a2144619d2e5c0cc9c439576e168aae51d` on 4 September 2026. No actionable regression found in the proof-timing change. This is a bounded local review, not production or combined-release acceptance.

The only runtime change is the `0017_resources` continuous-proof allowlist. It excludes exactly `backfill-upload-count-matches-attachments`; table presence, both resource indexes, integrity and foreign keys remain checked. The SQL migration, original receipt, its six proofs, runner and validator are unchanged. Both fresh bootstrap and pending-forward execution pass all original proofs to the existing atomic write before committing ledger/high-water metadata. Status and migration no-op use the continuous subset only after validating the recorded migration and receipt identities.

The equality counts every upload resource against legacy attachments. It is valid immediately after backfill and invalid once normal uploads create resources without attachments. Removing that equality from continuous checks corrects its lifetime; it does not disable the original migration gate.

## Verification

All execution used a `git archive` snapshot of the exact commit under this task's `work/ledger-proof-review/source`. Databases were in-memory or disposable local fixtures. No source repository, real database, provider or production state was changed.

- Existing migration contract: passed; Tasks 30 SQL files and Timeline 2 SQL files.
- Existing database contract suite: **64 passed, 0 failed**.
- Four additional disposable review tests: **4 passed, 0 failed**. They verified populated legacy identity preservation; reproduced the parent failure after a new upload and the corrected status/no-op; omitted the actual backfill INSERT while retaining the real proof SQL and verified rollback of the table, exact ledger row and high-water row, followed by successful retry; checked both index-drop failures; and checked foreign-key damage still rejects status and no-op.
- Git diff confirmed immutable SQL/receipts and migration runner/validator are unchanged.

The initial supplemental fault-injection harness accidentally left a comment-only SQL statement, producing a libSQL parse error. Removing that entire statement corrected the harness; the final test exercised and identified the real count-proof failure. No repository repair was needed.

Receipts: [contract](ledger-proof-review/contract-static.txt), [64 tests](ledger-proof-review/db-contract.txt), [4 supplemental tests](ledger-proof-review/supplement.txt), [supplemental test source](ledger-proof-review/ledger-review-supplement.test.mjs).

## Limits

This review did not rerun the lead's populated backup/restore rehearsal or inspect its private data. It does not assert Linux CI, live-provider behavior, full combined App acceptance or a new independent review of upload recovery. The two other documentation reports bundled in this commit were outside this ledger review. Existing proof granularity and application authorization were not redesigned or exhaustively rescanned.

## Upload handoff and LFS correction

Upload commit `3caf63566a69f7eae5ed16e67b384639848ccaa7` is complete; its task worktree remained clean at recheck. The lead reports it merged into core. The [upload receipt](drive-upload-recovery/handoff.md) records its 81 UI/recovery tests, 85 earlier regression tests, final type/lint/static checks and four-width synthetic browser evidence. Live Google, authenticated recovery end-to-end, full combined CI and general byte resumption are not claimed.

The five PNGs total **370,983 bytes** (45,178–91,343 bytes each). Root `AGENTS.md` says, “Bulk rounds, screenshots and videos belong in Git LFS or stable external artifact storage.” I applied that storage guidance to this small evidence set without sufficient consideration of the repository's existing ordinary PNG practice and checkout configuration. There is no image-size or runtime requirement for LFS here. The lead's explicit preference for ordinary tracked PNGs takes precedence. The first narrow LFS rule introduced unnecessary hook and checkout handling; ordinary PNGs are the better correction. No lead files, hooks or Git configuration were modified during this review.
