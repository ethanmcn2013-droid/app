import { ImageResponse } from "next/og";
import { TASKS_DOMAIN } from "@/lib/product-urls";

export const runtime = "edge";
export const alt = "Signal Tasks, execution clarity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AboutOG() {
  const struck = ["sprints", "epics", "tickets", "burndowns", "OKRs"];
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
          About
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 1.02,
            color: "#14151a",
            display: "flex",
            maxWidth: 1000,
          }}
        >
          Project management shouldn&rsquo;t be behind a paywall.
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          {struck.map((w) => (
            <div
              key={w}
              style={{
                fontSize: 22,
                color: "#94a3b8",
                position: "relative",
                display: "flex",
              }}
            >
              <span>{w}</span>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "55%",
                  height: 2,
                  background: "#fb7185",
                  display: "flex",
                }}
              />
            </div>
          ))}
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: "#d1fae5",
              color: "#065f46",
              fontSize: 22,
              fontWeight: 600,
              display: "flex",
            }}
          >
            tasks
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#94a3b8",
            fontSize: 17,
            letterSpacing: "0.04em",
            marginTop: 32,
          }}
        >
          <div style={{ display: "flex" }}>{TASKS_DOMAIN}/about</div>
          <div style={{ display: "flex" }}>jargon out · tool in</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
