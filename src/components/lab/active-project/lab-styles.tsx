/**
 * WP5 lab · one stylesheet, shared by the index and all four variants.
 *
 * Three jobs:
 *
 *  1. Disarm a real trap. `globals.css` carries an unlayered
 *     `:focus-visible { border-radius: 6px }`, which beats every Tailwind
 *     radius utility (utilities live in a cascade layer, that rule does not).
 *     Any pill or large-radius control therefore snaps to 6px the moment it
 *     takes focus. `.ap-r` restores the intended radius at higher specificity.
 *
 *  2. Carry the motion the variants need as CSS rather than JavaScript, so
 *     reduced motion is honoured by the platform. Durations come from
 *     `--motion-*`, which `tokens.css` already zeroes under
 *     `prefers-reduced-motion`; `[data-ap-motion="reduced"]` is the lab's own
 *     switch so a reviewer can see that state without changing an OS setting.
 *
 *  3. Provide the phone frame's simulated safe areas, so the bottom sheet is
 *     reviewable on a desktop without pretending the inset does not exist.
 */
export function LabStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
:root {
  --ap-safe-top: env(safe-area-inset-top, 0px);
  --ap-safe-bottom: env(safe-area-inset-bottom, 0px);
}

/* 1 · focus radius, restored above the unlayered global rule */
.ap-r:focus-visible { border-radius: var(--ap-r, 8px); }

/* 2 · surfaces */
.ap-skeleton {
  background: linear-gradient(
    90deg,
    var(--paper-deep) 0%,
    var(--paper-soft) 40%,
    var(--paper-deep) 80%
  );
  background-size: 220% 100%;
  animation: ap-shimmer 1400ms linear infinite;
}
@keyframes ap-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -60% 0; }
}

/* The committed Project, held still while another one opens. Dimmed and
   inert — never relabelled, never replaced by the incoming name. */
.ap-held[data-held="true"] {
  opacity: 0.42;
  filter: saturate(0.6);
  transition:
    opacity var(--motion-base) var(--ease-out),
    filter var(--motion-base) var(--ease-out);
}

/* 3 · the anchored layer, plan §7.5 F1: origin-aware scale .98 + opacity,
   140ms in, 100ms out. Escape cuts immediately (the variant unmounts). */
.ap-pop {
  transform-origin: var(--ap-origin, top left);
  animation: ap-pop-in var(--motion-fast) var(--ease-out) both;
}
@keyframes ap-pop-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

/* Mobile bottom sheet. A sheet that fades in place reads as a dialog that
   was already there; this one arrives from the edge it is anchored to. */
.ap-sheet { animation: ap-sheet-in var(--motion-base) var(--ease-out) both; }
@keyframes ap-sheet-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.ap-scrim { animation: ap-fade-in var(--motion-fast) var(--ease-out) both; }
@keyframes ap-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* The one progress affordance, past 300ms. A line that completes, not a
   spinner that never does. */
.ap-progress::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  background: var(--accent);
  transform-origin: left;
  animation: ap-progress 2600ms var(--ease-in-out) both;
}
@keyframes ap-progress {
  from { transform: scaleX(0.04); }
  to { transform: scaleX(0.92); }
}

/* Reduced motion: opacity only, no travel, no shimmer, no creeping line.
   Both the platform signal and the lab's own switch. */
@media (prefers-reduced-motion: reduce) {
  .ap-skeleton { animation: none; }
  .ap-pop, .ap-sheet { animation: ap-fade-in 1ms linear both; }
  .ap-progress::after { animation: none; transform: scaleX(0.5); }
  .ap-deck-card { transition: none !important; }
}
[data-ap-motion="reduced"] .ap-skeleton { animation: none; }
[data-ap-motion="reduced"] .ap-pop,
[data-ap-motion="reduced"] .ap-sheet { animation: ap-fade-in 1ms linear both; }
[data-ap-motion="reduced"] .ap-progress::after { animation: none; transform: scaleX(0.5); }
[data-ap-motion="reduced"] .ap-held[data-held="true"] { transition: none; }
[data-ap-motion="reduced"] .ap-deck-card { transition: none !important; }
[data-ap-motion="reduced"] .ap-band { transition: none !important; }

/* 4 · the phone frame's simulated insets */
.ap-stage[data-device="phone"] {
  --ap-safe-top: 44px;
  --ap-safe-bottom: 34px;
}
`,
      }}
    />
  );
}
