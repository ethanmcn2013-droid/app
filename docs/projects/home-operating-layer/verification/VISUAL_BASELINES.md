# Visual baselines — what one would cost, and where it is actually needed

**Status:** decision memo, nothing implemented · **Addresses:** R-H09 (P1) · **Diagnoses:** R-H03 (P1), see §9
**Base:** `feat/home-operating-layer`, on `origin/main` @ `c592e83` · **Measured:** 2026-08-12
**Owner:** Lead, with one founder decision inside it · **Blocks:** nothing in Wave 2; Gate 10

---

## The decision, first

Three recommendations, in the order they need answering.

1. **The lab does not need a visual baseline. Do not build one for it.** The lab exists to be
   replaced. A baseline pins the pixels of a thing whose entire purpose is to change, and it
   cannot answer the only question the lab is asked — which of these four is better. What the lab
   needs instead is a **capture set**: the 260 cells rendered once, hashed, and put in front of
   Ethan. That is evidence for a choice, not a regression gate.

2. **Wave 10 does need one, and the machinery does not exist.** The council gate lists
   "unapproved or missing visual baseline" as a hard blocker and sets `missingBaselineBehavior:
   "fail"`. There are **1,612 assessment units** and **zero** approved baselines. Nothing in the
   repository can create, store, compare or approve one.

3. **The scope of that baseline set is a founder decision and it is the same decision as R-H08.**
   Both come down to one question: what is the 9.5 gate actually being asked to certify? Ask it
   once. Recommended answer: a named, narrow set — the Home surfaces this programme ships, four
   viewports, default state only, roughly **24 images** — with every other surface recorded as
   explicitly not baselined rather than silently null.

**The good news, and it is genuinely good:** the hard part of visual regression is determinism,
and this repository already has it. Measured below — the same surface captured three times is
byte-identical. The blocker is not technical. It is that "approved" has no mechanism.

**One thing this memo settles that it did not set out to settle.** R-H03 — `experience:fixtures`
failing at base — is a CRLF line-ending artefact of the Windows checkout, not stale content, and
it is already green in CI. Proved in §9, with the consequence that **`experience:fixtures:write`
must not be run on this machine.**

---

## 1 · Two different things are both called a baseline

They are conflated everywhere in this repository, and the conflation is why R-H09 reads as one
problem when it is two.

| | **A Playwright snapshot** | **An approved baseline reference** |
|---|---|---|
| What it is | A PNG on disk that `toHaveScreenshot` compares against | A registry field naming a screenshot a human has blessed |
| Where it lives | `experience/baselines/…` (does not exist) | `registry.json` `approvedBaselineReference` (null ×78) |
| Who creates it | `playwright test --update-snapshots` | A person |
| Who approves it | nobody — it is a file | **the founder, explicitly** |
| Cost | minutes | the whole problem |

`critical-fixtures.json` `operatorBlocked` says it in one line, and it is the most important
sentence in this area of the repository:

> Visual baseline approval remains founder-owned; generated screenshots are evidence, not
> approval.

Everything mechanical below is cheap. Everything that says "approved" is not.

---

## 2 · What exists today, measured

| Fact | Evidence |
|---|---|
| `toHaveScreenshot` is configured and never called | `experience/playwright.config.ts:32-37`; no call anywhere in `experience/**` |
| A snapshot path is already declared | `playwright.config.ts:25-26` → `./baselines/{testFilePath}/{projectName}/{arg}{ext}` |
| No baselines directory exists | `experience/` has no `baselines/` |
| Screenshots are attached, never compared | `critical-experiences.spec.ts:235` `page.screenshot({fullPage:true})` + `testInfo.attach()` |
| Zero approved baselines | computed over `registry.json`: 78 entries, `approvedBaselineReference` non-null on **0** |
| The council needs one per assessment unit | `quality-council-gate.json:202-204`, `:219-220` |
| The council fails without one | `hardBlockers` includes "unapproved or missing visual baseline"; `missingBaselineBehavior: "fail"` |
| Automation may not award the taste half | `quality-council-gate.json` `automationMayAwardTasteScores: false` |

So today a pixel regression on an untouched surface ships silently, and simultaneously the
council can never pass. Both statements are true at once, which is the honest shape of R-H09.

---

## 3 · The scale, computed from the registry

```
entries                                     78
Σ requiredStates                           403
Σ requiredBreakpoints                      312
assessment units (state × viewport)      1,612
approved baselines today                     0
```

For contrast, one full run of the existing harness produces **132 rendered outcomes** (33 spec
titles × 4 viewport projects, audit D §3.3). The council's evidence contract asks for a baseline,
a candidate and a diff on 1,612 units. The gap between what the harness measures and what the
gate demands is a factor of twelve, and it is not a screenshot problem — it is that most of those
1,612 states are not reachable by any test that exists.

---

## 4 · What a baseline costs, measured on this machine

Full-page PNGs captured from the running review-mode server at the four viewports declared in
`experience/browser-contract.json`. Real bytes, not an estimate.

| Route | mobile 390 | tablet 768 | desktop 1280 | wide 1440 |
|---|---|---|---|---|
| `/app/home` | 50.8 KB | 61.4 KB | 65.4 KB | 68.1 KB |
| `/app/home/briefing` | 50.3 KB | 79.4 KB | 78.7 KB | 84.4 KB |

**8 captures · 538 KB · mean 67.3 KB · 1.3–2.7 s each.**

Extrapolated with that mean:

| Set | Images | Storage |
|---|---|---|
| The narrow Home set recommended in §7 (5 routes × 4 viewports) | 20 | ~1.3 MB |
| The full lab matrix (4 directions × 5 modes × 13 scenarios × 4 viewports) | 1,040 | **~68 MB** |
| Every council assessment unit (1,612 × 4 viewports already included) | 1,612 | **~106 MB** |

The lab matrix number comes from the fixture universe's own manifest —
`experience/home-operating-layer/fixtures/manifest.json` `captureMatrix` is
`{directions: 4, modes: 5, scenarios: 13, total: 260}` — so it is derived, not guessed.

At single-worker throughput (`workers: 1` in the config) 1,040 captures is roughly **25–35
minutes of wall clock per run**, before Axe, assertions and settle time. That is the real cost of
baselining the lab, and it recurs on every push that touches a pixel.

---

## 5 · Determinism, measured — and this is the surprise

The question a visual baseline lives or dies on is whether two runs of the same surface produce
the same bytes. Three independent browser contexts, same viewport, same locale, timezone, colour
scheme and reduced-motion settings:

```
/app/home            run 1  b6dc87ffb7465eaf  66934 bytes
                     run 2  b6dc87ffb7465eaf  66934 bytes
                     run 3  b6dc87ffb7465eaf  66934 bytes
                     distinct digests: 1   → byte-stable

/app/home/briefing   run 1  d78d20c633ac4f17  80558 bytes
                     run 2  d78d20c633ac4f17  80558 bytes
                     run 3  d78d20c633ac4f17  80558 bytes
                     distinct digests: 1   → byte-stable
```

**Byte-identical, not merely within a diff threshold.** The reason is that review mode pins its
clock: `src/lib/review-suite-fixture.ts:59` `reviewToday: "2026-07-16"`,
`src/lib/calendar-frame.ts:73-74` `PINNED_REVIEW_CALENDAR_FRAME`, and
`src/lib/project-truth-fixture.ts:38` all agree on the same date, which the Home fixture universe
matches. So the usual killer of visual regression — a surface that renders "today" — is already
handled on the path the harness screenshots.

### What this measurement does not cover, stated plainly

1. **It was taken on Windows against the dev server on port 3212.** The harness builds and runs
   `next start`. The result indicates stability; it does not prove it for the harness's own
   configuration.
2. **It is one machine, one day, one viewport, two routes, three runs.**
3. **The harness runs a different browser binary locally than it does in CI.**
   `playwright.config.ts:47` reads `channel: process.env.CI ? undefined : "chrome"` — Google
   Chrome locally, bundled Chromium in CI. Add Windows-versus-Ubuntu font rasterisation on top and
   **a baseline generated on this machine will not match `design-quality.yml`.** This is the
   single most expensive fact in this memo: baselines must be generated in the same environment
   that compares them, which means in CI, or in Playwright's Linux container, or not at all.
4. **`/app/tasks` never reached network idle** at any of the four viewports within 45 s during the
   cost run. That was my chosen wait condition, not the harness's, so it is not evidence the route
   is broken — but it is evidence that a naive `toHaveScreenshot` on that surface would need a
   settle strategy before it could be trusted.

---

## 6 · Does the lab need a baseline? No, and here is the argument

Four reasons, in descending strength.

1. **A baseline answers "did this change?" The lab is asked "which of these is better?"** They are
   different questions and only one of them has an automatable answer. The founder pause is a
   taste judgement; a pixel diff cannot contribute to it.
2. **The lab is disposable by design.** Three of the four directions are deleted after selection,
   and the fourth is rebuilt inside the real Home boundary in Wave 4. Every baseline created for
   it is invalidated by the act it exists to support.
3. **It is fixture-backed and pre-production.** Nothing it renders can regress a customer. The
   review/live boundary is enforced by the guard and by the transitive import gate
   (`LAB_ISOLATION.md` §4), not by pixels.
4. **68 MB and half an hour per run, for four throwaway directions**, spent inside a programme
   whose shared-runtime headroom is 0.9 KB (R-H01), is the wrong place to spend anything.

### What the lab needs instead

- **A capture set, once.** The 260 cells rendered at the two viewports that carry the design
  argument, hashed, with the manifest hash beside them, presented as a compare sheet. That is
  evidence for a decision.

  **This is already being built, by another Wave 2 session, and it agrees with this memo.**
  `scripts/home-layer/capture-home-lab.mjs` writes a PNG, an ARIA snapshot, an axe result and a
  receipt per cell, plus an index recording what was *not* captured and why. Its contract states
  the position independently: screenshots "are captured but are not comparison baselines: engine
  text rendering differs and a pixel diff between engines is not a defect"
  (`experience/home-layer/capture-contract.json:117`). Read as evidence rather than as a claim of
  agreement — the two pieces of work were done in parallel without coordination, which is why
  their agreement is worth something. **Nothing in this memo asks for that pipeline to change.**
- **The determinism receipt it already has.** `experience/home-operating-layer/fixtures/
  manifest.json` is a *data* receipt: every count derived from the fixture records, a diff in it
  is a diff in what the surfaces will say. It is the honest instrument for this wave and it is
  already built.
- **Nothing added to `registry.json` beyond the one entry §9 describes.** Registering 260 lab
  cells as experiences would make R-H03 permanently worse for a surface that will not exist in
  three weeks.

---

## 7 · What Wave 10 needs, and what has to be built

None of this exists. Each line is work, not configuration.

| # | Missing piece | Size |
|---|---|---|
| 1 | A spec that calls `toHaveScreenshot` at all | small — the config is already right |
| 2 | `experience/baselines/` and a decision on how binaries are stored (plain git, LFS, or an artifact store) | small decision, permanent consequence |
| 3 | Baselines generated **in the CI environment**, not locally (§5.3) | medium — a workflow that can commit or publish its own output |
| 4 | An approval receipt: who approved, what SHA, which image hash, when | medium, and it is the actual subject |
| 5 | `approvedBaselineReference` wired to that receipt and validated by `validate.mjs` | small |
| 6 | A rebaseline procedure: an intentional change must be approvable without blanket `--update-snapshots` | medium, and easy to get wrong |
| 7 | A scope decision — which surfaces, which states, which viewports | **founder** |
| 8 | Storage budget: 106 MB of PNGs in a git repository is a real cost that compounds per rebaseline | decision |

Items 4 and 7 are the programme. Items 1, 2, 5 are an afternoon.

### The recommended scope, if the founder wants a recommendation

Baseline **the five Home routes this programme ships, default state only, four viewports** —
`/app/home`, `/app/home/inbox`, `/app/home/my-work`, `/app/home/analytics`, `/app/home/briefing`,
taken from `HOME_ROUTES` in `src/lib/home-layer/fixtures/scenarios.ts:93-99`. That is **20 images,
about 1.3 MB.** Every other registry entry gets an explicit `intentionalExceptions` record saying
it is deliberately not baselined and why, instead of a `null` that reads as an oversight.

Rationale: 20 images is a set a person can actually look at and approve in one sitting, which is
the only way item 4 ever gets done. 1,612 is not, and pretending otherwise is how a gate becomes
`continue-on-error` — which is precisely what already happened to the council job in
`design-quality.yml:105`.

**This is a recommendation, not a decision.** Narrowing the gate's scope is explicitly an
automatic veto when done inside the programme (R-H08, brief §24). It goes to Ethan with R-H08, as
one question, or not at all.

---

## 8 · Cost summary

| Path | Build cost | Per-run cost | Storage | Founder time |
|---|---|---|---|---|
| Lab baseline (rejected) | ~1 day | 25–35 min | ~68 MB | approval of 1,040 images — not real |
| Lab capture set (recommended) | ~half a day | one run | ~34 MB at two viewports | one review sitting |
| Narrow Wave 10 baseline (recommended) | ~2–3 days incl. approval mechanism | ~2 min | ~1.3 MB | one sitting, ~30 min |
| Full Wave 10 baseline | ~1 week+ | ~40 min | ~106 MB | not achievable by one person |

---

## 9 · Found while measuring: `experience:validate` is now red

Not a baseline matter, but it was discovered by running these commands and the lead needs it.

```
$ node scripts/experience/validate.mjs
experience:validate: 1 failure(s)
  x tasks.page.lab-home-operating-layer: discovered experience is not registered
    (tasks/src/app/lab/home-operating-layer/page.tsx)
exit=1
```

`experience:validate` **passed at the Wave 0 baseline** (`BASELINE.md`, exit 0). It is red now
because Wave 2 added `src/app/lab/home-operating-layer/page.tsx` and `validate.mjs` discovers
every `page.tsx` under `src/app` and requires a registry entry for it. The six pre-existing lab
routes are all registered, so this is the established convention, not an argument for an
exemption.

`registry-and-drift` is a **required status check on `main`** and it runs `pnpm
experience:validate`, so this branch cannot merge until the entry is added.
`experience/registry.json` is an integration-junction file, so the exact entry is in this
session's report for the lead to apply rather than being written here. The entry was verified
rather than asserted: applied to a copy of the tree in a scratch directory, `validate.mjs` goes
from `1 failure(s)` to `clean - 79 Tasks experiences, 407 required state variants, 316 breakpoint
variants`, exit 0.

### R-H03 is a line-ending artefact, and it is not stale content

Found while verifying the entry above, and it changes what the lead should do about a P1.

`scripts/experience/critical-fixtures.mjs:506-513` decides staleness by comparing the **exact
bytes** of `experience/registry.json` against `` `${JSON.stringify(nextRegistry, null, 2)}\n` ``.
That expectation is LF-only. Measured on this checkout:

```
raw bytes        118,159
roundtrip bytes  114,521      (difference: 3,638 — one CR per line)
raw has CRLF     true
first difference at character 1, immediately after the opening brace
```

`.gitattributes` carries one rule, `drizzle/*.sql text eol=lf`, so `registry.json` is checked out
CRLF on Windows and the comparison can never match here. Proved by isolation: an untouched copy
of `experience/`, LF-normalised and **nothing else changed, no new entry added**, runs
`critical-fixtures.mjs` to `clean - 37/37 critical experiences mapped`, exit 0.

Three consequences.

1. **Wave 0's audit was right.** Audit D found the content was not actually stale — 78/78
   materiality hashes matched. This is why the gate exited 1 anyway.
2. **It is green in CI already.** `design-quality.yml` runs on `ubuntu-latest`, where git checks
   out LF. R-H03 is a local-only failure, which means it is not the Wave 10 blocker the register
   records it as. **The register entry needs correcting; that is the lead's call, not this
   memo's.**
3. **Do not run `experience:fixtures:write` on Windows.** It would rewrite the whole file LF,
   producing a 3,638-byte whole-file diff that reads as a content change, on an
   integration-junction file that other sessions are also touching. The real fix is a
   `.gitattributes` rule and a re-checkout, both outside this programme's write boundary.

---

## 10 · What is proven here, and what is not

### Proven

| Claim | How |
|---|---|
| Repeated captures of the same surface are byte-identical | 3 runs × 2 routes, SHA-256 of the PNG buffer, 1 distinct digest each |
| A full-page capture costs ~67 KB and 1.3–2.7 s | 8 real captures across 4 viewports |
| There are 1,612 assessment units and 0 approved baselines | computed over `registry.json` |
| The lab matrix is 260 cells | derived by the fixture universe's own manifest generator |
| Review mode pins its clock to 2026-07-16 | three source constants agree, and the Home fixture manifest matches |
| `experience:validate` is red on this branch, and was green at base | both runs recorded |
| The proposed registry entry makes it green again | applied on a scratch copy: exit 0, 79 experiences |
| R-H03 is caused by CRLF, not by stale content | LF-normalising an otherwise untouched copy runs the gate clean |

### Not proven

1. **Cross-platform stability.** Everything above is Windows + Google Chrome + dev server. CI is
   Ubuntu + bundled Chromium + a production build. Until one capture is taken in both and
   compared, the central assumption of any baseline plan is untested. **This is the first thing to
   measure if the lead takes the Wave 10 recommendation.**
2. **Stability across days.** Three runs, one afternoon. The clock pin makes drift unlikely on the
   review path; unlikely is not measured. Settle it by capturing the same route tomorrow and
   diffing.
3. **That every review-mode surface consumes the pinned frame.** Three constants agree; whether
   every component reads them was not traced.
4. **Anything about the production access path.** All measurements are review mode. Real-data
   surfaces have no pinned clock and would need a different determinism strategy entirely.
5. **Storage behaviour.** No estimate here accounts for git history growth across rebaselines,
   which is where PNG-in-git repositories actually hurt.
