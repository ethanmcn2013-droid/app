import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Freelance domain theme. Code-on-paper, mono-typographic, spec-doc
 * aesthetic, what a thoughtful developer would hand a client as the
 * artifact of an engagement, not a productivity-app screenshot.
 *
 * Off-white paper background, hairline rules between sections, ASCII-
 * style "[ ]" / "[x]" task prefixes, square-bracketed tags, version-
 * stamp meta line. Server-rendered. No "use client".
 */
export function FreelanceTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  const visibleLanes = LANE_ORDER.filter(
    (id) => (byLane.get(id) ?? []).length > 0,
  );

  // Pick the first non-empty in-flight lane to mark "active", the
  // single concession to color in this otherwise greyscale doc.
  const activeLaneId: LaneId | null =
    visibleLanes.find((id) => id === "doing") ??
    visibleLanes.find((id) => id === "review") ??
    visibleLanes.find((id) => id === "todo") ??
    null;

  const headerName = workspace.name.toLowerCase();
  const versionLabel = `v0.${tasks.length} · published ${fmtSpec(workspace.publishedAt)}`;
  const counter = `${tasks.length} item${tasks.length === 1 ? "" : "s"}`;

  return (
    <main
      className="relative w-full"
      style={{ background: "#f8f7f4", color: "#1f2024" }}
    >
      {/* Full-bleed paper backdrop, extends behind the footer too,
          via a sentinel pseudo-band; the wrapper itself is the page
          background since <main> spans the viewport width. */}
      <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-16 md:pt-24">
      {/* ─── Hero / spec header ──────────────────────────────────── */}
      <header className="border-b border-dashed border-[#1f2024]/15 pb-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#1f2024]/55">
          // project · spec
        </div>
        <h1 className="mt-5 font-mono text-[clamp(1.6rem,1.05rem+2.4vw,2.55rem)] font-medium leading-[1.15] tracking-[-0.01em] text-[#1f2024]">
          <span className="text-[#1f2024]/40">{"// "}</span>
          {headerName}
        </h1>
        <p className="mt-5 font-mono text-[12px] tracking-[0.02em] text-[#1f2024]/60">
          {versionLabel}
        </p>
        <p className="mt-2 max-w-[58ch] font-sans text-[14.5px] leading-[1.6] text-[#1f2024]/75">
          A read-only snapshot of the working scope. Lanes group items by
          state; checked rows are complete. Updated as the engagement
          progresses.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-[11.5px] leading-[1.7] text-[#1f2024]/65 sm:grid-cols-4">
          <SpecField label="slug" value={workspace.slug} />
          <SpecField label="scope" value={counter} />
          <SpecField label="lanes" value={String(visibleLanes.length)} />
          <SpecField
            label="status"
            value={
              activeLaneId
                ? LANES[activeLaneId].name.toLowerCase()
                : "archived"
            }
          />
        </div>
      </header>

      {/* ─── Lanes ───────────────────────────────────────────────── */}
      <div className="mt-12 space-y-14">
        {visibleLanes.map((laneId, idx) => {
          const list = byLane.get(laneId) ?? [];
          const lane = LANES[laneId];
          const isActive = laneId === activeLaneId;
          const sectionNumber = String(idx + 1).padStart(2, "0");
          const isDone = laneId === "done";

          return (
            <section key={laneId}>
              {idx > 0 ? (
                <div
                  className="mb-14 h-px w-full"
                  style={{ background: "#1f2024", opacity: 0.08 }}
                  aria-hidden
                />
              ) : null}

              <div className="flex items-baseline gap-3">
                <h2 className="font-mono text-[12px] font-medium uppercase tracking-[0.2em] text-[#1f2024]">
                  ## {sectionNumber} · {lane.name.toLowerCase()}
                </h2>
                <span
                  className="font-mono text-[11px] tabular-nums text-[#1f2024]/45"
                  aria-hidden
                >
                  ({list.length})
                </span>
                {isActive ? (
                  <span
                    className="ml-auto inline-block h-px w-10"
                    style={{ background: "#7c3aed" }}
                    aria-hidden
                  />
                ) : null}
              </div>

              <ul className="mt-6">
                {list.map((t, i) => {
                  const priority = PRIORITY_LABEL[t.priority];
                  return (
                    <li
                      key={t.id}
                      className="py-4"
                      style={
                        i === 0
                          ? undefined
                          : { borderTop: "1px solid rgba(31,32,36,0.08)" }
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-[2px] flex-shrink-0 select-none font-mono text-[13px] leading-[1.5] text-[#1f2024]/55"
                          aria-hidden
                        >
                          {isDone ? "[x]" : "[ ]"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={
                              "font-mono text-[14px] leading-[1.55] text-[#1f2024]" +
                              (isDone ? " line-through opacity-55" : "")
                            }
                          >
                            {t.title}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-[0.02em] text-[#1f2024]/55">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-block h-[6px] w-[6px] rounded-full"
                                style={{ background: priority.color }}
                                aria-hidden
                              />
                              <span className="uppercase tracking-[0.14em]">
                                {priority.label}
                              </span>
                            </span>
                            {t.due ? (
                              <span>
                                due{" "}
                                <span className="text-[#1f2024]/75">
                                  {t.due}
                                </span>
                              </span>
                            ) : null}
                            {t.tags && t.tags.length > 0 ? (
                              <span className="flex flex-wrap gap-1.5">
                                {t.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[#1f2024]/65"
                                  >
                                    [{tag}]
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </div>
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

      {/* ─── EOF marker ──────────────────────────────────────────── */}
      <div className="mt-20 border-t border-dashed border-[#1f2024]/15 pt-6 font-mono text-[11px] tracking-[0.18em] text-[#1f2024]/40">
       , end of document —
      </div>
      </div>
    </main>
  );
}

function SpecField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[#1f2024]/40">{label}</span>
      <span className="text-[#1f2024]/85">{value}</span>
    </div>
  );
}

/** Spec-doc dateline, e.g. "2026-06-14". ISO-ish, terse. */
function fmtSpec(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
