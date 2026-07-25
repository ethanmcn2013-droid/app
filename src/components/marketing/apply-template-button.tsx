"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyTemplateAction,
  remixTemplateAction,
} from "@/server/actions/templates";

/**
 * The single client island on `/templates/[slug]`. Wraps the apply
 * server action so the rest of the page can stay server-rendered for
 * indexing. Match the visual treatment to the gallery's primary CTA
 * but accept variant overrides since this gets used in two slots
 * (top hero + bottom-of-page card).
 *
 * Two modes:
 *   - `apply` (default): adds the template's tasks to the user's
 *     active workspace, then routes to `/app/tasks?templated=<id>`.
 *   - `remix`: mints a fresh workspace seeded with the template,
 *     flips the active-workspace cookie to it, then routes to
 *     `/app/tasks?remixed=<id>`. Lets users keep templates as
 *     personal copies they can edit freely without polluting their
 *     real working list.
 */
export function ApplyTemplateButton({
  templateId,
  label,
  variant = "primary",
  mode = "apply",
}: {
  templateId: string;
  label?: string;
  variant?: "primary" | "secondary";
  mode?: "apply" | "remix";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolvedLabel =
    label ??
    (mode === "remix"
      ? "Remix in a new workspace"
      : "Use this template, free, no signup");

  const pendingLabel = mode === "remix" ? "Spinning up…" : "Applying…";

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "remix") {
          await remixTemplateAction(templateId);
          router.push(
            `/app/tasks?remixed=${encodeURIComponent(templateId)}`,
          );
        } else {
          await applyTemplateAction(templateId);
          router.push(
            `/app/tasks?templated=${encodeURIComponent(templateId)}`,
          );
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const base =
    "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-medium transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0";
  const tone =
    variant === "primary"
      ? "bg-ink text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)]"
      : "border border-line-soft bg-white text-ink hover:border-ink-soft/30";

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`${base} ${tone}`}
      >
        {pending ? pendingLabel : resolvedLabel}
        {mode === "remix" ? <ForkIcon /> : <ArrowIcon />}
      </button>
      {error ? (
        <p className="text-[11.5px] text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/** Fork glyph, two branches diverging from a single trunk. Reads as
 *  "make your own copy" without leaning on a literal Y shape. */
function ForkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="5" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M6 7v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7" />
      <path d="M12 13v4" />
    </svg>
  );
}
