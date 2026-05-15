/**
 * Route loading state — the tasks· wordmark holding its heartbeat
 * (M·02, paired beats every 1.6s) on white while a route resolves.
 *
 * Replaces Next's blank default. No spinner: a spinner is the
 * productivity-suite default this brand refuses (BRAND.md refusal
 * list). The wordmark's own gesture is the wait — the dot keeps its
 * pulse via the existing .tasks-dot rule, so this adds no animation
 * code. Reduced motion holds the dot still (global reduced-motion
 * block) and the wordmark simply sits there, which is correct.
 *
 * Sibling products replicate this with their own wordmark + gesture:
 * roadmap· advance, analytics· tick, notes. settle. One done here,
 * per the one-product brief.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#ffffff",
        zIndex: 50,
      }}
    >
      <span
        className="relative inline-flex select-none items-baseline text-2xl font-semibold"
        style={{ letterSpacing: "-0.05em" }}
      >
        <span className="wordmark" style={{ fontWeight: 600 }}>
          tasks
        </span>
        <span className="tasks-dot" aria-hidden />
      </span>
    </div>
  );
}
