# The gates

Two automated harnesses, both green before round 1, both run at the end of
every round, both exiting non-zero on any failure so a regression cannot be
talked past. A third small verifier guards the console artifact.

The gates are the panel's eighth member: they free the seven human-judgment
seats from ever spending a finding on what a machine can prove, and the BAR
tells every seat exactly that — a finding restating a gate-proven fact is
refuted on sight.

## 1 · The measured gate — `scripts/audit.mjs`

Reads computed styles out of a real browser (Playwright/Chromium) across
every state × the default variant, driven by `elevate.config.json`. Checks
the things opinion is bad at:

1. **Palette lock** — every colour that actually paints (text, backgrounds,
   borders with width, outlines, shadows, gradients, SVG fill/stroke) must
   be one of the config's colours at some alpha. Judged on the DECLARED
   value; a colour that never paints (zero-width border) is ignored so real
   findings aren't buried in noise.
2. **Weights** — only the config's weights.
3. **Families** — only the config's families.
4. **Contrast** — every text node against its REAL composited backdrop
   (alpha colours composited over ancestors, not assumed against white), at
   the WCAG AA threshold for its size and weight.
5. **Hit targets** — interactive elements measured as the union of the box
   and any absolutely-positioned pseudo-element expander (the correct
   technique for small circular controls is rewarded, not punished).
6. **Radii ladder** — every corner on a declared step.
7. **Motion tokens** — every transition duration and easing on the declared
   ladders.
8. **Type ramp** — every font size on the declared ramp (skipped until the
   config's `ladders.typeRamp` is filled at palette lock — fill it; "and no
   ninth step" is a sentence the log gets to say only if this runs).
9. **Declared leading** — no text-bearing element whose computed
   line-height is `normal`. Leading is a decision; the browser choosing it
   means nobody did.

Run: `node <skill>/scripts/audit.mjs --lab=<labdir>` (add `--json` for
machine reading, `--states=a,b`, `--v=<variant>`, `--viewport=WxH`).

## 2 · The behaviour gate — the engagement's `interaction-check.mjs`

Scaffolded into the lab from `scripts/interaction-skeleton.mjs`, then GROWN
by the engagement: every time a confirmed finding is fixed, add an assertion
that would have caught it, while the defect is fresh. That is where the
proving engagements' 192- and 216-assertion gates came from — every
assertion exists because a seat found the defect it guards by driving the
real file.

The skeleton ships with the harness (`ok()`, `open()` with console/page
error capture, state/variant URL helpers) plus universal assertions that
apply to any interactive surface:

- no sideways scroll at any brief viewport;
- zero console errors on load in every state;
- every interactive element has an accessible name;
- everything focusable is visible, and everything visible-and-interactive
  is focusable — no invisible tab stops, no zero-opacity live controls;
- a visible focus treatment exists (outline or equivalent) on focus;
- word-safe truncation: no text node ends mid-word against its box unless
  an ellipsis or fade is present (silent content deletion is the worst
  typographic defect the panels found);
- place-keeping: after the surface's primary action, scroll positions and
  the focused element survive the repaint;
- if a live region is advertised, acting makes it announce.

The universal set is a floor, not the gate. The engagement-specific
assertions — the keyboard model, undo, the primary gesture — are the gate.

## 3 · The console verifier — `scripts/verify-console.mjs`

The console must drive the real master, not a copy of one. Asserts: the
compiled deck renders; every console control writes an attribute the master
actually reads (toggling it changes computed style or layout in the deck);
every room preset selects; every state paints; the primary action really
works inside the console (and undoes); zero console errors; no sideways
scroll. Run it after every `build-console.mjs`.

## The verify-fix protocol (manual, every round)

Gates catch classes; this catches the one that got away. For every
confirmed finding you fix: re-open the file, navigate to the element the
finding named, and confirm the change is VISIBLE (screenshot the region or
assert the computed style). Then record it. The reason this is a named
protocol: a fix in the proving engagements was aimed at a different file,
failed silently, was recorded as done, and cost five seats a duplicated
finding the next round. "I edited it" and "it renders" are different claims;
only the second one goes in the log.

## The artifact render check — `scripts/verify-artifact.mjs`

Before republishing the log or console artifact: renders it light, dark,
and 390px mobile; fails on horizontal overflow, missing image sources, or
console errors. A report that ships broken in dark mode is a poor argument
for the standard it reports on.
