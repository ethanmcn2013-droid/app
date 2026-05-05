# Cycle 1 · Make the view morph actually FLIP

**Status:** in_progress · 2026-05-05

## Problem

The cinematic demo's most ambitious scene is the view morph
(board → list → timeline → board). Today it crossfades via
`AnimatePresence mode="wait"`: the entire board view unmounts
before the list mounts, so the shared `layoutId="task-${id}"`
matches across components but motion has nothing to interpolate
between (source nodes are gone before targets exist). The result
is three abrupt fade transitions instead of cards gliding from
column to row to gantt bar. This is the single biggest broken
promise in the hero artifact, and it cheapens every other scene
that depends on the demo feeling alive.

## Solution shape

Move from "swap which view component mounts" to "render one set
of motion cards, change the layout that wraps them." A single
`<DemoSurface>` produces one motion.div per task with stable
`layoutId="task-${id}"` and `layout` enabled. View mode controls
how the surface is structured: lane-grouped flex columns for
board, sectioned table rows for list, absolute-positioned gantt
bars for timeline. Switching `state.view` changes the parent
layout; motion's FLIP system measures, interpolates, and animates
each card from its prior position to its new one over ~720ms with
the project's `ease-out-expo`. Cursors, sparkline, ghost-card,
nudge, and activity feed remain mounted throughout. Card content
collapses to the bare essentials inside the morph (title +
priority dot + assignee) so size differences don't fight the
transition.

## Success criteria

- Switching board → list visibly translates each card from its
  column position to its row position (no fade-then-mount)
- All 16 seed tasks animate continuously, none teleport
- Other scenes (carry, comment, nudge, dependency, celebration)
  unaffected
- Demo holds 60fps under Performance throttle (visual check)
- Type-checked, no `any` casts in new code
- `prefers-reduced-motion` honors the change (jump-cuts ok there)

## Out of scope

- New scenes
- Drag interactions inside the demo
- Actual data syncing across views (still single seed source)
- Calendar view inclusion in morph (stays board → list → timeline
  for now; calendar is decorative and lives in app routes only)

## Architect notes

**New files**
- `src/components/showcase/demo-surface.tsx` — unified surface; renders one card per task, places chrome (lane backgrounds / table header / gantt grid) in a sibling `ViewWrappers` that cross-fades.
- `src/components/showcase/use-reduced-motion.ts` — reads motion's `useReducedMotion`, exports a shared `LAYOUT_TRANSITION` constant so every card uses identical timing.

**Edits**
- `cinematic-demo.tsx` — replace the lines 622-662 `AnimatePresence mode="wait"` swap with `<DemoSurface state={state} cardRefs={cardRefs} />`. Keep all overlays (cursors, ghost, nudge, sparkline, celebration, activity) as siblings.
- `task-card.tsx` — extend `variant` to `"board" | "list" | "timeline"`. Body content branches by variant; outer wrapper keeps `layoutId="task-${id}"` and `layout`. Body wrapped in nested AnimatePresence (no mode="wait") for ~200ms cross-fade against the 720ms geometry tween.

**Component tree** — single LayoutGroup; `<ViewWrappers>` (chrome only, AnimatePresence cross-fade); `<CardLayer>` (stable, never unmounts, CSS layout switches by variant); overlays outside.

**Motion config** — 720ms / `[0.16, 1, 0.3, 1]` unified across all cards (no stagger — concert reads as "the surface reshaped"). Reduced motion → 0ms layout, 0ms cross-fade.

**Card content strategy** — cross-fade content while geometry morphs. Geometry tween dominates; body cross-fades on a 200ms tail.

**Edge cases handled**
- Carry guard: `if (state.view !== "board") return;` at top of `sceneCarry`.
- Morph guard: `if (state.pickedTaskId) return;` at top of `sceneViewMorph`.
- `data-task-id`, `data-lane`, `data-tab` preserved.
- `overflow: visible` on `<CardLayer>`; outer surface keeps `overflow: hidden`.
- Today marker moves into `ViewWrappers` and shares the 240px task-name gutter origin used by `<CardLayer>` in timeline mode.

**Rollback** — keep `list-view.tsx` and `timeline-view.tsx` files for one cycle; revert is a single import swap + the 40-line render-block restoration in `cinematic-demo.tsx`. Carry scene must keep working — verify by pausing demo mid-carry, expect ghost + drop + celebration intact.

**Risks logged**
- Timeline absolute-positioning fragility (acceptable fallback: keep `TimelineView` as render path inside `DemoSurface` for `view==="timeline"`).
- `transition-shadow` on cards may shimmer mid-morph — kill local CSS transition, let motion own it.
- Layout measurements on 16 cards at 60fps fine; recheck under throttle in TEST.

## Design notes

**Body content per variant**
- Board (~280×80): title (2-line clamp) + assignee stack + lane dot. Drop priority pill, due, estimate, idle/comments — they live on hover state.
- List (~32px row): align to header grid `[1.6fr 0.7fr 0.6fr 0.6fr 0.5fr]` → title · status pill (lane.bg tint) · priority dot+label · due (tabular-nums) · assignees. No leading bullet dot.
- Timeline (~28px bar): lead avatar (12px) + title (lane.ink color). No border — fill carries lane identity. If width <80px, hide title.

**The soul** — title text + leftmost assignee avatar. Both travel as a compact left-anchored unit across all three forms. Lane color is *contextual chrome* (full pill list, bar fill timeline, header dot board) — explicitly NOT a constant.

**Cross-fade timing within 720ms tween**
- t=0 → 160ms: outgoing body fade-out (ease-out-cubic `[0.4, 0, 1, 1]`)
- t=160 → 280ms: **120ms hole** — only soul (title + avatar) renders, prevents white flash from simultaneous opacity-50 overlap
- t=280 → 520ms: incoming body fade-in (ease-out-expo)
- t=520 → 720ms: geometry settles alone, content already at rest

**Chrome trails cards** — destination chrome whispers at 15% opacity throughout, rises 280ms starting at t=440ms, completes at 720ms in lockstep with geometry. Cards are protagonists; chrome is the room they walk into. Today-marker fades last at t=560ms (timeline-only flourish, see below).

**Hard nos** — no rotation/skew/Y-flip; no scale beyond geometry; no filter blur; no mid-flight color shift; no exit ghosts; no per-card stagger (concert, not swarm).

**Sound** — one sustained string-section downbow with a single soft wood-block tap as chrome lands.

**Flourish — Today indicator on entering timeline only**
- 80ms hold after cards land at t=720ms
- Then 320ms top-to-bottom draw of indigo line (ease-cinema)
- Today pill snaps in via spring at end of draw
- Single use of brand color per cycle = punctuation mark
- No flourish on board or list re-entry — restraint is the move there.
