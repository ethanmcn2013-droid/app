# Current state

Short and current by design. A resumed session reads this first.

**Updated:** 2026-08-12 22:4x BST

## Where the programme is

| | |
|---|---|
| **Integration SHA** | `11b60c7` on `feat/home-operating-layer`, 8 commits ahead |
| **Base** | `c592e83` = `origin/main` (rebased through three drift checkpoints: `a849fc4` → `78021c5` → `c592e83`) |
| **Worktree** | `_wt-home-layer`, clean |
| **Active wave** | 2 — fixture universe and harness, running in background |
| **Waves done** | 0 (base, audits, baseline, evidence) · 1 (ten contracts, sealed and compiling) |
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
