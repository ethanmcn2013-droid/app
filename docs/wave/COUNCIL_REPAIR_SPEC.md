# Quality Council repair specification — D-024, diagnosed to the bolt

**Cut:** 2026-08-17, reproduced twice against HEAD `76b5fcb` (clean tree). This
supersedes D-024's framing in two material ways, recorded here so Stage 3 executes
without re-discovery. Full mechanics: `scripts/experience/quality-council.mjs`
(1,882 lines), gate `experience/quality-council-gate.json`, journey
`experience/cross-suite-journey.json`.

## The two corrections to D-024

1. **`products/` is missing too, not just `journeys/`.** Seven receipt files are
   absent (3 product + 4 journey viewports), not four.
2. **The pinned commits are not what fails.** `d1af9ae` passes reachability; the only
   stale pin is the B0 baseline's `sources.app.sourceTreeSha256`, compared against
   the CURRENT tree (391 files drifted). "Create the journeys directory and its
   schema" is a no-op as written — the schemas already exist
   (`experience/schemas/quality-council-*-receipt.schema.json`, hash-sealed into the
   gate), and an empty directory changes nothing. The real deliverable is the seven
   receipt files, which are REVIEW OUTPUTS, not scaffolding.

## The two end-states, named apart

### State A — repaired and running honestly (exit 1 for the true reason)

The validator has a DESIGNED honest-failure mode: when the B0 baseline validates and
the only errors are the seven missing certification receipts, it suppresses the raw
list and prints the B0 NO-PASS verdict (per-surface floors, vetoes, the 9.5 gate).
`QUALITY_COUNCIL_EVIDENCE.md:84-98` documents this as intended. **The single defect
separating today's raw 9-error state from that designed state is the stale baseline
tree hash.**

But an honest rebaseline is NOT a hash-bump. The validator would accept a mechanical
bump — and it would attach the 2026-08-09 director scores to a tree 391 files away
from what they reviewed. A B0 receipt is immutable evidence; a bump without a fresh
review is falsification that only record-keeping discipline prevents. State A
therefore requires **a fresh ten-director external review of current production**
(the /panel ritual at B0 shape: ten seats, unique lenses, seven surfaces, one-decimal
scores, veto flags, 9.5 floor), then: new council-report.md + evidence-manifest.json
under `experience/council-evidence/wave-0-b0/`, hashes via
`quality-council.mjs --hash`, tree hash from `experience:council:prepare` at the
reviewed checkout, baseline rewritten with ten reviewers + seven surfaces +
`decision: "no-pass"`.

Verification of State A: `pnpm experience:council` exits 1 in external-baseline mode
(the score matrix, not the error list), and any edit under `src/` flips it back to
the stale-tree error — that flip is the pin working, not a regression.

### State B — passing (exit 0). Not achievable by engineering.

Requires, none of which exist: the seven receipts covering **104 assessment units**
(notes 28, tasks 40, timeline 36) every one ≥50/52 with ≤2 threes and nothing
below 3 — **1,352 dimension scores** each with ≥20-char rationale AND positive
evidence; **≥3 genuine independent reviewers per receipt**, each owning ≥1 dimension,
each with a distinct hashed review file; a full evidence corpus (12 artifacts/unit,
4 PNG, approved visual baselines — R-H09: zero approved baselines exist, approval is
founder-owned); zero axe serious/critical and zero console errors across all units
empirically; one reviewed commit whose committed tree equals the working tree over
the pinned inputs; and the B0 baseline simultaneously valid or founder-sanctioned
deleted.

The Stage-3 proof pair maps: "exits 0 on a clean tree" is State B only; "a broken
journey exits 1" is already continuously proven at fixture level by
`experience:self-test`, which runs UNMASKED in CI.

## The mask

`.github/workflows/design-quality.yml:107` — `continue-on-error: true` on the
council step inside `registry-and-drift`, which is a REQUIRED check. Removing the
flag before State B freezes main. The honest interim: a validator CI mode that
distinguishes structural breakage (red) from the honest external-baseline NO-PASS
(green with the verdict published). Validator edits rotate
`contractHashes.validatorSha256`, so ALL validator/contract changes land BEFORE any
receipt is authored — never between.

## Ordering constraints (consumers that must not break)

- `experience:council:prepare` must keep writing `experience/output/quality-council-input.json` (uploaded artifact).
- `experience:self-test` must stay green through validator edits.
- `docs/wave/BASELINE.json:126-130` records the historical exit 1 — never "fixed".
- The 10 hash-sealed contract files invalidate every receipt when edited — the D-008
  registry materiality cascade lands before receipt authoring or after, never between.
- The gate pins `tasks.page.app-{notes,tasks,timeline}` routes and requiredStates
  verbatim; demo note copy (`notes-demo.ts:62-66`) is sealed through the journey
  fixtureContext.
- `FIRST_CONTACT_TEST.md` pins exactly 13 dimensions.
- Home R-H08 (P0): narrowing the gate inside a programme is an automatic veto.

## Founder decisions this needs (engineering cannot take them)

- **F1** — authorize the fresh ten-director external review now (the only honest
  path to State A).
- **F2** — immutability vs the hardcoded `wave-0-b0` path: rewrite in place, or a
  small validator change to accept `wave-0-b1`. Which record survives is the call.
- **F3** — gate scope: 104 units × 13 dimensions exceeds solo review capacity; the
  decision file three documents cite
  (`studio/content/hq/operator-todos/rule-on-95-gate-scope.md`) **does not exist**.
  Recreate the todo; the content is the founder's. Narrowing scope inside either
  programme is an automatic veto.
- **F4** — CI semantics when unmasking: keep the mask with an honest dated comment,
  or the two-state CI mode. External-baseline mode goes stale on every source merge
  by design — it cannot be the steady CI state.
- **F5** — visual-baseline approval (R-H09): zero approved baselines exist; every
  certification unit needs one; approval is founder-owned. `VISUAL_BASELINES.md`
  argues F3 and F5 are one question — ask it once.
- **F6** — certification day: re-pin B0 against the certification release (fresh
  review) or delete it (permitted; erases the only external no-pass evidence).
  Needed only at State B.

**Bottom line:** one authorized review run buys State A this week. State B is a
review-capacity and founder-scope question that no scaffolding can shortcut.
