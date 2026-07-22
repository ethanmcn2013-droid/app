/**
 * /app/brief loading boundary, Signal Briefing Assembly skeleton.
 *
 * Loading canon (2026-07-01 review, pitch 10): once chrome exists,
 * loading stays inside the content region, no full-screen takeover
 * (law 1). This renders in normal document flow beneath the persistent
 * app header while buildBriefing() resolves its reads.
 *
 * Honesty contract (law 2): only sections this surface actually
 * renders are reserved. The default web brief renders "Needs attention"
 * and "Quiet risks", those real headings appear; everything else is
 * abstract structure. No fake items, no fake counts, no shimmer
 * (shimmer is Timeline-canonical only, DESIGN.md §13).
 *
 * Container mirrors BriefingView: mx-auto max-w-[640px] px-6 py-12.
 *
 * Server Component, zero JS. Static blocks satisfy reduced motion
 * without a media query.
 */
export default function BriefLoading() {
  return (
    <div
      aria-hidden
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: 640,
        padding: "48px 24px",
      }}
    >
      {/* Stamp line */}
      <div
        style={{
          height: 12,
          width: 180,
          borderRadius: 6,
          background: "var(--bg-deep, #f4f4f5)",
          marginBottom: 20,
        }}
      />
      {/* Greeting line */}
      <div
        style={{
          height: 30,
          width: "62%",
          borderRadius: 8,
          background: "var(--bg-deep, #f4f4f5)",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          height: 16,
          width: "84%",
          borderRadius: 6,
          background: "var(--bg-deep, #f4f4f5)",
          marginBottom: 40,
        }}
      />

      {["Needs attention", "Quiet risks"].map((label) => (
        <section key={label} style={{ marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--brand, #4f46e5)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--ink-soft, #3f3f46)",
              }}
            >
              {label}
            </span>
          </div>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--border-soft, rgba(17,17,17,0.06))",
                borderRadius: 10,
                padding: 14,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: 14,
                  width: i === 1 ? "72%" : "58%",
                  borderRadius: 6,
                  background: "var(--bg-deep, #f4f4f5)",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: i === 1 ? "88%" : "76%",
                  borderRadius: 6,
                  background: "var(--bg-deep, #f4f4f5)",
                }}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
