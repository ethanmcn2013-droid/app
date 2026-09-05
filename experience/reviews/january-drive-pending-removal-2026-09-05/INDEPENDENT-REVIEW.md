# Drive pending-removal projection — independent review

**Scoped PASS: no actionable defect reproduced in the new named-permission pending-count/notice projection.** Reviewed runtime **1ac3d2335b68a02594f4e8c68793a962090f9579** against **3be4ea9623acda261e47fe330e40e223d9a1671d**. Inspected sealed author evidence **ce25e4ef480de6069713d3f53ae621b1d9fbc00a** after the source checks. Date2026-09-05; independent Windows/Node22.23.2, isolated actual SQLite and React SSR. No author/principal edits or browser/server/provider actions.

## Mechanism and wording

- `src/server/connections/project-drive-ui-status.ts:80–96`: the grouped query joins both storage-generation ID and Project ID, additionally filters both tables to the authorized Project, and includes only `revoke_pending=1`. A foreign Project sharing the same provider connection/folder object does not contribute. Mismatched and orphan generations are excluded. Current and multiple retired generations aggregate separately.
- The query runs after the live-permission attempt, including its caught failure. New pending intent and retirement during that attempt are reflected by the later query. A failing receipt read rejects the status; it never becomes a zero-count success.
- `src/components/app/settings/sections/connections-view.tsx:53–58`: the separate notice says removal is **unconfirmed** and people **may** retain access. Current/previous copy follows the corresponding count. It does not identify a historical grantee, promise repair/retry timing, claim completed revocation, or turn receipt custody into live Google permission evidence. This is truthful for the named-user folder-grant queue in the selected Project.
- Existing exact live-email matching, access labels, timestamp invalidation and personal OAuth state remain independent. Changing or removing a member does not hide their generic pending custody count or assign their old email's permission to today's roster. Clearing pending custody removes only this notice on a new read; a still-live writer remains “Can edit.”
- The added DTO contains only two nonnegative integer counts. No permission, generation, connection or raw provider-error fields were added. The pre-existing vetted `https://drive.google.com/drive/folders/...` UI link remains an intentional DTO field; this review does not misstate that as eliminating every provider-derived URL.

The unchanged production caller `src/server/actions/project-drive-status.ts:7–27` retains review/flag-off early return, explicit management authorization before and after the read, and generic unavailable results. `connections.tsx` refreshes through that action and mounts by exact Project. These are source observations; the independent service fixture deliberately supplies a synthetic authorization proof and does not execute Clerk or the real action minter.

## Fresh executable evidence

Exact executable, argument arrays, UTC times, cwd, exit and logSHA are in each named JSON receipt. Scratch source is a Git archive of1ac; original seven inputs were checked against Git after testing. Dependencies were reused read-only; no environment/provider configuration was copied. A network-denial preload and task-local temp directories were used.

| Receipt | Result |
|---|---|
| `authored-status` | **26/26, exit0**: actual committed status SQLite/SSR tests plus retained follow-up components. |
| `independent-pending` | **5/5, exit0**: multi-generation totals/live clock independence; OAuth/provider failure plus retirement/no-current reload; shared provider-object foreign Project and corrupt/orphan controls; changed/removed roster; minimal DTO and vetted-link control. |
| `parent-counterexample` | **0/1, exit1**, retained expected failure: actual3be reader/view hide the pending notice during failed Google read. |
| `candidate-notice-control` | **1/1, exit0**: same witness with only reader/view imports switched to1ac. |

Normal synthetic fixtures enable FK after applying the repository's existing core migration helper, and check FK/integrity. The deliberate mismatched/orphan-generation fixture uses FKoff and still checks integrity. This is real SQLite persistence, not mocked query results. It is not a fresh full migration-ledger acceptance claim.

Commands from `work/drive-1ac-review/source`, using the exact Node path recorded in the receipts:

```sh
node --import ../deny-network.mjs --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/connections/project-drive-ui-status.test.ts src/lib/project-drive-follow-up.test.tsx
node --import ../deny-network.mjs --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 independent-pending.test.ts
node --import ../deny-network.mjs --import tsx --import ./src/test/register-server-only.mjs --test parent-notice-counterexample.test.ts
node --import ../deny-network.mjs --import tsx --import ./src/test/register-server-only.mjs --test candidate-notice-control.test.ts
```

The Python launcher prints receipts even for a failing child; the recorded `exitCode` is authoritative. The parent failure was not translated into a pass.

## Sealed author rendering, inspected without a new browser

`sealed-evidence-verification.json` verifies the195-entry archive's complete index, byte lengths, hashes and CRCs. Archive/LFS SHA256: **17839e256005aefca9b81d0e93d406567c0358d32efa93f8a52bfe804d0ba572**,6,022,813bytes. Thirteen archived source files match exact1ac Git bytes; declared loaded-file hashes match the unchanged author files and normalize to those same Git bytes. The stored DTO-data and server bundles match their recorded hashes. All23 archived style assets match their receipts. Runtime/schema/package remain unchanged between1ac andce25.

The saved capture receipt records **46/46 cases,42 static remounts,4 interaction cases,52 screenshots**, no reported browser errors/external requests, and no measured horizontal overflow. The existing27af owning archive Git blob remains unchanged; the old runnable client's only compatibility change adds explicit zero DTO counts. Both the original before-state and author's first fixture failure are retained.

Inspected saved images: current390light, unavailable-both390dark, previous-only/no-current768light, both1440light (`selected-author-images/`). The notice remains readable in its own panel, distinguishes current/previous folders, and unavailable access has no checked timestamp or named live-permission claims. Four saved images were visually inspected; this is not a claim to have manually inspected all52 or rerun the browser matrix.

These are actual Connections components with saved actual-SQLite DTOs, synthetic action/connection/permission ports and an explicit fixture frame. The author reuses styles from the prior normal8172364e build; **there is no new full Next build at1ac**. Browser reload/remount coverage is authored fixture evidence, not a production route/Clerk/provider test. The author's saved stop receipt records its4499 server stopped; this reviewer launched no server.

A reviewer artifact-check preparation failure is preserved in `evidence-audit-first-failure.txt`: the first checker incorrectly compared archived Git bytes to the distinct loaded-file hash. The corrected checker verifies each separately, including their normalized equivalence. No source or evidence was changed to satisfy it.

## Remaining boundary

This closes only the reviewed named-permission pending-removal projection. **Durable token-disconnect intent/completion remains open.** No migration, cryptography, worker/writer policy, full Drive lifecycle, real Google permissions, remote contention, full App/type/lint/build/Linux/receiving, human comprehension, council or release acceptance is claimed. A total status/DB read failure remains explicitly unavailable; this patch does not create offline cached warning persistence. No registry or canonical adoption was performed. Integration remains principal-owned.
