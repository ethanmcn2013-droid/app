# C · Design-system and interaction archaeology

**Programme:** Home operating layer · Wave 0
**Worktree:** `_wt-home-layer` · branch `feat/home-operating-layer`
**Base SHA:** `a849fc40e46787a39e499fc94b171a5dfb898821` (clean)
**Method:** every claim below carries a `file:line` citation from this worktree, or is
marked **INFERENCE**. Nothing was run against a dev server; no production source was
modified. This document is the only file written.

---

## 0. Headline for the visual lab

The design language a Home lab must build from is **two systems wearing one name**.

There is a real, vendored, three-tier design system (`src/ds/tokens.css`) with nine type
steps, a base-4 spacing scale, two shadows, four motion durations and two easings. And
there is what the product actually renders: **1,208 arbitrary `text-[Npx]` utilities
against 126 uses of the nine named type steps**, a Tailwind numeric spacing namespace
whose indices 7–12 do not mean what any developer reads them to mean, a Tailwind
`text-ink-quiet` utility that resolves to a *deprecated* alias two contrast steps below
the token the system's own comments say that job requires, and four independently
authored row anatomies across the four surfaces Home is meant to unify.

A lab designed from the token file will not match the product. A lab designed from the
product will inherit its drift. The lab must be designed from **the tokens plus this
document's list of the traps**, and Wave 4 must decide which of the drifts it is fixing.

---

## 1. The design token system

### 1.1 Where tokens live, and what owns them

| Layer | File | Owner |
|---|---|---|
| System tokens (primitive → semantic → component) | `src/ds/tokens.css` | **Vendored.** `signal-design-system@2.0.1` (`50e7faf`). `src/ds/tokens.css:1-2` — "do not edit. Regenerate: node scripts/ds-vendor.mjs". |
| Tailwind v4 `@theme` bindings for those tokens | `src/ds/tailwind.css` | **Vendored + generated** by `scripts/build-tailwind.mjs` in the DS repo (`src/ds/tailwind.css:1-7`). |
| App-owned theme overrides | `src/ds/theme-overrides.css` | App. Currently only an identity `[data-theme="light"]` rule (`src/ds/theme-overrides.css:33-35`). |
| Repo-local extensions, legacy aliases, module palettes | `src/app/globals.css` | App. 1,585 lines. |

`@signal/ds` is **not** consumed as a package. It is vendored into `src/ds/` and imported
directly: `src/app/globals.css:1-4` imports `tailwindcss`, then `../ds/tokens.css`, then
`../ds/theme-overrides.css`, then `../ds/tailwind.css`. That import order is load-bearing —
`src/ds/theme-overrides.css:9-19` records that an earlier second copy of the dark mapping
in the *later* file silently won the cascade for every token it named.

There is no `tailwind.config.*` and no `@config`. `postcss.config.mjs:1-7` loads only
`@tailwindcss/postcss`. All theme configuration is CSS-first via `@theme inline` blocks in
`src/ds/tailwind.css:9-95` and `src/app/globals.css:514-570`.

### 1.2 Colour

Primitives (reachable only inside `tokens.css` and data-viz code, per `src/ds/tokens.css:9-11`):

- Indigo ramp 50–900, `#4f46e5` canonical at 600 (`src/ds/tokens.css:21-30`).
- Zinc ramp 50–950 (`src/ds/tokens.css:33-43`).

Semantic:

```
--paper #ffffff · --paper-soft #fafafa · --paper-deep #f4f4f5      (tokens.css:48-50)
--ink #111111 · --ink-soft #3f3f46 · --ink-faint #71717a · --ink-ghost #d4d4d8
                                                                    (tokens.css:53-56)
--accent = indigo-600 · --accent-hover = indigo-700 · --accent-tint = indigo-50
--accent-glow rgba(79,70,229,.32) · --accent-soft rgba(79,70,229,.12)
                                                                    (tokens.css:59-63)
--hairline rgba(17,17,17,.10) · --hairline-soft rgba(17,17,17,.06)  (tokens.css:66-67)
--status-done #10b981 · --status-flight #f59e0b · --status-blocked #ef4444
--status-next = --ink-faint  (+ four -bg washes)                    (tokens.css:72-81)
```

The register rule is stated in the token file itself: **"One earned indigo moment per
view"** (`src/ds/tokens.css:58`), and **"Hairlines do the work shadows would in a louder
system"** (`src/ds/tokens.css:65`).

Dark exists and is designed but was gated: `src/ds/tokens.css:190-220` carries the complete
mapping under `[data-theme="dark"]`. `src/ds/tokens.css:193` still reads "No product sets
data-theme='dark' before launch" — **that comment is stale**; the signed-in app shipped the
switch as D-013 on 2026-08-11 (`src/ds/theme-overrides.css:4-5`, `src/app/globals.css:338-361`),
and `src/app/app/theme-runtime.tsx:79` writes `data-theme` before first paint on every
`/app` document.

### 1.3 Type scale — exactly nine steps

`src/ds/tokens.css:95-118`. Size, leading and tracking are declared as **one decision, not
three** (`src/ds/tokens.css:96`):

| Token | Size | Leading | Tracking | Weight |
|---|---|---|---|---|
| `--text-display` | `clamp(2.75rem, 1.8rem + 4.2vw, 5.5rem)` | 1.04 | −0.04em | 600 |
| `--text-title` | `clamp(1.875rem, 1.4rem + 2.2vw, 3.25rem)` | 1.10 | −0.03em | 600 |
| `--text-section` | `clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)` | 1.15 | −0.02em | 600 |
| `--text-heading` | 1.25rem / 20px | 1.30 | −0.01em | 600 |
| `--text-body-lg` | 1.0625rem / 17px | 1.60 | — | 400 |
| `--text-body` | 0.9375rem / 15px | 1.55 | — | 400 |
| `--text-body-sm` | 0.8125rem / 13px | 1.50 | — | 400 |
| `--text-caption` | 0.75rem / 12px | 1.40 | — | 400/500 |
| `--text-label` | 0.6875rem / 11px | 1 | +0.08em | 500, mono caps |

Three weights only — 400 / 500 / 600 (`src/ds/tokens.css:90-93`). Faces are Geist Sans and
Geist Mono, loaded via `next/font/google` in `src/app/layout.tsx:16-24` with `latin` and
`latin-ext` subsets.

Two ratified extensions beyond the nine steps, both `--x-` prefixed and both in
`src/app/globals.css`:

- **Artifact display register** (`src/app/globals.css:227-255`) — exhibition-scale display
  and a *derived* metric at ratio `0.78`, so a countdown can never outrank the project name.
- **Reading leading** (`src/app/globals.css:257-283`) — `--x-lead-flush: 1`, `--x-lead-tight: 1.2`,
  `--x-lead-ui: 1.35`, `--x-lead-read: 1.55`. The comment records the defect that produced
  them: across Tasks, 431 rules set a font size and 42 set a line height, using nine
  different values.

### 1.4 Spacing — and the trap

Base-4 semantic scale, `src/ds/tokens.css:124-135`:

```
--space-1  4px    --space-5  20px   --space-9  48px
--space-2  8px    --space-6  24px   --space-10 64px
--space-3  12px   --space-7  32px   --space-11 80px
--space-4  16px   --space-8  40px   --space-12 96px
```

Plus `--section-gap: clamp(64px, 8vw, 128px)`, `--content-gap: var(--space-6)`,
`--container: 1120px` (`src/ds/tokens.css:137-139`).

**THE SPACING-SCALE COLLISION — the single most dangerous trap in this repo for a design
lab.** `src/ds/tailwind.css:75-86` maps each `--space-N` onto Tailwind v4's *numeric spacing
namespace* as `--spacing-N`. Tailwind derives numeric utilities from `calc(var(--spacing) * N)`
where `--spacing` is `0.25rem`, so declaring `--spacing-11` overrides **only** key 11.
Indices 1–12 are overridden; 13 and up fall through to stock Tailwind. The result, from
`docs/SPACING_SCALE_COLLISION.md:35-48`:

| index | resolves to | stock Tailwind | |
|---|---|---|---|
| 1–6 | 4–24px | 4–24px | agree |
| 7 | **32px** | 28px | diverges |
| 8 | **40px** | 32px | diverges |
| 9 | **48px** | 36px | diverges |
| 10 | **64px** | 40px | diverges |
| 11 | **80px** | 44px | diverges |
| 12 | **96px** | 48px | diverges |
| 13, 14, 16, 20, 24 | stock | stock | agree |

Two consequences the document names (`docs/SPACING_SCALE_COLLISION.md:58-77`): **value
collisions** (`p-10` and `p-16` are both 64px; `p-11` and `p-20` are both 80px) and
**non-monotonicity** (`min-h-13` = 52px is *smaller* than `min-h-10` = 64px).

Status: **root cause identified, not fixed** (`docs/SPACING_SCALE_COLLISION.md:3-6`). Only the
tap-target symptom at index 11 is fixed and gated. Measured over `src/` in this worktree
today, indices 7/8/9/10/12 are still live:

| index | sizing utilities | spacing utilities |
|---|---|---|
| 7 | 29 | 39 |
| 8 | 16 | 112 |
| 9 | 16 | 20 |
| 10 | 38 | 61 |
| 12 | 18 | 29 |
| **total** | **117** | **261** |

*(measured by regex over `src/**/*.tsx`; the doc's own count of ~455 was taken 2026-07-30
and is the same order of magnitude.)*

The failure this caused is worth reading before designing anything: `check-chrome-contract.mjs:152`
asserts `h-10` with the message "slim 40px bar"; `h-10` is 64px, and the studio bar measures
1280×64 — **the gate passes because it greps for a class name, never a computed value**
(`docs/SPACING_SCALE_COLLISION.md:84-91`).

**Lab rule:** for any exact box geometry, write a bracketed value (`h-[44px]`,
`min-h-[44px]`). For rhythm, either stay at indices 1–6 or use `p-[var(--space-N)]`.

### 1.5 Radii, shadow, motion

```
--radius-sm 4px (chips) · --radius-md 6px (buttons/inputs, the default)
--radius-lg 10px (cards/panels) · --radius-pill 999px          (tokens.css:143-146)

--shadow-float 0 1px 2px rgba(17,17,17,.04), 0 6px 16px rgba(17,17,17,.04)
--shadow-modal 0 4px 8px rgba(17,17,17,.04), 0 16px 40px rgba(17,17,17,.07)
                                                                (tokens.css:151-152)
"Exactly two shadows. Flat surfaces get hairlines, never shadows." (tokens.css:150)

--ease-out    cubic-bezier(0.23, 1, 0.32, 1)
--ease-in-out cubic-bezier(0.77, 0, 0.175, 1)                    (tokens.css:157-158)
--motion-instant 80ms · --motion-fast 140ms · --motion-base 220ms · --motion-slow 400ms
                                                                (tokens.css:161-164)

--control-h-sm 28px · --control-h-md 36px · --nav-h 56px · --table-row-h 44px
                                                                (tokens.css:168-171)
```

Deprecated aliases kept for one major (`src/ds/tokens.css:176-187`): `--brand`, `--brand-deep`,
`--brand-soft`, `--accent-deep`, `--indigo`, `--indigo-soft`, `--border`, `--border-soft`,
`--bg`, **`--ink-quiet`**, `--text`, `--ease-standard`. That `--ink-quiet` alias is the root
of finding 1.6.

### 1.6 The `--ink-quiet` trap (contrast, not aesthetics)

`src/app/globals.css:128-132` states the repo's own contrast contract:

> Contrast contract on paper: `--x-ink-quiet` ≥7:1 for 12–13px metadata and captions,
> `--x-ink-quiet-soft` ≥5.9:1 for 14px and up.
> `--x-ink-quiet: #52525b; /* 7.73:1 on --paper */`

But the Tailwind utility everything actually spends is `text-ink-quiet`, wired at
`src/app/globals.css:520` as `--color-ink-quiet: var(--ink-quiet)` — and `--ink-quiet` is the
*deprecated alias* `var(--ink-faint)` (`src/ds/tokens.css:185`), i.e. `#71717a`, **4.83:1**,
the exact value `src/app/globals.css:130` says is not enough for 12–13px metadata.

Measured in this worktree: **421 `text-ink-quiet` callsites in `src/**/*.tsx`** versus **5
TSX references to `--x-ink-quiet`**. `--x-ink-quiet` has **no Tailwind utility at all** — it
is reachable only from CSS modules (`src/components/hybrid/options/a/option-a.module.css:45`,
`src/modules/notes/app/workspace/notes-workspace.module.css:56`,
`src/modules/timeline/app/plan/[projectSlug]/_components/curation-surface.module.css:111`).

**So the three surfaces Home is built from — Home, Inbox, My Week — all use the weaker ink,
because they are Tailwind-utility surfaces, while the Tasks board, Notes and Timeline use
the stronger one, because they are CSS-module surfaces.** Home spends `text-ink-quiet` at
11px (`src/components/app/home/home-view.tsx:29`), 11.5px (`:118`), 12px (`:98`) and 12.5px
(`:252`). This passes WCAG AA (4.83 > 4.5) and fails the repo's own stated floor.

### 1.7 Other repo-local extension families in `globals.css`

Worth knowing they exist so a lab does not reinvent them:

- Audience accents `--x-aud-*` (`:33-41`), roadmap pill palette (`:56-68`), per-column board
  hues `--x-col-*` (`:289-296`), user-presence colours (`:299-301`).
- **Editorial Project Room register** `--x-task-*` (`:160-212`) — the precision-white field
  the Tasks board renders on. Note `--x-task-control-border: var(--ink-faint)` with the
  comment (`:177-180`) that `--x-task-border-strong` is ~1.5:1 and under WCAG 1.4.11's 3:1
  for a control's visible edge.
- **Canonical done green** `--x-status-done: #1b873f` (`:187-198`), one green for everything
  finished.
- **The accent's three roles**, each its own token because one indigo cannot do all three
  across two themes: `--x-accent-ink` (as text, `:93-104`), `--x-on-accent` (ink riding an
  accent fill, `:106-113`), `--x-accent-focus` (the focus ring, `:115-125`).
- Studio-bar charcoal chrome `--x-studio-*` (`:136-158`).
- Loading-system tokens, declared canonical across all five repos and marked no-merge
  (`:801-827`).

---

## 2. Tailwind 4 configuration and the design gates

### 2.1 Configuration

CSS-first, no config file. Bindings are two `@theme inline` blocks:
`src/ds/tailwind.css:9-95` (system) and `src/app/globals.css:514-570` (legacy v0.2 aliases +
Tasks extras, explicitly labelled a burn-down path at `src/app/globals.css:510-513`).

**Name collision to know about:** `src/app/globals.css:558` declares `--font-display: var(--font-sans)`
inside `@theme inline`, generating a Tailwind `font-display` utility; `src/app/globals.css:683-687`
also declares a plain `.font-display` CSS class that sets font-family, letter-spacing and
font-feature-settings. Unlayered CSS beats `@layer utilities`, so the class wins.
**INFERENCE** (cascade reasoning from the file, not observed in a browser).

### 2.2 `pnpm ds:check` — the drift gate

`scripts/ds/ds-check.mjs`, itself vendored (`:2-3`). Five drift classes:

1. **Banned colours, never grandfathered** (`:29-33`): `#c9a96a` (retired antique gold),
   `#7c5cff` (legacy Tasks purple), `#6366f1` (indigo-500 spent as status/accent).
2. **System tokens no file outside `src/ds/` may redefine** (`:38-39`) — the regex covers
   `--paper*`, `--ink*`, `--accent*`, `--hairline*`, `--status-*`, `--space-N`, `--radius-*`,
   `--motion-*`, `--ease-out|in-out`, `--text-*`, `--font-sans|mono`, `--indigo-N`, `--zinc-N`.
   CSS files only.
3. **Rogue easings** (`:42`) — any `cubic-bezier()` that is not the two contract curves.
4. **Non-Geist font stacks** (`:45`) — Inter, Roboto, Space Grotesk, Arial.
5. **Raw hex, ratcheted per file** (`:48`) against `.ds-grandfather.json`.

The two ratcheted classes (raw hex, rogue easing) may only shrink, and **a file not in the
manifest starts at zero** (`scripts/ds/ds-check.mjs:90`). A per-line `ds-allow` comment waives
style checks but never a banned colour (`:76-78`).

**Consequence for the lab: every new lab file must contain zero raw hex and zero
non-contract easings.** The existing labs bought their allowance up front —
`.ds-grandfather.json` carries `src/app/lab/timeline-w/page.tsx {hex:24}` and
`src/app/lab/welcome-w/page.tsx {hex:18}`, i.e. the wildcards were admitted *with* their
debt recorded.

Two secondary observations on the manifest: it is **not** shrink-enforced the way the
tap-target ledger is — a file that no longer exists keeps its entry silently, and
`.ds-grandfather.json` still lists `src/components/lab/task-detail/lab-board.tsx`,
`lab-fixtures.ts` and `task-detail.tsx`, none of which exist in the tree (`git ls-files
src/components/lab` returns nothing). And `src/app/globals.css` itself carries `{hex:97, ease:2}`.

`ds:check` is **not in the `pnpm test` chain** (verified against `package.json` scripts). It
runs inside `pnpm experience:quality`.

### 2.3 `check-tap-target-scale.mjs` — the disarmed half of the collision

`scripts/check-tap-target-scale.mjs`. Fails the build on **any** sizing utility at index 11
(`min-h|min-w|max-h|max-w|size|h|w`, `:66-70`), because `--spacing-11` is 80px, not the 44px
the idiom means. Required form: `min-h-[44px]` / `h-[44px]` / `w-[44px]` / `min-w-[44px]`
(`:130-133`).

Two escape hatches, both narrow. `OUTSTANDING` (`:42-52`) currently holds one file,
`src/app/invite/[token]/page.tsx`, and the ledger is **shrink-only in both directions** — it
fails if a listed file gets worse *and* if it becomes clean (`:116-127`). `CHROME_SCALE`
(`:59-61`) permits exactly one container height, `src/components/studio-bar/studio-bar.tsx::md:pointer-coarse:h-11`.

Wired into `pnpm test`. Baseline log:
`docs/projects/home-operating-layer/verification/baseline-logs/check_tap-targets.log` — ok, 1
known-outstanding, 1 allowed chrome-scale height.

### 2.4 `check-chrome-contract.mjs` — what it does and does not enforce

`scripts/check-chrome-contract.mjs:149-170` is the Studio Bar block for `pkg.name === "tasks"`.
It asserts source **substrings**: `h-10`, `--x-studio-chrome`, `z-40`, `w-[60px]`, `w-[248px]`,
`signal-pulse`; plus rail assertions that `signal-shell.module.css` is used and contains
`flex: 0 0 60px` and `--x-studio-chrome`. It also byte-seals the shared marketing
`SuiteHeader` to a sha256 (`:27-28`, `:126-133`) and pins the marketing nav labels to exactly
`Pricing · Design · About` (`:104-113`).

**It never measures a rendered pixel.** That is how the "slim 40px bar" assertion stayed green
over a 64px bar. Wired into `pnpm test`.

### 2.5 `check-loading-contract.mjs`

`scripts/check-loading-contract.mjs:67-86` requires `src/app/app/loading.tsx` to render the
rising wordmark (`signal-letter-rise`), to spell `["t","a","s","k","s"]`, and to carry the
canon long-wait line "Opening the workspace". It additionally parses `src/app/globals.css` and
requires the reduced-motion block to freeze `.tasks-dot` with `animation: none !important`
and the exact resting transform (`:127-153`). Wired into `pnpm test`.

### 2.6 `check-first-contact-language.mjs` — a copy gate the lab must design against

`scripts/check-first-contact-language.mjs` scans **rendered copy only** — JSX text nodes,
quoted string literals, static template segments — in `src/**/*.tsx`, excluding tests and
`showcase`. Two banned vocabularies:

- **Discipline** (`:24-29`): backlog, sprint, kanban, epic, swimlane, standup, velocity,
  burndown, story point, scrum, retrospective, **triage**, **wip**, work in progress,
  throughput, cycle time, lead time, **iteration**, **blocker**, **blocked by**.
- **Stack** (`:33-37`): payload, endpoint, webhook, boolean, null, undefined, **schema**,
  query string, **config**, deprecated, serialize, mutation, idempotent, 4xx, 5xx, stack
  trace, nan.

Known debt is a baseline that **may only shrink** — a removed baselined occurrence also fails
(`:16-18`). Baseline log shows 335 files scanned, 7 baselined occurrences unchanged. Wired
into `pnpm test`.

This directly constrains Home copy: an Inbox cannot say "triage", an analytics surface cannot
say "throughput" or "cycle time", a My-work surface cannot say "blocked by".

### 2.7 `check-contrast.mjs` — real, but not wired

`scripts/check-contrast.mjs` computes WCAG 2.1 AA ratios itself rather than trusting axe,
because axe marks this design's translucent panels "incomplete" rather than "failed"
(`:8-14`). It resolves `color(srgb …)` (the form `color-mix` computes to in Chromium),
composites ancestor `opacity`, and alpha-composites the whole ancestor background chain
(`:16-31`). Default sweep is `/app/tasks`, `/app/notes`, `/app/timeline` × light/dark
(`:44-56`). **No baseline, by design** (`:63-69`): any violation fails, and any unparseable
colour also fails.

It is **not in `pnpm test`** and it needs a live server. Baseline log
`check_contrast.log` shows all six surface/theme combinations ERROR/unreachable and exit 1.
**There is currently no instrumented contrast coverage for `/app/home` at all** — it is not
even in the default sweep list.

### 2.8 `check-route-manifest.mjs` — a removal-only gate that touches this programme

`scripts/check-route-manifest.mjs` fails if any listed `src/app` route directory stops
existing; new routes are explicitly **not** an error (`:14-17`). The manifest includes
`app/inbox` and `app/my-tasks` (`:44-45`). The charter's target routes are `/app/home/inbox`
and `/app/home/my-work` — so the old directories must survive as redirect stubs, or the
manifest must be edited with cited authority.

### 2.9 `experience/registry.json` + `scripts/experience/validate.mjs` — the hardest gate

This is the gate most likely to stop Wave 3 and Wave 4 dead.

- `discoverRoutes` (`scripts/experience/validate.mjs:213-256`) walks `src/app` and auto-discovers
  every `page`, `loading`, `error`, `not-found` file (`:21-27`). Any discovered surface that is
  not registered fails: *"discovered experience is not registered"* (`:322`).
- Every registered entry carries a 16-char `materialityHash` of its source (`:243`, `:380-382`).
  Editing the source without a reviewed refresh fails with *"changed materiality hash requires
  an explicit reviewed hash refresh; coverage and baseline metadata never waive later source
  drift"* (`:308-313`).
- The refresh requires a receipt validated by `scripts/experience/materiality-receipt.mjs`,
  signed by the design owner, produced through `scripts/experience/review-materiality.mjs`
  (`:276-305`).

Current Home-family registrations (78 experiences total):

```
tasks.page.app-home                    /app/home            materialityHash 756ff772168e21cf
tasks.page.app-home-briefing           /app/home/briefing
tasks.page.app-home-briefing-onboarding
tasks.page.app-home-briefing-settings-notifications
tasks.state.app-home-loading           /app/home
tasks.state.app-home-error             /app/home
tasks.state.app-home-briefing-loading
tasks.state.app-home-briefing-error
tasks.page.app-inbox                   /app/inbox
tasks.page.app-my-tasks                /app/my-tasks
tasks.page.app-signal (+2)             /app/signal*
```

`tasks.page.app-home` is `reviewTier: "critical"`, `designOwner: "product-taste-design-integrity"`,
`implementationStatus: "legacy"`, `lastReviewedAt: "2026-07-26"`, with `automatedTestCoverage`,
`screenshotCoverage`, `accessibilityCoverage` and `fixtureCoverage` all `"partial"`, and
`requiredStates` of `default, populated, empty, first-use, loading, partial-failure, error,
restricted, reduced-motion, keyboard-only` across four breakpoints (mobile 390×844, tablet
768×1024, desktop 1280×900, wide 1440×960).

**`layout.tsx` is not in `SPECIAL_FILES`, so layouts are not discovered or hashed.** A Home
layout can be added without touching the registry. Pages, loading and error boundaries cannot.

### 2.10 Performance budgets — the reason the last lab was deleted

`contracts/venue-surface-performance-budgets.v1.json`:

| budget | target | ceiling (the ratchet that fails the build) |
|---|---|---|
| `shared_runtime` | 170 KB gzip | 247 |
| `total_client_js` | 936 KB gzip | **940** |
| `largest_chunk` | 63 KB gzip | 63 |
| `repo_images` | 200 KB | 200 |

The ceiling may only be lowered; raising one is a founder decision (contract `note`, and
`scripts/check-performance-budgets.mjs:34-40`). The script sums **every** chunk under
`.next/static/chunks` whether it loads eagerly or lazily, so **code-splitting a lab relocates
bytes rather than removing them** (`contracts/…:26`, and `CHANGELOG.md:643-650`).

`CHANGELOG.md:618-641` (T·130, 2026-08-05) records the precedent directly: `/lab/task-detail`
— three shells over one composition, its own board replica, its own fixture set — cost
**19.1 KB gzip across three chunks** while noindexed and unreachable from any link, and its
deletion is what brought the budget back under the ceiling. The three `/lab/welcome-*`
directions were left alone at "about 4 KB together" because they were a live decision.

**Four Home lab directions, each a full four-mode operating layer, are an order of magnitude
larger than 19 KB.** Baseline log `perf_budgets.log` currently exits 3 ("no production build
found") — the budget is unmeasured on this branch.

Also recorded there (`CHANGELOG.md:650-655`): `motion` is the single largest line item at
~185 KB gzip across 15 chunks, all 65 call sites import `motion/react`.

---

## 3. The existing shell components

### 3.1 The composition, top to bottom

`src/app/app/layout.tsx:90-126` is the whole authenticated frame:

```
StudioChromeProvider                                       (studio-bar/studio-chrome-context)
└─ ThemeRuntime                       first thing in the /app body — theme before paint
└─ SuiteScrollFrame                   div.flex.h-dvh  (or min-h-dvh on bare routes)
   ├─ <a href="#app-main-content">Skip to main content</a>        layout.tsx:101-103
   ├─ SuiteChromeGate → StudioBar     <header role="banner">      layout.tsx:104-106
   ├─ SuiteScrollFrameBody            div.flex.flex-1.overflow-hidden
   │  ├─ SuiteChromeGate → StudioRail <aside aria-label="Signal Studio navigation">
   │  └─ Suspense fallback={SuiteLoading}
   │     └─ SharedAppGate             requireAppAccessTasks()     layout.tsx:49-63
   │        └─ ProductWorkspaceShell  ← the branch point
   └─ SuiteChromeGate → MobileSuiteNav + SuiteCommandRoot          layout.tsx:117-120
```

Wrapped in `ClerkRuntimeProvider` unless demo mode (`src/app/app/layout.tsx:125`).

The layout is a **server component**, so it runs once per document. Every decision that must
survive a client navigation is therefore delegated to small client components that read
`usePathname()`: `SuiteChromeGate` (`src/components/app/suite-chrome-gate.tsx:26-30`) and
`SuiteScrollFrame` / `useBareChromeRoute` (`src/components/app/suite-scroll-frame.tsx:40-75`).
The rationale is written out at `src/app/app/layout.tsx:78-88` and
`src/components/app/suite-scroll-frame.tsx:31-38`. **A Home-local nav must follow the same
rule: no server-layout branch on a request-scoped value.**

### 3.2 `ProductWorkspaceShell` — where the branch is, and what it means for Home

`src/components/app/product-workspace-shell.tsx`. Three outcomes:

| Condition | Render |
|---|---|
| Tasks surface, no workspace data | `<>{children}</>` — defers to the nested Tasks runtime (`:41-43`) |
| **Not** a Tasks surface | `<main id="app-main-content" tabIndex={-1} data-product-canvas="module">` (`:45-60`) |
| Tasks surface with data | `RoomToolsProvider` + `AppSidebar` + `<main … data-product-canvas="tasks">` (`:66-78`) |

`isTasksSurface` (`:9-19`) is a **negative** test: everything is a Tasks surface except
`/app/notes`, `/app/timeline`, `/app/home` and `/app/signal`. So `/app/inbox`, `/app/my-tasks`,
`/app/settings`, `/app/archived`, `/app/project`, `/app/import`, `/app/task/*` are all Tasks
surfaces.

The module canvas classes (`:52-53`):

```
bare:      "flex min-w-0 flex-1 flex-col bg-[var(--paper)]"
otherwise: "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--paper)]"
```

The Tasks canvas (`:72`) additionally paints
`bg-[color-mix(in_srgb,var(--x-task-canvas)_72%,var(--x-task-surface))]` and reserves
`pb-[calc(64px+env(safe-area-inset-bottom))]` below `md` for the Tasks mobile tab bar.

**Trap: nested scroll containers.** The module `<main>` already carries `overflow-y-auto`
(`product-workspace-shell.tsx:53`), and `HomeView` opens with another
`overflow-auto` (`src/components/app/home/home-view.tsx:25`). A sticky Home-mode nav has to
resolve which element owns the scroll before it can stick to anything.

### 3.3 `TasksRuntimeShell` — the reason Inbox and My work are hard to move

`src/components/app/tasks-runtime-shell.tsx` is a server component that:

- calls `requireAppAccessTasks()` (`:66`),
- resolves the active workspace and **redirects a first-run user to `/welcome`** (`:68-71`),
- performs eleven parallel reads — tasks, domain, user, workspace row, workspace list, room
  brief, projects tree, board name, column config, tag defs, members (`:73-133`),
- then wraps the children in ten providers (`:145-200`): `CurrentUserProvider`, `DomainProvider`,
  `TasksProvider`, `RoomBriefProvider`, `ToastRoot`, `AddTaskRoot`, `PaletteRoot`, plus
  `StudioChromePublisher`, `StudioChromeBridge`, `FirstCompletionMoment`, and after the shell
  `TaskDetailPanel`, `CrossWorkspaceOverdue`, `CrossWorkspaceSearch`, `FocusMode`, `ToastBridge`.

`/app/inbox/layout.tsx` and `/app/my-tasks/layout.tsx` are each two lines: they wrap children
in `TasksRuntimeShell`. **Both current Home-adjacent modes are inside the full Tasks runtime.**
`/app/home` is not — it has no layout of its own, so it takes the shared module canvas.

Concrete coupling this creates (see §4.4): `InboxApp` calls `useTaskPanel()`
(`src/components/app/inbox/inbox-app.tsx:93`); `MyWeekApp` calls `usePersonalization`,
`useTasksState`, `useTasksDispatch`, `useTaskPanel`, `useColumnConfig`, `useCurrentUser` and
`useCalendarFrame` (`src/components/app/my-week/my-week-app.tsx:37-50`). Moving those routes
under `/app/home/*` without the Tasks runtime breaks all of them — **and moving them *with*
the runtime imports the `/welcome` first-run redirect onto Home**
(`src/components/app/tasks-runtime-shell.tsx:69-71`).

### 3.4 The suite rail

`src/components/studio-bar/studio-rail.tsx` — `<aside aria-label="Signal Studio navigation">`,
`hidden md:flex`, geometry in `src/components/studio-bar/signal-shell.module.css:22-33`
(`flex: 0 0 60px`, charcoal `--x-studio-chrome`, `z-index: 40`).

Contents, in order (`:156-210`):

1. `<nav aria-label="Products">` with **exactly three tiles** — Notes, Tasks, Timeline
   (`RAIL_DESTINATIONS`, `:45-53`). **Home is deliberately not on the rail**: the comment at
   `:37-44` records that "Home follows now: it is a suite landing … not a sibling product".
2. Divider, then a "More" tile linking to `STUDIO_URL` in a new tab.
3. Spacer, then Inbox (`/app/inbox`, `:197-199`), a Help-and-settings menu (`:70-148`), and the
   account avatar docked at the foot of the L-frame (`:206-208`).

Active state: `aria-current={active ? "page" : undefined}` plus `data-active` (`:166-168`),
keyed off `suiteSurfaceFromAppPath`.

### 3.5 The Studio Bar

`src/components/studio-bar/studio-bar.tsx:196-199` — `<header role="banner">`, `z-40`,
`h-14 md:h-10 md:pointer-coarse:h-11`. As Tailwind numbers that reads 56/40/44; on this
scale it is **56 / 64 / 80** (`docs/SPACING_SCALE_COLLISION.md:109-115`). The file's own
comment (`:189-195`) explains why it was left: the bar's contents are inflated by the same
factor, so shell and contents must move together.

Column grid (`:11-21`): 60px mark cell → 248px module identity → 1fr open field with a
reserved `data-slot="signal-pulse"` at the far edge (`:211-215`, deliberately empty, "never a
generic notification bell") → auto action cluster.

Home-relevant behaviour:

- The 60px cell is a link to `HOME_APP_PATH` with `aria-label="Signal Studio Home"` and the
  Home rail glyph (`:105-117`).
- `MODULE_LABELS` includes `home: "Home"` (`:78-86`), so on `/app/home` the 248px wordmark
  reads `home.` and links to `/app/home` (`:88-95`, `:131-154`).
- **The create action is suppressed on Home**: `showCreate = tasksSurface` (`:183`), because
  the create event bridge lives in the Tasks runtime, which does not wrap Home. The comment
  (`:178-182`) states Home's quick capture is the palette instead.
- The command field label switches to "Search Signal Studio" off Tasks (`:184-186`).

All tap targets inside the bar are written as literals — `h-[44px]`, `min-w-[44px]`,
`md:h-[34px]`, `md:pointer-coarse:h-[44px]` (`:110`, `:229`, `:256`).

### 3.6 Mobile navigation — two different bars

**`MobileSuiteNav`** (`src/components/app/mobile-suite-nav.tsx`) — `<nav aria-label="Signal Studio products"
data-signal-bottom-nav="suite">`, `md:hidden`, charcoal, four destinations: Home, Notes, Tasks,
Timeline (`:22-31`). Rows are `min-h-[54px]`, `aria-current="page"` on the active one, plus a
1×1 indigo dot (`:63-83`). **It returns `null` when the active surface is `tasks`** (`:49`).

**`MobileTabBar`** inside `src/components/app/sidebar.tsx` — `<nav aria-label="Signal Studio
products and Tasks views" data-signal-bottom-nav="tasks">`, `fixed inset-x-0 bottom-0 z-30`,
light-surfaced, with a pop-up `role="menu"` carrying the four Tasks views plus Inbox and My work
(`:245-330`). Rows are `min-h-[44px]` with `aria-current` (`:271`, `:300`, `:318`).

Because `/app/inbox` and `/app/my-tasks` resolve to `"tasks"`
(`src/lib/product-urls.ts:113-115`, `:123-126`), **Inbox and My work today wear the Tasks
mobile bar, the Tasks sidebar, the Tasks canvas and the `tasks.` wordmark.**

### 3.7 Local navigation that already exists — and where a Home nav attaches

There is exactly one place in the product where Home, Inbox and My work appear as siblings:
`src/components/studio-bar/projects-sidebar.tsx:439-473`, a `<nav aria-label="Shortcuts">` with
three rows — Home (`/app/home`, `aria-current` matching `/app/home` **and** `/app/home/*`,
`:445`), Inbox (`/app/inbox`, with a count badge, `:453-465`), My work (`/app/my-tasks`, `:467-472`).
That sidebar is rendered only inside `AppSidebar`, i.e. only on Tasks surfaces
(`src/components/app/sidebar.tsx:60`, `src/components/app/product-workspace-shell.tsx:68`).

**So the Home operating layer's own navigation has nowhere to live today.** The attachment
options are:

1. **A new `src/app/app/home/layout.tsx`**, rendering the mode nav above `{children}` inside the
   module `<main>`. Not discovered by `experience/validate.mjs` (layouts are not `SPECIAL_FILES`).
   Requires resolving the nested-scroll question in §3.2.
2. **A second branch in `ProductWorkspaceShell`** for `pathname.startsWith("/app/home")`, mirroring
   the Tasks branch's sidebar composition. Touches a file the whole app depends on.
3. **Extending the rail** — contradicted by the explicit decision at
   `src/components/studio-bar/studio-rail.tsx:37-44` and by charter locked-decision 1.

Whichever is chosen, the landmark contract is fixed: `id="app-main-content"` and `tabIndex={-1}`
are the skip-link target (`src/app/app/layout.tsx:101`), and `main#app-main-content,[data-product-canvas]`
is the selector `ArrivalSettle` animates (`src/components/system/arrival-settle.tsx:59`).
**Both must keep resolving to exactly one element per Home mode.**

---

## 4. List/row, detail, sheet, empty, loading, error and announcer primitives

### 4.1 What is genuinely reusable

| Primitive | File | Verdict for Home |
|---|---|---|
| `Dialog` | `src/components/primitives/dialog.tsx` | **Reusable.** Portal, `role="dialog"`, `aria-modal`, Escape, focus-on-open, focus return on exit, and a real Tab trap (`:78-95`, added because `aria-modal` does nothing to the Tab order). `motionMode="instant"` escape hatch. No Tasks import. |
| `Hint` | `src/components/primitives/hint.tsx` | **Reusable.** `aria-describedby` cloned onto the *control*, hover **and** focus-within, pure CSS. `:19-22` warns it must never be the sole carrier of a fact on touch. |
| `ToastRoot` / `useToast` / `ToastBridge` | `src/components/primitives/toast.tsx` | **Reusable, but not mounted on Home.** `ToastRoot` is only rendered inside `TasksRuntimeShell:165`. `useToast()` outside a provider silently degrades to `console.warn` (`:211-223`) — a Home toast would vanish. Live region is `role="status" aria-live="polite" aria-atomic` (`:105-108`). Four tones, max 4 stacked. |
| `LongWaitStatus` | `src/components/system/long-wait-status.tsx` | **Reusable.** Renders nothing for 5s, then one calm line with `role="status" aria-live="polite"`. Explicitly document/app boot only (`:18-20`). |
| `ArrivalSettle` | `src/components/system/arrival-settle.tsx` | **Reusable and already used by Home** (`src/app/app/home/loading.tsx:16,34`). One 0.6→1 opacity settle on the product canvas, duration read from `--motion-fast` at runtime (`:103-107`), two entry paths (inline MutationObserver for cold load, layout-effect cleanup for client nav), 400ms dedupe window. |
| `MotionProvider` | `src/components/motion-provider.tsx` | **Reusable, already global.** `MotionConfig reducedMotion="user"` in the root layout (`src/app/layout.tsx:80`), which closes the JS half of reduced motion for the 15-of-25 components that never called `useReducedMotion()`. |
| `RailIcon` | `src/components/studio-bar/rail-icons.tsx` | **Reusable.** 24 grid, ~18 optical, 1.75 stroke, round caps, "Signal Point" r2, `currentColor`. Names: home, notes, tasks, timeline, signal, project, more, search, updates, team, settings (`:11-13`). Home's glyph carries the Signal Point inside the house (`:25-31`). |
| `SuiteLoading` | `src/components/app/suite-loading.tsx` | **Reusable.** Product-neutral: a pulsing accent dot + `LongWaitStatus`, inside its own `<main id="app-main-content" aria-busy="true">`. Note it *also* claims the `app-main-content` id. |

### 4.2 What is Tasks-coupled and cannot be lifted as-is

| Component | File | Coupling |
|---|---|---|
| `AppPageHeader` | `src/components/app/page-header.tsx` | Calls `usePalette`, `useDomain`, `useTasks`, `useToast`, `useActiveWorkspace`, `useColumnConfig` (`:52-56`, `:161-165`). Hard-codes the four Tasks view tabs (`:23-28`) and special-cases `/app/my-tasks`, `/app/inbox`, `/app/archived` by pathname (`:58-83`). |
| `EmptyStateOverlay` | `src/components/app/empty-state/empty-state-overlay.tsx` | Calls `useAddTask()` (`:28`) and `seedDomainAction` (`:36-38`); the CTA is "Add your first task" (`:25`). Its fade overlays are hard-coded `rgba(255,255,255,…)` (`:66-70`) — **broken in dark**. |
| `ghost-views` | `src/components/app/empty-state/ghost-views.tsx` | Imports `LANES`/`LANE_ORDER` from `@/lib/data` (`:3`) and draws Tasks board/list/timeline/calendar skeletons. |
| `TaskDetailPanel`, palette, focus mode, cross-workspace search | mounted only in `src/components/app/tasks-runtime-shell.tsx:170-191` | Whole detail/sheet layer is inside the Tasks runtime. |
| `EvidenceDrawer` | `src/modules/signal/components/signal/evidence-drawer.tsx` | The only sheet on the Home/briefing side; Signal-analytics-shaped. |

### 4.3 Four row anatomies, zero shared row primitive

There is **no product-neutral list-row component in this repo.** Grepping exported `*Row`
components returns only `field-rows.tsx` (Tasks detail fields), settings profile rows,
`SettingsRow`, `ReorderList`, `ScopeChipRow`/`ScopeOptionRow`, `SummaryRow` (Signal) and
`CaptureEmailRow` (Notes). The four surfaces Home must unify each hand-roll their own:

1. **Home** — `<ul className="mt-3 divide-y divide-line-soft">` with `flex items-baseline gap-4 py-4`
   (`src/components/app/home/home-view.tsx:102-132`).
2. **Full briefing** — a three-column CSS grid `var(--rail) minmax(0,1fr) auto`, left border in
   the row's tone, `.signal-row` (`src/modules/signal/components/brief/quiet-briefing-ledger.tsx`,
   `LEDGER_CSS` block).
3. **Inbox** — `NudgeCard` (rounded-xl, tone-tinted border+fill), `DigestCard`, `NotificationRow`
   (`src/components/app/inbox/inbox-app.tsx:270-330`, `:429`, `:578`).
4. **My Week** — `motion.li` with `border-b border-line-soft/60 px-1 py-2.5`, a `DopamineCheck`,
   a lane dot and an `AvatarStack` (`src/components/app/my-week/my-week-app.tsx:221-307`).

Building one row primitive that all four modes share is arguably the single highest-value
design decision available to the lab.

### 4.4 Loading, error and status conventions actually in force

**Loading canon** (`src/app/app/home/loading.tsx:1-15`, quoting "pitch 10"): where chrome
already exists, loading stays in the content region — *a tracing of the settled page*, no
full-screen takeover, no shimmer (Timeline-canonical only), no fake items. Home's boundary is
a **server component with zero JS and no animation** — static blocks satisfy reduced motion
without a media query — reserving header + section label + one row height, `role="status"
aria-label="Opening Home"` (`:36`). `ArrivalSettle` rides beside it.

**Boot loader** (`src/app/app/loading.tsx`) is the exception: fixed full-screen, the "tasks"
wordmark rising letter by letter (60ms stagger, 280ms `cubic-bezier(0.16,1,0.3,1)`), the indigo
dot landing as the period and entering the canonical pulse. Gated by
`scripts/check-loading-contract.mjs`.

**Error boundaries** are pure inline-style client components with no Tailwind at all
(`src/app/app/home/error.tsx:22-86`). Copy pattern: a plain-English headline
("Home didn't load."), reassurance that work is untouched, an escape route to the products, an
optional `ref · {digest}` in mono, and one "Try again" button. Colours are read defensively as
`var(--color-ink, var(--ink))`.

**Status announcers** — there is no shared announcer component. The pattern is a locally
declared `role="status" aria-live="polite"` region, sometimes with a hand-rolled
visually-hidden class (`.signal-visually-hidden` in the ledger's `LEDGER_CSS`). 36 `aria-live`
usages across 30 files. The best exemplar for Home is the ledger's submit action
(`src/modules/signal/components/brief/quiet-briefing-ledger.tsx:488-509`): `aria-disabled`
rather than `disabled` so keyboard focus is never dropped, a click guard that actually prevents
the double submit, and a polite status that says "Opening in Tasks."

---

## 5. Motion

### 5.1 The token contract

CSS tokens, `src/ds/tokens.css:157-164`: two easings, four durations (80/140/220/400ms).
Reduced motion **zeroes all four at the token level** (`src/ds/tokens.css:223-230`), so every
consumer inherits the suppression without a media query of its own.

`src/app/globals.css` adds, repo-locally: `--motion-moderate: 320ms` (`:306`), a legacy
`--ease-in` marked `ds-allow` (`:307`), three cinematic springs licensed for the homepage demo
only (`:310-316`), and a global reduced-motion block that also clamps every animation and
transition to 0.01ms and resolves `.reveal` to its final painted state (`:1008-1031`).

### 5.2 The drift between CSS and JS motion values

`src/lib/motion.ts` claims to mirror the CSS tokens (`:1-9`). Two of its values do not:

- `MOTION_SLOW = 0.48` with the comment `// --motion-slow: 480ms` (`src/lib/motion.ts:18`),
  where `src/ds/tokens.css:164` says `--motion-slow: 400ms`.
- `EASE_OUT = [0, 0, 0.2, 1]` (`src/lib/motion.ts:23`), i.e. `cubic-bezier(0,0,0.2,1)`, where
  `src/ds/tokens.css:157` says `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. The ledger repeats
  the same `[0, 0, 0.2, 1]` as its own `EASE_OUT`
  (`src/modules/signal/components/brief/quiet-briefing-ledger.tsx:39`) while its CSS uses
  `var(--ease-out)`.

So a JS-animated Home element and a CSS-animated one, both claiming `--ease-out`, currently
draw different curves. `ds-check`'s `ROGUE_EASE` regex only scans CSS-ish text for
`cubic-bezier(...)` literals and never sees the JS tuples.

### 5.3 The Tasks delight motion contract

`docs/design/TASKS_DELIGHT_MOTION_CONTRACT.md`. Character: **Precise, Calm, Tactile,
Trustworthy** — explicitly *not* mechanical, *not* slow, *not* bouncy, *not* success theatre.

Budgets (`:22-31`): one dominant movement at a time; one expressive signature per journey;
zero acknowledgement latency for keyboard commands and ≤80ms for press feedback; pointer
movement one-to-one; **route and representation changes are immediate**; no looping ambient
motion; reduced motion preserves state through opacity, colour, outline, text and
announcements, never spatial travel.

Forbidden patterns (`:69-80`) — directly binding on a Home lab: `transition: all`; animated
keyboard commands; card hover lift, tilt or parallax; **page-load card staggers**; full-view
slides between views; pulsing today markers or urgency states; bounce/inertial overshoot;
full-screen completion celebrations; animation that owns durable state; animation-only status
or error meaning.

Token duties (`:33-42`): instant = press/hover/focus; fast = anchored layers and disclosure;
base = placement and removal; moderate (320ms) = the task inspector only; `--ease-out` = enter/
exit/response; `--ease-in-out` = visible relocation; `--spring-glide` = controlled spatial settle,
never routine hover.

### 5.4 The delight catalogue

`docs/DELIGHT_CATALOG.md`. **Status: catalogued and grouped, awaiting references. Do not
implement** except where an entry carries an explicit founder verdict (`:3-6`). 66 sites →
**nine families, one open question, three restrained-by-default** (`:24-33`).

The families most relevant to Home: **F3 folds and reveals** (reference: the ledger's
"Why this" fold, 200ms height ease, chevron unified both directions); **F4 item arrival and
departure** (reference: the ledger entrance, 220ms rise, 60ms stagger, CSS on server markup —
*batch case only, single-item arrival is unsolved*); **F6 confirmations** (no motion reference
exists); **F8 content swap** (two shipped references that *disagree in register* — a 220ms
crossfade vs a 140ms directional slide — and picking which governs is an open decision);
**F9 hover reveal** (decided restrained: "a hover-only affordance does not exist on touch").

**F10 is a live founder question, and it is a Home question**: SG12 asks whether the daily
read's lead attention mark gets a perpetual ping. `docs/DELIGHT_CATALOG.md:66-75` frames it as
"one perpetual mark, or none" and notes that today the only perpetual motion in the app lives
in the empty state — *the screen whose message is that nothing happened*.

Ground rules (`:18-23`): `--spring-glide` / `--spring-snap` / `--ease-out` are the only curves;
`prefers-reduced-motion` is absolute; **no confetti or celebration animations (BRAND refusal)**.

### 5.5 Reduced motion — the layers already in place

1. Tokens zeroed (`src/ds/tokens.css:223-230`).
2. Global CSS clamp + `.reveal` resolution + `.tasks-dot` freeze (`src/app/globals.css:1008-1031`),
   the last of which is gated by `scripts/check-loading-contract.mjs:127-153`.
3. `MotionConfig reducedMotion="user"` for all `motion/react` components
   (`src/components/motion-provider.tsx:25`).
4. Per-component guards that return **before** animating: `ArrivalSettle`
   (`src/components/system/arrival-settle.tsx:95`), the theme-resolve transition
   (`src/app/globals.css:1575`), the ledger's own `@media (prefers-reduced-motion: reduce)` block.
5. One recorded lesson worth reusing: reduced motion means *present*, not *briefly invisible* —
   `quiet-briefing-ledger.tsx:522-527` sets the fold duration to exactly `0`, not `0.08`,
   because an 80ms opacity ramp still commits the panel to full height at opacity 0 on frame one.

### 5.6 The theme-change frame

`src/app/globals.css:1575-1583`: when `data-theme` changes on a live document the resolver adds
`.theme-resolving` to `<html>` for 200ms, and that class lends the *whole document* a transition
on exactly four properties — `background-color, border-color, color, fill` — at `--motion-fast`
on `--ease-out`. Never on first paint, never on the streamed correction, never under reduced
motion (`src/app/app/theme-runtime.tsx:46-58`).

---

## 6. Typography and reading measure actually in use

### 6.1 Measures

| Surface | Container | Text measures |
|---|---|---|
| **Home** | `mx-auto max-w-[760px]` (`home-view.tsx:27`) | all-clear body `max-w-[46ch]` (`:94`) |
| **Home, new user** | `max-w-[560px]`, vertically centred at `min-h-[60dvh]` (`:215`) | body `max-w-[44ch]` (`:224`) |
| **Full briefing** | `mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8` (`quiet-briefing-ledger.tsx:88`) | heading `max-w-[540px]`; row title `max-width: 560px`; row detail `490px`; receipt `400px`; reasons `440px`; closing line `max-w-[510px]` |
| **Inbox** | `mx-auto max-w-[820px] space-y-8` (`inbox-app.tsx:103`) | — |
| **My Week** | `mx-auto max-w-3xl` = 768px (`my-week-app.tsx:88`) | — |

Four different measures for four modes of one operating layer: **760 / 960 / 820 / 768**.

The ledger's own note on why 960 works (`quiet-briefing-ledger.tsx`, `LEDGER_CSS`): the 34px
ordinal rail is "narrow enough that the body still holds a 60–66 character measure at 960px" —
i.e. the measure is governed by the *inner* max-widths, not the container.

### 6.2 The type actually rendered

**Home** (`src/components/app/home/home-view.tsx`):

```
date eyebrow    11px / 600 / uppercase / tracking-[0.18em] / text-ink-quiet      :29
greeting h1     24px → md:28px / font-medium / tracking-tight / text-ink         :32
scope line      13px / text-ink-soft                                             :35
section h2      11px / 600 / uppercase / tracking-[0.16em] / text-ink-quiet      :62
signal title    15px / font-medium / leading-snug                                :112
signal why      13px / leading-relaxed / text-ink-soft                           :115
signal source   11.5px / text-ink-quiet                                          :118
all-clear head  17px / font-medium / tracking-tight                              :91
all-clear body  13.5px / leading-relaxed / max-w-[46ch]                          :94
coming/review   13.5px title · 11.5px source · 12px due                          :161-167
```

**Full briefing** (`quiet-briefing-ledger.tsx` + `LEDGER_CSS`):

```
kicker          11px / 600 / uppercase / tracking .14em / --ink-soft
mono meta       11px / --font-mono / tracking .06em / --ink-quiet
h1              36px / 600 / leading 1.06 / tracking -0.035em / text-balance
section h2      11px / 600 / uppercase / tracking .14em / in the section's tone
row ordinal     11px mono / tracking .12em / --ink-faint  (chosen over --ink-ghost:
                "ghost on paper is 1.47:1 and this is real text … axe fails it")
row title       17px / 600 / leading 1.3 / tracking -0.02em / text-wrap: pretty
lead row title  20px / leading 1.2 / tracking -0.025em
row detail      15px / leading 1.55 / --ink-soft / text-wrap: pretty
row receipt     12px / leading 1.5 / --ink-quiet
action          13px / 500 / min-height 44px from padding
```

**Not one of these is a named DS step.** Repo-wide, the nine steps are used 126 times
(`text-display` 4, `text-title` 5, `text-section` 6, `text-heading` 7, `text-body-lg` 5,
`text-body-sm` 23, `text-body` 10, `text-caption` 58, `text-label` 8) against **1,208 arbitrary
`text-[Npx]` utilities** — 34 of them inside `src/components/app/home`, `src/app/app/home` and
`src/modules/signal/components/brief` alone.

The two register moves the product *does* share and that a lab should keep: the **11px uppercase
eyebrow at ~0.14–0.18em tracking** as the universal section label, and the **mono 11px at 0.06em
tracking** as the metadata/receipt voice. Both appear on Home, the briefing and My Week
independently.

### 6.3 Base typographic settings

`src/app/globals.css:584-597` — `font-feature-settings: "ss01", "cv11"`, antialiased,
`text-rendering: optimizeLegibility`, `overflow-x: clip` on html/body (clip rather than hidden,
so `position: sticky` descendants keep working — relevant to any sticky Home nav).
`::selection` is `--indigo-200` on `--ink-900`, inverted for dark (`:606-609`, `:666-669`).

Display helpers `.h-display` / `.h-title` / `.h-section` (`:689-706`) with a mobile leading
correction below 640px that requires `!important` because hero h1s carry inline `lineHeight`
(`:712-719`). A `.marker` gradient underline for the earned indigo on display headlines
(`:725-736`).

---

## 7. Accessibility primitives already present

| Primitive | Where | State |
|---|---|---|
| **Skip link** | `src/app/app/layout.tsx:65-69`, `:101-103` | One, app-wide. Targets `#app-main-content`. Label rides `--ink` fill with `--paper` text specifically so it survives dark (`:66-68`). A second, unused one exists at `src/modules/signal/components/signal/signal-app-shell.tsx:46` — `SignalAppShell` is never rendered. |
| **Landmarks** | `role="banner"` on the bar (`studio-bar.tsx:197`); `<aside aria-label="Signal Studio navigation">` on the rail (`studio-rail.tsx:157`); `<nav aria-label="Products">` (`:160`), `"Signal Studio products"` (`mobile-suite-nav.tsx:53`), `"Signal Studio products and Tasks views"` (`sidebar.tsx:248`), `"Shortcuts"` (`projects-sidebar.tsx:439`), `"Project folders"` (`:474`); one `<main id="app-main-content" tabIndex={-1}>` per canvas (`product-workspace-shell.tsx:48`, `:70`; also `suite-loading.tsx:10`). | Sound. The `tabIndex={-1}` is what makes the skip link actually move focus. |
| **`aria-current="page"`** | 24 callsites; the shell ones are `mobile-suite-nav.tsx:63`, `studio-rail.tsx:166`, `sidebar.tsx:271/300/318/358`, `projects-sidebar.tsx:445/454/468/492`, `suite-launcher.tsx:526`. | Established convention. `projects-sidebar.tsx:445` is the only one that matches a *subtree* (`/app/home` and `/app/home/*`) — the pattern a Home mode nav needs. |
| **Focus management** | `Dialog` trap + restore (`primitives/dialog.tsx:36-95`, `:101`); `focus-window.tsx`; `useTaskPanel` module-scope focus-origin restore (`src/lib/tasks/use-task-panel.ts:17-30`); rail help menu focuses the first `role="menuitem"` on open and returns to the trigger on Escape (`studio-rail.tsx:76-101`). | Good primitives, all inside Tasks or `primitives/`. |
| **Focus ring** | `src/app/globals.css:932-937` — `2px solid var(--x-accent-focus)`, offset 2, radius 6, **`scroll-margin-top: 128px`** so sticky chrome never obscures a focused element (WCAG 2.4.11). `:focus:not(:focus-visible){outline:none}` at `:922-924`. | Global. A Home nav that adds height must revisit the 128px. |
| **Live regions** | 36 `aria-live` usages / 30 files. Canonical: toast (`role="status" aria-live="polite" aria-atomic`), `LongWaitStatus`, the ledger's submit announcer, the coverage aside (`quiet-briefing-ledger.tsx:113-115`). | No shared announcer component. |
| **Tap targets** | `scripts/check-tap-target-scale.mjs`, in `pnpm test`. | Gated at index 11 only; §2.3. |
| **Contrast** | `scripts/check-contrast.mjs`. | Real but **not wired into `pnpm test`**, needs a live server, and **`/app/home` is not in its default sweep** (`:45`). Baseline run errored on all six combinations. |
| **Forced colors** | `src/lib/ui-wave3-contract.test.ts:35-36` pins a `@media (forced-colors: active)` block with `outline: 2px solid Highlight !important` in `share-controls.module.css`. | Precedent exists; not general. |
| **axe** | `@axe-core/playwright` is a devDependency; `scripts/check-contrast.mjs:8-14` records that axe returns "incomplete" rather than "failed" on this design's translucent panels, which is why the bespoke gate exists. | Do not treat a clean axe run as contrast proof. |

---

## 8. The `/lab` route family and its guard

### 8.1 What exists

Six routes, three pairs of explorations plus a wildcard each:

```
src/app/lab/timeline-a/page.tsx   src/app/lab/welcome-a/page.tsx
src/app/lab/timeline-b/page.tsx   src/app/lab/welcome-b/page.tsx
src/app/lab/timeline-w/page.tsx   src/app/lab/welcome-w/page.tsx
```

The `-a` / `-b` / `-w` suffix convention is the `/lab` skill's shape: two on-brief directions
plus a standing wildcard.

### 8.2 The guard — there is effectively none

**There is no authentication guard on `/lab`.** `src/proxy.ts:280-298` scopes the Clerk proxy
matcher to `/`, `/app/:path*`, `/s/:path*`, `/the-wedding`, `/api/:path*`, `/sign-in/:path*`,
`/sign-up/:path*`, `/welcome/:path*`, `/redeem/:path*`, `/invite/:path*`, `/settings/:path*`.
`/lab` is **not** in the matcher, so the proxy never runs for it and no `auth.protect()` is
reached. The pages themselves confirm it: "Review-only: no auth, no data fetching, noindex"
(`src/app/lab/timeline-b/page.tsx:9`), "no auth, no production mutation, no server actions"
(`src/app/lab/welcome-w/page.tsx:24`).

What protection there is, is **discovery-level only**, in three thin layers:

1. **Per-page metadata**: `robots: { index: false, follow: false }` on each lab page
   (`src/app/lab/timeline-a/page.tsx:26`, `src/app/lab/welcome-w/page.tsx:32`).
2. **Site-wide robots.txt**: `src/app/robots.ts:36-50` disallows `/` with only `/the-wedding`
   and `/embed` allowed — so `/lab` is covered by the blanket disallow.
3. **No inbound links.** `CHANGELOG.md:628-632` describes `/lab/task-detail` as "noindexed and
   unreachable from any link".

There is **no** `X-Robots-Tag` header for `/lab` — `next.config.ts:110` sets that header only in
`audienceArtifactHeaders` for the `/s` bearer-link surface. And `src/app/robots.ts:24-30`
records the known interaction explicitly: a `Disallow` stops an obedient crawler *fetching* the
page, which also stops it reading the per-page `noindex`, so a URL discovered from an external
link can still be listed URL-only.

`src/lib/access-allowlist.ts` (email allowlist, founder hardcoded) gates `/app` only, via
`requireAppAccess*`. Nothing in `/lab` calls it.

### 8.3 The historical protected-lab pattern

Two patterns are visible in the record:

- **Route labs** (`src/app/lab/*`) — self-contained pages, fixtures inline, no auth, noindex
  metadata, **registered in `experience/registry.json`** as `tasks.page.lab-*` with
  `reviewTier: "supporting"`, `automatedTestCoverage/screenshot/accessibility/fixture: "none"`,
  `parentJourney` and `archetype` matching the surface being explored, and a `primaryJob` that
  names the comparison ("Compare the working direction against directions A and B").
- **Component labs** (`src/components/lab/task-detail/*`) — **deleted 2026-08-05** by T·130
  (`CHANGELOG.md:618-641`) for costing 19.1 KB gzip against the `total_client_js` ratchet. Its
  entries linger in `.ds-grandfather.json` because that manifest does not fail on obsolete rows.

**INFERENCE, stated as such:** a four-direction Home lab that is (a) publicly reachable, (b)
carrying four full operating-layer implementations, and (c) counted by
`check-performance-budgets.mjs` — which sums every emitted chunk regardless of laziness — is
materially riskier than the welcome labs on both axes. The charter's own phrase is "one
protected preview". Nothing in this repo currently implements "protected" for `/lab`; that
mechanism has to be built (a preview-only env gate, an allowlist check, or a non-`/lab` route
inside the `/app` matcher), and the budget consequence has to be measured, not assumed.

---

## 9. Structural anatomy of the current surfaces

Enough that a designer can redraw them without running the app.

### 9.1 `/app/home` — Today's Signal

Route: `src/app/app/home/page.tsx`. `dynamic = "force-dynamic"`, title "Home · Signal Studio".
`requireAppAccess()` → `requireSignalUser()` → `loadHomeData({ clerkId })`. Two renders:
`HomeNewUser` when `kind === "new-user"`, else `HomeView`.

Data (`src/app/app/home/home-data.ts`): **one** briefing build, `cadence: "daily"`,
`recordReadState: false` — Home is a glance, the Full Briefing remains the read of record
(`:19-23`). Caps: `COMING_UP_WINDOW_DAYS = 14`, `COMING_UP_CAP = 4`, `REVIEW_CAP = 3` (`:78-80`).

**Heading tree:**

```
main#app-main-content  (module canvas, from ProductWorkspaceShell)
└─ div.thin-scroll.overflow-auto.bg-bg  px-5 py-6 / md:px-10 md:py-9      home-view.tsx:25
   └─ div.mx-auto.max-w-[760px]
      ├─ header  (mb-9)
      │  ├─ p    DATE, uppercase 11px .18em            e.g. "WEDNESDAY, 12 AUGUST"
      │  ├─ h1   greeting 24/28px medium               "Good morning."
      │  └─ p    scopeLabel 13px ink-soft
      ├─ section aria-labelledby="todays-signal"  (mb-10)
      │  ├─ h2#todays-signal  ● + "TODAY'S SIGNAL"     dot = var(--brand), 7×7 :64-70
      │  ├─ EITHER all-clear card:
      │  │     rounded-xl border-line-soft bg-bg-elevated px-6 py-8
      │  │     p 17px medium headline · p 13.5px/46ch body · p 12px readLine
      │  └─ OR  ul.divide-y.divide-line-soft  (≤3 rows)
      │        li > a  flex items-baseline gap-4 py-4
      │           ├─ span 15px medium title      (underline on group-hover)
      │           ├─ span 13px ink-soft "why"
      │           ├─ span 11.5px ink-quiet  "source · due"
      │           └─ span "Open →"  translate-x-0.5 on hover
      │  └─ a "Open full briefing →"  13px medium ink-soft      :136-144
      ├─ section aria-labelledby="coming-up"     (only when non-empty)   ≤4 rows
      │     row: [title 13.5px truncate] [source 11.5px, sm:block] [due 12px, w-[9ch] right]
      └─ section aria-labelledby="needs-review"  (only when non-empty)   ≤3 rows
            row: [title 13.5px truncate] [source 11.5px] ["waiting Nd" | "in review"]
```

**Rules encoded in the component** (`home-view.tsx:11-22`): three principal sections, never more;
Today's Signal is dominant; **sections other than Today's Signal render only when they have
something true to say** — "a stack of empty placeholders is dashboard furniture, not calm".
Server component; the only client JS is the analytics ping and per-row open events, with no
content in payloads.

Row hrefs are `/app/task/${id}` (`home-data.ts:82-84`) — the **full task route**, not the
`?task=` detail panel that every Tasks surface uses. Two different task-open affordances exist
in the product.

Honesty guards worth preserving: `allClear` is set only when `signalRows.length === 0`
(`home-data.ts:177-192`); when something shipped recently the quiet state *names it* rather than
claiming nothing happened; `readLine` reports the honest arithmetic
("Read 8 items across your workspace").

`HomeNewUser` (`home-view.tsx:212-262`): centred 560px column, a 9×9 brand dot, h1 "Welcome to
Signal Studio.", a 44ch body, one `bg-ink text-white` pill CTA to `/welcome`, then a
`divide-y` list of the three products with a one-line promise each ("Capture the thinking." /
"Move the work forward." / "Make the plan visible.").

### 9.2 `/app/home/briefing` — the Full Briefing

Route: `src/app/app/home/briefing/page.tsx` → `SignalBriefPage`
(`src/modules/signal/app/signal-brief-page.tsx`). **Two code paths, one component**: when
`SIGNAL_ANALYTICS_V1_ENABLED` is unset the legacy path runs
(`src/modules/signal/server/analytics/feature-flag.ts:11-15` — every environment closed by
default), and both paths end at `QuietBriefingLedger`
(`signal-brief-page.tsx:73`, `signal-legacy-briefing.tsx:77`).

`briefing/layout.tsx` exists only to import `src/modules/signal/components/signal/signal.css`.

**Heading tree** (`quiet-briefing-ledger.tsx`):

```
div[data-signal-module]
└─ section#signal-main-content tabIndex={-1}          (a SECOND focus target, not the landmark)
   └─ article.signal-ledger  mx-auto max-w-[960px] px-6 py-8 sm:px-8
      ├─ LedgerDateline        ● TODAY'S SIGNAL      |   mono: timestamp · scope · freshness
      ├─ header  border-b hairline, pb-6, mt-4 mb-9
      │  ├─ h1  36px/600/1.06/-0.035em/text-balance/max-w-[540px]
      │  └─ Distillation  — a mark strip + "N read · N flagged · N shown"
      ├─ [coverage aside]  role=status aria-live=polite, border-y, 13px, ≤510px
      ├─ section "Now"   (attention)   ● + h2 11px caps
      │  └─ ol.divide-y
      │     └─ li.signal-row   grid  [34px rail] [1fr body] [auto action]
      │        border-left 2px in the row's tone (47% → 100% when active)
      │        ├─ span.signal-row-rail   "01"  mono 11px, padding-top 9px to sit on the baseline
      │        ├─ div.signal-row-body
      │        │  ├─ h3 17px/600  (20px on the lead row)
      │        │  ├─ p 15px detail
      │        │  ├─ p 12px receipt  "from {source} · N items · {age}"
      │        │  └─ actions: "Evidence"  ·  "Why this ›"  (fold, 200ms, chevron rotates 90°)
      │        └─ div.signal-row-primary   "{label} →"  (a <form> POST when it targets Tasks)
      ├─ section "Next"  (risks)  — same anatomy, ordinals continue across the whole read
      └─ footer  border-t, closing line 15px  |  ● "N cleared"
```

Layout system: **two left edges** — marks and rails hang at 0, all text sits at `--hang: 16px`
(`LEDGER_CSS`). The row collapses to a single column below 720px, with the rail becoming a line
above the title and the action returning beneath the body.

Colour grammar, ported from the Signal marketing hero
(`quiet-briefing-ledger.tsx:18-27`): red needs you, amber is coming, green is cleared. **Pure hue
is spent only on marks; every piece of text takes the ink-mixed tone**, because raw amber on
paper is 2.15:1. The mix ratios are the suite's, not invented — 72% red = `--x-task-danger`,
52% amber = `--x-task-waiting`, 60% green = `--x-task-success` — and "a new surface must not
invent a fifth ratio."

Marks carry a toned 1px border plus a 3px 14% halo specifically to clear the 3:1 non-text floor
that raw amber (2.15:1) and green (2.54:1) miss alone.

Empty state (`quiet-briefing-ledger.tsx:~575-615`): "Briefing complete" / "Coverage update"
eyebrow, 36px headline, 15px body, and — when not coverage-limited — the tick gesture,
`animation: signal-tick 3.6s steps(1, end) 3`, which **comes to rest after three cycles**.

Entrance: `.signal-rise`, 220ms `var(--ease-out)`, delay `min(--i, 5) * 40ms`, **transform
only, never opacity** — with an opacity ramp the frame after the skeleton is still white
(`quiet-briefing-ledger.tsx:29-35`). It is CSS on server-rendered markup rather than a
motion/react variant, so nothing waits for hydration.

### 9.3 `/app/inbox`

Route: `src/app/app/inbox/page.tsx`; layout wraps it in `TasksRuntimeShell`. Server-fetches
notifications, daily digest, tasks, weekly snapshot, workspace name/slug, overdue count, user
name and personality prefs in parallel (`:92-121`), then renders `<AppPageHeader />` +
`<InboxApp>`.

**Structure** (`src/components/app/inbox/inbox-app.tsx:97-199`):

```
AppPageHeader                       h1 "Inbox", 20/24px, no tabs, no share    page-header.tsx:71-82
div.thin-scroll.overflow-auto.bg-bg  px-4 py-5 / md:px-8 md:py-6
└─ div.mx-auto.max-w-[820px].space-y-8
   ├─ GreetingBanner        (personality-gated, session-keyed)
   ├─ TipCard context="inbox"
   ├─ NudgesSection         "WHAT'S STUCK" — N things want a nudge
   │     ul of NudgeCard: rounded-xl, tone border+fill
   │       urgent (sev ≥75) rose-200/rose-50 · warn (≥50) amber-200/amber-50 · info line-soft
   ├─ WeeklyRecapSection    (only when AI configured)
   ├─ section  "DAILY DIGEST" / "Good morning, {name}."
   │     actions: Share this week · Copy Slack summary · Roll forward
   │     grid md:grid-cols-2 → DigestCard "Closed yesterday" (emerald) | "Due today" (brand)
   │     Mentions list
   └─ section  "DIRECT ALERTS" / "Inbox zero. Quiet here on purpose." | "N alerts for you."
         ul of NotificationRow, or EmptyAlerts
```

`SectionHead` is eyebrow + 20px/600 title + subtitle + optional action
(`inbox-app.tsx:397-427`). Nudge dismissal is `localStorage["tasks_dismissed_nudges"]`, and the
whole section returns `null` until hydrated (`:226-245`) — so the section pops in after mount.

The background choice is recorded (`inbox-app.tsx:98-101`): the inbox reads on white, not the
Tasks room wash, because its quiet uppercase kickers fall under 4.5:1 on the wash.

Copy voice is deliberately cheekier here than anywhere else — "Nudges, the 'what's stuck' feed.
Cheeky on purpose; the brand can afford a smirk because the policy underneath is restrained"
(`inbox-app.tsx:202-205`).

### 9.4 `/app/my-tasks` — "My work" (rendered by `MyWeekApp`)

Route: `src/app/app/my-tasks/page.tsx` — 13 lines, `<AppPageHeader />` + `<MyWeekApp />`; layout
wraps in `TasksRuntimeShell`.

**Three names for one page**, recorded at `page-header.tsx:65-69`: the URL says `/app/my-tasks`,
the nav says "My work", the header used to say "My week", and the component is `MyWeekApp`.
The header now forces "My work".

**Structure** (`src/components/app/my-week/my-week-app.tsx:86-162`):

```
div.thin-scroll.overflow-auto  px-6 py-5 / md:px-10 md:py-7
└─ div.mx-auto.max-w-3xl
   ├─ header  mb-8
   │  ├─ p  date, 11px caps .18em ink-quiet, lowercased  ("wednesday 12 august")
   │  └─ h2 greeting 22 → md:26px medium              ← an h2, not an h1
   ├─ Section "Today"           (always renders; empty line "Today is clear.")
   ├─ Section "This evening"    (only when a task carries an explicit evening time)
   ├─ Section "Needs attention"
   ├─ Section "Waiting on you"
   ├─ Section "This week"
   ├─ Section "Done this week"  (muted, opacity-75)
   └─ NudgesRail
```

`Section` (`:164-219`): `h3` 11px/600 uppercase `.18em` `text-ink-soft` on a
`border-b border-line-soft pb-2` rule, with a right-aligned tabular-nums count. Sections with
no tasks are silent except "Today", "so an empty day reads as confidence, not absence" (`:29-35`).

`Row` (`:221-307`): `motion.li` with `layout`, `initial {opacity:0,y:3}`, 0.22s
`[0.16,1,0.3,1]`, stagger `min(i * 0.012, 0.12)`. Anatomy:
`[DopamineCheck] [DoneTitle 13.5px line-clamp-1 / meta 11px: ● lane · due · first tag] [AvatarStack 18px]`.
Selected row: `background: var(--brand-soft)` + `box-shadow: inset 2px 0 0 var(--brand)`.

Empty state for the whole surface is `EmptyStateOverlay` with a `ListGhost`
(`my-week-app.tsx:73-82`) — the Tasks-coupled overlay from §4.2.

Both `greetingFor` and `formatDateHeader` take an explicit timezone and locale from
`useCalendarFrame()`, with the reason spelled out (`:309-344`): `getHours()` would hydrate two
different salutations from one instant, and `undefined` locale let the server's ICU default
fight the browser's. **Any Home greeting must use the same frame.**

### 9.5 Route naming traps found

- **`/app/your-work` is not "My work".** `src/app/app/your-work/page.tsx` is a
  planning-periods administration surface (create/duplicate/archive/reorder workspaces and
  periods), gated by `resolvePlanningFeatureFlags().planningPeriods` and redirecting to
  `/app/tasks` when off. "My work" is `/app/my-tasks`.
- **`/app/signal*` is a redirect input only.** `src/proxy.ts:245-253` 308s `/app/signal` and
  `/app/signal/*` to `/app/home/briefing` at the edge, preserving query state; the route files
  repeat it as belt-and-braces. The registry still lists three `tasks.page.app-signal*`
  experiences.
- **"Schedule", never "Timeline", inside Tasks** (`page-header.tsx:19-22`) — "Timeline" without
  the Tasks namespace always means the product one rail-stop below. The route slug
  `/app/tasks/timeline` is the one place the old name legitimately survives.

---

## 10. Consolidated trap list for the visual lab

1. **Never write a numeric sizing utility at index 7–12.** Use `h-[44px]`-style literals or
   `var(--space-N)`. `min-h-11` is 80px, `h-10` is 64px, `min-h-13` is smaller than `min-h-10`.
2. **New files carry zero raw hex and zero non-contract easings** or `ds:check` fails
   (`scripts/ds/ds-check.mjs:90`). `#6366f1` is banned outright and cannot be waived.
3. **`text-ink-quiet` is 4.83:1, not the 7.73:1 the system's own comment requires for 12–13px.**
   `--x-ink-quiet` has no utility. Decide this deliberately.
4. **`--ease-out` means two different curves** depending on whether you reach it from CSS
   (`cubic-bezier(.23,1,.32,1)`) or from `src/lib/motion.ts:23` (`[0,0,0.2,1]`). Same for
   `MOTION_SLOW` (400ms vs 480ms).
5. **Every new `page.tsx` / `loading.tsx` / `error.tsx` must be registered in
   `experience/registry.json`,** and every edit to an existing one needs a signed materiality
   refresh. `layout.tsx` is exempt.
6. **`total_client_js` ceiling is 940 KB gzip and the script counts lazy chunks.** A four-direction
   lab cannot be code-split out of the measurement. The last multi-shell lab cost 19.1 KB and was
   deleted for it.
7. **`/lab` has no auth guard at all** — noindex metadata plus a blanket robots disallow is the
   whole of it. "Protected preview" has to be built.
8. **Copy cannot contain** backlog, sprint, triage, wip, blocker, blocked by, iteration,
   throughput, cycle time, config, schema, payload, endpoint, null (§2.6). The baseline may only
   shrink.
9. **Delight is frozen.** `docs/DELIGHT_CATALOG.md:3-6` — do not implement micro-interactions
   without a founder verdict. F8 (content swap) has two shipped references that disagree; F10 (one
   perpetual mark, or none) is an open founder question that lands squarely on Today's Signal.
10. **Moving Inbox and My work under `/app/home/*` costs their entire provider stack**, and taking
    `TasksRuntimeShell` with them imports the first-run `/welcome` redirect onto Home
    (`src/components/app/tasks-runtime-shell.tsx:69-71`).
11. **Nested scroll containers**: the module `<main>` already scrolls
    (`product-workspace-shell.tsx:53`) and each surface opens another `overflow-auto`. Resolve
    ownership before designing a sticky mode nav; note `overflow-x: clip` (not `hidden`) on
    html/body is deliberate so `position: sticky` keeps working (`globals.css:592-596`).
12. **Four measures for four modes** — 760 / 960 / 820 / 768. Pick one, or justify the difference.
13. **`/app/home` has no instrumented contrast coverage** — it is not in
    `scripts/check-contrast.mjs`'s default sweep, and that gate is not in `pnpm test` and errored
    on all six combinations at baseline.
14. **`src/ds/tokens.css:193` is stale** ("No product sets data-theme='dark' before launch").
    Dark shipped 2026-08-11. Every Home surface must be designed in both themes; the
    elevation ramp *inverts* in dark (`globals.css:450-470`).

---

## 11. What I did not verify

- No dev server was started, so **nothing here is a rendered measurement.** All geometry claims
  are read from source or from `docs/SPACING_SCALE_COLLISION.md`'s recorded Playwright run.
- Contrast ratios are quoted from the comments in `src/app/globals.css` and
  `quiet-briefing-ledger.tsx`; I did not recompute them.
- The `.font-display` class-vs-utility collision (§2.1) is cascade reasoning, not an observation.
- Bundle sizes are quoted from `CHANGELOG.md` and the budgets contract; `perf_budgets` exits 3 on
  this branch for want of a production build.
- I did not read `src/modules/notes/**` or `src/modules/timeline/**` beyond token grep, so their
  CSS-module registers are described only where they consume `--x-ink-quiet`.
- I did not open `experience/QUALITY_COUNCIL_EVIDENCE.md`, the council gate, or
  `scripts/experience/quality-council.mjs`; the 9.5 gate's mechanics are outside this brief.
