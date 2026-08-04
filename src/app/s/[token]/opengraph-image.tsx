import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * The social card for every bearer-link timeline (`/s/[token]`).
 *
 * Deliberately data-free: a bearer link's unfurl may not leak names, dates,
 * or milestones — but "nothing" was the wrong answer too. A pasted link is
 * the artifact's first impression in the group chat, so the card carries the
 * product's own typography and the rail motif instead of a grey text stub.
 * Values are the design-system tokens flattened to literals; satori cannot
 * read CSS custom properties.
 *
 * The miniature rail is drawn with the artifact's real grammar: ink fill to
 * the completed frontier (never past it), solid beads for what is settled, a
 * hairline future, one indigo target for the next milestone, and a Today
 * dash riding the same line.
 */

export const runtime = "nodejs";
export const alt =
  "A shared timeline — milestones on a single line, from Signal Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111111"; // ds-allow: satori renders outside the CSS var scope — SDS --ink flattened.
const INK_SOFT = "#3f3f46"; // ds-allow: SDS --ink-soft flattened for satori.
const INK_FAINT = "#71717a"; // ds-allow: SDS --ink-faint flattened for satori.
const INK_GHOST = "#d4d4d8"; // ds-allow: SDS --ink-ghost flattened for satori.
const ACCENT = "#4f46e5"; // ds-allow: SDS --accent flattened for satori.
const PAPER = "#ffffff"; // ds-allow: SDS --paper flattened for satori.

function geistFont(file: string): Promise<Buffer> {
  // process.cwd(), not import.meta.url: the bundler relocates compiled route
  // files, so a source-relative URL misses node_modules at runtime.
  return readFile(
    path.join(process.cwd(), "node_modules", "geist", "dist", "fonts", file),
  );
}

export default async function SharedTimelineOpenGraphImage() {
  const [sans, sansSemi, mono] = await Promise.all([
    geistFont("geist-sans/Geist-Medium.ttf"),
    geistFont("geist-sans/Geist-SemiBold.ttf"),
    geistFont("geist-mono/GeistMono-Medium.ttf"),
  ]);

  const railY = 430;
  const dot = (
    left: number,
    kind: "complete" | "upcoming" | "target",
  ) => {
    if (kind === "target") {
      // The next milestone at full strength: a solid indigo mark, no hollow.
      return (
        <div
          style={{
            position: "absolute",
            top: railY - 13,
            left: left - 13,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: ACCENT,
            display: "flex",
          }}
        />
      );
    }
    const complete = kind === "complete";
    return (
      <div
        style={{
          position: "absolute",
          top: complete ? railY - 9 : railY - 8,
          left: left - (complete ? 9 : 8),
          width: complete ? 18 : 16,
          height: complete ? 18 : 16,
          borderRadius: 999,
          border: `2px solid ${complete ? INK : INK_FAINT}`,
          background: complete ? INK : PAPER,
        }}
      />
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          fontFamily: "GeistSans",
          padding: "64px 80px",
        }}
      >
        {/* Wordmark: lowercase, tight, one indigo dot. */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            timeline
          </div>
          <div
            style={{
              width: 12,
              height: 12,
              marginLeft: 5,
              borderRadius: 999,
              background: ACCENT,
            }}
          />
        </div>

        {/* Headline in the artifact display register. */}
        <div
          style={{
            marginTop: 48,
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: "-0.055em",
            lineHeight: 0.95,
            maxWidth: 1020,
            color: INK,
          }}
        >
          A shared timeline.
        </div>

        {/* The rail motif — the artifact's own grammar in miniature. */}
        <div
          style={{
            position: "absolute",
            top: railY,
            left: 80,
            width: 1040,
            height: 1,
            background: INK_GHOST,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: railY - 1,
            left: 80,
            width: 330,
            height: 3,
            background: INK,
            display: "flex",
          }}
        />
        {dot(120, "complete")}
        {dot(410, "complete")}
        {dot(620, "target")}
        {dot(846, "upcoming")}
        {dot(1056, "upcoming")}
        {/* Today rides the same line, between the frontier and the target. */}
        <div
          style={{
            position: "absolute",
            top: railY - 16,
            left: 508,
            width: 2,
            height: 32,
            background: INK_SOFT,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: railY - 52,
            left: 470,
            fontFamily: "GeistMono",
            fontSize: 22,
            color: INK_FAINT,
            display: "flex",
          }}
        >
          Today
        </div>

        {/* Footer register: what this is, and where it came from. */}
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            bottom: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid rgba(17, 17, 17, 0.1)`,
            paddingTop: 28,
            fontFamily: "GeistMono",
            fontSize: 22,
            color: INK_FAINT,
          }}
        >
          <div style={{ display: "flex" }}>
            Every decision on the way to the day
          </div>
          <div style={{ display: "flex", color: INK_SOFT }}>
            Made with Signal Timeline
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "GeistSans", data: sans, weight: 500, style: "normal" },
        { name: "GeistSans", data: sansSemi, weight: 600, style: "normal" },
        { name: "GeistMono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
