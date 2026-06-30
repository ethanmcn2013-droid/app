import { ImageResponse } from "next/og";
import { TASKS_DOMAIN } from "@/lib/product-urls";

export const runtime = "edge";
export const alt = "Signal Studio for Students.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function StudentsOG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f4f4f5 62%, #eef2ff 100%)",
          padding: "72px 96px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#4f46e5",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Signal Studio for Students
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 84,
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 1.0,
            color: "#14151a",
            display: "flex",
            maxWidth: 980,
          }}
        >
          Your semester, without the noise.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: "#475569",
            maxWidth: 880,
            lineHeight: 1.4,
            display: "flex",
          }}
        >
          Notes, Tasks, Timeline, and Signal. €9.99 a year with any student email.
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        <div
          style={{
            display: "flex",
            gap: 24,
            color: "#94a3b8",
            fontSize: 17,
            letterSpacing: "0.04em",
          }}
        >
          <div style={{ display: "flex" }}>{TASKS_DOMAIN}/students</div>
          <div style={{ display: "flex" }}>|</div>
          <div style={{ display: "flex" }}>€9.99 / year. Verified student.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
