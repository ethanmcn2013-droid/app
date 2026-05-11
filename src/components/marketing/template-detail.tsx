import Link from "next/link";
import type { Template } from "@/lib/templates";
import type { TemplateEssay } from "@/lib/template-essays";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { LANES, PRIORITY_LABEL, type LaneId } from "@/lib/data";
import { TemplateGlyph } from "./template-glyph";

const LANE_ORDER: LaneId[] = ["todo", "doing", "review", "done"];
import { ApplyTemplateButton } from "./apply-template-button";

/**
 * `/templates/[slug]` rendering. Server-rendered for indexing — the
 * apply CTA is the only client island. Two render modes:
 *
 *   - Rich (template has an entry in `TEMPLATE_ESSAYS`): renders the
 *     manifesto-voiced long-form copy plus the task preview.
 *   - Light (no essay yet): renders the same skeleton with just the
 *     template's `description` as intro and no body sections. Still
 *     a working URL with the apply CTA so the route works for every
 *     template slug.
 */
export function TemplateDetail({
  template,
  essay,
  related,
}: {
  template: Template;
  essay: TemplateEssay | null;
  related: Template[];
}) {
  const domain = DOMAINS[template.domain as DomainId];
  const heroline =
    essay?.heroline ?? `${template.name} — a drop-in task list.`;
  const intro = essay?.intro ?? template.description;

  return (
    <section className="relative isolate overflow-hidden pb-32 pt-12 md:pt-16">
      {/* Soft brand glow — same idiom as /about, /students, /templates */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 92, 255, 0.18), rgba(79, 70, 229, 0.06), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        {/* Back link */}
        <Link
          href="/templates"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-quiet transition-colors hover:text-ink"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All templates
        </Link>

        {/* Eyebrow row */}
        <div className="mt-6 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"
          >
            <TemplateGlyph slug={template.icon} size={26} />
          </span>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-brand">
              Template · {domain?.label ?? template.domain}
            </div>
            <div className="mt-0.5 text-[13.5px] font-medium text-ink-soft">
              {template.name}
            </div>
          </div>
        </div>

        {/* Heroline + intro */}
        <h1 className="mt-6 text-balance text-[clamp(2.1rem,1.4rem+3.2vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
          {heroline}
        </h1>
        <p className="mt-5 text-[17px] leading-[1.6] text-ink-soft">
          {intro}
        </p>

        {/* Primary apply + remix CTAs */}
        <div className="mt-7">
          <div className="flex flex-wrap items-center gap-3">
            <ApplyTemplateButton templateId={template.id} />
            <ApplyTemplateButton
              templateId={template.id}
              mode="remix"
              variant="secondary"
            />
          </div>
          <p className="mt-2.5 text-[12px] text-ink-quiet">
            <span className="font-medium text-ink-soft">Use</span> drops these{" "}
            {template.tasks.length} task
            {template.tasks.length === 1 ? "" : "s"} into your active workspace.{" "}
            <span className="font-medium text-ink-soft">Remix</span> mints a
            fresh workspace seeded with them — your personal copy to edit.
          </p>
        </div>

        {/* Task preview */}
        <TaskPreview template={template} />

        {/* Essay body */}
        {essay ? (
          <div className="mt-16 space-y-12">
            {essay.sections.map((s) => (
              <div key={s.heading}>
                <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
                  {s.heading}
                </h2>
                <p className="mt-3 text-[16.5px] leading-[1.65] text-ink-soft">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Closer card */}
        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Plain English
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            {essay?.closer ??
              "The list is yours in 30 seconds. The free workspace stays free."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ApplyTemplateButton
              templateId={template.id}
              label="Use this template"
            />
            <ApplyTemplateButton
              templateId={template.id}
              mode="remix"
              variant="secondary"
            />
            <Link
              href="/templates"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Browse all templates
            </Link>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 ? (
          <div className="mt-20">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
              Related templates
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/templates/${r.id}`}
                  className="group flex items-start gap-3 rounded-xl border border-line-soft bg-white px-4 py-3 transition-colors hover:border-ink-soft/30"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
                  >
                    <TemplateGlyph slug={r.icon} size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-ink">
                      {r.name}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-ink-quiet">
                      {r.tasks.length} tasks ·{" "}
                      {DOMAINS[r.domain as DomainId]?.label ?? r.domain}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The task list rendered as a structured preview, lane-grouped so the
 *  reader sees the shape of the work instead of just a flat list. */
function TaskPreview({ template }: { template: Template }) {
  // Group tasks by lane, preserving the canonical lane order.
  const byLane = new Map<LaneId, typeof template.tasks>();
  for (const id of LANE_ORDER) byLane.set(id, []);
  for (const t of template.tasks) {
    byLane.get(t.lane)?.push(t);
  }

  return (
    <div className="mt-12 rounded-2xl border border-line-soft bg-white p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
          The list
        </div>
        <div className="text-[11px] tabular-nums text-ink-quiet">
          {template.tasks.length} task
          {template.tasks.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mt-5 space-y-6">
        {LANE_ORDER.map((laneId) => {
          const tasks = byLane.get(laneId) ?? [];
          if (tasks.length === 0) return null;
          const lane = LANES[laneId];
          return (
            <div key={laneId}>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: `var(--lane-${laneId}-dot)` }}
                  aria-hidden
                />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                  {lane.name}
                </span>
                <span className="text-[10.5px] tabular-nums text-ink-faint">
                  · {tasks.length}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {tasks.map((t, i) => (
                  <li
                    key={`${laneId}-${i}`}
                    className="flex items-start gap-3 rounded-md border border-line-soft/60 bg-bg-elevated/50 px-3 py-2"
                  >
                    <span className="mt-0.5 inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-line bg-white" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] leading-[1.4] text-ink">
                        {t.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-quiet">
                        <span className="font-medium tabular-nums">
                          {PRIORITY_LABEL[t.priority].label}
                        </span>
                        {t.due ? <span>· {t.due}</span> : null}
                        {t.tags && t.tags.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-bg-sunken/70 px-1.5 py-px text-[10px]"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
