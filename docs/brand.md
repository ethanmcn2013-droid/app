# Tasks · brand kit

Voice, type, color, mark, motion. Everything that makes the product look and read like itself.

## Voice

Dry. Observational. Occasionally funny in the way a clean sentence is funny — by being clean. Em-dashes welcome. Lower-case casual where it lands. Never:

- thrilled · excited · launching today · huge · amazing · game-changer · revolutionize · disrupt · committed to your privacy · paramount · industry-leading · 🚀 · 🎉

The `/about` page is the voice ground truth. The `/principles` refusal list is the second-best reference. New marketing copy is voice-checked against both before merge.

## Wordmark

`tasks·` — lowercase Geist semibold, tight tracking (-0.01em), trailing dot in the brand indigo (`--highlight: #4f46e5`) that animates on the marketing surfaces. The old `#7c5cff` purple is BRAND §5-banned; do not reintroduce. Source: `src/components/brand/wordmark.tsx`.

The dot is load-bearing. Don't replace it with a swoosh, a checkmark, or a square.

## Type

| Use | Family | Source |
|---|---|---|
| Display + body | Geist | `next/font/google` (`Geist`) — handles `display:swap` by default. |
| Mono / code | Geist Mono | Same. |
| Fallback stack | `var(--font-geist-sans), 'Geist', -apple-system, system-ui, sans-serif` | `globals.css :root` |

Sizes: 11/12/13/13.5/14/15/20/24/40 px in the design tokens. We don't ship a 16px body — Geist at 13.5/14 reads the way a system body reads at 16/17.

Tracking: `-0.02em` on display, `-0.01em` on h2/h3, normal on body, `0.12em` on uppercase eyebrows.

Leading: four values, in `globals.css` as `--x-lead-*`. Leading is a
function of what the text has to do, not of how big it is.

| Token | Value | For |
|---|---|---|
| `--x-lead-flush` | 1 | a single line whose box already sets its height — chips, pills, buttons, table cells |
| `--x-lead-tight` | 1.2 | headings, and the uppercase eyebrows at the 11px floor |
| `--x-lead-ui` | 1.35 | interface text over one or two lines — field values, menu items, row titles |
| `--x-lead-read` | 1.55 | prose read as a paragraph — descriptions, briefs, comments, empty-state body |

The display end of the ramp keeps its own leading in the artifact
register (`--x-artifact-display-leading`, `.h-display`/`.h-title`/
`.h-section`, with a mobile correction). These four are the reading end,
which until T·131 was one inherited 1.5 applied to everything.

## Color

All tokens live in `src/app/globals.css :root`.

**Indigo ramp** (`--indigo-50` → `--indigo-900`). Primary `--brand` = `--indigo-600` (#4f46e5). Used for emphasis, launch pills, the wordmark dot's parent context.

**Ink ramp** (`--ink-0` → `--ink-950`). Neutrals. `--text` = `--ink-900`, `--text-muted` = `--ink-500`, `--text-faint` = `--ink-400`. Surfaces: `--bg` (#fafaf7, warm-stone), `--bg-elev` (#fff), `--bg-deep` (#f4f4f0).

**Audience accents** — used sparingly to flavor domain packs, not the marketing surface:

| Domain | Token | Hex |
|---|---|---|
| Marketing | `--aud-marketing` | #4f46e5 |
| Freelance | `--aud-freelance` | #16a34a |
| Student | `--aud-student` | #eab308 |
| Wedding | `--aud-wedding` | #be185d |

**Status tokens** — used inside the app, not on marketing.

| Status | Token | Hex |
|---|---|---|
| Todo | `--status-todo` | #6366f1 |
| In progress | `--status-progress` | #f59e0b |
| Review | `--status-review` | #06b6d4 |
| Done | `--status-done` | #10b981 |
| Blocked | `--status-blocked` | #ef4444 |

**Lane palette** — desaturated by design. Cards do the talking, not the lane.

| Lane | Bg | Ink | Dot |
|---|---|---|---|
| Todo | #f6f4fb | #6d4ea3 | #c9b4f0 |
| Doing | #fbf6ee | #b35a16 | #f3b878 |
| Review | #eff6fc | #1d6fa3 | #91c8ec |
| Done | #eef7f1 | #1f7a45 | #8fd5a8 |

## Motion

Three named springs (`globals.css`):

- `--spring-snap` `cubic-bezier(.2, .9, .2, 1.2)` — overshoot. Drops, lifts, taps.
- `--spring-soft` `cubic-bezier(.32, .72, 0, 1)` — settle. Cards, panels.
- `--spring-glide` `cubic-bezier(.16, 1, .3, 1)` — ride. Sweeps, fades.

Plus `--ease-out` for default ease-out. The cinematic demo uses these spring tokens explicitly.

Reduced-motion users get the same content with motion gated off via `prefers-reduced-motion: reduce`. The 30-sec hero loop is the silent fallback.

## Layout primitives

- 36-px row height with a 64-px right-edge "kbd hint" gutter that reveals on hover. Linear borrowed it; we steal back.
- Things-3 1px hairlines at 50% opacity for empty states. The `.horizon` class.
- Mac-window chrome on the cinematic demo, never on the real app — chrome is a tell.

## Refusal list (visual)

- No purple gradient hero.
- No metric tile that doesn't earn its pixels.
- No skeuomorphic terminal chrome.
- No emoji anywhere.
- No "rocketship" iconography.
- No "trusted by" logos until there are real ones we'd be proud to show.

## Logo + image assets

| Asset | Path | Size |
|---|---|---|
| Wordmark SVG (animated) | `src/components/brand/wordmark.tsx` (export via Playwright) | vector |
| OG default | `/opengraph-image` | 1200×630 PNG |
| X banner | `/social/x-banner/opengraph-image` | 1500×500 PNG |
| Bluesky banner | `/social/bluesky-banner/opengraph-image` | 1500×500 PNG |
| X pinned-post card | `/social/x-pinned/opengraph-image` | 1200×675 PNG |
| Bluesky pinned-post card | `/social/bluesky-pinned/opengraph-image` | 1200×630 PNG |
| Reddit Ads (wedding) | `/social/reddit-ads-wedding/opengraph-image` | 1200×628 PNG |
| Hero loop video | `/hero-loop.30s.mp4` (also at `/social/hero-loop-30s.mp4`) | 1080×1080 30fps 30s |

Press kit aggregator: `/press` (in flight in the legal-pages cycle).

## Voice anchor — when in doubt

Read `/about` again. Then read `/principles`. Then write.
