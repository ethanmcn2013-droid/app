import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tasks — priced honestly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Pricing OG. Lays out the four tiers as a row of price cards. */
export default async function PricingOG() {
  const tiers = [
    { name: "Solo", price: "Free", note: "forever" },
    { name: "Pro", price: "$4.99", note: "/ month" },
    { name: "Team", price: "$9.95", note: "/ workspace" },
    { name: "Wedding", price: "$79", note: "one-time" },
  ];

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
          Pricing
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            color: "#14151a",
            display: "flex",
          }}
        >
          Priced honestly.{" "}
          <span style={{ color: "rgba(71,85,105,0.65)", marginLeft: 14 }}>
            Free where it counts.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 56,
          }}
        >
          {tiers.map((t, i) => (
            <div
              key={t.name}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: i === 2 ? "#14151a" : "#ffffff",
                color: i === 2 ? "#ffffff" : "#14151a",
                border: i === 2 ? "1px solid #14151a" : "1px solid #e5e7eb",
                borderRadius: 18,
                padding: "24px 22px",
                boxShadow:
                  i === 2
                    ? "0 24px 48px -16px rgba(20,21,26,0.32)"
                    : "0 4px 12px -2px rgba(20,21,26,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: i === 2 ? "rgba(255,255,255,0.6)" : "#94a3b8",
                  display: "flex",
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 38,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  display: "flex",
                }}
              >
                {t.price}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: i === 2 ? "rgba(255,255,255,0.7)" : "#64748b",
                  display: "flex",
                }}
              >
                {t.note}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#94a3b8",
            fontSize: 17,
            letterSpacing: "0.04em",
          }}
        >
          <div style={{ display: "flex" }}>tasks.app/pricing</div>
          <div style={{ display: "flex" }}>per workspace, never per seat</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
