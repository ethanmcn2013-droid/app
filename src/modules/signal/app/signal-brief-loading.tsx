/**
 * /app/signal loading boundary, Signal Briefing Assembly skeleton.
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
 * (shimmer is Timeline-canonical only, DESIGN.md section 13).
 *
 * Container mirrors QuietBriefingLedger: mx-auto max-w-[960px] px-6 py-8.
 *
 * Server Component, zero JS. Static blocks satisfy reduced motion
 * without a media query.
 */
export default function BriefLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: 960,
        padding: "32px 24px",
      }}
    >
      <span className="sr-only">Building your Signal briefing.</span>
      <div aria-hidden>
        {/* Dateline */}
      <div
        style={{
          height: 11,
          width: 168,
          borderRadius: 6,
          background: "var(--bg-deep)",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          height: 12,
          width: 120,
          borderRadius: 6,
          background: "var(--bg-deep)",
          marginBottom: 26,
        }}
      />

        {/* Ledger heading */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          borderBottom: "1px solid var(--hairline)",
          paddingBottom: 20,
          marginBottom: 32,
        }}
      >
        <div style={{ width: "min(520px, 72%)" }}>
          <div
            style={{
              height: 10,
              width: 96,
              borderRadius: 6,
              background: "var(--bg-deep)",
              marginBottom: 10,
            }}
          />
          <div
            style={{
              height: 21,
              width: "72%",
              borderRadius: 7,
              background: "var(--bg-deep)",
            }}
          />
        </div>
        <div
          style={{
            height: 10,
            width: 112,
            borderRadius: 6,
            background: "var(--bg-deep)",
          }}
        />
      </div>

      {["Needs attention", "Quiet risks"].map((label, sectionIndex) => (
        <section key={label} style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
              }}
            >
              {label}
            </span>
          </div>

          {[1, 2].map((row) => (
            <div
              key={row}
              style={{
                borderBottom: "1px solid var(--hairline-soft)",
                padding: "16px 12px",
              }}
            >
              <div
                style={{
                  height: 14,
                  width:
                    sectionIndex === 0 && row === 1
                      ? "68%"
                      : row === 1
                        ? "58%"
                        : "74%",
                  maxWidth: 620,
                  borderRadius: 6,
                  background: "var(--bg-deep)",
                  marginBottom: 9,
                }}
              />
              <div
                style={{
                  height: 11,
                  width: row === 1 ? 210 : 176,
                  borderRadius: 6,
                  background: "var(--bg-deep)",
                }}
              />
            </div>
          ))}
        </section>
      ))}

      <div
        style={{
          height: 10,
          width: 196,
          borderRadius: 6,
          background: "var(--bg-deep)",
          marginTop: 48,
        }}
      />
      </div>
    </div>
  );
}
