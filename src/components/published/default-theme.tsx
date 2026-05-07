import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Default published-workspace theme. Used when the workspace has no
 * activeDomain set, or as the structural reference for the four
 * domain-specific themes (wedding, freelance, student, marketing).
 *
 * Clean editorial layout: the workspace name as a hero, lane-grouped
 * task list as the body, no chrome beyond what's necessary for
 * readability. Server-rendered.
 */
export function DefaultTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 pb-20 pt-16 md:pt-24">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
        Published workspace
      </div>
      <h1 className="mt-3 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
        {workspace.name}
      </h1>
      <p className="mt-4 text-[13px] text-ink-quiet">
        {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
        {fmtShort(workspace.publishedAt)}
      </p>

      <div className="mt-12 space-y-10">
        {LANE_ORDER.map((laneId) => {
          const list = byLane.get(laneId) ?? [];
          if (list.length === 0) return null;
          const lane = LANES[laneId];
          return (
            <section key={laneId}>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: `var(--lane-${laneId}-dot)` }}
                  aria-hidden
                />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
                  {lane.name}
                </h2>
                <span className="text-[11px] tabular-nums text-ink-faint">
                  · {list.length}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-md border border-line-soft/60 bg-white px-4 py-3"
                  >
                    <span
                      className="mt-1 inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-line bg-bg-sunken/40"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] leading-[1.4] text-ink">
                        {t.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-quiet">
                        <span className="font-medium tabular-nums">
                          {PRIORITY_LABEL[t.priority].label}
                        </span>
                        {t.due ? <span>· due {t.due}</span> : null}
                        {t.tags && t.tags.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-bg-sunken/60 px-1.5 py-px text-[10.5px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
