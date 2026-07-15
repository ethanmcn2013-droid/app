import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Wedding theme. Ivory page, blush accents, serif display heading,
 * generous whitespace. Reskins the published workspace as a save-the-
 * date / planning page rather than a productivity board.
 *
 * Server component, no client hooks.
 */
export function WeddingTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  return (
    <main
      className="min-h-screen w-full"
      style={{ background: "#fbf8f3", color: "#3a2f2a" }}
    >
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-[1080px] px-6 pt-20 md:pt-32">
        <div className="flex flex-col items-center text-center">
          <FloralRule />

          <p
            className="mt-8 font-serif text-[12.5px] italic tracking-[0.32em]"
            style={{ color: "#75504f" }}
          >
            {laneLabel(workspace.publishedAt)}
          </p>

          <h1
            className="mt-6 text-balance font-serif font-normal leading-[1.02] tracking-[-0.01em]"
            style={{
              color: "#3a2f2a",
              fontSize: "clamp(3rem, 1.6rem + 6vw, 6.25rem)",
            }}
          >
            {workspace.name}
          </h1>

          <p
            className="mt-8 font-serif text-[14px] italic"
            style={{ color: "#7a615e" }}
          >
            {tasks.length === 0
              ? "A quiet beginning"
              : tasks.length === 1
                ? "One small thing in motion"
                : `${tasks.length} things in motion, gathered with care`}
          </p>

          <FloralRule mirrored />
        </div>
      </section>

      {/* ── Task body ──────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[820px] px-6 pb-32 pt-16 md:pt-24">
        <div className="space-y-16">
          {LANE_ORDER.map((laneId) => {
            const list = byLane.get(laneId) ?? [];
            if (list.length === 0) return null;
            const lane = LANES[laneId];
            return (
              <section key={laneId}>
                <header className="flex items-baseline gap-4">
                  <h2
                    className="font-serif text-[22px] font-normal italic leading-none tracking-[0.005em]"
                    style={{ color: "#3a2f2a" }}
                  >
                    {laneHeading(laneId, lane.name)}
                  </h2>
                  <span
                    className="h-px flex-1"
                    style={{ background: "#e7c4c2" }}
                    aria-hidden
                  />
                  <span
                    className="font-serif text-[12px] italic tabular-nums"
                    style={{ color: "#75504f" }}
                  >
                    {list.length}
                  </span>
                </header>

                <ul className="mt-6 space-y-3">
                  {list.map((t) => {
                    const priority = PRIORITY_LABEL[t.priority];
                    return (
                      <li
                        key={t.id}
                        className="relative overflow-hidden rounded-[2px] bg-white"
                        style={{
                          borderLeft: "2px solid #e7c4c2",
                          boxShadow:
                            "0 1px 0 rgba(58, 47, 42, 0.04), 0 8px 24px -16px rgba(168, 127, 125, 0.18)",
                        }}
                      >
                        <div className="px-6 py-5 md:px-7 md:py-6">
                          <div
                            className="font-serif text-[18px] font-normal leading-[1.35]"
                            style={{ color: "#2a2320" }}
                          >
                            {t.title}
                          </div>

                          <div
                            className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]"
                            style={{ color: "#7a615e" }}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-block h-1 w-1 rounded-full"
                                style={{ background: "#d4a5a5" }}
                                aria-hidden
                              />
                              <span className="italic">{priority.label}</span>
                            </span>

                            {t.due ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="inline-block h-px w-3"
                                  style={{ background: "#d4a5a5" }}
                                  aria-hidden
                                />
                                <span className="italic">
                                  {formatDue(t.due)}
                                </span>
                              </span>
                            ) : null}

                            {t.tags && t.tags.length > 0 ? (
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                {t.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full px-2.5 py-0.5 font-serif text-[11px] italic"
                                    style={{
                                      background: "#f5e8e6",
                                      color: "#754b49",
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-24 flex justify-center">
          <FloralMark />
        </div>
      </section>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */

function laneLabel(d: Date): string {
  // "Published Saturday, May 6, 2026", but lower-case, sparse, like
  // a save-the-date corner mark rather than a banner.
  return `Published ${d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
}

function laneHeading(laneId: LaneId, fallback: string): string {
  // Re-voice the lanes for a wedding context. Calm, manifesto English.
  switch (laneId) {
    case "todo":
      return "Still to plan";
    case "doing":
      return "Underway";
    case "review":
      return "Awaiting blessing";
    case "done":
      return "Settled";
    default:
      return fallback;
  }
}

function formatDue(due: string): string {
  // `due` arrives as a free-form string ("Jun 14", "next Friday",
  // "2026-06-14"). Try to coerce ISO-ish into a long-form date; fall
  // back to the raw string otherwise.
  const iso = /^\d{4}-\d{2}-\d{2}/.test(due) ? due : null;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  }
  return due;
}

/* ────────────────────────────────────────────────────────────────────
 * Floral motifs, tasteful inline SVG, no external assets, no bright
 * colours. A small leafed sprig used as a horizontal rule and as a
 * footer mark. Stroke colour stays in the blush family.
 * ──────────────────────────────────────────────────────────────────── */

function FloralRule({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <div
      className="flex items-center justify-center gap-4"
      style={{ transform: mirrored ? "scaleY(-1)" : undefined }}
      aria-hidden
    >
      <span
        className="h-px w-16 md:w-24"
        style={{ background: "#e7c4c2" }}
      />
      <Sprig />
      <span
        className="h-px w-16 md:w-24"
        style={{ background: "#e7c4c2" }}
      />
    </div>
  );
}

function Sprig() {
  // A small, hand-drawn-feeling sprig: a curved stem with a few
  // teardrop leaves. Single colour, thin stroke.
  return (
    <svg
      width="44"
      height="14"
      viewBox="0 0 44 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 7 C 10 3, 18 3, 22 7 C 26 11, 34 11, 42 7"
        stroke="#c79b99"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M10 5.6 C 11.6 3.6, 13.4 3.4, 14.4 4.4 C 13.6 5.6, 12 6.2, 10 5.6 Z"
        fill="#d4a5a5"
        opacity="0.85"
      />
      <path
        d="M30 8.4 C 31.6 10.4, 33.4 10.6, 34.4 9.6 C 33.6 8.4, 32 7.8, 30 8.4 Z"
        fill="#d4a5a5"
        opacity="0.85"
      />
      <circle cx="22" cy="7" r="1.1" fill="#a06664" />
    </svg>
  );
}

function FloralMark() {
  // Footer-area accent, just the sprig, slightly larger, as a
  // closing flourish above the shared <PublishedFooter>.
  return (
    <svg
      width="64"
      height="20"
      viewBox="0 0 44 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 7 C 10 3, 18 3, 22 7 C 26 11, 34 11, 42 7"
        stroke="#c79b99"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M10 5.6 C 11.6 3.6, 13.4 3.4, 14.4 4.4 C 13.6 5.6, 12 6.2, 10 5.6 Z"
        fill="#d4a5a5"
        opacity="0.85"
      />
      <path
        d="M30 8.4 C 31.6 10.4, 33.4 10.6, 34.4 9.6 C 33.6 8.4, 32 7.8, 30 8.4 Z"
        fill="#d4a5a5"
        opacity="0.85"
      />
      <circle cx="22" cy="7" r="1.1" fill="#a06664" />
    </svg>
  );
}
