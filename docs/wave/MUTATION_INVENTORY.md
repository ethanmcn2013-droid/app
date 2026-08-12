# Ambient active-workspace inventory (WP3 source of truth)

**Audited:** `3682bf7`, read-only. **Supersedes the plan's "104 call sites across 43 files."**

## Headline

**95 ambient call sites across 39 files.**
Derived as: 100 raw `getActiveWorkspace()` textual matches − 1 definition (`src/server/auth.ts:147`)
− 1 error string (`src/server/db/tenant.ts:37`) − 3 test-guard string literals
(`src/server/tasks-security-regression.test.mjs:279,494,515`).

| Classification | Count | | Risk | Count |
|---|---:|---|---|---:|
| `scoped-create` | 30 | | **critical** — cookie is the *sole* write destination | **36** |
| `object-mutation` | 25 | | **high** — wrong-Project read/leak, silent dropped write, or wrong-Project artefact | **40** |
| `scoped-read` | 27 | | medium | 17 |
| `export-print` | 6 | | low | 2 |
| `route-fallback` | 2 | | | |
| `compat-seam` | 5 | | | |

By context: 79 Server Actions · 14 Server Components/layouts · 1 Route Handler · 1 plain module · **0 client**.

## The accessor family

| Accessor | Definition |
|---|---|
| `getActiveWorkspace()` | `src/server/auth.ts:147-180` — **the** ambient accessor |
| `ACTIVE_WORKSPACE_COOKIE = "tasks_active_ws"` | `src/server/auth.ts:30` |
| `getActiveWorkspaceNameAction()` | `src/server/actions/import.ts:183-191` |
| `getMyRoleInActiveWorkspace()` | `src/server/actions/settings.ts:52-68` — gates every owner-only settings mutation |
| `resolveCallerTaskWorkspace(taskId)` | `src/server/actions/comments.ts:58-67` — takes a task id but resolves ambiently |
| `compileDailyDigest(userId?, workspaceId?)` | `src/server/db/daily-digest.ts:39-44` — fallback currently unreachable |
| `getCurrentWorkspace(userId, requested?)` | `src/modules/timeline/server/auth.ts:112-128` — Timeline-side, `workspaces[0]` fallback at `:126` |

**Exactly one `cookies()` read resolves a workspace:** `src/server/auth.ts:151-152`. Every
other cookie touch in `src/server/**` and `src/app/**` writes or deletes.

**`getActiveWorkspace()` has three fallbacks, not one:** cookie → **first membership**
(`:169-174`) → **`ws-legacy`** (`:179`). The latter two are silent guesses; the third hands
out a workspace with no membership proof (see DECISIONS D-005).

## Critical sites (36) — the cookie is the sole write destination

`attachments.ts:162` · `billing.ts:72` · `board.ts:{134,176,212,237,264,287,347,406,475}` ·
`comments.ts:61` · `comp.ts:295` · `import.ts:118` · `onboarding.ts:{40,112,160}` ·
`project-overview.ts:{439,469}` · `roll-forward.ts:32` · `room.ts:177` ·
`seed.ts:{53,69,87}` · `settings.ts:{77,119,142,161,180,217,264,288,355,680,788}` ·
`share.ts:73` · `tags.ts:{90,110,124}` · `tasks.ts:524` · `templates.ts:45`
(all under `src/server/actions/`).

`seed.ts:53` and `:87` are `db.delete(tasks).where(eq(tasks.workspaceId, ws))` — **destructive
bulk operations keyed solely by the cookie.** `settings.ts:788` destroys the Project itself.

## The dominant pattern, and why the risk split matters

Most object mutations use the ambient `ws` as an **AND-guard** against the object's own
workspace. A wrong Project therefore produces a **silent refusal that returns success**, not
a mis-targeted write — e.g. `tasks.ts:{114,159,391,613,657,737,794}`,
`timeline-drag.ts:46` (`returns {ok:true}`), `board.ts:590`, `attachments.ts:297`,
`comments.ts:168`, `resources.ts:228`, `share.ts:145`.

That is data loss with false success, graded **high**, kept distinct from the 36 sites where
the cookie *is* the destination. Recorded rather than collapsed, because the two need
different fixes: the 36 need an explicit Project parameter; these need object-derived Project.

**Outlier:** `src/server/actions/tasks.ts:884` `setTaskMilestoneAction` is the only task
mutation with **no pre-read guard** — a bare scoped UPDATE. Behaviourally equivalent today,
but it is the one site where the guard is structural rather than explicit.

## Named deep-link defects — all five confirmed

1. **`/app/task/[id]`** — `src/app/app/task/[id]/page.tsx:16-17`. Its own comment says
   `// Not found or wrong workspace`. Accepts no Project param.
2. **Notes-to-Tasks receipts** — the receipt *knows* the destination
   (`notes-task-send-contract.ts:19,138`) but the URL builder drops it (`:94-97`).
   **The delivery write itself is already safe and explicit** —
   `src/app/api/notes-extract/v2/route.ts:142-168` binds the destination in the HMAC
   assertion and reauthorizes membership. Only the link is defective.
3. **Home evidence links** — `home-data.ts:82-84` emits `/app/task/${id}`, no Project.
   Home's briefing is built cross-workspace, so a row sourced from B lands on defect 1.
4. **Full Briefing evidence links — a *different* defect.** The builder **does** carry the
   Project (`ledger-task-target.ts:53-57` emits `workspaceId`), but **the destination
   discards it**: `src/app/app/tasks/page.tsx:18-22` reads only `welcome`, and
   `tasks-runtime-shell.tsx:68` then calls `getActiveWorkspace()`. The only route consuming
   `workspaceId` is `src/app/app/page.tsx:17-29`, which requires `contextVersion=2` — never
   set by the ledger builder. **Do not bundle this with defect 3; they need opposite fixes.**
5. **Print routes** — `src/app/print/{layout.tsx:13,board/page.tsx:8,list/page.tsx:7,
   timeline/page.tsx:6,calendar/page.tsx:6}`. No print route accepts `searchParams` at all.
6. **Project Overview** — `src/app/app/project/page.tsx:20-22`, resolving at
   `project-overview.ts:239`. Both its mutations (`:439`, `:469`) resolve the same way.

## Allowlist — 3 files may keep ambient lookup

| File | Justification |
|---|---|
| `src/server/auth.ts` | The central resolver — the one place the cookie may be read. Gains an optional explicit-Project parameter validated against membership; cookie demoted to last resort. Its second and third fallbacks are in scope for removal. |
| `src/components/app/tasks-runtime-shell.tsx:68` | The one legitimate `route-fallback`: bare `/app/tasks` must land somewhere. Allowlisted **only on condition** it prefers an explicit Project from the route. Everything downstream inherits this value — the highest-leverage single fix in WP3. |
| `src/app/welcome/page.tsx:39` | First-run provisioning; no explicit Project exists yet. Genuinely ambient. Already guarded at `:40-46`. |

**Two named compat seams to delete, not allowlist:**
`src/server/db/daily-digest.ts:44` (fallback unreachable — both callers pass explicit ids;
make the parameter required) and `src/server/actions/import.ts:107` (resolves ambiently only
to label a zero-row no-op).

## CI source guards

**Guard A — accessor allowlist (primary ratchet).** Baseline today: **93 lines**. Pin and drive to zero.
```
rg --glob 'src/**/*.ts' --glob 'src/**/*.tsx' \
   --glob '!src/server/auth.ts' \
   --glob '!src/components/app/tasks-runtime-shell.tsx' \
   --glob '!src/app/welcome/page.tsx' \
   --glob '!src/**/*.test.*' 'getActiveWorkspace\s*\('
```

**Guard B — raw cookie name outside the resolver.** Currently clean.
**Guard C — cookie *reads* outside the resolver.** One legitimate hit,
`src/server/actions/planning.ts:289` (delete-if-current); refactor behind an
`isActiveWorkspace(id)` helper rather than allowlisting a line number.

**Guard D — mutation-time ambient usage must NOT be a file-level regex.** The obvious
pattern under-reports: it misses `src/server/actions/{onboarding,set-parent}.ts` because
their writes are formatted `await db⏎  .update(...)`, and will still miss `tx.insert`,
`db.run(sql\`…\`)` in helpers, and re-exported writers.

**Build Guard D as a Node source guard** modelled on the existing
`src/server/tenant-scope.test.mjs` / `tasks-security-regression.test.mjs` pattern — both
already parse action bodies, assert boundary ordering, and run in `pnpm test`. It walks each
exported `"use server"` body and fails when it contains `getActiveWorkspace(` **and** any of
`db.insert|db.update|db.delete|db.run|db.transaction|tx.*`, unless allowlisted. A regex-only
version is a lower bound, not a proof, and must be labelled as such.

## Not yet audited

The Timeline and Notes modules were not audited for **their own** ambient patterns beyond
the accessors above. `src/modules/timeline/server/auth.ts:112` `getCurrentWorkspace` and its
`workspaces[0]` fallback at `:126` are the same class of defect in the Timeline lane and are
unexamined. **WP3 scope must be extended to cover them.**
