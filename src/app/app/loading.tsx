/**
 * Tasks /app loading boundary, wordmark identity loader.
 *
 * Replaces the prior skeleton + the bare indigo circle that the
 * cross-origin pre-CSS window was painting during sibling-product
 * jumps. Pure Server Component: zero JS, inlined keyframes so the
 * motion paints with the first HTML chunk, survives the brief
 * window before globals.css resolves.
 *
 * Choreography:
 *   1. Letters of "tasks" rise into place with stagger (60ms apart,
 *      280ms cubic-bezier(0.16,1,0.3,1)).
 *   2. Indigo dot lands as the period with a soft overshoot bounce
 *      300ms after the last letter starts.
 *   3. Once landed, the dot enters the canonical Tasks pulse, the
 *      same gesture the product surfaces use, so the loader IS the
 *      product gesture continuing into the brief wait.
 *
 * Reduced motion: letters appear fully (no rise), dot lands without
 * scale-bounce, pulse animation halts.
 *
 * Long-wait escalation (loading canon, pitch 6): after a real 5s wait
 * one calm line appears, "Opening the workspace", with role="status"
 * aria-live="polite". The decorative wordmark stays aria-hidden; the
 * status line is the only announced content.
 */
import { LongWaitStatus } from "@/components/system/long-wait-status";

export default function TasksLoading() {
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
        background: "var(--paper, #ffffff)",
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
          color: "var(--ink, #14151a)",
          display: "inline-flex",
          alignItems: "baseline",
          whiteSpace: "nowrap",
        }}
      >
        {["t", "a", "s", "k", "s"].map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              animation: `signal-letter-rise 280ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
            }}
          >
            {c}
          </span>
        ))}
        <span
          style={{
            // 10px hard px, boundary-dot authority (DESIGN.md §13.3).
            display: "inline-block",
            width: 10,
            height: 10,
            maxWidth: 10,
            maxHeight: 10,
            borderRadius: "50%",
            background: "var(--indigo, #4f46e5)",
            marginLeft: 6,
            transform: "translateY(-2px)",
            flexShrink: 0,
            animation:
              "signal-dot-land 360ms cubic-bezier(0.34,1.56,0.64,1) 360ms both, signal-tasks-pulse 2.6s ease-in-out 800ms infinite",
          }}
        />
      </span>
      <LongWaitStatus line="Opening the workspace" />
      <style>{`
        @keyframes signal-letter-rise {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes signal-dot-land {
          0%   { opacity: 0; transform: translateY(-2px) scale(0.4); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.18); }
          100% { opacity: 1; transform: translateY(-2px) scale(1); }
        }
        @keyframes signal-tasks-pulse {
          0%, 30%, 100% { transform: translateY(-2px) scale(1); }
          10%           { transform: translateY(-2px) scale(1.22); }
          20%           { transform: translateY(-2px) scale(1); }
          40%           { transform: translateY(-2px) scale(1.12); }
          50%           { transform: translateY(-2px) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes signal-letter-rise {
            from { opacity: 1; transform: none; }
            to   { opacity: 1; transform: none; }
          }
          @keyframes signal-dot-land {
            from, to { opacity: 1; transform: translateY(-2px) scale(1); }
          }
          @keyframes signal-tasks-pulse {
            from, to { transform: translateY(-2px) scale(1); }
          }
        }
      `}</style>
    </div>
  );
}
