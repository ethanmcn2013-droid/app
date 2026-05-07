import { ImageResponse } from "next/og";

// nodejs runtime — see cycle-26 review note in
// `/templates/[slug]/opengraph-image.tsx`. Edge runtime + Turbopack
// dev mode + ImageResponse intermittently breaks with "failed to
// pipe response"; nodejs is reliable.
export const runtime = "nodejs";
export const alt = "Tasks — strikethrough manifesto banner";
export const size = { width: 1500, height: 500 };
export const contentType = "image/png";

/**
 * X / Twitter banner — 1500×500.
 *
 * Strikethrough manifesto wallpaper, per gtm-week-1.md Brief 1.
 * Studio off-white background. Ten jargon phrases tiled across the
 * canvas, each crossed out with a thin rose-300 line. Tagline anchored
 * bottom-right. No logo, no emojis.
 *
 * Geist requested in brief — but we don't fetch fonts here (matches
 * the rest of the OG fleet, which uses the system stack). Geist
 * heads the font-family list so the page picks it up wherever the
 * renderer surfaces it; Satori falls back to its default sans
 * otherwise. Visual concession: the rendered glyphs will be Satori's
 * default rather than true Geist.
 */
const PHRASES = [
  "sprint planning",
  "epic refinement",
  "ticket triage",
  "issue grooming",
  "story points",
  "burndown reviews",
  "stand-up rituals",
  "backlog dependencies",
  "gantt cascades",
  "OKR alignment",
];

const FONT_STACK =
  '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

export default async function XBannerOG() {
  // Two rows of five phrases, evenly distributed. Each phrase sits
  // inside its own flex cell so the rose strikethrough line can be
  // sized to the cell width without measuring text.
  const rows = [PHRASES.slice(0, 5), PHRASES.slice(5, 10)];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f7f6f1",
          padding: "70px 80px 60px 80px",
          fontFamily: FONT_STACK,
          position: "relative",
        }}
      >
        {/* Wallpaper grid: two rows × five phrases */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
          }}
        >
          {rows.map((row, rIdx) => (
            <div
              key={rIdx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              {row.map((phrase) => (
                <div
                  key={phrase}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingLeft: 14,
                    paddingRight: 14,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      fontSize: 32,
                      fontWeight: 500,
                      letterSpacing: "-0.015em",
                      color: "#2b2a26",
                    }}
                  >
                    {phrase}
                  </span>
                  {/* Rose-300 strikethrough — absolute, centered */}
                  <span
                    style={{
                      position: "absolute",
                      left: 6,
                      right: 6,
                      top: "50%",
                      height: 2,
                      background: "#fda4af",
                      transform: "translateY(-1px) rotate(-1.2deg)",
                      display: "flex",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Tagline, bottom-right */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            marginTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#14151a",
              textAlign: "right",
              lineHeight: 1.3,
              fontFamily: FONT_STACK,
            }}
          >
            You don&rsquo;t need a vocabulary. You need a list.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
