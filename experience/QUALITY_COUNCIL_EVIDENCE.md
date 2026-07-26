# Signal Studio 9.5 quality gate

The certification threshold is fail closed. Every required state of Notes,
Tasks, Timeline, and Signal must be reviewed at mobile, tablet, desktop, and
wide viewports. Each assessment has 13 integer dimensions scored from 0 to 4.
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
Notes-to-Tasks-to-Timeline-to-Signal journey receipt for every viewport. Each
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
`experience/output/quality-council-input.json`. It lists 120 product assessment
units, the four required journey receipts, the reviewed commit, the current
source-tree digest, and every contract digest. It deliberately contains no
scores.

Promote the captured screenshots, baselines, diffs, traces, reports, and
independent council reviews into `experience/council-evidence/`. Calculate the
receipt hash for each file with:

```powershell
node scripts/experience/quality-council.mjs --hash experience/council-evidence/<file>
```

Author the four product receipt files and four journey receipt files named in
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
