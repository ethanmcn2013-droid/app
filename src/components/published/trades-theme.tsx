import { LANE_ORDER, LANES, PRIORITY_LABEL } from "@/lib/data";
import type { LaneId } from "@/lib/data";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Trades theme, blueprint paper, technical-drawing aesthetic.
 *
 * The audience: electricians, carpenters, plumbers, contractors —
 * people whose work is dispatched as a list of calls and finished
 * with a signature. The theme reads like a job-ticket binder, not
 * a productivity app: graph-paper background, mono kicker labels,
 * bracketed lane callouts ([ROUGH-IN], [FINAL]), safety-orange
 * accent on the active lane, a steel-rule "approved" footer mark.
 *
 * Server-rendered. No client hooks.
 */

const SAFETY_ORANGE = "#f97316";
const STEEL_INK = "#0f172a";
const PAPER = "#fbfaf3";
const RULE = "#cbd5e1";

const LANE_BRACKET: Record<LaneId, string> = {
  todo: "[QUEUED]",
  doing: "[ON SITE]",
  review: "[FINAL WALK]",
  done: "[CLOSED]",
};

export function TradesTheme({ workspace, tasks }: PublishedWorkspaceProps) {
  const byLane = new Map<LaneId, typeof tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of tasks) {
    const arr = byLane.get(t.lane);
    if (arr) arr.push(t);
  }

  const visibleLanes = LANE_ORDER.filter(
    (id) => (byLane.get(id) ?? []).length > 0,
  );
  // The active lane gets the safety-orange treatment, first lane
  // that has work in progress, falling back through the queue.
  const activeLane: LaneId | null =
    visibleLanes.find((id) => id === "doing") ??
    visibleLanes.find((id) => id === "review") ??
    visibleLanes.find((id) => id === "todo") ??
    null;

  return (
    <main
      className="relative w-full"
      style={{
        background: PAPER,
        color: STEEL_INK,
        // Faint cyan graph-paper grid. Pale enough to read like
        // engineering vellum, not loud enough to fight the type.
        backgroundImage: [
          `linear-gradient(to right, rgba(56, 121, 158, 0.08) 1px, transparent 1px)`,
          `linear-gradient(to bottom, rgba(56, 121, 158, 0.08) 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: "24px 24px",
        minHeight: "100vh",
      }}
    >
      {/* Top edge: orange rule + ticket meta */}
      <div
        className="w-full"
        style={{
          height: 4,
          background: `linear-gradient(to right, ${SAFETY_ORANGE} 0%, ${SAFETY_ORANGE} 60%, transparent 60%, transparent 100%)`,
        }}
      />

      <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-12 md:pt-16">
        {/* Header, job-ticket masthead */}
        <header
          className="grid gap-1 pb-8"
          style={{ borderBottom: `1px solid ${RULE}` }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ color: STEEL_INK, opacity: 0.5 }}
          >
            {"// job ticket · binder"}
          </div>
          <h1
            className="mt-3 text-[clamp(1.7rem,1.1rem+2.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.02em]"
            style={{ color: STEEL_INK }}
          >
            {workspace.name}
          </h1>
          <div
            className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-[11px] tracking-[0.04em] sm:grid-cols-4"
            style={{ color: STEEL_INK, opacity: 0.65 }}
          >
            <Field label="ref" value={workspace.slug} />
            <Field label="scope" value={`${tasks.length} item${tasks.length === 1 ? "" : "s"}`} />
            <Field label="lanes" value={String(visibleLanes.length)} />
            <Field
              label="status"
              value={
                activeLane
                  ? LANES[activeLane].name.toLowerCase()
                  : "archived"
              }
            />
          </div>
          <p
            className="mt-5 max-w-[58ch] text-[14.5px] leading-[1.55]"
            style={{ color: STEEL_INK, opacity: 0.85 }}
          >
            Read-only snapshot of the route. Lanes group calls by
            stage; closed rows are signed-off. Updated as the work
            moves.
          </p>
        </header>

        {/* Body, bracketed lanes, job-ticket rows */}
        <div className="mt-12 space-y-12">
          {visibleLanes.map((laneId) => {
            const list = byLane.get(laneId) ?? [];
            const isActive = laneId === activeLane;
            return (
              <section key={laneId}>
                <header className="flex items-baseline gap-3">
                  <h2
                    className="font-mono text-[12px] font-medium tracking-[0.18em]"
                    style={{ color: isActive ? SAFETY_ORANGE : STEEL_INK, opacity: isActive ? 1 : 0.6 }}
                  >
                    {LANE_BRACKET[laneId]}
                  </h2>
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: STEEL_INK, opacity: 0.4 }}
                  >
                    ({list.length})
                  </span>
                  {isActive ? (
                    <span
                      className="ml-auto font-mono text-[10px] tracking-[0.18em]"
                      style={{ color: SAFETY_ORANGE }}
                    >
                      ACTIVE
                    </span>
                  ) : null}
                </header>

                <ul
                  className="mt-4 overflow-hidden"
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${RULE}`,
                  }}
                >
                  {list.map((t, i) => {
                    const priority = PRIORITY_LABEL[t.priority];
                    const isClosed = laneId === "done";
                    const stripeColor = isActive
                      ? SAFETY_ORANGE
                      : isClosed
                        ? "#10b981"
                        : "#94a3b8";
                    return (
                      <li
                        key={t.id}
                        className="grid grid-cols-[6px_1fr] gap-0"
                        style={{
                          borderTop:
                            i === 0 ? "none" : `1px solid ${RULE}`,
                        }}
                      >
                        <div style={{ background: stripeColor }} aria-hidden />
                        <div className="px-5 py-4">
                          <div
                            className="text-[15px] leading-[1.4]"
                            style={{
                              color: STEEL_INK,
                              opacity: isClosed ? 0.55 : 1,
                              textDecoration: isClosed ? "line-through" : "none",
                            }}
                          >
                            {t.title}
                          </div>
                          <div
                            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]"
                            style={{ color: STEEL_INK, opacity: 0.55 }}
                          >
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
                                <span style={{ color: STEEL_INK, opacity: 0.85 }}>
                                  {t.due}
                                </span>
                              </span>
                            ) : null}
                            {t.tags && t.tags.length > 0 ? (
                              <span className="flex flex-wrap gap-1.5">
                                {t.tags.map((tag) => (
                                  <span key={tag}>[{tag}]</span>
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

        {/* Approved-by footer, signature-line aesthetic */}
        <div
          className="mt-20 grid grid-cols-[1fr_auto] items-end gap-8 pt-6"
          style={{ borderTop: `1px solid ${RULE}` }}
        >
          <div className="font-mono text-[11px] tracking-[0.04em]" style={{ color: STEEL_INK, opacity: 0.55 }}>
            published {fmtSpec(workspace.publishedAt)}
            <br />
            <span style={{ opacity: 0.8 }}>route binder · read-only</span>
          </div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: STEEL_INK, opacity: 0.45 }}
          >
           , end of ticket
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span style={{ opacity: 0.95 }}>{value}</span>
    </div>
  );
}

function fmtSpec(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
