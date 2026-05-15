"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { applyTemplateAction } from "@/server/actions/templates";
import type { Template } from "@/lib/templates";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { TemplateGlyph } from "@/components/marketing/template-glyph";

/**
 * `/templates` gallery. Each card carries the template name, a short
 * description, an icon, the task-count, and a single "Use this
 * template" CTA. Apply runs the server action and bounces to
 * `/app/board` with a `?templated=<id>` query so the consumer can
 * surface a confirmation toast on first paint.
 *
 * The action grants the entitlement-equivalent local-write path even
 * when Clerk isn't configured — no auth gate at the gallery layer.
 * Real auth gating is enforced server-side by `getActiveWorkspace`.
 */
export function TemplatesGallery({ templates }: { templates: Template[] }) {
  return (
    <section className="relative pb-32 pt-16 md:pt-24">
      {/* Soft brand glow, same idiom as /about + /students */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 92, 255, 0.18), rgba(79, 70, 229, 0.06), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1080px] px-6">
        <Eyebrow />
        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
          The work,{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,92,255,0.28), rgba(79,70,229,0.16))",
              }}
            />
            pre-written.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-[58ch] text-[16.5px] leading-[1.55] text-ink-soft">
          Wedding planning workspaces, thesis sprints, freelance
          onboarding, tax-season checklists. The recurring stuff,
          ready to drop into any workspace. Applies in one click.
          Doesn&rsquo;t touch your existing tasks.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t, i) => (
            <TemplateCard key={t.id} template={t} index={i} />
          ))}
        </div>
      </div>
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
       and crawlers (proven, T·54). whileHover stays — JS-only, hides
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
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        Templates
      </span>
      Drop-in task lists, free on every tier
    </div>
  );
}
