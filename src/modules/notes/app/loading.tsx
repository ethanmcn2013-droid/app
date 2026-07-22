/**
 * Notes /app loading boundary, wordmark identity loader.
 *
 * Server Component, zero JS, inlined keyframes so motion paints with
 * the first HTML chunk, survives the cross-origin pre-CSS window
 * during sibling-product jumps.
 *
 * Choreography:
 *   1. Letters of "notes" rise into place with stagger (60ms apart,
 *      280ms using the licensed wordmark-loader easing).
 *   2. Indigo dot lands as the period with a soft overshoot bounce
 *      after the last letter starts.
 *   3. Once landed, the dot enters the canonical Notes caret blink —
 *      same gesture as the notebook header.
 *
 * Notes uses the canonical `--paper` surface, which carries its warm-white
 * brand register.
 *
 * Reduced motion: letters appear fully, dot lands without scale-bounce,
 * caret stops blinking.
 *
 * Loading canon (2026-07-01 review, pitch 7): the mark's dot becomes
 * the canonical sharp caret, a held cursor, 1.1s steps(1,end) on/off.
 * No blank notebook line is drawn before the real notebook shell
 * exists. After a real 5s wait one calm line appears, "Opening the
 * notebook", with role="status" aria-live="polite".
 */
import { LongWaitStatus } from "@/modules/notes/components/long-wait-status";

export default function NotesLoading() {
  const word = "notes";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        zIndex: 9999,
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily:
            'var(--font-geist-sans), "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontWeight: 600,
          fontSize: 36,
          letterSpacing: "-0.04em",
          lineHeight: 0.96,
          color: "var(--ink)",
          display: "inline-flex",
          alignItems: "baseline",
          whiteSpace: "nowrap",
        }}
      >
        {word.split("").map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              animation: `signal-letter-rise 280ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`, // ds-allow — Notes wordmark-loader rise choreography.
            }}
          >
            {c}
          </span>
        ))}
        <span
          style={{
            // The canonical Notes caret, a sharp held cursor, not a dot
            // (BRAND.md §4). Hard px so it cannot balloon pre-hydration.
            display: "inline-block",
            width: 3,
            height: 22,
            maxWidth: 3,
            maxHeight: 22,
            borderRadius: 1,
            background: "var(--accent)",
            marginLeft: 6,
            alignSelf: "center",
            transform: "translateY(1px)",
            flexShrink: 0,
            animation: `signal-caret-land 360ms cubic-bezier(0.34,1.56,0.64,1) ${word.length * 60 + 80}ms both, signal-notes-caret 1.1s steps(1,end) ${word.length * 60 + 600}ms infinite`, // ds-allow — Notes caret-land signature bounce.
          }}
        />
      </span>
      <LongWaitStatus line="Opening the notebook" />
      <style>{`
        @keyframes signal-letter-rise {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes signal-caret-land {
          0%   { opacity: 0; transform: translateY(1px) scaleY(0.4); }
          60%  { opacity: 1; transform: translateY(1px) scaleY(1.12); }
          100% { opacity: 1; transform: translateY(1px) scaleY(1); }
        }
        @keyframes signal-notes-caret {
          0%, 49%  { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes signal-letter-rise {
            from { opacity: 1; transform: none; }
            to   { opacity: 1; transform: none; }
          }
          @keyframes signal-caret-land {
            from, to { opacity: 1; transform: translateY(1px) scaleY(1); }
          }
          @keyframes signal-notes-caret {
            from, to { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
