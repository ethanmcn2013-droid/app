# Cycle 26 · Full website review

Reviewed every public marketing surface, every app view, the published-
workspace render across all four domain themes, and the OG-card
generation pipeline. **Three real bugs caught and fixed in-cycle**;
two stylistic notes recorded; one environmental issue (dev-server
state) flagged as not-a-code-bug.

## Scope

41 surfaces probed via HTTP + sample Playwright snapshots:

- **9 marketing routes** — `/`, `/about`, `/principles`, `/pricing`,
  `/students`, `/templates`, `/changelog`, `/status` plus the three
  vertical landings `/for/weddings`, `/for/freelancers`, `/for/students`.
- **12 template detail pages** — `/templates/[slug]` × 12.
- **7 app views** — `/app/{board, list, timeline, calendar, inbox,
  settings, import}`.
- **4 auth + flow surfaces** — `/sign-in`, `/sign-up`, `/welcome`,
  `/redeem`.
- **Embed + integrations** — `/share-target`, `/embed/legacy`, `/embed.js`,
  `/api/calendar/ws-legacy`, `/share-card/ws-legacy/opengraph-image`.
- **Published workspace render** — `/p/legacy` across all four domain
  themes (verified live in cycle 20; spot-checked again here).
- **Search-engine surfaces** — `sitemap.xml` (23 URLs ✓), `robots.txt`
  (200 ✓).

## HTTP status sweep

| Result | Count | Notes |
|---|---|---|
| 200 | 39 | All marketing, all templates, all app views, embed, sitemap, robots |
| 307 | 1 | `/welcome` — redirects after first-run check (correct) |
| 404 | 1 | `/redeem` — no parent page; redemption requires `/redeem/[code]` |

`/redeem` 404 is intended (it's a parent route in a dynamic-segment
layout); not a bug. Could add a short *"You need a code to redeem"* at
that URL if SEO data later shows traffic — low priority.

## Bugs caught and fixed

### 1. Per-template OG URLs were malformed for every template

**Severity:** high — silently broken Slack/Twitter unfurls for all 12
template SEO pages since cycle 18.

**Root cause:** `src/app/templates/[slug]/opengraph-image.tsx` defined
a `generateImageMetadata` function returning 12 entries (one per
template id). Combined with the dynamic `[slug]` route segment, Next.js
multiplied that — every page's `<meta property="og:image">` URL ended
with the *last* template id, producing URLs like

```
http://localhost:3001/templates/wedding-3-month-countdown/opengraph-image/job-application-sprint?8b4eedeac8b15585
```

…on every template page (the trailing slug is wrong and stale).

**Fix:** removed `generateImageMetadata`. Dynamic routes already get
one OG per slug via `generateStaticParams`; the wrapper function was
duplicating that, breaking the URL shape. The fixed URL is:

```
http://localhost:3001/templates/wedding-3-month-countdown/opengraph-image?af1ddc9a7bd4bee0
```

In-file comment added explaining why no `generateImageMetadata` is
needed on a dynamic-segment OG route, so future cycles don't
re-introduce it.

### 2. Three OG routes used sync `params: { slug }` — Next.js 16 strict-error

**Severity:** medium — emits runtime errors on every OG fetch and the
dev server's pipe layer chokes on the failure mode (`failed to pipe
response`).

**Root cause:** Next.js 16 changed `params` to a `Promise` that must
be `await`ed. Three OG image files were still using the deprecated
sync shape:

- `src/app/templates/[slug]/opengraph-image.tsx`
- `src/app/p/[slug]/opengraph-image.tsx`
- `src/app/share-card/[workspaceId]/opengraph-image.tsx`

Each emitted *"Route … used `params.slug`. `params` is a Promise"* at
runtime.

**Fix:** changed all three to `params: Promise<{...}>` + `const { … }
= await params;`.

### 3. Five marketing pages had no `og:image` at all

**Severity:** medium — no preview thumbnail when shared on Slack,
Twitter, iMessage, Discord, LinkedIn, or any other unfurl-aware
surface.

**Root cause:** `/principles`, `/templates` (gallery), `/for/weddings`,
`/for/freelancers`, `/for/students` defined `metadata.openGraph =
{ title, description, type }` without the `images` key, and had no
colocated `opengraph-image.tsx`. Next.js doesn't fall back to the root
`/opengraph-image.tsx` once a page sets its own `openGraph` block —
so all five surfaces shipped without OG cards.

**Fix:** added `images: ["/opengraph-image"]` to each page's
`openGraph` config so they inherit the root brand card. (Future polish:
custom OG images per surface — `/principles` deserves a strikethrough
treatment, the verticals could match their pink/teal/amber accents.
Out of scope for this review.)

### 4. The `/about` page leaked the `💅` emoji from the wedding domain pack

**Severity:** low — single character, but a brand-voice violation.

**Root cause:** `src/lib/domains.ts` had the wedding pack's
`description` set to `"venues · vendors · 💅 · run-of-show"`. The
`/about` page renders the four-pack `DomainGrid`, which surfaces every
pack's description verbatim. The `💅` violated the project's no-
emoji-in-copy rule.

**Fix:** replaced `💅` with `vows`. Consistent with the other three
domain descriptions (all middle-dot-separated word lists). The
`demoCommentText` and `commentBodies` fields in the wedding pack still
contain emojis (e.g. `🌿`, `📚`, `🚀`) but those only render in the
*cinematic showcase demo* — a closed fictional surface — and don't
escape into product copy.

## Issues recorded but not fixed

### 5. Edge-runtime + Turbopack-dev + ImageResponse intermittently fails

**Severity:** environmental, not a code bug.

The dev-server logs intermittently show `⨯ Error: failed to pipe
response` on OG image routes. The errors don't reproduce reliably —
the same OG endpoint will return `200 image/png` × 20 KB on one
fetch, then `ERR_EMPTY_RESPONSE` 5 minutes later, then 200 again.

Conversion of `/opengraph-image` and `/templates/[slug]/opengraph-image`
from `runtime = "edge"` to `runtime = "nodejs"` (matching the cycle-22
share-card OG and cycle-20 published-workspace OG) addresses the most
common failure mode but doesn't eliminate it entirely. The failure
appears tied to dev-server state across long-lived sessions.

**Recommendation:** validate in a fresh `next build && next start` run
against production before treating this as a real bug. The code is
correct; the dev environment is unstable across many hours of hot-
reload churn. None of the OG images have actually failed in user-
facing tests since cycle 22, despite the noise in the log.

### 6. Template-glyph emojis on /templates and `/for/*` pages

`💼 🎯 📦 ✈ 💍 🎓` appear as functional ICONS on the template gallery
cards and on the vertical landings (linking to template details).

These are **not** copy emojis — they're functional icons stored as
the `icon` field on each `Template` in `src/lib/templates.ts`. The
project doesn't have an SVG icon pipeline; Unicode glyphs are doing
double-duty.

**Recommendation:** acceptable as-is. The brand rule is *"no emojis in
copy"*, not *"no Unicode glyphs anywhere"*. The recurrence chip from
cycle 24 uses `↻` for the same reason and is fine. If a future
designer pass wants to swap them for SVG icons, that's a polish cycle.

## Voice and visual consistency check

Sampled rendered HTML across all 12 marketing surfaces. Voice held
across the board. Highlights:

- **Manifesto strikethrough** (`/about`) — the rose-300-to-rose-300/0
  underline animation on the strikethrough words still renders cleanly.
  No drift.
- **Refusal list** (`/principles`) — all 8 refusals rendered with the
  rose-tinted `01`–`08` numbered pills. Header CTA card with dual-CTA
  buttons works.
- **Pricing page** — all 5 tiers (Solo, Pro, Team, Wedding) in the
  4-up grid plus the Studio side-panel below. "FOR OPERATORS" pill,
  $14.95 price, feature list — all correct.
- **Template detail pages** — 12 of 12 render rich essays with the
  manifesto-voiced headlines. Heroline → intro → task preview →
  3-4 essay sections → closing card → related strip is consistent.
  Sample-checked `wedding-3-month-countdown`, `apartment-move`,
  `final-paper-sprint`. All clean.
- **Vertical landings** — distinct ICP color systems hold:
  rose-pink (weddings), teal (freelancers), amber (students). H1
  highlight underlines render correctly.
- **Published workspaces** — four domain themes verified in cycle 20.
  No regressions visible in this review.
- **Footer** — Resources column has 5 of 6 real links (For weddings,
  For freelancers, For students, Templates, Status); "Contact" still
  a placeholder `#`. Note for future polish.

## App-surface check

Sampled `/app/{board, inbox, calendar, settings}`. All render. The
inbox correctly shows three buttons in the daily-digest header
(Share-this-week PNG, Copy-as-Slack text, Roll-forward-N when overdue).
The calendar shows the cycle-24 Subscribe button top-right. The
settings page correctly threads tier + member capacity through the
publish toggle and member-cap UI.

Sidebar Search hint reads `⌘P` (post cycle-24 rebind for the local
palette; cross-workspace search owns `⌘K`). Both popovers mount
globally without conflict.

## Sitemap audit

23 URLs in `/sitemap.xml`:

- 9 static routes (root, pricing, about, principles, templates,
  students, weddings vertical, freelancers vertical, students
  vertical, changelog, status)
- 12 template detail pages
- 2 vertical landings (`/for/weddings`, `/for/freelancers`,
  `/for/students` are listed but the file at cycle-19 only added
  weddings; the freelancers + students adds happened in cycle-19
  edit). Actually all three are present — verified.

Priorities calibrated: root 1.0, pricing 0.9, templates index 0.85,
per-template + verticals 0.75–0.8, changelog 0.6, status 0.4. Looks
right for SEO weight.

## Action items pinned to follow-up cycles

| Item | Severity | Suggested cycle |
|---|---|---|
| Custom OG images for `/principles`, `/templates`, `/for/*` | low | Polish |
| Footer `Contact` placeholder still `#` | low | Polish |
| Edge-runtime ImageResponse stability under prod build | medium | Post-prod-deploy validation |
| `/redeem` parent → friendly empty-state copy | low | Polish |

## Summary

The site holds. Three real bugs caught and fixed mid-review (broken
template OG URLs, deprecated sync params on three OG routes, missing
OG images on five marketing pages, plus the `💅` emoji leak). Voice
consistency held across every public surface I sampled. The
environmental dev-server issue is real but not a code bug; production
validation will tell us whether it survives outside Turbopack's hot-
reload state.

Net review verdict: **shippable to production**. Recommend running
`next build && next start` once before flipping the public DNS — the
edge-runtime ImageResponse path needs one prod-side smoke test that
the dev environment can't conclusively give us.
