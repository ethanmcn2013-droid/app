# Current state

Short and current by design. A resumed session reads this first.

**Updated:** 2026-08-12 20:47 BST

## Where the programme is

| | |
|---|---|
| **Integration SHA** | `bd64db9` on `feat/home-operating-layer` |
| **Base** | `78021c5` = `origin/main` (PR #125, Project Truth Wave 0, merged 20:4x today) |
| **Worktree** | `_wt-home-layer` — clean apart from Wave 0 records being committed |
| **Active wave** | 0, closing |
| **Active writers** | none |
| **Preview URL** | none. Local review-mode server only, port 3212, `home-layer-review` in `.claude/launch.json` |
| **Flags** | none created. All five planned flags remain unwritten and default-off by design |
| **Founder pause** | not reached (Wave 3) |

## What is done

- Clean base proven and re-proven through one drift checkpoint (base moved mid-wave when
  PR #125 merged; rebased lead-owned, zero conflicts, zero `src/` delta).
- Collision register written and re-taken. Three live lanes identified and routed around.
  No foreign file read as authority or written to.
- Baseline receipt at `a849fc4`: 15 pass, 1 genuine pre-existing failure, 2 ordering
  artifacts since resolved. Inherited to `78021c5` with justification recorded.
- Four read-only audits complete — 3,088 lines with file:line citations across routes,
  domain/permissions, design system, and release machinery.
- Current-product structural evidence captured: 30 route × viewport captures with ARIA
  snapshots and a landmark/heading audit, from the running review-mode server.
- Charter, reconciliation table, risk register (15 entries) written.

## Open blockers

| ID | Blocker | Owner |
|---|---|---|
| `R-H08` | The 9.5 quality council cannot return a pass (1,352 human scores required, automation barred, `continue-on-error` in CI). Wave 10 is unachievable as specified until the open founder decision on gate scope is taken. | **Ethan** |
| `R-H10` | `/lab` has no authentication guard at all. The protected preview the founder pause depends on must be built before Wave 3 deploys. | Lead, Wave 2 |
| `R-H11` | Every Tasks mutation binds tenant to the `tasks_active_ws` cookie across 80 call sites. Cross-Project mutation silently no-ops. Workspace-parameterised actions are a prerequisite for Waves 6 and 7. | Lead, Wave 1 |
| `R-H01` | 0.9 KB of shared-runtime headroom for the entire programme. Binds the lab, not just implementation. | Lead, standing |
| `R-H12` | No Inbox event store, no approval primitive, no analytics history writer. Waves 6 and 8 are new schema, not migrations. | Lead, Wave 1 |

## Highest-priority next package

**Wave 1, package 1: adopt and revalidate the Project contract.**
`docs/adr/0001-canonical-project-identity.md` and `docs/wave/**` are now present at the base.
Three-way compare their conclusions against this programme's audit findings and current
`origin/main`, classify each as STILL TRUE / DRIFTED / RESOLVED / NEW CONFLICT, and record the
result in `RECONCILIATION.md`. Then name the one canonical membership seam (`R-H13`).

Do **not** create `src/lib/projects/**` — `lane/wp2-project-platform` owns it and is still
uncommitted-to-main. Re-take the collision register before any Wave 1 write.

## Exact next command for a resumed session

```bash
cd C:/Users/ethan/signal-studio-workspace/_wt-home-layer
git fetch origin && git log --oneline -1 origin/main   # confirm the base has not moved again
cat docs/projects/home-operating-layer/CURRENT_STATE.md
cat docs/projects/home-operating-layer/REPOSITORY_TRUTH.md
```
