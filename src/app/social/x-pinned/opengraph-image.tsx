import { ImageResponse } from "next/og";

// nodejs runtime — see cycle-26 review note in
// `/templates/[slug]/opengraph-image.tsx`. Edge runtime + Turbopack
// dev mode + ImageResponse intermittently breaks with "failed to
// pipe response"; nodejs is reliable.
export const runtime = "nodejs";
export const alt = "Tasks — 8 features we'll never ship";
export const size = { width: 1200, height: 675 };
export const contentType = "image/png";

/**
 * X pinned-post image — 1200×675.
 *
 * Per gtm-week-1.md 9:30pm: "8 features we'll never ship. /principles
 * — the other roadmap." Black-on-cream, Geist semibold, no emojis.
 * Subtle: under the headline, four refusal captions sit as small
 * rows, each crossed out with a thin strikethrough line.
 *
 * Geist not fetched — same rationale as the other social images;
 * Geist heads the font-family stack but the renderer falls back to
 * its default sans. Visual concession noted.
 */
const FONT_STACK =
  '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const REFUSAL_PREVIEW = [
  "Per-seat pricing",
  "Gantt charts",
  "AI agents that close your loops",
  "Real-time push notifications",
];

export default async function XPinnedOG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f7f6f1",
          padding: "80px 96px",
          fontFamily: FONT_STACK,
          color: "#14151a",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: "#7a766b",
            textTransform: "uppercase",
          }}
        >
          The other roadmap
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.0,
            }}
          >
            8 features
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginTop: 6,
            }}
          >
            we&rsquo;ll never ship.
          </div>
        </div>

        {/* Refusal preview rows — each with thin strikethrough */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 44,
          }}
        >
          {REFUSAL_PREVIEW.map((r) => (
            <div
              key={r}
              style={{
                display: "flex",
                alignItems: "center",
                position: "relative",
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 500,
                  color: "#3a382f",
                  letterSpacing: "-0.01em",
                }}
              >
                {r}
              </span>
              <span
                style={{
                  position: "absolute",
                  left: -2,
                  top: "50%",
                  height: 1.5,
                  width: 520,
                  background: "#fda4af",
                  transform: "translateY(-1px)",
                  display: "flex",
                }}
              />
            </div>
          ))}
          <div
            style={{
              display: "flex",
              marginTop: 4,
              fontSize: 22,
              color: "#7a766b",
              fontStyle: "italic",
            }}
          >
            and four more.
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#3a382f",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            tasks
            <span
              style={{
                display: "flex",
                marginLeft: 6,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#4f46e5",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              color: "#7a766b",
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            /principles
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
