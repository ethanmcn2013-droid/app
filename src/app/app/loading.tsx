// app/app/loading.tsx
// Signal Studio /app segment loading boundary — LOADING_SYSTEM.md §1.
// Renders while the authenticated workspace shell resolves (Clerk auth,
// DB reads). Chrome (SuiteChrome) lives in layout and renders instantly;
// this boundary fills only the content well — hence position:fixed + z:9999
// still covers the sub-chrome area cleanly.
//
// Server Component: zero JS overhead, paints with the RSC shell.
// DECISIONS.md D5: auth() moved out of layout into Suspense child so this
// boundary actually paints (Next 16.2 blocks loading.tsx when layout awaits
// runtime data).
export default function AppLoading() {
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
