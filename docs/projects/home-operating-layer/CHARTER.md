# Signal Studio Home operating layer — programme charter

**Opened:** 2026-08-12
**Owner:** Claude Code (product / infrastructure / operations lane)
**Base:** `a849fc40e46787a39e499fc94b171a5dfb898821` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`

## What we are building

One coherent personal operating layer inside the authenticated shell:

```
HOME — how I operate
├── Today        what deserves attention now?
│   └── Full briefing — the complete daily ledger
├── Inbox        what changed and needs my response?
├── My work      what am I responsible for?
└── Analytics    what does the evidence say?

PRODUCTS — where work lives:  Notes · Tasks · Timeline
HOME READ SCOPE — what Home may read together
ACTIVE PROJECT — where product routes and mutations target
ACCOUNT — who I am and how my account is administered
```

Canonical routes:

```
/app/home            Today
/app/home/inbox      Inbox
/app/home/my-work    My work
/app/home/analytics  Analytics
/app/home/briefing   Full briefing
```

The goal is not that these routes exist. It is that the authenticated suite reads as one
composed operating system: clear in five seconds, useful in thirty, calm under ordinary
use, truthful under partial data, excellent on mobile and assistive technology, and exact
enough that no count, badge, claim, action or "all clear" can lie.

## Controlling sources, in authority order

1. Ethan's latest direct instruction.
2. The approved Home operating-layer architecture — `signal-studio-home-operating-layer-research-and-panel-report-2026-08-12.md` (nine-director unanimous pass, true minimum 8.9, conceptual only — it does **not** certify a rendered UI).
3. Truth, authorization, privacy, accessibility and legal constraints.
4. Current merged founder-approved ADRs and product contracts.
5. Repository operating agreements — workspace `AGENTS.md`, app `AGENTS.md`, `docs/SUITE_URL_AND_NAMING_CONTRACT.md`.
6. Ethan's selected visual direction (not yet given).
7. Sealed contracts and acceptance criteria for this programme.
8. Current code as evidence of what exists.
9. Older reports, historical branches, individual agent preference.

Authority is topic-scoped. Existing tests are evidence of current behaviour, not product
authority when they encode superseded UI: classify each conflicting test as **invariant**,
**compatibility** or **stale**, and update stale ones only with cited founder/ADR authority.

## Locked product decisions

These are implementation constraints. An implementation agent cannot reopen them; changing
one needs a fresh founder decision recorded as an ADR.

1. Three products: Notes, Tasks, Timeline. Home is the visible operating layer, not a fourth.
2. Home is never hidden behind the avatar, Profile, More, or an unlabelled icon.
3. Profile stays identity and account administration only.
4. Four stable, text-labelled, route-backed Home modes. Full briefing is depth from Today, not a fifth mode.
5. Project is scope and mutation context — not a product, not a Home mode.
6. One canonical Inbox: one route, one event store, one badge definition, one state machine.
7. My work is a read projection over source truth. Never a second task database.
8. Analytics is evidence-led progressive depth. Never a configurable dashboard.
9. Today and Full briefing share one deterministic ranking engine.
10. The five modes have mutually exclusive primary jobs; existing duplicate summaries get decomposed.
11. Unknown stays unknown. Missing, incomplete, unsupported, stale, permission-limited, failed or insufficient-history data may never render as zero, healthy, complete, empty or all clear.
12. AI may phrase already-authorized deterministic facts. It may not invent priority, ownership, risk, health, performance, next actions or completeness.
13. No generic card/KPI dashboard, widget marketplace, health score, productivity ranking or decorative chart wall.
14. The design is recognizably Signal Studio: editorial, exact, confident, expressive where earned, quieter than the work.

## The one expected pause

Ethan's explicit visual-direction selection, after all four lab directions independently
pass admission and are inspectable in one protected preview.

Before that selection this programme may: research, seal contracts, write failing contract
tests, build deterministic fixture infrastructure, build and deploy the protected lab, and
publish its evidence. It may **not**: replace production routes, merge the product
implementation, run production migrations, enable jobs, or manufacture a hybrid.

After selection it continues autonomously through implementation, verification, PR,
preview, merge, disabled production deployment, and staged enablement when all live gates
pass.

## Wave sequence

```
W0  Current truth, collision map, clean base
W1  Domain, authorization, content-ownership, experience contracts
W2  Deterministic fixture universe and evidence harness
W3  Four-direction isolated design lab
    ── ETHAN SELECTS ──
W4  Shared Home boundary: routes, context, flags, primitives
W5 Today · W6 Inbox · W7 My work · W8 Analytics   (parallel, only after W4 freezes contracts)
W9  Convergence, de-duplication, compatibility, delight, migration
W10 Exact-SHA adversarial verification and 9.5 production council
W11 Protected release, live proof, staged rollout, rollback, closure
```

## Relationship to the live Project Truth programme

The Project Truth / Analytics wave (`feat/project-truth-wave`, PR #125, plus lanes
`lane/wp1-timeline-safety` and `lane/wp2-project-platform`) is **running right now**. It is
not a competing programme and must not be treated as one.

- It owns canonical Project identity (`Project = Tasks workspaces.id`), the Analytics truth
  defects R1–R10, Timeline exact-Project resolution, and `src/lib/projects/**`.
- This programme **adopts and revalidates** that work. It does not fork it, rebase it,
  merge it wholesale, or build a second ProjectScope foundation.
- Their `docs/wave/PROGRAMME.md` is recorded as absorbed or superseded only after
  reconciliation, and only by a lead-owned edit on a merged base.

See `COLLISION_REGISTER.md` for the exact foreign-owned path list and the standing rules.

## Definition of done

Recorded in full in the master brief §26. In short: Home visibly contains the four modes;
Notes/Tasks/Timeline remain the only products; the three competing daily reads are
decomposed; no duplicate canonical route, store, ranking, summary, badge or analytics shell
remains; every non-ideal state stays honest; cross-tenant, revocation, Notes-privacy,
telemetry, cache, migration and rollback tests pass; 320px, high zoom, keyboard, touch,
reduced motion, forced colours, NVDA and VoiceOver gates are genuinely evidenced or the
release stays disabled; the repository's measured gate and ten independent directors all
pass at 9.5+ with zero vetoes; synthetic and live evidence are visibly separate.
