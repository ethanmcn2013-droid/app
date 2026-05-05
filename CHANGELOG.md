# Changelog

All notable changes to the Tasks product are recorded here. Each entry
corresponds to one autonomous PM/Architect cycle.

## Cycle 1 · 2026-05-05 · View morph actually FLIPs

The cinematic showcase demo's view-morph scene previously crossfaded
via `AnimatePresence mode="wait"` — every card unmounted before the
next view mounted, so the shared `layoutId` had nothing to interpolate
between. Net effect: three abrupt fades instead of cards gliding from
column to row to gantt bar. The hero artifact's most ambitious moment
was unfulfilled.

**Changed**
- Replaced the `AnimatePresence mode="wait"` view swap with a unified
  `<DemoSurface>` (`src/components/showcase/demo-surface.tsx`) that
  keeps one set of motion cards mounted at all times. Switching `view`
  now changes the parent layout; motion's FLIP system tweens each card
  from its previous geometry to its new geometry over 720ms with
  ease-out-expo, all 16 cards in concert.
- Card body cross-fades in two stages with a 120ms hole between them,
  so the eye never sees both bodies at 50% (which would white-flash).
- Wrapper chrome (column backgrounds, list table header, gantt grid)
  trails the cards: faint at 15% throughout, rises 280ms starting at
  t=440ms — cards are protagonists, chrome is the room.
- Today indicator on entering timeline draws top-to-bottom over 320ms,
  then the pill snaps in via spring — a single brand-color punctuation.
- Added scene guards: carry no-ops outside board view; view-morph
  no-ops while a card is in flight.
- New `useMorphTransition` hook centralizes durations and respects
  `prefers-reduced-motion`.

**Fixed (during review pass)**
- Timeline geometry: replaced malformed
  `calc(% * (100% - 200px) / 100%)` with absolute positioning inside
  a 200px-gutter-aware track. Bars now land in the correct day cell.
- TodayMarker alignment: removed magic `0.985` fudge factor and
  duplicated 20px gutter; now computed against the same reference
  frame as the bars.
- Duplicated `data-lane` attributes (chrome + card-layer) collapsed
  to a single source on the card-layer column so `querySelector`
  returns the right element for the carry-scene celebration burst.

**Backlog** — see `docs/cycles/backlog.md` for deferred items
(TaskCard/MorphCard reunification, dead-code purge, useMemo on
transitions, stable ref callback).
