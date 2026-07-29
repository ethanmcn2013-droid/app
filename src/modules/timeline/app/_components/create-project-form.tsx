"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createProjectAction } from "@/modules/timeline/server/actions/workspaces";
import { slugify, isValidSlug } from "@/modules/timeline/lib/reserved-slugs";

const initialState = {
  error: undefined as string | undefined,
  ok: false,
  slug: undefined as string | undefined,
};

export function CreateProjectForm({
  workspaceSlug,
  onCreated,
}: {
  workspaceSlug: string;
  onCreated?: (projectSlug: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await createProjectAction(workspaceSlug, formData);
      if ("error" in result) return { error: result.error, ok: false, slug: undefined };
      return { error: undefined, ok: true, slug: result.slug };
    },
    initialState,
  );

  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok && state.slug) {
      onCreated?.(state.slug);
    }
  }, [state.ok, state.slug, onCreated]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugEdited) {
      setSlug(slugify(e.target.value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugEdited(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  const slugOk = isValidSlug(slug);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="proj-name"
          className="text-xs font-medium"
          style={{ color: "var(--ink-soft)" }}
        >
          Project name
        </label>
        {/* R7 fix: autocomplete="off" prevents browser saved-creds dropdown */}
        <input
          ref={nameRef}
          id="proj-name"
          name="name"
          type="text"
          required
          autoComplete="off"
          placeholder="Mobile App v2"
          onChange={handleNameChange}
          className="rounded-lg border px-3.5 py-2.5 text-sm outline-none"
          style={{
            background: "var(--bg-elev)",
            borderColor: "var(--border)",
            color: "var(--ink)",
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="proj-slug"
          className="text-xs font-medium"
          style={{ color: "var(--ink-soft)" }}
        >
          Slug
        </label>
        <input
          id="proj-slug"
          name="slug"
          type="text"
          autoComplete="off"
          placeholder="mobile-app-v2"
          value={slug}
          onChange={handleSlugChange}
          aria-describedby="proj-slug-feedback"
          aria-invalid={slug ? !slugOk : undefined}
          className="rounded-lg border px-3.5 py-2.5 text-sm outline-none"
          style={{
            background: "var(--bg-elev)",
            borderColor: "var(--border)",
            color: "var(--ink)",
          }}
        />
        <p
          id="proj-slug-feedback"
          aria-live="polite"
          className="text-xs"
          style={{
            color: !slug
              ? "var(--ink-quiet)"
              : slugOk
                ? "var(--status-done)"
                : "var(--x-timeline-alarm)",
          }}
        >
          {!slug
            ? "Auto-filled from the name. 3–32 chars, lowercase."
            : slugOk
              ? "Looks good."
              : "3–32 chars, lowercase letters/numbers/hyphens."}
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border px-3.5 py-2.5 text-sm"
          style={{
            color: "var(--roadmap-red-fg)",
            background: "var(--roadmap-red-bg)",
            borderColor: "var(--roadmap-red-border)",
          }}
        >
          {state.error}
        </p>
      )}

      {/* R6 fix: only dim when slug is invalid, not when pending.
          Pending = indigo fill + inline spinner. The token pairing passes WCAG AA. */}
      <button
        type="submit"
        disabled={pending || !slugOk}
        className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all"
        style={{
          background: "var(--brand)",
          opacity: !slugOk && !pending ? 0.4 : 1,
          cursor: pending ? "default" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {pending && (
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
          >
            <circle
              cx="7" cy="7" r="5.5"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.75"
            />
            <path
              d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
