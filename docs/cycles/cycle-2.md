# Cycle 2 · Restraint — pacing + cursor labels

**Status:** in_progress · 2026-05-05

## Problem

Two related defects in the demo's *tone*. (1) Scene-to-scene
transitions hold for only ~700ms — after the celebration burst the
loop immediately rolls into the next setup beat, leaving the eye no
moment to settle. The demo treats every second as equally loud, which
reads as "watch me work" rather than "this is alive." (2) Cursor name
tags (Chloe in pink, David in teal, Alex in purple) are large
saturated pills that ride the cursor permanently. They flatten the
hierarchy: every moment screams its own label. Together these two
make the demo feel chat-app-y when the brand demands concert-hall.

## Solution shape

Subtract, don't add. Two interventions: a **settle beat** of ~1.6s
between scenes where cursors gently drift, no overlays render, no
state changes — the room breathes. And **conditional cursor labels**
that appear only when a cursor is doing something meaningful
(grabbing, reading a card, or just landed). During idle drift, the
cursor is a quiet arrow; only when intent activates does the name
surface, and it fades out 600ms after the action ends. Per-cursor
fade timing is staggered so the three labels don't pulse in unison.

## Success criteria

- Between every scene there's a visible held moment (~1.5s+) where
  no orchestrated action is firing
- Cursor labels are absent during idle drift; present during
  grabbing / reading; fade out cleanly after action ends
- Three cursors don't synchronize their label fades (visual asynchrony)
- Demo feels "less busy" on first watch — a designer reviewing for
  10s should describe the tone as *composed*, not *eager*
- No regression in existing scenes (carry, comment, morph, nudge,
  dependency, celebration)
- Type-clean, no console errors, prefers-reduced-motion preserved

## Out of scope

- New scenes
- Card content density changes (deferred from cycle 1 backlog)
- TaskCard / MorphCard reunification (backlog)
- Sound (we are not adding audio yet, despite the design rec
  invoking string sections)

## Architect notes

Small surface; skipping the parallel Plan agent — the changes are local
to two files.

**Edits**
- `src/components/showcase/cursors-layer.tsx` — gate label visibility
  on `cursor.grabbing || cursor.reading || cursor.justArrived`. Add a
  per-cursor `labelFade` timer so labels exit ~600ms after the action
  ends, staggered by user (chloe 0ms, david 220ms, alex 440ms).
- `src/components/showcase/cinematic-demo.tsx` — add a
  `sceneSettle(durationMs)` helper that just `wait(ms)`s with the
  scene name set to `"settle"`. Insert ~1600ms settle between every
  pair of scenes in the run loop. While settling, gently drift each
  cursor every ~700ms toward random nearby points (a subtle wander)
  so the demo reads "alive" without firing scripted action.
- `src/components/showcase/types.ts` — add `justArrived?: boolean` to
  cursor state for the brief landing-label window (200ms grace).

**Motion config** — label fade-out 320ms ease-out-expo. Drift moves
use existing spring physics (no new config). Settle beat = 1600ms
default; scenes choose their own override via parameter.

**Edge cases** — During settle, the orchestrator still wakes if
`paused` or unmounted. Drift uses the same cursor x/y motion values,
so spring physics handle interruption. No new refs.

## Design notes

Restraint is the move. Three principles:

1. **Labels are signal, not skin.** A name pill says "this cursor is
   doing something." When it's just drifting it's a quiet arrow.
2. **Asynchrony reads as life.** Three cursors fading their labels at
   the same instant looks like a state machine. Staggered (220ms
   offsets) reads as three independent humans.
3. **The settle is part of the choreography.** It is not "dead time."
   The cursors drift, the burndown sparkline holds, the activity feed
   keeps its last entry visible — the room is *occupied*, just not
   *acting*. This is the difference between a concert and a busker.
