# Tasks · GTM Phase Plan

**Window:** drafted 2026-05-07 · Plan covers 144 roadmap items live in `roadmap_items` (deterministic IDs from `src/server/roadmap/parser.ts`). Of 144 items, **~6 are fully autonomous** for Claude (Phase 1 — code, drafts, renders, research), **~96 are Claude-prepares-then-user-clicks-send** (Phase 2 — every social post, every press email, every cross-post, every form submit), and **~42 are user-blocked** (Phase 3 — purchases, handle claims, recordings, paid runs, the live launch beats themselves).

The leverage move is to drain Phase 1 in the next 7 days so that by 2026-05-14 every Phase-2 item has a queued draft sitting in `docs/posts-week-N.md` or a Gmail draft, and the user's only job is the click-to-send mechanical step. Posts weeks 1–3 and the 15 press emails are already drafted, so Phase 2 starts the loop already partly fueled.

## Phase classification rubric

- **Auto** — Claude can fully complete with no user touch (code, content drafting, file rendering, research, asset composition, calendar holds via MCP).
- **Stage** — Claude prepares to one-tap completion; the user then takes the final mechanical action (post, send, click submit, accept Calendar invite). The DB cycle to `completed` happens only after the user confirms the action.
- **Blocked** — fully gated on user (purchase, account claim, live launch beat, ad spend, recording session). Claude cannot move these forward and should not classify them as Phase 1 or 2.

---

## Phase 1 — execute now (Auto)

| roadmap-item-id (suffix) | kind | What Claude does | Verify | Min | Dispatch |
|---|---|---|---|---|---|
| `app-redirect-to-sign-in-…-1` | asset | Fix `/app/*` redirect — Clerk `signInUrl` env or `auth.protect({ unauthenticatedUrl })`. | curl -I /app/board returns 302 → /sign-in | 30 | dev-agent A |
| `30-second-hero-loop-video-…-4` | asset | Render `HeroLoop30s.tsx` to `public/hero-loop.30s.{mp4,webm}`; wire `<video autoplay muted loop>` block onto landing if not present. | files exist; landing has video block | 90 | dev-agent B |
| `at-least-one-published-p-slug-…-3` | asset | Seed one wedding workspace, run publish flow, confirm `/p/{slug}` renders with OG card. | curl /p/<slug> 200 + valid OG meta | 45 | dev-agent C |
| `press-email-list-15-contacts-11` | asset | Resolve 6 `[VERIFY OPENER]` flags in `docs/press-drafts.md` (rows 1, 3, 4, 8, 13, 15) via WebFetch; verify Sherwood masthead (row 4). | press-drafts.md has zero `[VERIFY OPENER]` strings | 60 | research-agent |
| `kpi-w1-2026-05-11-monday-standup` | kpi | Pre-fill W1 row in `docs/kpi-log.md` with baseline-zero placeholders. | row W1 has zeros | 5 | dev-agent D |
| `posts-week-4-through-week-8-drafts` | post (45 rows) | Extend the verbatim deck pattern from `posts-week-1/2/3.md` into `posts-week-4.md` → `posts-week-8.md`. Voice-match. | each gtm-plan.md §7 W4–W8 row has a verbatim post body | 120 | dev-agent E |

**Phase 1 explicitly does NOT include:** any actual posting, any actual emailing, any purchase, any handle claim. Those stay Phase 2 or 3.

**Atomic, file-scope-disjoint buckets** for parallel dispatch:

1. **P1-A · Redirect bug** — `src/proxy.ts` + Clerk env. Touches: proxy.ts, possibly `src/app/sign-in/`. (`asset-w0-app-redirect…-1`)
2. **P1-B · Hero render + landing wire** — read-only on `~/Projects/approvals-motion/src/compositions/HeroLoop30s.tsx`; writes `~/Projects/tasks/public/hero-loop.*`; touches landing hero component.
3. **P1-C · Seed published `/p/` workspace** — DB seed via existing publish flow. Server-actions scope.
4. **P1-D · Press-draft opener verification** — `docs/press-drafts.md` only. Read-mostly with targeted edits to 6 rows.
5. **P1-E · Posts W4–W8 drafting** — `docs/posts-week-{4,5,6,7,8}.md` only. Brand voice match.
6. **Reviewer audit pass** — read-only.

Estimated wall-clock for Phase 1 if dispatched in parallel: **4–6 hours**.

---

## Phase 2 — Stage for user (Auto, then Stage)

Claude finishes the asset and queues the action; user fires. Mark roadmap item `in_progress` when the draft is ready; `completed` only after user confirms send/post.

**Sub-buckets:**

- **P2-1 · Social posts (~91 items, all `kind=post`).** W1–3 already drafted; W4–8 drafted in P1-E. Each row maps 1:1 to a verbatim post.
- **P2-2 · Press emails (12 actionable rows).** Drafted at `docs/press-drafts.md`. On 2026-06-08 user opens Gmail, pastes each draft body, sends. Optionally Claude pre-creates Gmail drafts via MCP once authorized.
- **P2-3 · Form submits (5 items).** Sidebar.io, Designer News, Refind. Claude prepares paste-bodies; user submits.
- **P2-4 · HN/IH cross-posts (7 items).** Per `docs/syndication.md` template. Bodies pre-composed; user posts.
- **P2-5 · YouTube uploads (1–5 items, depending on Phase 3 unblocks).** Hero loop only is auto; the rest gated on recording.
- **P2-6 · Asset drafts ready for user-action.** Product Hunt page draft → `docs/product-hunt-page.md`; user pastes.
- **P2-7 · Calendar holds.** Google Calendar MCP — KPI Mondays, Show HN, PH, IH.

---

## Phase 3 — User-blocked

Listed for transparency, grouped by what unblocks them:

- **A · Domain purchase + DNS** (target 2026-05-07) — unblocks `asset-w0-custom-domain-…-0` and the URL-swap cascade across all post/press drafts.
- **B · ElevenLabs Creator + PVC clone** (target 2026-05-15) — unblocks PVC-clone asset, 90s walkthrough, 3-min founder explainer, and the YouTube W3 Wed + W5 Wed uploads.
- **C · Handle claim** (X `@taskshq`, Bluesky `taskshq.bsky.social`) (target 2026-05-11) — unblocks every X / Bluesky post row + the two profile-asset rows.
- **D · ScreenStudio recording session(s)** (target 2026-05-22 → 2026-06-08) — unblocks the 90s/3min videos and YouTube short rows W4/W6/W7/W8.
- **E · Sentry alert config** (target 2026-06-15) — `asset-w0-sentry-pager-…-2`.
- **F · Paid spend authorization** — $300 Reddit Ads (W4 Mon 06-01) and $200 IG boost (W5 Mon 06-08). Claude prepares creative + copy + targeting brief; user funds and launches.
- **G · The live launch beats** — Show HN 06-16, PH 06-23, IH 06-24 plus their press-Gantt mirrors. User actions.
- **H · Weekly KPI write-ups** — W2–W8 KPI rows. User reads PostHog/Stripe/HN/PH numbers.

---

## Milestone map (current — updated 2026-05-07 after Phase 3 prep)

| Phase | Started | Items planned | Items completed | Items deferred |
|---|---|---|---|---|
| 1 | 2026-05-07 | 6 buckets · 5 single rows | **5 single rows ✅** + 95 post-drafts staged into Phase 2 | 1 (cooldown "ship one small thing" placeholder) |
| 2 | 2026-05-07 — drafts staged | 96 | 0 (96 `in_progress`: PH page + 95 post drafts) | 0 |
| 3 | 2026-05-07 (prep underway) · launch beats 2026-06-16 / 06-23 | 42 (user-blocked roadmap items) + 233 (engineering / QA / launch-readiness action items) | **20/233 action items** ✅ — see `docs/launch-checklist.md` for the on-the-day list | 0 |

**Phase 3 prep closed 2026-05-07** (the engineering / docs / verification half — the user-blocked half stays user-blocked). New artifacts on disk:
- `src/app/{privacy,terms,press,security}/page.tsx` — four hand-written legal/info pages, voice-matched, sitemap-registered
- `src/server/roadmap/parser.test.ts` — 8/8 passing parser unit tests
- `e2e/marketing-golden-path.smoke.ts` — pure-Node fetch smoke for 7 routes
- `.github/workflows/ci.yml` — lint + typecheck + parser tests on every push
- `docs/data-model.md` — where each kind of data lives + the GDPR + backup story
- `docs/brand.md` — voice, type, color, mark, motion canonical reference
- `docs/decisions.md` — D1–D17 technical/business decisions with rationale + change-our-mind triggers
- `docs/launch-checklist.md` — the single page to read on Mon 06-15 evening

**Action items closed (20):** legal pages (4) · tests/CI (3) · SEO verifications (3) · security audit (2) · perf checks (2) · docs (2) · decisions (2) · dogfooding (2)

(Counts in `roadmap_items`: completed=5, in_progress=96, pending=43. Sum 144. Architect's grid expected 6/96/42; the actual 5/96/43 is correct because the W4–W8 post-drafting work-bucket maps to 95 individual rows that all moved to `in_progress` rather than one row to `completed` — which is the right semantics: drafts staged ≠ posted.)

**Phase 1 closed 2026-05-07.** Reviewer audit pending. All Phase-1 deliverables on disk:

- `src/proxy.ts` — Clerk `unauthenticatedUrl` fix
- `~/Projects/approvals-motion/out/hero-loop-30s.mp4` (768 KB) → `~/Projects/tasks/public/hero-loop.30s.mp4`
- `/p/wedding-2026-public` — published wedding workspace, 9 tasks, OG image 200
- `docs/press-drafts.md` — 0 `[VERIFY OPENER]` flags remaining; 6 openers verified against real recent pieces
- `docs/kpi-log.md` — W1 baseline scaffold
- `docs/posts-week-{1..8}.md` — 2,522 lines, ~140 verbatim post bodies + briefs/templates/scripts

**Phase 2 staged:** 95 post-row drafts + 1 PH-page draft + 1 Reddit Ads creative now `in_progress` in `roadmap_items`. User cycles each to `completed` after the corresponding post / submission. Voice-and-URL audit by reviewer agent (next).

**Phase 2 micro-batch closed 2026-05-07.** Additional artifacts on disk:
- `docs/form-submissions.md` — 5 paste-bodies for Sidebar.io / Designer News / Refind
- `src/app/social/reddit-ads-wedding/opengraph-image.tsx` — 1200×628 wedding-vertical Reddit Ads creative
- `src/server/roadmap/ics-export.ts` + `/api/roadmap.ics` — 143-event auth-gated ICS feed for one-tap calendar import
- `docs/launch-day-show-hn.md` (382 lines) — Tue 06-16 hour-by-hour
- `docs/launch-day-product-hunt.md` (425 lines) — Tue 06-23 hour-by-hour + Wed 06-24 IH day
- `docs/product-hunt-page.md` — full PH page copy + maker-comment cadence
- `CHANGELOG.md` cycle 31 — narrating /roadmap + attachments + GTM execution prep

---

## Standing instructions for execution

- **To mark an item completed:** call `cycleRoadmapStatusAction(id)` from `src/server/actions/roadmap.ts`. It cycles pending → in_progress → completed → pending. Two calls take a fresh item from pending to completed; one call moves it to in_progress (the right state when a draft is queued but the user hasn't sent/posted yet). Use `setRoadmapStatusAction(id, 'completed')` to skip the in_progress step (post-facto bulk completion only).
- **Reviewer agents check for:** (a) voice integrity — no emojis, no "thrilled/excited/rockstar," lowercase casual, em-dashes preserved; (b) URL hygiene — every URL is `tasks-nu-hazel.vercel.app` until domain swap; (c) no roadmap_items writes outside the status-cycle path; (d) no live posting from automated dispatches; (e) the 144-item parser invariant — if a count drift from 144, the gtm-plan.md was edited and the sync layer needs to re-upsert.
- **Drift handling:** when a draft needs human review, add a `[NEEDS-REVIEW: <reason>]` token to the body and set the roadmap item's note via `setRoadmapNoteAction(id, '<reason>')`.
- **When a Phase-2 item flips to completed:** append a one-line entry to that week's retro slot in `docs/kpi-log.md` (e.g., "W2 Tue: posted X thread (5)").
- **Voice anchor:** re-read `~/Projects/tasks/src/app/about/` when in doubt.
- **Calendar import:** ICS feed available at `/api/roadmap.ics` (auth-gated). One-tap import to Google/Apple Calendar.

---

## Open questions (architect flagged for spot-check)

- **PH back-channel hunter-DM rows + r/freelance comment-only row** — currently Phase 3 because each requires user's real-time account voice. If user wants Claude to draft templates instead, move to Phase 2.
- **YouTube short rows** (W4/W6/W7/W8 Wed) — Phase 3 because each needs a fresh ScreenStudio capture. A single 30-min batch recording would move them to Phase 2.
- **`press-w0-…cooldown-begins-…-17` (2026-06-26 "ship one small thing")** — Phase 1 placeholder; underspecified.
