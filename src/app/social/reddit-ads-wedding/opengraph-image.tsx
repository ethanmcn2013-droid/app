import { ImageResponse } from "next/og";

// nodejs runtime — see cycle-26 review note in
// `/templates/[slug]/opengraph-image.tsx`. Edge runtime + Turbopack
// dev mode + ImageResponse intermittently breaks with "failed to
// pipe response"; nodejs is reliable.
export const runtime = "nodejs";
export const alt =
  "Tasks — wedding workspace creative for Reddit Ads, $79 once";
export const size = { width: 1200, height: 628 };
export const contentType = "image/png";

/**
 * Reddit Ads creative — 1200×628.
 *
 * The W4 paid wedding-vertical experiment per `docs/gtm-plan.md` §8.
 * A stylized rendering of a `/p/` published wedding workspace in the
 * wedding domain pack — ivory background (#faf7f2), blush card
 * borders (#f5d4dd), italic serif lane labels, four lanes with
 * realistic 3-month-out tasks. The headline "$79 once. Fits the
 * bride, groom, both moms, and the DJ." anchors the lower-right.
 *
 * No emojis, no real photographs — pure typographic + geometric. The
 * card aspect (1200×628) also flatters Instagram feed when reused.
 *
 * Wedding token: --aud-wedding #be185d (used sparingly for the
 * wordmark dot only — the lanes stay desaturated so cards read).
 */

const FONT_STACK =
  '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Iowan Old Style", "Palatino Linotype", Georgia, serif';

const IVORY = "#faf7f2";
const BLUSH = "#f5d4dd";
const BLUSH_SOFT = "#fbe9ef";
const INK = "#2b2a26";
const INK_SOFT = "#6b6960";
const INK_QUIET = "#9a9789";
const WEDDING = "#be185d";

type Lane = {
  label: string;
  tint: string;
  border: string;
  cards: string[];
};

// Lanes use progressively warmer blush tints. "Done" reads slightly
// muted so the eye lands on "In progress" first — that's the lane
// most weddings actually live in three months out.
const LANES: Lane[] = [
  {
    label: "To plan",
    tint: "#ffffff",
    border: BLUSH,
    cards: [
      "Send save-the-dates",
      "Book hair + makeup trial",
      "Finalize officiant",
    ],
  },
  {
    label: "In progress",
    tint: BLUSH_SOFT,
    border: BLUSH,
    cards: [
      "Confirm florist — peony swap",
      "Day-of run-of-show v2",
      "Seating chart — both moms",
    ],
  },
  {
    label: "Reviewed",
    tint: "#ffffff",
    border: BLUSH,
    cards: ["Tasting menu signed off", "DJ playlist — do-not-play"],
  },
  {
    label: "Done",
    tint: "#fafaf7",
    border: "#e8e4d8",
    cards: ["Venue deposit cleared", "Dress alterations 1 of 3"],
  },
];

export default async function RedditAdsWeddingOG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: IVORY,
          padding: "44px 56px 48px 56px",
          fontFamily: FONT_STACK,
          color: INK,
          position: "relative",
        }}
      >
        {/* Wordmark — top-left */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: INK,
          }}
        >
          tasks
          <span
            style={{
              display: "flex",
              marginLeft: 6,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: WEDDING,
              boxShadow: "0 0 16px rgba(190,24,93,0.45)",
            }}
          />
          <span
            style={{
              display: "flex",
              marginLeft: 14,
              fontSize: 14,
              fontWeight: 500,
              color: INK_QUIET,
              letterSpacing: "0.04em",
            }}
          >
            /p/avery-and-jordan
          </span>
        </div>

        {/* Board — four lanes */}
        <div
          style={{
            display: "flex",
            marginTop: 24,
            gap: 14,
            flex: 1,
          }}
        >
          {LANES.map((lane) => (
            <div
              key={lane.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Italic serif lane label */}
              <div
                style={{
                  display: "flex",
                  fontFamily: SERIF_STACK,
                  fontStyle: "italic",
                  fontSize: 22,
                  fontWeight: 500,
                  color: INK_SOFT,
                  letterSpacing: "-0.005em",
                  paddingLeft: 4,
                  paddingBottom: 10,
                  borderBottom: `1px solid ${BLUSH}`,
                }}
              >
                {lane.label}
              </div>

              {/* Cards */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {lane.cards.map((card) => (
                  <div
                    key={card}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: lane.tint,
                      border: `1px solid ${lane.border}`,
                      borderRadius: 10,
                      padding: "11px 12px 12px 12px",
                      boxShadow: "0 1px 0 rgba(43,42,38,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: INK,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.3,
                      }}
                    >
                      {card}
                    </div>
                    {/* meta row — tiny dot + faux date */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginTop: 8,
                        fontSize: 10.5,
                        color: INK_QUIET,
                        letterSpacing: "0.02em",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: WEDDING,
                          marginRight: 6,
                          opacity: 0.55,
                        }}
                      />
                      {lane.label === "Done" ? "cleared" : "due Jul 18"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Headline block — anchored bottom-right */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 24,
            alignItems: "flex-end",
            textAlign: "right",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.04,
              color: INK,
              maxWidth: 940,
            }}
          >
            $79 once. Fits the bride, groom, both moms, and the DJ.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 16,
              fontWeight: 500,
              color: INK_SOFT,
              letterSpacing: "-0.005em",
            }}
          >
            Per-workspace pricing. tasks-nu-hazel.vercel.app/for/weddings
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
