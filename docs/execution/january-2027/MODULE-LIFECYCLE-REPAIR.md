# Module lifecycle repair

Base: App `77d22a6bdbe6764da53daf1159049eef58fc523d`. This bounded repair follows the separate immutable App182935f7 module recovery proof; it does not rewrite that proof or treat its passing negative reproductions as fixes. Principal delegated the compatibility decisions below after the fresh read-only boundary investigation. These are delegated implementation decisions, not founder-selected design or production approval.

Ownership is limited to Notes extract identity authorization, Briefing's planning catalog, Timeline local erasure, and scoped regressions/docs. No Tasks My Work/page/selector, Studio, migration, provider, account-start fence or cross-store orchestration changes.

## Notes immutable identity — candidate

Both signed Notes v1/v2 receivers pass `assertion.sub` to `resolveNotesExtractAccess`. That subject is now joined through `users.clerk_id` to the local membership id in the same current-membership query. Receipt identity remains `${immutableSubject}:${noteId}`. There is no email, raw-local-ID fallback or provisioning. The same destination predicate and opaque 401 remain ahead of receipt/metadata reads.

The new actual-route SQLite regression initially failed four cases: both versions refused a legitimate unequal local/Clerk mapping (401 instead of 200), and both accepted a foreign membership whose local id collided with the signed subject (200 instead of 401). After the candidate, both routes accept the rightful legacy and normal identities, reconcile a lost response to one task, reject changed V2 wording and tampered claims, and deny unknown/colliding/removed subjects without metadata. FKs are on; the two synthetic actors intentionally share an email so email cannot grant access. Existing direct-helper tests now pass the immutable subject just as real callers do.

Commands from the task worktree (Node 24, isolated environment; no operational env files):

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/notes-extract-identity.test.ts src/server/security-membership-regression.test.ts src/server/notes-extract-idempotency.test.ts src/server/notes-extract-contract.test.mjs src/server/cross-product-assertion.test.ts
```

`src/server/notes-extract-identity.test.ts` is a new mandatory focused regression file; package/workflow registration remains with the principal. The old default suite already covers the three updated neighboring tests. Final verification and fresh candidate review are pending; this document does not yet claim `fixed`.

Candidate checks: all 23 tests in the command above passed, as did `node node_modules/typescript/bin/tsc --noEmit --incremental false` and scoped ESLint on the four changed/new Notes source/test files. Red and green logs are retained in the task's `outputs/january-module-lifecycle` handoff.

## Briefing loose projects — candidate

The actual catalog now uses a left join with an explicit admission rule: the project is active and either has a null period reference or references a present active period. Invalid period metadata stays excluded. No union with the predecessor catalog is used; that predecessor still includes archived projects and remains only the existing unavailable-schema fallback. The 200-project bound, immutable actor mapping, owner/member semantics and exact-request refusal remain.

Four new actual-SQL regressions failed before the patch, including the real non-demo briefing builder returning `no-workspace` for an authorized loose project. They now pass against the owning Tasks SQL fixture and Signal baseline, with DB/config boundaries replaced and real catalog, adapter, briefing engine and read-state queries. Tests cover two actors with unequal local/Clerk ids and shared email, grouped/loose owner/member projects, archive exclusions, a deliberately injected dangling reference, the 200 bound, membership removal, and a foreign/removed explicit request refusing to use the valid saved project. The corruption test intentionally injects one FK violation before restoring FK enforcement; ordinary fixtures remain FK-clean.

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/modules/signal/lib/planning-periods/scope.test.ts src/modules/signal/server/briefing/signal-build-for-user.test.ts src/modules/signal/signal-suite-context.test.ts
```

All 7 focused tests passed. New registration for the principal: `src/modules/signal/lib/planning-periods/scope.test.ts`. No package/workflow edits are included.

## Remaining authorized slice and compatibility

- Briefing: add only genuinely loose active authorized projects (`w.planning_period_id IS NULL`). Preserve the exclusion of archived periods and dangling non-null references, the 200-row bound and exact-request refusal. Do not reinterpret an invalid link as loose or union the stale predecessor catalog. Archived-period usability remains separate policy scope.
- Timeline: select owned workspaces by exact Clerk identity inside one local transaction; collect IDs and sweep every owned child in that transaction. Remove sync state before all binding states, then restricted projects/workspaces. Preserve explicit cleanup with FKs off, pre-0001 compatibility through an exact table-absence check, and operational failure as failure. No Google files or provider operations belong in this eraser.
- Both authenticated POST and verified `user.deleted` orchestration retain the existing begin-account-deletion fence. Other modules/Tasks still run after a Timeline failure, and the existing aggregate failure blocks completion. Local rollback does not imply cross-store atomicity or fencing every possible concurrent writer.

A fresh principal-owned bypass/regression review receives the finding and candidate diff after focused checks, before final verification/integration. Each coherent slice is committed separately; no push or merge is authorized here.
