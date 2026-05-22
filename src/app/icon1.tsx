import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * Android maskable icon — Signal Tasks.
 *
 * Solid indigo field (suite-locked accent), white "t." glyph
 * centred inside the maskable safe zone (80%-diameter circle ≈
 * 51px inset on each side). Any Android adaptive-icon mask
 * resolves to a clean indigo silhouette with the mark intact.
 */
export default function MaskableIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#4f46e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            color: "#ffffff",
            fontSize: 220,
            fontWeight: 700,
            letterSpacing: "-0.06em",
          }}
        >
          <span style={{ display: "flex" }}>t</span>
          <span
            style={{
              display: "flex",
              width: 28,
              height: 28,
              borderRadius: 9999,
              background: "#ffffff",
              marginLeft: 12,
              marginBottom: 12,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
