import { ImageResponse } from "next/og";

// nodejs runtime, see cycle-26 review note. Edge + Turbopack dev mode
// + ImageResponse breaks intermittently; nodejs is reliable.
export const runtime = "nodejs";
export const alt = "tasks, work that moves itself forward";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Root OG image.
 * Wordmark-only composition, same restraint as studio. OG.
 * Background: --bg #fafaf7 (warm-stone canvas token from globals.css)
 * Wordmark: lowercase "tasks" + brand dot
 *   - text color: #18181b (--ink-900)
 *   - dot color:  #4f46e5 (--indigo-600 / --brand)
 *   - dot size: 0.32em × fontSize; offset: marginLeft 0.12em, translateY -0.38em
 */
export default async function OG() {
  const fontSize = 380;
  const dotSize = Math.round(fontSize * 0.32);
  const dotMarginLeft = Math.round(fontSize * 0.12);
  const dotOffsetY = Math.round(fontSize * 0.38);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#fafaf7",
          fontFamily: "-apple-system, 'Helvetica Neue', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize,
            fontWeight: 600,
            letterSpacing: "-0.05em",
            color: "#18181b",
            marginLeft: "-0.3ch",
          }}
        >
          tasks
          {/* Brand dot, matches .tasks-dot spec: 0.32em, translateY -0.38em */}
          <span
            style={{
              display: "flex",
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: "#4f46e5",
              marginLeft: dotMarginLeft,
              marginBottom: dotOffsetY,
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
