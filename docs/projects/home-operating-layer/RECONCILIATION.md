# Reconciliation — one programme, four instruction sources

Required by the master brief §3 before any product edit. This table resolves who owns
what, so the Home report, the Analytics prompt, the live Project Truth programme and the
current code never produce two answers.

**Status:** authority model settled (lead decision). Factual rows marked *pending audit*
are completed from the Wave 0 auditor reports, not from assumption.

## The four sources

| Source | Governs | Does not govern |
|---|---|---|
| **Home report** (`signal-studio-home-operating-layer-research-and-panel-report-2026-08-12.md`) | Suite information architecture, route hierarchy, mode ownership, product taxonomy, shell behaviour | Analytics truth classes, Project identity, visual certification |
| **Analytics prompt** (`opus-5-signal-analytics-master-execution-prompt.md`) | Analytics truth classes, metric safety, evidence, snapshots, history, permissions, Project Lens, synthetic-vs-live proof | Suite IA, shell, route hierarchy |
| **Project Truth programme** (`feat/project-truth-wave`, PR #125 + lanes) | Canonical Project identity, Timeline exact-Project resolution, the Analytics R1–R10 defects, `src/lib/projects/**` | Home IA, the Home design lab, the Home release programme |
| **This programme** | The only shell, the only Home design lab, the only shared ranking seam, the only release programme | Re-deciding any of the above |

**Hard rule:** never create two Home shells, two design labs, two ranking engines, two
Inbox stores, or two Analytics implementations.

## Reconciliation table

| # | Topic | Resolution | Basis |
|---|---|---|---|
| 1 | **Route ownership** | This programme owns the `/app/home/**` family. The locked URL contract (`docs/SUITE_URL_AND_NAMING_CONTRACT.md`) is executable authority via `src/lib/suite-contracts.v1.json`, `src/lib/product-urls.ts`, `src/proxy.ts`, `next.config.ts`. Adding `/app/home/{inbox,my-work,analytics}` **requires updating that contract and the matching Studio decision record in the same release** — this is a Wave 4 deliverable, not a Wave 9 cleanup. | URL contract §"Implementation authority", §"Migration rule" |
| 2 | **Active Project vs Home Read Scope** | Two independent axes, never one "scope" variable. Active Project = the one exact Project a product route or write may target. Home Read Scope = what authorized work may be *read together* (`all` \| `project` \| `planning-period`). Choosing All projects or a Planning Period never mutates Active Project. | Brief §10.2 |
| 3 | **Planning Period vs Analytics Time Window** | Planning Period groups Projects. Time Window selects *when*. Neither is the other; neither is an authorization grant or a mutation target. The lab pins a Last-12-weeks comparison window for determinism; current-state exceptions keep their explicit as-of instant. | Brief §10.2 |
| 4 | **Today / Full briefing ranking** | One deterministic engine, shared. Two ranking implementations is an automatic veto. Existing briefing build logic (`src/modules/signal/lib/briefing/**`) is the incumbent — Wave 5 either extends it or replaces it wholesale, never forks it. | Brief §14; incumbent located at base |
| 5 | **Inbox content and state** | One canonical store, one badge definition, one state machine. The global Inbox affordance and the Home-local link resolve to the same route and count. V1 kinds: mention, reply, review-requested, approval-requested, handoff, explicit-block. Invitation excluded pending a separate sealed `InviteEventContract`. | Brief §15.1–15.2 |
| 6 | **My work source coverage** | V1 is complete and truthful for assigned/owned **Tasks** across authorized Projects. Notes and Timeline join only on a structured accountable object with stable owner identity, authorization adapter, source revision and mutation receipt. If the label stays "My work" while V1 is Tasks-only, a coverage receipt sits at the view introduction. | Brief §16.1 |
| 7 | **Analytics Project identity** | **Adopted from Project Truth, not re-derived:** Project = canonical Tasks `workspaces.id`. Tags become Labels/Workstreams. Timeline slugs are subordinate artifact identities. Analytics accepts one authorized Project or an opaque authorized Project set from HomeReadScope — the existing workspace→project scope nesting is replaced. | ADR 0001 (foreign-owned, adopt after PR #125 merges) |
| 8 | **Visual-lab ownership** | This programme owns the only Home design lab, at the repository's canonical `/lab` route family under a review flag plus a reviewer allowlist or protected-preview policy. Authentication + noindex alone is not protection. *pending audit: exact current `/lab` guard* | Brief §12.2 |
| 9 | **Feature flags and job gates** | Five independent responsibilities, all server-side, default-off, fail-closed: `HOME_OPERATING_LAYER_ENABLED` (umbrella), a dedicated Home Analytics view gate, `SIGNAL_ANALYTICS_JOBS_ENABLED`, `HOME_MUTATIONS_ENABLED`, per-provider kill switches, plus the review-lab flag. **Do not reuse `SIGNAL_ANALYTICS_V1_ENABLED` as a view flag if it still switches the Briefing engine.** *pending audit: what that flag currently switches* | Brief §13.5, §17.5 |
| 10 | **Legacy routes and redirects** | `/app/signal*` already permanently redirects to `/app/home/briefing` — that is settled and must not be reopened. `/app/inbox` and `/app/my-tasks` redirect only after semantic and state parity is proven. `/app/your-work` is planning administration and must **never** redirect to personal My work. `/app/project` needs an explicit keep / Manage Projects / Project Lens decision. `/app/trends` emitted actions are dead and get removed; incoming `/app/trends` gets an explicit compatibility disposition. | URL contract 2026-08-04 table; brief §19.3 |
| 11 | **Migration ordering** | Project Truth lands first (it is already in PR). This programme's Wave 1 ports the **merged** contract from `origin/main`, never by cherry-picking a lane SHA and never by merging `feat/project-truth-wave` wholesale. Their `docs/wave/PROGRAMME.md` is marked absorbed/superseded only after reconciliation, by a lead-owned edit on a merged base. | Brief §10.1; COLLISION_REGISTER §3 |
| 12 | **Quality and release gates** | The repository's own measured gate (`experience:quality`, quality-council) plus ten independent directors at 9.5. No prior research-panel score carries into visual or production certification — the Home report's 8.9 minimum certifies the *architecture*, explicitly not a rendered UI. | Home report §"Panel result"; brief §21.7 |

## Absorbed vs superseded

| Their artifact | Disposition |
|---|---|
| `docs/adr/0001-canonical-project-identity.md` | **Adopt** after revalidation against the merged base. Do not author a competing ADR. |
| `docs/wave/ANALYTICS_TRUTH.md` (R1–R10) | **Adopt as release blockers** for our Wave 8. Re-run each audit against the merged base and classify STILL TRUE / DRIFTED / RESOLVED / NEW CONFLICT. |
| `docs/wave/MUTATION_INVENTORY.md` | **Adopt as input** to our My work writeback and Inbox source-action contracts. |
| `docs/wave/PROGRAMME.md` | **Superseded** by this programme's wave plan for Home surfaces — recorded after reconciliation, not before. Their historical merge/deploy cadence, separate founder gates and flag plan are **not** executed in parallel with ours. |
| `src/lib/projects/**` (in flight) | **Consume.** This programme does not create a second ProjectScope foundation. |

## Standing conflicts recorded, not silently reconciled

1. The master brief cites `feat/project-truth-wave` at `9880694`; the branch is at `d4d9295`
   and the WP0 commit was rebased to `c598bd0`. The brief's SHA is stale.
2. The Home report cites `origin/main` at `3682bf7` and reads current-product evidence out of
   `_wt-design-audit`. Both are superseded by base `a849fc4`. Its *architecture* conclusions
   stand; its *file-line citations* must be re-derived against our base before use.
3. `src/lib/product-urls.ts` is simultaneously (a) locked executable URL authority, (b) being
   modified uncommitted by `lane/wp2-project-platform`, and (c) required by our Wave 4 route
   family. Sequencing, not concurrent editing, is the only safe resolution.
