import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Student theme, marker-on-corkboard, paper-and-tape.
 *
 * The whole page reads like a study group's shared bulletin board
 * photographed on a phone: legal-pad cream paper, faint blue rules,
 * highlighter underlines on the lane labels, sticky-note cards
 * rotated a hair off-square. Server component, no interactivity,
 * just the document.
 */

const NOTE_PALETTE: Record<
  LaneId,
  { bg: string; ink: string; tape: string; tilt: number; accent: string }
> = {
  todo: {
    bg: "#fff6b8",
    ink: "#3d2f00",
    tape: "rgba(207,164,84,0.55)",
    tilt: -0.6,
    accent: "#f4d35e",
  },
  doing: {
    bg: "#cfe7ff",
    ink: "#0f2c4a",
    tape: "rgba(86,128,179,0.5)",
    tilt: 0.8,
    accent: "#7eb6ff",
  },
  review: {
    bg: "#ffd6e0",
    ink: "#4a1024",
    tape: "rgba(187,107,131,0.5)",
    tilt: -0.4,
    accent: "#f29bb1",
  },
  done: {
    bg: "#d6f0c8",
    ink: "#1d3a14",
    tape: "rgba(102,150,76,0.45)",
    tilt: 0.5,
    accent: "#a4d68a",
  },
};

const LANE_HEADING: Record<LaneId, string> = {
  todo: "still ahead",
  doing: "this week",
  review: "looking over",
  done: "wrapped",
};

const HIGHLIGHTER: Record<LaneId, string> = {
  todo: "rgba(252,211,77,0.55)",
  doing: "rgba(147,197,253,0.6)",
  review: "rgba(249,168,212,0.55)",
  done: "rgba(167,224,142,0.55)",
};

export function StudentTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  return (
    <main
      className="relative mx-auto w-full max-w-[860px] px-6 pb-24 pt-14 md:pt-20"
      style={{
        // Warm legal-pad cream + a faint pale-blue rule every 28px.
        backgroundColor: "#fdf9eb",
        backgroundImage: [
          "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(120,170,210,0.18) 27px, rgba(120,170,210,0.18) 28px)",
          // A single pink margin rule down the left.
          "linear-gradient(to right, transparent 0, transparent 56px, rgba(220,90,110,0.28) 56px, rgba(220,90,110,0.28) 57px, transparent 57px)",
        ].join(", "),
      }}
    >
      <header className="relative">
        <div
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            color: "#7a5a1f",
            background: "rgba(252,211,77,0.55)",
            padding: "2px 8px",
            transform: "rotate(-1.2deg)",
          }}
        >
          study group
        </div>
        <h1
          className="mt-4 text-balance font-serif text-[clamp(2.8rem,1.8rem+4vw,4.6rem)] font-semibold leading-[1.0] tracking-[-0.02em]"
          style={{
            color: "#1f1810",
            transform: "rotate(-0.4deg)",
          }}
        >
          {workspace.name}
        </h1>
        <p
          className="mt-5 max-w-[520px] font-serif text-[14px] italic leading-[1.55]"
          style={{ color: "#5a4a2a" }}
        >
          shared notes, kept honest. {tasks.length} thing
          {tasks.length === 1 ? "" : "s"} on the board · last pinned{" "}
          {fmtLong(workspace.publishedAt)}.
        </p>
      </header>

      <div className="mt-14 space-y-14">
        {LANE_ORDER.map((laneId) => {
          const list = byLane.get(laneId) ?? [];
          if (list.length === 0) return null;
          const lane = LANES[laneId];
          const palette = NOTE_PALETTE[laneId];

          return (
            <section key={laneId}>
              <div className="flex items-baseline gap-3">
                <h2
                  className="font-serif text-[24px] font-bold leading-none"
                  style={{
                    color: "#1f1810",
                    transform: "rotate(-1deg)",
                    display: "inline-block",
                    backgroundImage: `linear-gradient(transparent 62%, ${HIGHLIGHTER[laneId]} 62%, ${HIGHLIGHTER[laneId]} 92%, transparent 92%)`,
                    backgroundRepeat: "no-repeat",
                    padding: "0 4px",
                  }}
                >
                  {LANE_HEADING[laneId]}
                </h2>
                <span
                  className="font-serif text-[13px] italic tabular-nums"
                  style={{ color: "#7a5a1f" }}
                >
                  ({list.length}), “{lane.name.toLowerCase()}”
                </span>
              </div>

              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {list.map((t, i) => {
                  const isDone = laneId === "done";
                  // Alternate the per-card tilt so the wall feels
                  // pinned-by-hand rather than CSS-grid-perfect.
                  const cardTilt =
                    palette.tilt + (i % 2 === 0 ? -0.4 : 0.6);
                  return (
                    <li
                      key={t.id}
                      className="relative"
                      style={{
                        transform: `rotate(${cardTilt}deg)`,
                      }}
                    >
                      {/* The piece of tape across the top */}
                      <span
                        aria-hidden
                        className="absolute left-1/2 top-[-10px] block h-[18px] w-[64px]"
                        style={{
                          transform: "translateX(-50%) rotate(-2deg)",
                          background: palette.tape,
                          boxShadow:
                            "0 1px 2px rgba(60,40,10,0.12), inset 0 0 6px rgba(255,255,255,0.4)",
                        }}
                      />
                      <article
                        className="relative px-5 pb-5 pt-6"
                        style={{
                          background: palette.bg,
                          color: palette.ink,
                          boxShadow:
                            "0 1px 0 rgba(60,40,10,0.06), 0 8px 18px -10px rgba(60,40,10,0.35), 0 22px 30px -22px rgba(60,40,10,0.25)",
                          borderRadius: "2px",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className="mt-[2px] inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center"
                            style={{
                              border: `1.5px solid ${palette.ink}`,
                              borderRadius: "3px",
                              transform: "rotate(-3deg)",
                              opacity: 0.85,
                            }}
                          >
                            {isDone ? (
                              <svg
                                viewBox="0 0 18 18"
                                className="h-[14px] w-[14px]"
                                aria-hidden
                              >
                                <path
                                  d="M3 9.5 L7.5 13.5 L15.5 4"
                                  fill="none"
                                  stroke={palette.ink}
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : null}
                          </span>
                          <h3
                            className="font-serif text-[16.5px] font-semibold leading-[1.32]"
                            style={{
                              color: palette.ink,
                              textDecoration: isDone ? "line-through" : "none",
                              textDecorationThickness: isDone ? "1.5px" : undefined,
                              textDecorationColor: isDone
                                ? "rgba(29,58,20,0.55)"
                                : undefined,
                              opacity: isDone ? 0.72 : 1,
                            }}
                          >
                            {t.title}
                          </h3>
                        </div>

                        <div
                          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-serif text-[12.5px]"
                          style={{
                            color: palette.ink,
                            opacity: isDone ? 0.65 : 0.85,
                          }}
                        >
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ fontWeight: 600 }}
                          >
                            <span
                              aria-hidden
                              className="inline-block h-[8px] w-[8px] rounded-full"
                              style={{
                                background: PRIORITY_LABEL[t.priority].color,
                                boxShadow:
                                  "inset 0 0 0 1px rgba(0,0,0,0.08)",
                              }}
                            />
                            {PRIORITY_LABEL[t.priority].label.toLowerCase()}
                          </span>
                          {t.due ? (
                            <span className="italic">due {t.due}</span>
                          ) : null}
                        </div>

                        {t.tags && t.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {t.tags.map((tag, ti) => (
                              <span
                                key={tag}
                                className="inline-block font-serif text-[11px] font-medium"
                                style={{
                                  background: tabColor(laneId, ti),
                                  color: palette.ink,
                                  padding: "2px 9px",
                                  borderRadius: "999px",
                                  border: `1px solid ${palette.ink}22`,
                                  transform: `rotate(${
                                    ti % 2 === 0 ? -1 : 1.2
                                  }deg)`,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p
        className="mt-20 font-serif text-[13px] italic"
        style={{
          color: "#7a5a1f",
          transform: "rotate(-0.5deg)",
          textAlign: "center",
        }}
      >
       , kept up by whoever opens it last
      </p>
    </main>
  );
}

/** Rotate through a few sticky-tab colors for tags so a row of three
 *  doesn't look identical. Stays inside each lane's mood. */
function tabColor(lane: LaneId, i: number): string {
  const palettes: Record<LaneId, string[]> = {
    todo: ["#fde68a", "#fcd34d", "#fef3c7"],
    doing: ["#bfdbfe", "#a5c8f0", "#dbeafe"],
    review: ["#fbcfe8", "#f9a8d4", "#fde2ec"],
    done: ["#bbf7d0", "#a7f3d0", "#d9f5cd"],
  };
  const arr = palettes[lane];
  return arr[i % arr.length];
}

function fmtLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
