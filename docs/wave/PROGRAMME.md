# Project Truth & Analytics — execution programme

**Status:** executing · Waves 0–4 merged · **Wave 5 gate CLOSED 17 Aug 2026** (D-025, D-026) · Wave 6 next
**Integration owner:** Claude Code (single architecture owner, sole merger/deployer)
**Integration worktree:** `_wt-project-truth` · branch `feat/project-truth-wave`
**Base:** `origin/main` @ `3682bf75180ac6c575133cb2008f6d4ddf8e3aee` (merge of PR #123, 12 Aug 2026 17:13Z)
**Opened:** 12 August 2026

---

## 1. The controlling decision: one programme, not two

Two briefs were handed in as separate programmes:

- **Active Project Wave** (WP0–WP11) — one canonical Project identity across Notes, Tasks,
  Timeline, Home, Full Briefing, Project Overview, suite chrome, lifecycle, and migration.
- **Signal Analytics** — a local Analytics view inside authenticated Home.

**They cannot run as independent programmes.** They collide on the single most important
noun in the system.

| | Active Project brief | Analytics brief |
|---|---|---|
| What a Project is | Tasks `workspaces.id`, branded, freshly authorized | canonical workspace (same target) |
| Tag-derived "project" | rename to **Label / Workstream**, keep out of Project identity (§8.5) | "rebase analytical Project identity from tags to canonical workspaces" (Phase 1.1) |
| Who owns scope + authorization | WP2 resolver / WP3 explicit-authorization seam | its own "authorized scope contract" |
| Who owns permission-aware coverage | WP3 + WP10 | its own permissions/privacy lane |

The *destination* is identical. The **conflict is sequencing and ownership**, and it is
material:

1. Analytics' own hard pre-design truth gate — *"the ported analytics adapter derives
   projects from task tags, while product truth defines Projects as canonical
   workspaces"* — **is a subset of Active Project WP0/WP2/WP9**. It cannot be closed
   correctly before the canonical `ProjectId`, catalog, and authorization seam exist.
2. Both briefs would edit `src/modules/signal/**`, Home, Project Overview, and the
   Project catalog. Run in parallel, two lanes redefine Project scope simultaneously —
   the exact failure both briefs forbid ("do not let a subagent redefine identity,
   authorization, migration, privacy, or URL contracts independently").
3. Analytics' "permission-aware aggregate coverage" would be built against the model
   WP3 is in the middle of replacing, and would be rebuilt.

**Decision:** run **one programme, foundation-first**. Active Project WP0–WP4 establish
Project truth; Analytics folds in as a consumer of that truth from Wave 4 onward, and
its design lab runs alongside the Active Project lab so both founder picks land in one
sitting rather than weeks apart.

This costs nothing in scope. Every clause of both briefs is retained. It removes a
guaranteed rework cycle and a guaranteed contract conflict.

---

## 2. Safety envelope

This workspace has ~30 worktrees and prior sessions in flight. The following are hard
rules for every agent and for the integration owner.

**Established by audit, 12 Aug 2026:**

- `app/` root checkout is on `main` @ `438b572` — **1 ahead, 137 behind** `origin/main`,
  with **170 dirty/untracked files** last modified 9 August. It is stale working state,
  not a live session.
- **Zero open PRs.** No in-flight PR work to conflict with.
- `origin/main` @ `3682bf7` is the true clean baseline. The Active Project plan's audited
  baseline `a1b66a7` and the Analytics brief's cited snapshot `_wt-motion-wave7` @
  `b0e9283` are both **ancestors of current main and therefore stale**. Neither is used.

**Rules:**

1. Never read from, write to, or `git` against `app/` root or any existing `_wt-*`
   worktree. All work happens in `_wt-project-truth` and per-lane worktrees created
   fresh from the integration branch.
2. Never `git reset --hard`, `git checkout --`, `git clean`, or stash against any tree
   containing another session's changes.
3. No agent pushes, deploys, changes a production flag, or touches a production database.
   Subagents commit to their own lane branches only.
4. The integration owner alone rebases lanes, resolves semantic conflicts, merges,
   pushes, opens PRs, and deploys.
5. One owner per file. Cross-lane needs go through an interface request, never a
   concurrent edit.
6. Every check that fails is reproduced against the untouched baseline
   (`docs/wave/BASELINE.json`) before it may be called pre-existing.

---

## 3. Wave structure and deploy cadence

Every wave ends in a merge to `main` and a production deploy, so the work is observable
in real time. This is safe because **all behavioural change lands behind default-off
flags**; the only unflagged wave is Wave 1, which is pure data-integrity safety and
strictly removes unsafe behaviour.

| Wave | Contents | Ships | Risk at merge |
|---|---|---|---|
| **0** | Ground-truth audits, baseline, WP0 contract freeze: ADR, branded `ProjectId`, truth fixtures, failing A→A/B→B contracts | docs, types, tests | none — no runtime path changes |
| **1** | WP1 P0 shields: no Timeline substitution, no destructive sync, tagged source results, Notes fail-closed | **unflagged** | negative — removes known-unsafe behaviour |
| **2** | WP2 platform: catalog, resolver, URL contract, cookie writer, provider, navigation-epoch guard | `SIGNAL_ACTIVE_PROJECT_V3_ENABLED` off | none while flag off |
| **3** | WP3 mutation-safety migration + CI source guard | mostly unflagged (authorization tightening) | low — tightens, never loosens |
| **4** | WP4 Timeline bindings/provisioning/sync + Analytics truth foundation (tag→workspace rebase, metric registry, baseline ADR, snapshot semantics) | `SIGNAL_TIMELINE_CANONICAL_BINDING_V1`, `SIGNAL_TIMELINE_SAFE_FRESH_SYNC_V1`, `SIGNAL_HOME_ANALYTICS_V1` all off | none while flags off |
| **5** | Two isolated design labs + independent panels → **FOUNDER GATE** | lab routes, deny-by-default | none — labs 404 in production mode |
| **6** | WP6–WP9 product adaptation + Home Analytics V1 using the selected compositions | flags off | none while flags off |
| **7** | WP10 lifecycle, membership revalidation, two-phase delete, erasure receipts, telemetry, rollback | flags off | none while flags off |
| **8** | WP11 evidence, panels, certification, staged rollout | flags progressively **on** | gated per §14.3 rollout |

Production migrations (Wave 4 and Wave 6) are **not** run at merge. They follow the
production migration gate in §5 and require explicit founder authorization.

---

## 4. Agent lane model

The integration owner is the single architecture and integration owner and personally
reads the controlling contracts and inspects every lane diff. Agents own bounded,
non-overlapping paths.

**Wave 0 — read-only orientation (running):**

| Lane | Ownership | Output |
|---|---|---|
| Drift auditor | read-only | every plan-cited seam revalidated against `3682bf7`, CONFIRMED/DRIFTED/FALSE |
| Mutation inventory auditor | read-only | complete ambient-cookie call-site inventory, classified and risk-ranked, with the CI guard pattern |
| Analytics truth auditor | read-only | tag-vs-workspace blast radius, flag blast radius, live/ported/stale/synthetic classification, dead route targets |

**Wave 1+ — editing lanes**, each on its own worktree and branch, single-writer:

| Lane | Owns | Never touches |
|---|---|---|
| Project Platform | `src/lib/projects/**`, `src/server/projects/**`, ADR, shared types, URL contract | product UI |
| Timeline Safety & Data | `src/modules/timeline/**`, `drizzle-timeline/**` | anything else; sole Timeline schema writer |
| Tasks & Shared Chrome | Tasks routes/actions/runtime, sidebar, Studio Bar, mobile nav, command UI | Timeline/Notes internals |
| Notes | `src/modules/notes/**`, `drizzle-notes/**` | Tasks/Timeline internals |
| Home / Briefing / Analytics | Home, Full Briefing, Project Overview, Read Scope, `src/modules/signal/**` | shared chrome (interface request) |
| Lifecycle / Operations | allocated cross-product ops, telemetry, flags, rollout, rollback | other lanes' module files |
| Experience Lab | `/lab/**` routes and lab-local fixtures only | production chrome |
| Verification Architect | cross-product harnesses, shared Playwright journeys, evidence manifest | product implementation files |

Every handoff carries: base SHA, commit SHA, files changed, behaviour changed, exact
tests and results, assumptions, remaining risks, and confirmation that no unrelated
change was included.

**Independent review wave** after integration, fresh read-only reviewers against the same
commit: authorization/privacy · data integrity/concurrency · UX/accessibility/first-contact
· Next.js/performance. Implementers never certify their own work.

---

## 5. Gates

**Founder gates — the only expected pauses:**

1. **Wave 5 design selection.** Two picks in one sitting: the Active Project control
   (A Studio Bar anchor / B canvas band / C command-led / Wildcard) and the Home
   Analytics composition (Editorial Briefing / Evidence Ledger / Plan Trace / Hybrid).
   Both arrive with protected previews, screenshots at four canonical viewports, panel
   verdicts, and a recommendation. An agent or panel vote is never a substitute for the
   founder's selection.
2. **Production migration authorization** (Wave 4/6) — required before any production
   schema write or backfill, and only after backups, demonstrated restore, ledger
   fingerprints, read-only inventory, isolated-copy rehearsal, second-run no-op proof,
   and a rollback manifest all exist.
3. **Customer-visible Analytics label** — "Signal Analytics" stays internal. The local
   view's label and route contract need approval at the Wave 5 gate.

**Hard blockers that stop a lane** (not the programme): ambiguous production Timeline
mappings, missing credentials, a failed backup/restore receipt, an unresolved legal or
privacy decision, or a destructive operation without a proven rollback path. When one
lane blocks, every independent lane continues.

---

## 6. Honest scale

The Active Project plan estimates **15–22 focused engineering days** for one senior
implementer, plus human selection and certification gates; ~8–12 days for the safe core
journey without the broader lifecycle and analytics work. Signal Analytics is a further
programme on top of that.

Parallel agent lanes compress calendar time materially, but they do not compress the
gates: the founder selection, the human true-newcomer First Contact test, and the
production migration authorization are all real-world dependencies. **This programme
will not complete in one session, and any claim that it had would be false.** The
merge-and-deploy-per-wave cadence exists precisely so progress is observable and
reversible throughout.

What is *not* negotiable regardless of time pressure: no inferred Timeline binding, no
production write without receipts, no synthetic fixture presented as live proof, no
skipped selection gate, and no "done" claimed on unverified work.
