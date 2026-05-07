import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Browser tab icon. Compact mark — wordmark "t" on a brand-soft
 * tile, indigo-600 dot bottom-right. Reads at 16x16 because the
 * mark is just a glyph and a dot, not the whole wordmark.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#eef2ff",
          color: "#14151a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          borderRadius: 6,
        }}
      >
        <span style={{ display: "flex", marginLeft: 1 }}>t</span>
        <span
          style={{
            display: "flex",
            position: "absolute",
            right: 5,
            bottom: 7,
            width: 4,
            height: 4,
            borderRadius: 9999,
            background: "#4f46e5",
          }}
        />
      </div>
    ),
    size,
  );
}
