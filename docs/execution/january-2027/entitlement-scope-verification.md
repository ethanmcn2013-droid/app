# Entitlement scope verification

**Principal result: confirmed fixed for original F1 and L3.** No residual exploit or recovery defect was reproduced in the requested composition with `07a9de41`. Eleven independent checks passed, including reproduction of both failures with the original reader, a real local transaction rollback after the shared grant, and revocation before a delayed settlement retry.

Reviewed immutable sources: reader fix `254cccc6dc5c87c70f9c29e474f3d700c3359216` as present in core `66f106680efb5cc023ac0af445cad5d10ec20211`; billing writer/lifecycle `07a9de4129c160b745b535d612bb7a3ac733cfee`. The two reader files are identical between 254 and 66. Since 07 was not an ancestor of 66, the composition test explicitly combined those immutable modules; it is not an assertion about a subsequently merged HEAD. The lead checkout advanced during verification.

## Original boundary and result

| Check | Original reader at 3d5b8ee8 | Reader at 66f10668 |
| --- | --- | --- |
| F1: buyer holds Event purchase scoped to A, requests paid storage in another editable project B | B resolves Event / 10 GiB | B resolves free / 100 MiB; A retains Event |
| L3: exact local purchase is revoked at epoch zero while its shared mirror remains active | A still resolves Event | A resolves free; delayed positive retry cannot restore access |

These comparisons executed each immutable reader pair against equivalent disposable database states. They do not claim execution of the complete historical application.

F1's controlled input was the target project selected by an authenticated buyer who could already edit B. The sensitive effect was B's paid resource quota, not access to another user's private project. In `src/lib/entitlements-shared/reads.ts:41,68,102`, explicit scope is parsed and filtered before ranking. In `src/server/db/entitlements.ts:87`, the App reader applies that scope again. The reachable upload caller first obtains the task's authorized project through `scopeForTask`, then supplies it to `getEffectiveTier(me, ws)` at `src/server/actions/attachments.ts:192`.

L3 requires a committed local revocation and an unupdated active shared mirror. The App reader now retains expired local rows, correlates purchase references, and rejects expired, duplicate, or mismatched mirrors at `src/server/db/entitlements.ts:81,94`. A failed local read cannot authorize a purchase mirror (`:92`). Tests also covered a naturally expired recurring local row against an active shared mirror, duplicate tombstones, and mismatched project/tier metadata. Independent legitimate account Studio and venue grants remain usable; revoking one purchase does not remove unrelated grants.

The shared-only `resolveEntitlement` still cannot observe App-local revocations. The production call found outside the App resolver is the edition-source display in `src/components/app/tasks-runtime-shell.tsx:207`, not a paid access gate. This verdict does not certify external consumers of the shared library.

## Shared-first settlement and rollback

The new writer establishes a brand-new binding before its first local grant (`07a9de41:src/server/stripe-access.ts:143`). An injected failure after the local insert but before transaction commit caused an actual SQLite rollback. The separate shared database retained exactly one active grant with the verified customer and project A; the local database retained zero grants and zero processed-event markers.

The signed fixture webhook returned **503**. While the local database was healthy but empty, A retained its paid entitlement from the correctly scoped shared grant. B, an account-only request, and another user remained free. This is the writer's deliberate shared-first settlement behavior: local rollback does not roll back independently committed shared evidence. It did not demonstrate an unpaid grant or scope bypass.

Retry one day later returned 200, created exactly one local row with the original shared expiry, and recorded one processed event. Repeating the same event was deduplicated. No moving expiry or duplicate grant was observed.

A separate interleaving committed a revocation after that first rollback, then failed the shared mirror. The local epoch tombstone immediately blocked the still-active shared grant. A delayed signed checkout event, deliberately retrieving a still-positive fixture snapshot, left local access revoked and repaired shared status to revoked. Closing the local database instead of supplying an empty healthy database also denied the shared purchase.

## Verification and limits

**11/11 independent checks passed**, exit 0, using bundled Node v24.19.0, actual Drizzle/libSQL queries and disposable databases, immutable TypeScript modules, real Stripe SDK signature validation with a fabricated local secret, and mocked provider retrieval. Both `database` and `sharedDatabase` were explicitly supplied to writer and reader adapters. No providers, credentials, persistent application databases, or repository writes were used.

Executable reproduction is in task scratch:
`C:/Users/ethan/Documents/Codex/2026-09-04/here-are-6-prompts-i-have-2/work/entitlement-scope-verification/proof.cjs`.

Run with:
`C:/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` followed by that script path.

The eleven checks comprise two historical reader failure reproductions, two repaired-reader reproductions, settlement rollback/retry/deduplication, rollback followed by revocation and stale positive delivery, local-read outage, duplicate/mismatched references, independent account-grant controls, malformed/missing purchase scope, and a scoped recurring grant with local expiry.

The lead owns the full composed default-gate rerun and its disposable `sharedDatabase` injection correction. This verification does not waive that gate. It does not establish behavior under every distributed commit-acknowledgement failure or delivery interleaving. Event postWindow behavior, broader commercial policy, and human comprehension were not assessed.

```json
{
  "results": [
    {
      "id": "F1",
      "status": "fixed",
      "evidence": "Old reader reproduces project-A purchase upgrading B; 66f10668 filters scope before ranking, keeps B at 100 MiB, and preserves A and legitimate account grants."
    },
    {
      "id": "L3",
      "status": "fixed",
      "evidence": "Old reader accepts an active stale mirror after local epoch revocation; 66f10668 rejects it by exact purchase reference. Local-read failure, duplicate tombstones, and a delayed positive retry do not bypass the revocation."
    }
  ]
}
```

