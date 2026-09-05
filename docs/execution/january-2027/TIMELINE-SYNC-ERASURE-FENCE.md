# Timeline sync / erasure transaction boundary

Internal candidate follow-on to MODULE-REC-03. This record covers only
`syncMilestonesAction`; it does not assert that every Timeline writer is fenced.
No schema, provider, Tasks membership, account-deletion orchestration or Google
file operation changes are part of this patch.

## Failure and repair

The preserved actual-source pre-0001 interleave paused after inherited binding
validation, erased the owner, then resumed the null-lease node writer. The action
reported success and recreated one task with no owning workspace, even with FKs
on: the legacy tasks table has no parent FK. The bystander remained unchanged.

An additional bounded preparation probe reproduced both an orphan normalized
binding and an orphan lease row with FKs off. That probe used the actual
preparation helpers and eraser; it was not a whole-action proof. FKs on rejected
those two inserts. This observed variant justified guarding preparation too.

The action now uses two short local transactions separated by the external Tasks
read. Each transaction reads the current exact owner, workspace, selected child
project and canonical parent/child Tasks binding through its own executor.

- Preparation establishes any additive binding and takes a lease within the
  guarded transaction.
- Final application revalidates the target before CAS, before the unchanged
  digest shortcut, and before child-binding fill, node upsert, date history and
  reconciliation. The history's prior-date read uses the same executor.
- Missing or changed local targets return an unavailable, non-retryable result.
  A genuine newer generation still returns `superseded` without writing nodes.
- A null child can inherit the still-current exact parent. Pre-0001 sync remains
  supported; normalized helpers retain their existing optional-table behavior.
  Partial snapshots preserve omitted nodes and use the same target guard.

The optional executor parameters retain the previous default for provisioning
callers. No claim is made that provisioning or other direct writers acquired an
erasure fence through this change. Current Tasks membership remains checked by
the existing source/context path; this is not an across-store transaction.

## Reproducible validation and fixture boundary

New suite: `src/modules/timeline/server/sync/sync-erasure-regression.test.ts`.
Run from App with Node 22 or 24:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/modules/timeline/server/sync/sync-erasure-regression.test.ts
```

The suite uses the actual owning Timeline migration runner, or the actual
pre-0001 baseline SQL, with disposable file SQLite databases and two synthetic
owners. Actual action, queries, state helpers, target resolver and eraser run;
auth, external Tasks snapshots and framework/provider boundaries are injected.
FK mode is asserted inside every transaction. Global reads/writes during the
sync transaction fail the fixture, so executor escapes cannot silently pass.

The 27 cases cover valid current/null-child controls, FKs on/off, erasure during
source reads, paused after-binding null-lease writes, normalized binding/lease
preparation, owner/parent/child/project changes, unchanged digest, real CAS
supersession, partial preservation and late failure rollback including history.
The earlier 25-case version against immutable `efa8e1e4` passed five controls and
failed 20 assertions; the first archive attempt omitted `.gitattributes` and is
retained separately as a fixture setup failure. Passing old negative proofs
remain negative proofs; they have not been relabelled as fixed checks.

Erasure while a local writer owns the transaction returns a busy failure and
retains retry custody. The fixture verifies retry with a fresh connection after
the writer completes. In this libSQL version the connection whose BEGIN failed
can retain a pending native statement: same-connection busy recovery is not
proven here. No loop hides that failure. Every assertion is awaited and fixture
connections close; uniquely named synthetic temp files are retained because
Windows libSQL handles may outlive close.

The separate teardown-only change in `timeline-gdpr.test.ts` recognizes only
Windows EBUSY/EPERM on its exact owned synthetic directory or `timeline.db`, after
the awaited body and successful close. It preserves files; unexpected paths,
codes, platforms, close failures and assertion failures still fail.

## Integration boundaries

Principal owns package/default-suite registration. Add the new sync-erasure test
to the relevant Timeline/module-lifecycle suite; retain the three existing module
tests and the nearby generation, safety, binding and history suites. No package,
workflow or registry was edited here. Affected material runtime surfaces are the
existing Timeline editor refresh and server account-erasure path; no new page or
browser receipt is asserted.

Exact command receipts and the immutable candidate SHA are in the external
handoff package. Principal owns combined candidate review, receiving Linux/full
build checks and integration. This branch does not include principal's separate
Briefing catch-all fallback repair, and does not supersede its documentation.
