# Signal Studio 9.5 quality gate

The certification threshold is fail closed. Every required state of the three
products, Notes, Tasks, and Timeline, must be reviewed at mobile, tablet,
desktop, and wide viewports. Home and the Full Briefing are assessed in the
cross-suite journey because Home is the authenticated front door, not a fourth
product. Each assessment has 13 integer dimensions scored from 0 to 4.
The assessment passes only at 50 of 52 or higher, no dimension may be below 3,
and at most two dimensions may score 3.

Product and suite scores are the minimum qualifying score. They are never an
average, and a rounded display score cannot create a pass.

## What constitutes evidence

The product receipt schema is
`experience/schemas/quality-council-product-receipt.schema.json`. The journey
receipt schema is
`experience/schemas/quality-council-journey-receipt.schema.json`.

Every receipt must bind to:

- one reachable Git commit containing the exact reviewed product and backend
  source tree;
- the current council, browser, fixture, registry, Playwright, validator, and
  receipt-schema hashes;
- real checked-in files under `experience/council-evidence/`, each with its
  current SHA-256;
- at least three independent council reviews;
- hard-blocker measurements with zero serious or critical accessibility
  violations, zero runtime failures, no overflow, a passing keyboard and
  reduced-motion result, 44 CSS-pixel primary targets, approved baselines, and
  visual diffs inside policy;
- a written rationale and positive evidence for all 13 dimension scores.

The cross-suite gate additionally requires one continuous, deterministic
Notes-to-Tasks-to-Timeline-to-Home journey receipt for every viewport. Each
trace must prove context continuity, idempotent mutations, and exact source
identity through all five journey steps.

## Evidence run

Commit the exact product source under review first. Then run:

```powershell
pnpm test
pnpm experience:self-test
pnpm experience:fixtures
pnpm experience:validate
pnpm experience:test
pnpm experience:attest -- --write-record
pnpm experience:council:prepare
```

The last command writes the current, non-certifying review matrix to
`experience/output/quality-council-input.json`. It lists 104 product assessment
units, the four required journey receipts, the reviewed commit, the current
source-tree digest, and every contract digest. It deliberately contains no
scores.

Promote the captured screenshots, baselines, diffs, traces, reports, and
independent council reviews into `experience/council-evidence/`. Calculate the
receipt hash for each file with:

```powershell
node scripts/experience/quality-council.mjs --hash experience/council-evidence/<file>
```

Author the three product receipt files and four journey receipt files named in
the preparation output. Reviewers must provide the scores and written evidence;
automation may collect measurements but cannot award taste scores.

Finally run:

```powershell
pnpm experience:council
pnpm experience:quality
```

`pnpm experience:council` must remain red while any receipt, state, viewport,
score, evidence file, hash, source version, continuous journey, or hard-blocker
result is missing or stale.

## Superseded pre-Wave-0 state, measured 2026-08-01

The gate was run end to end for the first time on 2026-08-01, as part of the
north-star cycle (T·126). Result, honestly stated: **the machinery works and
has never certified anything.**

What passes today:

| Layer | Result |
|---|---|
| `experience:self-test` | pass — correctly rejects 49/52, fractional scores, missing journey evidence, stale source, and tampered evidence |
| `experience:fixtures` | clean — 35/35 critical experiences mapped, 32 deterministic cases x 4 breakpoints |
| `experience:validate` | clean — 80 experiences, 412 required state variants |
| `ds:check` | clean — no drift |
| `experience:council:prepare` | wrote the old matrix — 120 product assessment units, 4 journey receipts |
| `experience:council` | **9 failures** — the old four-product model expected 8 absent receipts and had no score |

`experience/council-evidence/` does not exist. No product or journey receipt
has ever been authored. `certificationStatus` reads
`not-assessed-until-receipts-validate`.

### The bottleneck is review capacity, not engineering

The deterministic half is finished and green. The human half has never started,
and the arithmetic explains why:

- 26 required states across the three products, x 4 viewports = **104
  assessment units**;
- x 13 dimensions = **1,352 individual taste scores**, each requiring a
  written rationale and positive rendered evidence;
- plus at least three independent council reviews bound to every receipt;
- plus 4 continuous journey receipts, one per viewport.

Automation is explicitly barred from awarding those scores, and correctly so.
But a solo operator cannot produce 1,560 evidenced taste judgements, which
means the gate as specified does not fail — it simply never runs, and
"ships at the standard of the best studios" stays unproven rather than proven.

This is recorded as a founder decision, not fixed unilaterally, because
narrowing a quality gate is a judgement about standards:
`studio/content/hq/operator-todos/rule-on-95-gate-scope.md`.

Nothing here argues for lowering the bar. The 50/52 threshold, the fail-closed
posture, and the ban on automated taste scores should all survive. The question
is only how much surface one pass must cover before it may certify anything at
all.
