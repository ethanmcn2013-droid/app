# Current state

Short and current by design. A resumed session reads this first.

**Updated:** 2026-08-13

## Where the programme is

| | |
|---|---|
| **Integration SHA** | `53abcc0` on `feat/home-operating-layer` |
| **Base** | `0b112ab` = `origin/main`. Rebased through five drift checkpoints. |
| **Worktree** | `_wt-home-layer`, clean |
| **Active wave** | 3 — four directions built; rendering evidence for the founder pause |
| **Waves done** | 0, 1, 2. Wave 3 build complete, evidence and panel outstanding. |
| **Preview** | local review-mode server, port 3212, `home-layer-review` in `.claude/launch.json` |
| **Flags** | `HOME_REVIEW_LAB_ENABLED` only, default-off, fail-closed. The other five remain unwritten. |
| **Founder pause** | not reached (Wave 3) |
| **`pnpm typecheck`** | exit 0 |

## What is true now

- **The Project foundation merged and matches our contract.** PR #127 landed
  `src/lib/projects/**` and `src/server/projects/**`. Verified line by line in
  `CONTRACT_ALIGNMENT.md`: same branded `ProjectId`, same three-way read scope, same four-state
  route model, same `workspaceId` param. Wave 4 consumes it and builds nothing parallel.
- **The lab is protected.** `/lab/home-operating-layer` → 404 when the flag is off or the viewer
  is not a reviewer; all six existing labs still 200. `contracts/LAB_ISOLATION.md`.
- **Both defect chips raised in Wave 0 became PRs.** #128 (digest cross-tenant) is **merged and
  in our base**. #130 (Home `/waitlist` access gate) is open.

## Open blockers

| ID | Blocker | Owner |
|---|---|---|
| `R-H08` | The 9.5 quality council cannot return a pass — 1,352 human scores required, automation barred, `continue-on-error` in CI. Wave 10 is unachievable as specified until the gate-scope decision is taken. | **Ethan** |
| `R-H17` | A Vercel preview defaults to review mode, which bypasses Clerk — so the protected preview for the founder pause cannot authenticate. Decision memo in flight (Wave 2). | Lead, Wave 2 |
| `R-H09` | No visual-regression baseline exists anywhere. Memo in flight (Wave 2). | Lead, Wave 2 |
| `R-H01` | 0.9 KB shared-runtime headroom. Binds the lab, not just implementation. | Lead, standing |
| `R-H11` | 80 cookie-bound mutation call sites; cross-Project writes silently no-op. | Lead, Wave 4 |
| `R-H16` | A layout-only guard does not stop the page rendering or fetching. Every Home route asserts its own guard. | Lead, Wave 4 |

## Wave 4 entry conditions — verified open at `c592e83`

1. `LEGACY_WORKSPACE_ID` is still the final fallback of `getActiveWorkspace()`
   (`src/server/auth.ts:179`). **Gate:** Home must not be reachable while a Project the user did
   not choose can be substituted.
2. `clearActiveProjectCookie()` exists with **zero callers**; the cookie keeps `path:"/"`, a
   30-day life and no actor binding.
3. The cookie is still written from five-plus places alongside the new canonical helper.
4. Whether the four subordinate membership seams now defer to `src/server/projects/catalog.ts`
   is untraced.

Items 1–3 reported to the owning session, not filed as competing work.

## Sequencing constraint

Wave 4 cannot author the Home route family until PR #130 merges — it owns
`src/app/app/home/page.tsx`, `.../briefing/page.tsx`, `src/app/app/layout.tsx`,
`src/server/{require-app-access,app-access}.ts`. Waves 2 and 3 do not touch those files.

## Exact next command for a resumed session

```bash
cd C:/Users/ethan/signal-studio-workspace/_wt-home-layer
git fetch origin && git log --oneline -1 origin/main   # has the base moved again?
cat docs/projects/home-operating-layer/CURRENT_STATE.md
cat docs/projects/home-operating-layer/COLLISION_REGISTER.md   # re-take before any write
```

---

## Wave 3 build complete — 2026-08-13

Four directions built independently, each across all five surfaces and thirteen worlds. None could
see another's folder. Typecheck exit 0; lab-shell 21/21.

| | Direction | Thesis as built | Signature |
|---|---|---|---|
| v=1 | **Editorial Line** | Not one container, card, fill or shadow. Three-tier measure: 33rem prose, 46rem ledgers, one widening to 58rem for the Analytics table. Colour spent once per view. | An indigo rule over the first ranked entry. Current mode marked three ways, ink, weight and rule, so nothing rides on colour alone. |
| v=2 | **Context Rail** | A labelled column that never leaves, so the content is free to be a document. Zero client JavaScript. | The rail prints each mode's own read-state under its name, and only when it is not ordinary. A quiet day shows "Inbox, nothing in it"; a broken provider shows "Partly read" under all four. |
| v=3 | **Reading Index** | Home as a periodical, and the navigation is its contents page. Ordinal numbering recurses into every mode. Zero client JavaScript. | Dotted leaders run from each mode to its current condition, so the navigation doubles as the summary. My work numbers continuously, so the count is a fact about the page rather than a total someone asserted. |
| v=4 | **Signal Desk** (wildcard) | Warm paper mixed from the theme token, and one 1px spine at the same x in all five modes. Changing mode changes the marks on the line, not the furniture. No status colours anywhere. | The spine shows where the read broke: a gap with a dashed diamond where a source did not answer. A quiet day is a short unbroken line; a failed provider is the same line with holes. |

All four independently solved this programme's governing rule, that a quiet day and a broken
provider must look different, and each solved it a different way. That is what the lab existed to
find out.

**Next:** render the four to static HTML with faithful CSS and screenshot them (the guard refuses
review-mode servers by design, so live local HTTP is not available), then run the ten-director
admission panel at 8.5, then present to Ethan for selection.

---

## Wave 3, round 3 complete — 2026-08-13

**HEAD `fa2cc66`** · base `origin/main` @ `0b112ab`, now **6 behind** (rebase due after the panel).

### Panel history — the gate has never moved

| Round | Editorial | Desk | Index | Rail / replacement | Admitted |
|---|---|---|---|---|---|
| 1 | 6.4 / 8.17 | 6.8 / 7.97 | 7.7 / 8.37 | 5.0 / 6.81 · **VETO** | none |
| 2 | 7.6 / 8.41 | 7.4 / 8.46 | 6.9 / 8.12 | 6.1 / 7.71 · **VETO** | none |
| 3 | — scoring — | | | *(Rail replaced)* | |

Floor / mean. Gate: every director ≥ 8.5 overall **and** ≥ 8.5 on their own lens, zero vetoes.

### What round 3 changed, and why it was not more remediation

Two panels raised four concerns against **all four** directions. A fault found independently in
every candidate is in the shared material, not in four teams. Both were fixed at source:

- **The shell** now separates *nothing set up yet* from *nothing readable* from *nothing in it*.
  A reader with no Project was being reported as a read that failed. Proved by breaking the fix
  twice and watching the new tests fail.
- **The lab brief** gained two amendments, recorded in it rather than quietly applied.
  Amendment 1: a narrow measure is a decision about text, not about the page — 44 complaints
  about unused width were the brief's fault. Amendment 2: a new reader is not a failed read.

**Context Rail was replaced, not repaired.** Vetoed twice, zero passes in twenty ballots, and the
criticism was about what it was rather than defects it could fix — which is exactly the case the
master brief §12.9 says to replace. The new direction puts read-state under each mode name, time
in a left margin, and the read's own provenance in a right column.

### External dependency now recorded

`R-H08` (the 9.5 council cannot certify) was independently confirmed by the Project Truth
programme as their **D-024**. They own the repair; it is their Wave 8. Home's Wave 10 waits on it.
Until then no 9.5 claim may be made by anyone, and `registry-and-drift` reporting green is **not**
evidence — the council fails inside it while the check reports pass.

### Green at this commit

24 shell · 338 fixture · 70 oracle · typecheck exit 0 · 40/40 pages rendered, 160 screenshots.

### Next

Round-4 ballots → if admitted, present to Ethan for selection; if not, report honestly whether the
remaining gap is fixable or whether 8.5-on-every-lens is the wrong instrument for a four-way
comparison. That judgment goes to Ethan rather than being iterated on indefinitely.

---

## Wave 3, round 5 complete — 2026-08-17

Four lanes remediated in parallel (fairness held: only the lead touched shared
material, fixing five shell defects the Meridian audit caught at source). All
40 pages re-rendered from the final code, then a fresh ten-seat blind panel —
the ten lenses: product taste, data truth, UI composition, typography, UX
first-contact, accessibility, engineering, copy/voice, emotional resonance,
and measured evidence.

### The result: zero vetoes again, and nothing admitted

| Direction | Floor overall | Floor owned | Mean | Pass | Blocking |
|---|---|---|---|---|---|
| **Editorial Line** | **8.1** | 7.8 | **8.64** | **8 of 10** | 2 |
| Signal Desk | 8.0 | 7.8 | 8.50 | 5 of 10 | 5 |
| Reading Index | 7.8 | 7.7 | 8.24 | 1 of 10 | 9 |
| Meridian (first panel) | 6.8 | 5.8 | 8.19 | 4 of 10 | 6 |

Gate: 8.5 overall AND owned lens, every director, zero vetoes.

**Editorial Line is now the closest a direction has ever been**: eight passes,
two revisable ballots (a deck line inconsistent with its own ledger; liturgy
deduplication). **Signal Desk regressed on its own signature** — the round-5
remediation over-applied "Short is not empty" so it renders on healthy pages
against the page's own "0 did not answer" ledger: a governing-rule violation
in the direction's proudest grammar. **Meridian's** zero-client-JS purity cost
it exactly where the other three spent their islands: its actions are not real
controls (a11y floor 5.8, its only structural fault class). **Reading Index**
composes only when the day is full — nine directors said versions of the same
thing.

The panel has now run five rounds without an admission, with zero vetoes in
the last two. The gate is measuring polish distance, not category fitness.
Per the round-4 note, that judgment goes to Ethan rather than being iterated
indefinitely: the founder's selection is the authority; the panel advises.

Full record: `verification/panel/ballots-round-5.json`, per-direction
work-orders in `verification/panel/round-5-*.md`.
