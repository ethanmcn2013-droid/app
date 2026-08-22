/**
 * /app/tasks loading boundary.
 *
 * Tasks had none, so every move between Board, List, Schedule and Calendar
 * fell through to the /app boot boundary — a fixed, full-screen,
 * z-index-9999 wordmark takeover. Switching a view inside a workspace you
 * are already standing in is not an arrival, and painting the product's
 * cold-entry loader over it made a tab press read as a page reload.
 *
 * Loading canon (pitch 10): chrome exists here, so the wait stays in the
 * content region — a tracing of the settled surface, no takeover, no
 * shimmer (Timeline-canonical only), no fake tasks. Server Component, zero
 * JS, no animation, so reduced motion is satisfied without a media query.
 *
 * Reserve floor: the project band, the view bar, and one lane's worth of
 * column headers. Reserving the chrome that is about to reappear in the
 * same place is the correct direction to be wrong in — the surface settles
 * into the tracing rather than replacing it.
 *
 * Hand-off (wave 7): ArrivalSettle rides beside the tracing and gives the
 * view that replaces it one whole-surface opacity settle, so "settles into
 * the tracing" is now literally what happens rather than a description of a
 * cut. See src/components/system/arrival-settle.tsx.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";

export default function TasksLoading() {
  const bar = (width: string, height = 12) => (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: 4,
        background: "var(--paper-deep, rgba(20,21,26,0.06))",
      }}
    />
  );

  const lane = (key: string) => (
    <div
      key={key}
      aria-hidden
      style={{
        flex: "1 0 224px",
        minWidth: 224,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "0 12px",
        borderRight: "1px solid var(--hairline-soft, rgba(17,17,17,0.06))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 38 }}>
        {bar("9ch", 10)}
      </div>
      <div
        style={{
          height: 64,
          borderRadius: 12,
          background: "var(--wash, rgba(20,21,26,0.04))",
        }}
      />
    </div>
  );

  return (
    <>
      <ArrivalSettle />
      <div
        role="status"
        aria-label="Opening this view"
        style={{
          display: "flex",
          flex: "1 1 auto",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--paper)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            minHeight: 54,
            padding: "6px 14px 6px 16px",
            borderBottom: "1px solid var(--hairline, rgba(17,17,17,0.10))",
          }}
        >
          {bar("16ch", 16)}
          {bar("11ch", 10)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            minHeight: 42,
            padding: "0 10px 0 16px",
            borderBottom: "1px solid var(--hairline, rgba(17,17,17,0.10))",
          }}
        >
          {bar("5ch", 10)}
          {bar("4ch", 10)}
          {bar("7ch", 10)}
          {bar("7ch", 10)}
        </div>
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0, paddingTop: 12, paddingLeft: 4 }}>
          {["a", "b", "c", "d"].map(lane)}
        </div>
      </div>
    </>
  );
}
