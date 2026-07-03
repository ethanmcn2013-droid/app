"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { applyTemplateAction } from "@/server/actions/templates";
import type { Template } from "@/lib/templates";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { TemplateGlyph } from "@/components/marketing/template-glyph";
import {
  TemplatePills,
  type TemplatePill,
} from "@/components/marketing/template-pills";

/**
 * `/templates` gallery. Each card carries the template name, a short
 * description, an icon, the task-count, and a single "Use this
 * template" CTA. Apply runs the server action and bounces to
 * `/app/board` with a `?templated=<id>` query so the consumer can
 * surface a confirmation toast on first paint.
 *
 * The action grants the entitlement-equivalent local-write path even
 * when Clerk isn't configured, no auth gate at the gallery layer.
 * Real auth gating is enforced server-side by `getActiveWorkspace`.
 *
 * Pills (TP-3, 2026-05-22). Audience filter row sits below the hero,
 * above the grid. Pills = wedge-canon order (Wedding → Trades →
 * Freelance → Marketing) plus an "All" pill at position 0. Default =
 * All (gallery is a working surface, maximize browse / serendipity).
 * Students live in "All" only (per segment canon, students never get
 * a pill); /for-students landing page is the dedicated surface.
 *
 * URL contract is byte-identical to studio /templates: `?audience=<id>`
 * with the default omitting the param.
 */

type GalleryAudience =
  | "all"
  | "wedding"
  | "trades"
  | "freelance"
  | "marketing";

const PILL_ORDER: GalleryAudience[] = [
  "all",
  "wedding",
  "trades",
  "freelance",
  "marketing",
];

const PILL_LABELS: Record<GalleryAudience, string> = {
  all: "All",
  wedding: "Weddings",
  trades: "Trades",
  freelance: "Freelance",
  marketing: "Marketing",
};

const DEPTH_NOUN: Record<GalleryAudience, { one: string; many: string }> = {
  all: { one: "template", many: "templates" },
  wedding: { one: "wedding template", many: "wedding templates" },
  trades: { one: "trades template", many: "trades templates" },
  freelance: { one: "freelance template", many: "freelance templates" },
  marketing: { one: "marketing template", many: "marketing templates" },
};

function parseAudience(raw: string | undefined): GalleryAudience {
  if (raw && (PILL_ORDER as string[]).includes(raw)) {
    return raw as GalleryAudience;
  }
  return "all";
}

export function TemplatesGallery({
  templates,
  audience,
}: {
  templates: Template[];
  audience?: string;
}) {
  const current = parseAudience(audience);

  const counts = useMemo(() => {
    const byDomain: Record<string, number> = {};
    for (const t of templates) {
      byDomain[t.domain] = (byDomain[t.domain] ?? 0) + 1;
    }
    return {
      all: templates.length,
      wedding: byDomain.wedding ?? 0,
      trades: byDomain.trades ?? 0,
      freelance: byDomain.freelance ?? 0,
      marketing: byDomain.marketing ?? 0,
    } as Record<GalleryAudience, number>;
  }, [templates]);

  const filtered = useMemo(
    () => (current === "all" ? templates : templates.filter((t) => t.domain === current)),
    [templates, current],
  );

  const pills: TemplatePill[] = PILL_ORDER.map((id) => ({
    id,
    label: PILL_LABELS[id],
    count: counts[id],
  }));

  const noun =
    filtered.length === 1 ? DEPTH_NOUN[current].one : DEPTH_NOUN[current].many;
  const depthLabel = `${filtered.length} ${noun}`;
  const studentCount = templates.filter((t) => t.domain === "student").length;

  return (
    <section className="relative pb-32 pt-16 md:pt-24">
      {/* Soft brand glow, same idiom as /about + /students */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(79,70,229, 0.18), rgba(79, 70, 229, 0.06), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1080px] px-6">
        <Eyebrow />
        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
          The work, pre-written.
        </h1>
        <p className="mx-auto mt-5 max-w-[58ch] text-[16.5px] leading-[1.55] text-ink-soft">
          Wedding planning workspaces, thesis deadlines, freelance
          onboarding, tax-season checklists. The recurring stuff,
          ready to drop into any workspace. Applies in one click.
          Doesn&rsquo;t touch your existing tasks.
        </p>

        {/* ── Pill filter row ─────────────────────────── */}
        <div className="mt-10">
          <TemplatePills
            pills={pills}
            current={current}
            basePath="/templates"
            defaultId="all"
            depthLabel={depthLabel}
          />
        </div>

        <div
          key={current}
          className="tg-fadein mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-line-soft px-6 py-8 text-center text-[13.5px] text-ink-faint">
              No templates for this filter yet.
            </div>
          ) : (
            filtered.map((t, i) => (
              <TemplateCard key={t.id} template={t} index={i} />
            ))
          )}
        </div>

        {/* Student footer link, students get a dedicated landing page,
            not a pill (segment canon 2026-05-16). The templates still
            appear in "All"; this surfaces them as a named alternative. */}
        {studentCount > 0 ? (
          <div className="mt-12 text-center text-[13px] text-ink-faint">
            Studying?{" "}
            <a
              href="/for-students"
              className="underline decoration-line-soft underline-offset-[3px] hover:text-ink hover:decoration-ink"
            >
              Students get the full tier for €9.99 a year
            </a>
            {". "}
            {studentCount} student templates live under{" "}
            <span className="font-medium text-ink-soft">All</span>.
          </div>
        ) : null}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html:
            ".tg-fadein{animation:tg-fadein 150ms ease both}" +
            "@keyframes tg-fadein{from{opacity:0}to{opacity:1}}" +
            "@media (prefers-reduced-motion: reduce){" +
            ".tg-fadein{animation:none}}",
        }}
      />
    </section>
  );
}

function TemplateCard({ template, index }: { template: Template; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    setError(null);
    startTransition(async () => {
      try {
        await applyTemplateAction(template.id);
        router.push(`/app/board?templated=${encodeURIComponent(template.id)}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const domain = DOMAINS[template.domain as DomainId];

  return (
    /* No scroll-reveal: each card is a real template the 80% browse,
       and a whileInView opacity:0 left the gallery invisible to no-JS
       and crawlers (proven, T·54). whileHover stays, JS-only, hides
       nothing. */
    <motion.div
      whileHover={{ y: -2 }}
      className="group flex flex-col rounded-2xl border border-line-soft bg-bg-elevated p-5 transition-shadow hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
        >
          <TemplateGlyph slug={template.icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
            {template.name}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
            {domain?.label ?? template.domain}
          </div>
        </div>
      </div>

      <p className="mt-3 flex-1 text-[13.5px] leading-[1.55] text-ink-soft">
        {template.description}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-bg-sunken/70 px-2 py-0.5 text-[11px] font-medium text-ink-quiet">
          {template.tasks.length} tasks
        </span>
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          aria-label={`Use the ${template.name} template`}
          className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[12px] font-medium text-white transition-transform hover:-translate-y-px disabled:opacity-60"
        >
          {pending ? "Applying…" : "Use this template"}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11.5px] text-rose-600">{error}</p>
      ) : null}
    </motion.div>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur">
      <span
        className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
      >
        Templates
      </span>
      Drop-in task lists, free on every tier
    </div>
  );
}
