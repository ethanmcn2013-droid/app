import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Marketing theme. Editorial, magazine-grade, closer to Stripe Press
 * or the Linear changelog than to a kanban board. A reader should feel
 * like they’re reading a published brief, not navigating an app.
 *
 * Pure white page, generous typography, brand-purple used sparingly
 * (eyebrow, lane dots, the active-lane heading). Narrow editorial
 * column at 760px. Server component, no client hooks.
 */
export function MarketingTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  // The "active lane" is the first non-empty lane in canonical order.
  // It gets the brand-purple heading; the rest stay in inks. This
  // mirrors how a launch brief calls out the current chapter without
  // shouting about the others.
  const activeLane: LaneId | null =
    LANE_ORDER.find((id) => (byLane.get(id) ?? []).length > 0) ?? null;

  const eyebrow = pickEyebrow(workspace.name);

  return (
    <main
      className="mx-auto w-full max-w-[760px] px-6 pb-24 pt-20 md:pt-28"
      style={{ background: "#ffffff" }}
    >
      {/* ── Hero ────────────────────────────────────────────────── */}
      <header>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.22em]"
          style={{
            color: "var(--brand)",
            background: "var(--brand-soft)",
          }}
        >
          {eyebrow}
        </span>

        <h1
          className="mt-10 text-balance font-semibold text-ink"
          style={{
            fontSize: "clamp(2.6rem, 1.4rem + 4.2vw, 4.6rem)",
            letterSpacing: "-0.035em",
            lineHeight: "1.04",
          }}
        >
          {workspace.name}
        </h1>

        <p
          className="mt-8 text-[13px] tabular-nums text-ink-quiet"
          style={{ letterSpacing: "0.005em" }}
        >
          Published {fmtLong(workspace.publishedAt)}
          <span aria-hidden> · </span>
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </p>
      </header>

      {/* ── Editorial rule ───────────────────────────────────────── */}
      <hr
        className="mt-14 border-0"
        style={{ height: "1px", background: "var(--line-soft)" }}
        aria-hidden
      />

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="mt-14 space-y-16">
        {LANE_ORDER.map((laneId) => {
          const list = byLane.get(laneId) ?? [];
          if (list.length === 0) return null;
          const lane = LANES[laneId];
          const isActive = laneId === activeLane;

          return (
            <section key={laneId}>
              <header className="flex items-center gap-3">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: isActive
                      ? "var(--brand)"
                      : `var(--lane-${laneId}-dot)`,
                  }}
                  aria-hidden
                />
                <h2
                  className="text-[11px] font-semibold uppercase"
                  style={{
                    letterSpacing: "0.2em",
                    color: isActive ? "var(--brand)" : "var(--ink-quiet)",
                  }}
                >
                  {lane.name}
                </h2>
                <span
                  className="text-[11px] tabular-nums text-ink-faint"
                  aria-hidden
                >
                  {String(list.length).padStart(2, "0")}
                </span>
              </header>

              <ul className="mt-5">
                {list.map((t, i) => {
                  const priority = PRIORITY_LABEL[t.priority];
                  const showPriority = t.priority !== "p3";
                  return (
                    <li
                      key={t.id}
                      className="py-5"
                      style={{
                        borderTop:
                          i === 0 ? "1px solid var(--line-soft)" : undefined,
                        borderBottom: "1px solid var(--line-soft)",
                      }}
                    >
                      <div
                        className="text-[16.5px] leading-[1.45] text-ink"
                        style={{ letterSpacing: "-0.005em" }}
                      >
                        {t.title}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-quiet">
                        {showPriority ? (
                          <span
                            className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase"
                            style={{
                              letterSpacing: "0.1em",
                              color: priority.color,
                              background: tintFor(t.priority),
                            }}
                          >
                            {priority.label}
                          </span>
                        ) : null}

                        {t.due ? (
                          <span className="tabular-nums">
                            Due {formatDue(t.due)}
                          </span>
                        ) : null}

                        {t.tags && t.tags.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-x-2">
                            {t.tags.map((tag, j) => (
                              <span
                                key={tag}
                                className="text-ink-quiet"
                                style={{ letterSpacing: "0.005em" }}
                              >
                                {j > 0 ? (
                                  <span
                                    className="mr-2 text-ink-faint"
                                    aria-hidden
                                  >
                                    ·
                                  </span>
                                ) : null}
                                {tag}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ── Closing mark ─────────────────────────────────────────── */}
      <div
        className="mt-20 flex items-center gap-3 text-[10.5px] font-semibold uppercase"
        style={{ letterSpacing: "0.22em", color: "var(--ink-faint)" }}
      >
        <span
          className="inline-block h-px flex-1"
          style={{ background: "var(--line-soft)" }}
          aria-hidden
        />
        <span>End of brief</span>
        <span
          className="inline-block h-px flex-1"
          style={{ background: "var(--line-soft)" }}
          aria-hidden
        />
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */

/** Eyebrow chip copy, "Brief", "Plan", "Roadmap", "Launch", chosen
 *  deterministically from the workspace name so the same workspace
 *  always reads with the same eyebrow across renders. */
function pickEyebrow(name: string): string {
  const lower = name.toLowerCase();
  if (/launch|release|ship/.test(lower)) return "Launch";
  if (/roadmap|quarter|q[1-4]\b/.test(lower)) return "Roadmap";
  if (/plan|planning|sprint/.test(lower)) return "Plan";
  if (/brief|memo/.test(lower)) return "Brief";
  // Default: a calm, editorial fallback.
  return "Brief";
}

function fmtLong(d: Date): string {
  // ISO-style for the editorial meta line, "2026-05-06" reads more
  // like a masthead date than "May 6, 2026".
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDue(due: string): string {
  // Pass through cleanly. The "Due " prefix is owned by the caller so
  // this stays a pure formatter for the date fragment itself.
  const iso = /^\d{4}-\d{2}-\d{2}/.test(due) ? due : null;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  }
  return due;
}

/** Tinted background for the priority chip, a 12% wash of the
 *  priority colour. Keeps the chip readable on white without
 *  introducing a second accent. */
function tintFor(priority: "p0" | "p1" | "p2" | "p3"): string {
  switch (priority) {
    case "p0":
      return "rgba(220, 38, 38, 0.08)";
    case "p1":
      return "rgba(234, 88, 12, 0.08)";
    case "p2":
      return "rgba(2, 132, 199, 0.08)";
    case "p3":
      return "rgba(100, 116, 139, 0.08)";
  }
}
