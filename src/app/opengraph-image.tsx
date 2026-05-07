import { ImageResponse } from "next/og";

// nodejs runtime — see cycle-26 review note in
// `/templates/[slug]/opengraph-image.tsx`. Edge runtime + Turbopack
// dev mode + ImageResponse breaks intermittently with "failed to
// pipe response"; nodejs is reliable.
export const runtime = "nodejs";
export const alt = "Tasks — work that moves itself forward";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Root OG image. Single elegant card — wordmark, headline, subhead.
 * Brand gradient backdrop with the "·" emit-dot motif lifted from
 * the in-app Wordmark.
 */
export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #fafafa 0%, #f3f4f6 60%, #e5e7eb 100%)",
          padding: "80px 96px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Soft brand glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(124,92,255,0.32), rgba(79,70,229,0.12), transparent 70%)",
            filter: "blur(60px)",
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "#14151a",
          }}
        >
          tasks
          <span
            style={{
              display: "flex",
              marginLeft: 6,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#4f46e5",
              boxShadow: "0 0 24px rgba(124,92,255,0.6)",
            }}
          />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            color: "#14151a",
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 1.02,
              maxWidth: 920,
            }}
          >
            Work that moves itself forward.
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              color: "#475569",
              maxWidth: 880,
              lineHeight: 1.4,
            }}
          >
            A live task workspace built for momentum. Multi-view, real-time, plain-English dates.
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 40,
            color: "#94a3b8",
            fontSize: 18,
            letterSpacing: "0.04em",
          }}
        >
          <div style={{ display: "flex" }}>tasks.app</div>
          <div style={{ display: "flex" }}>v0.2 · designed in motion</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
