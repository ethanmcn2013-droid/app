# WP6 surface map — where the Studio Bar anchor lands

**Cut:** 2026-08-17, against `origin/main` post-#141 (verified read-only trace; lab
reference read from `lab/lab-active-project` @ `bbcc7b7`). This map exists so the WP6
build lanes start from evidence, not re-discovery. Verify a citation before leaning on
it if main has moved materially.

## 1. The slot

The Studio Bar's centre run — `src/components/studio-bar/studio-bar.tsx:207-216` — is
an empty flex-1 span (`data-slot="signal-pulse"`, reserved and unused). That is where
variant A mounts. The bar's own header comment (`:12-17`) records that a workspace
dropdown USED to live in `IdentityCell` and was deliberately removed in the Phase-1
header cleanup; WP6 is re-adding a control to chrome that once existed, which reviewers
must know. Bar height rides a remapped spacing scale (`:189-198` — `h-14` /
`md:h-10` where h-10 is 64px, tap targets fixed at 44px absolute) governed by
`scripts/check-chrome-contract.mjs` and `content/hq/decisions/product-header-contract.md`
— the lab's literal `h-[56px]` must be reconciled, not copied.

**Mobile:** no context strip exists. `MobileSuiteNav` (bottom product tabs) hides
itself on Tasks; the only mobile door into Project switching is a Tasks-board-embedded
drawer trigger (`src/components/hybrid/options/b/workspace-brief.tsx:368`). The lab's
sticky 48px safe-area strip (variant-a.tsx:170-178) is genuinely new UI.

**Dormant data pipe:** `studio-chrome-context.tsx` publishes `workspaces` +
`activeWorkspaceId` from the Tasks-only runtime; `StudioBar` reads only `edition`. A
second, older, Tasks-only chrome channel sits beside the new suite-wide
`ActiveProjectProvider` — retire or reconcile, never feed both.

## 2. The platform WP6 consumes (all merged, all real)

- `src/lib/projects/flags.ts` — `isActiveProjectV3Enabled()`, truthy set, default off.
  Server decides once; client reads `enabled` off context, never the env var.
  Gate pattern pinned by `active-project-contract.test.mjs:209-218,263-268` — extend
  that file, do not invent a second gate.
- `src/lib/projects/project-ref.ts` — brands (`ProjectId`, `LabelId`…), capabilities,
  `ProjectSummary`, route states.
- `src/lib/projects/project-url.ts` — `buildProjectUrl`, `withActiveProject`,
  `canonicaliseProjectUrl`, `PROJECT_DESTINATION_SURFACES` (6, per D-020).
- `src/lib/projects/route-snapshot.ts` — the navigation-epoch machine:
  `stampSnapshotEpoch`, `decideSnapshotCommit`, `reduceActiveProject`, `chromeFor`.
- `src/server/projects/active-project-cookie.ts` — `writeActiveProjectCookie` is the
  ONE sanctioned writer; unified name `signal_active_project`.
- `src/server/projects/catalog.ts` — `buildProjectCatalog`,
  `listProjectCatalogPage` (2000-row limit), `firstMembershipByCatalogOrder`.
- `src/server/projects/request-scope.ts` — `getProjectCatalog` (React.cache),
  `resolveActiveProjectForRoute`; the cache boundary takes primitives only.
- `src/server/projects/resolve.ts` — never-substitute precedence: explicit URL →
  cookie → legacy cookie → first-active → `empty` (D-005).
- `src/server/projects/route-authz.ts` — `resolveProjectForRoute`,
  `requireRouteProjectId`, `authorizeObjectProject` (ADR §9).
- `src/components/app/active-project-provider.tsx` — `useActiveProject()`,
  `selectProject(project, destination)` is the real guarded one-at-a-time entry point;
  `ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH = 168`.
- `src/server/actions/active-project.ts` — `switchActiveProjectAction`, the one
  caller of `writeActiveProjectCookie`.

Contract tests guarding the seam: `active-project-contract.test.mjs`,
`route-authz-contract.test.mjs`, plus the per-module unit suites (catalog,
capabilities, resolve, project-ref, project-url, route-snapshot,
active-project-machine).

## 3. D-021 — the five legacy cookie writers, current state

| # | Site | State |
|---|---|---|
| 1 | `src/app/api/suite-context/route.ts:60` | attributes fine; **behaviourally open** — still rewrites the preference on a contextual link, contradicting ADR 0001 §4. "Needs a decision, not a patch." |
| 2 | `src/server/actions/cross-workspace.ts:199` | fixed by WP3 |
| 3 | `src/server/actions/planning.ts:1252` | was already complete |
| 4 | `src/server/actions/settings.ts:801` | **still missing httpOnly + secure** |
| 5 | `src/server/actions/templates.ts:151` | fixed by WP3 |

None of the five have migrated to `writeActiveProjectCookie` yet; all still set
`ACTIVE_WORKSPACE_COOKIE_NAME` (`src/server/auth.ts:290`) directly. Consolidation is
WP6's precondition work.

## 4. Legacy switchers to retire or repoint

1. **Tasks sidebar** — `projects-sidebar.tsx` (`ProjectsSidebar`), chooses via
   `selectWorkspaceAction` (writer #2) + `router.refresh()`. Its data source is
   `getProjectsTreeData()` (`src/server/actions/projects-tree.ts:73-178`) — entirely
   independent of the WP2 catalog, no shared bucket, no capabilities, no
   disambiguator. "Driven by the same catalog" = swap to `getProjectCatalog`, then
   reconcile grouping in the UI.
2. **Timeline switcher** — inside `[projectSlug]` (`_components/project-switcher.tsx`),
   path-segment routing, no cookie write. Route-topology change (D-004), WP7's.
3. **Notes and Home have no switcher at all.**

## 5. D-022 — still open, and a hard precondition

`TasksRuntimeShell` is mounted from **nine** `layout.tsx` files; layouts cannot read
`searchParams`, so the board cannot follow `?workspaceId=`. The interim withholding is
live in prod: `src/app/app/tasks/page.tsx:43-110` renders `ProjectMismatch` instead of
substituting. **Ship the visible bar control before this lands and it visibly cannot
change the Tasks board** — the worst possible first impression of the exact feature
this programme exists to build.

## 6. The guarded transition — one part must be invented

Production already has: the one-at-a-time ref guard, archived rejection, pending
labelling (`selectProject`), and the server action's failure reasons. Production does
NOT have any host signal for unsaved work: the only real "dirty" tracking is local to
`NotesWorkspace.tsx:742-758` behind a same-tab `beforeunload`. The lab's
`unsaved-work` / `notes-draft` states were simulated by the lab's own state selector.
**This signal is designed from scratch in WP6** — likely a small shared context beside
`active-project-provider.tsx` that Notes (and later Tasks editors) publish into.

Portable lab logic (read from `lab/lab-active-project`): `model.ts` (catalog shaping,
typeahead, count messages), `use-chooser.ts` (listbox <8 / combobox ≥8, debounced
announcements — reusable as-is), `machine.ts` (the refusal table), `variant-a.tsx`
(composition + the `.ap-r` focus-ring disarm for the unlayered globals.css rule).

## 7. The consolidated service — two diverged implementations, not two copies

- **Path A** `planning.ts`: owner-role check (`requireWorkspaceOwner`), no
  `.returning()` receipts except `reorderWorkspaceAction`, delete cascades WITHOUT
  the `/p/{slug}` ISR revalidation.
- **Path B** `settings.ts`: capability check (`provedSettingsProject`), and its
  `deleteWorkspaceAction` DOES revalidate the published page (incident E06.12,
  2026-08-03) — a fix Path A lacks. Deleting the same Project from sidebar vs
  Settings has different observable behaviour for a live bearer link today.

The merge must be explicit and evidenced: keep the ISR fix, keep the capability
idiom, add write receipts. A mechanical dedupe reintroduces a fixed bug or narrows a
permission check.

## 8. Proposed lanes (file-disjoint)

- **A · Chrome** — studio-bar centre cell + new `studio-bar/active-project/*` (port
  variant-a onto `useActiveProject` + `getProjectCatalog`) + the mobile strip +
  layout mount. Must satisfy `check-chrome-contract.mjs`.
- **B · D-022** — nine layouts → pages, retire `ProjectMismatch` withholding once the
  real switch works. Gates lane A's Tasks enablement; A can demo on other surfaces
  meanwhile.
- **C · Guarded transition + retirement** — the new unsaved-signal context, wire into
  `selectProject`, repoint `ProjectsSidebar`, close D-021 #4 and decide #1.
- **D · Consolidated service** — one module, one authorization idiom, receipts,
  ISR fix preserved; `planning.ts`/`settings.ts` repointed. Publishes signatures
  early so A and C code against them.

Risks, ranked: (1) shipping A's control before B lands; (2) underestimating the
unsaved-signal invention in C; (3) a silent dedupe in D.
