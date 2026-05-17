/**
 * /app segment loading boundary — shown while the authenticated
 * workspace shell is resolving (data fetch, Clerk session, DB read).
 *
 * Mirrors the root loading.tsx contract: tasks· wordmark with its
 * canonical pulse gesture (M·02, 2.6s ease-in-out) centred on the
 * Tasks paper background. No spinner — a spinner is the productivity-
 * suite default this brand refuses (BRAND.md refusal list).
 *
 * The dot is px-clamped (max-width/max-height 8px) so it cannot
 * balloon to 250px+ before CSS hydrates — the suite-wide footgun
 * caught in R3. The em sizing still holds the proportional position at
 * normal font sizes; the clamp only caps the pre-hydration worst case.
 */
export default function AppLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
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
