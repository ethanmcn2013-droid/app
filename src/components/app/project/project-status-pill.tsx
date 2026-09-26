/**
 * The declared-status pill, shared by the Projects hub cards and the project
 * overview so a status reads identically in both places.
 *
 * Tailwind utilities over v3 tokens rather than a CSS module on purpose: the
 * overview is bundled standalone by the wedding-date browser check, and that
 * bundle has no CSS output path.
 */

import type { ProjectStatusTone } from "@/lib/projects/project-hub";

export const STATUS_TONE_CLASS: Record<ProjectStatusTone, string> = {
  success:
    "bg-[color-mix(in_srgb,var(--v3-success)_13%,transparent)] text-[color:color-mix(in_srgb,var(--v3-success)_82%,var(--v3-text))]",
  warning:
    "bg-[color-mix(in_srgb,var(--v3-warning)_17%,transparent)] text-[color:var(--v3-warning-text)]",
  neutral: "bg-[var(--v3-sunken)] text-[color:var(--v3-text-2)] ring-1 ring-inset ring-[color:var(--v3-border)]",
  accent: "bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)]",
  none: "bg-transparent text-[color:var(--v3-text-3)] ring-1 ring-inset ring-[color:var(--v3-border-strong)]",
};

/** The tone's text colour alone, for a bare status dot. */
export const STATUS_TONE_TEXT: Record<ProjectStatusTone, string> = {
  success: "text-[color:var(--v3-success)]",
  warning: "text-[color:var(--v3-warning)]",
  neutral: "text-[color:var(--v3-text-3)]",
  accent: "text-[color:var(--v3-accent)]",
  none: "text-[color:var(--v3-text-3)]",
};

export const STATUS_PILL_BASE =
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium leading-none";

export function StatusDot({ tone }: { tone: ProjectStatusTone }) {
  return (
    <span
      aria-hidden="true"
      className={
        "inline-block size-1.5 shrink-0 rounded-full " +
        (tone === "none" ? "border border-current bg-transparent" : "bg-current")
      }
    />
  );
}

export function StatusPill({
  label,
  tone,
  title,
}: {
  label: string;
  tone: ProjectStatusTone;
  title?: string;
}) {
  return (
    <span className={`${STATUS_PILL_BASE} ${STATUS_TONE_CLASS[tone]}`} title={title}>
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}
