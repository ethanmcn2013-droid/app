// app/loading.tsx
// Signal Studio loading boundary — LOADING_SYSTEM.md §1.
// One dot. Paper white field. No wordmark. No chrome. No skeleton.
// Server Component: zero JS overhead, paints with the RSC shell.
//
// Hard refusals (cite LOADING_SYSTEM.md §1 if asked to add any):
//   - No wordmark in the loading state
//   - No skeleton bars as system loader
//   - No large disc, spinner, or ring
//   - No product-colour differentiation
//   - No text ("Loading...", "Please wait.")
export default function Loading() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper, #ffffff)",
        zIndex: 9999,
      }}
    >
      <div
        className="signal-loading-dot"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "var(--indigo, #4f46e5)",
          flexShrink: 0,
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
