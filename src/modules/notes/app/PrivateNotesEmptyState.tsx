"use client";

import { useEffect, useState } from "react";

// Dalí row 4, trim. Seven lines became four. The cut lines repeated
// other angles ("For things not ready" overlapped "Ideas before they
// become decisions"; "For thoughts still forming" overlapped "A place
// to think"; "Not everything needs to be shared" overlapped "Some
// things are only for you"). What's left covers four distinct angles:
// voice, time, mind, ownership.
const PRIVATE_NOTES_EMPTY_LINES = [
  "Things you can’t say out loud.",
  "Ideas before they become decisions.",
  "A place to think before you speak.",
  "Some things are only for you.",
] as const;

// E7(b), settled placeholder shown to users with ≥ this many notes.
// At this point the user knows the app; the rotating poem is first-touch
// guidance, not a permanent feature. The settled string is calm, not a CTA.
const SETTLED_NOTE_THRESHOLD = 8;
const SETTLED_LINE = "A place to think before you speak.";

// Typewriter rotation tuning. Total cycle ≈ 18s per line, was 30s,
// trimmed for Dalí row 4 so a four-line rotation completes in ~72s
// instead of ~3.5 minutes. The full pass is now short enough to
// re-encounter a line within one writing session.
//   - Type-in:  N chars × TYPE_INTERVAL_MS  (e.g. 34 chars × 50ms ≈ 1700ms)
//   - Settled hold: TOTAL_CYCLE_MS − type-in − fade-out  (≈ 15.5s)
//   - Fade-out: FADE_OUT_MS                              (≈ 800ms)
const TYPE_INTERVAL_MS = 50;
const FADE_OUT_MS = 800;
const TOTAL_CYCLE_MS = 18_000;

interface PrivateNotesEmptyStateProps {
  visible: boolean;
  /**
   * Total number of notes the user has saved. When this reaches
   * SETTLED_NOTE_THRESHOLD the placeholder poem stops rotating and
   * shows one quiet stable string instead.
   */
  noteCount?: number;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

type Phase = "typing" | "settled" | "fading";

export function PrivateNotesEmptyState({ visible, noteCount = 0 }: PrivateNotesEmptyStateProps) {
  const [index, setIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const reducedMotion = usePrefersReducedMotion();

  // E7(b): settled users get a stable string, no rotation.
  const settled = noteCount >= SETTLED_NOTE_THRESHOLD;
  const fullText = settled ? SETTLED_LINE : PRIVATE_NOTES_EMPTY_LINES[index];

  // Reduced-motion + settled-state short-circuit: skip the typewriter entirely
  // and render the full line. The caret still renders but its blink is killed
  // by the prefers-reduced-motion media query below.
  const animateTypewriter = !reducedMotion && !settled;

  // Type-in tick. Adds one character per TYPE_INTERVAL_MS until the line is
  // fully revealed, then flips to the settled phase. Skipped entirely when
  // typewriter is disabled (reduced motion / settled / hidden).
  useEffect(() => {
    if (!animateTypewriter || !visible) return;
    if (phase !== "typing") return;
    if (typedChars >= fullText.length) {
      setPhase("settled");
      return;
    }
    const t = window.setTimeout(() => setTypedChars((c) => c + 1), TYPE_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [animateTypewriter, visible, phase, typedChars, fullText.length]);

  // Settled-hold timer. Once the full line is on screen, hold for the
  // remainder of the 30s cycle, then start fading out. The hold duration is
  // computed so that (type-in + hold + fade-out) ≈ TOTAL_CYCLE_MS regardless
  // of line length.
  useEffect(() => {
    if (!animateTypewriter || !visible) return;
    if (phase !== "settled") return;
    const typeInMs = fullText.length * TYPE_INTERVAL_MS;
    const hold = Math.max(2000, TOTAL_CYCLE_MS - typeInMs - FADE_OUT_MS);
    const t = window.setTimeout(() => setPhase("fading"), hold);
    return () => window.clearTimeout(t);
  }, [animateTypewriter, visible, phase, fullText.length]);

  // Fade-out → advance index → reset to typing for the next line.
  useEffect(() => {
    if (!animateTypewriter || !visible) return;
    if (phase !== "fading") return;
    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % PRIVATE_NOTES_EMPTY_LINES.length);
      setTypedChars(0);
      setPhase("typing");
    }, FADE_OUT_MS);
    return () => window.clearTimeout(t);
  }, [animateTypewriter, visible, phase]);

  // When the user transitions into the settled state mid-cycle (note count
  // crosses the threshold) or reduced-motion turns on, snap to the fully-
  // shown stable string so we don't leave a half-typed line on screen.
  useEffect(() => {
    if (!animateTypewriter) {
      setTypedChars(fullText.length);
      setPhase("settled");
    }
  }, [animateTypewriter, fullText.length]);

  const displayText = animateTypewriter ? fullText.slice(0, typedChars) : fullText;
  const isFading = phase === "fading";

  return (
    <span
      aria-hidden="true"
      className={[
        "private-notes-empty-state",
        visible ? "" : "is-hidden",
        isFading ? "is-changing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{displayText}</span>
      <span className="private-notes-empty-caret" />
    </span>
  );
}
