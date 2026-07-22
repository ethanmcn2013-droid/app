"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWorkspaceAction } from "@/modules/timeline/server/actions/workspaces";
import { slugify, isValidSlug } from "@/modules/timeline/lib/reserved-slugs";
import { useState } from "react";

const initialState = { error: undefined as string | undefined };

export function CreateWorkspaceForm({ writesPaused = false }: { writesPaused?: boolean }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await createWorkspaceAction(formData);
      if ("error" in result) return { error: result.error };
      return { error: undefined };
    },
    initialState,
  );

  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

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
    <div className="mx-auto w-full max-w-md py-20 px-6">
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--brand)", letterSpacing: "0.12em" }}
      >
        New workspace
      </p>
      <h1
        className="mb-2 text-3xl font-semibold"
        style={{ letterSpacing: "-0.03em", color: "var(--ink)" }}
      >
        What&apos;s the plan?
      </h1>
      <p
        className="mb-10 text-sm leading-relaxed"
        style={{ color: "var(--ink-soft)" }}
      >
        A roadmap is one public link that shows what you&apos;re doing and
        what&apos;s next, in plain English. No login for the people you share it
        with. Pick a name and a link to start, you can change both later.
      </p>

      {writesPaused && (
        <div
          role="status"
          className="mb-6 rounded-lg border px-3.5 py-2.5 text-sm"
          style={{
            color: "var(--ink-soft)",
            background: "var(--bg-deep)",
            borderColor: "var(--border)",
          }}
        >
          Workspace creation is paused. Back shortly.
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ws-name"
            className="text-xs font-medium"
            style={{ color: "var(--ink-soft)" }}
          >
            Workspace name
          </label>
          {/* R7 fix: autocomplete="off" prevents browser saved-creds dropdown */}
          <input
            ref={nameRef}
            id="ws-name"
            name="name"
            type="text"
            required
            autoComplete="off"
            placeholder="Acme Corp"
            onChange={handleNameChange}
            className="field rounded-lg border px-3.5 py-2.5 text-sm"
            style={{
              background: "var(--bg-elev)",
              color: "var(--ink)",
            }}
          />
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ws-slug"
            className="text-xs font-medium"
            style={{ color: "var(--ink-soft)" }}
          >
            Your public link
          </label>
          <div className="field flex items-center rounded-lg border overflow-hidden" style={{ background: "var(--bg-elev)" }}>
            <span
              className="px-3 py-2.5 text-sm select-none"
              style={{ color: "var(--ink-quiet)", borderRight: "1px solid var(--border)" }}
            >
              timeline.signalstudio.ie/
            </span>
            <input
              id="ws-slug"
              name="slug"
              type="text"
              required
              autoComplete="off"
              placeholder="acme-corp"
              value={slug}
              onChange={handleSlugChange}
              aria-describedby="ws-slug-feedback"
              aria-invalid={slug ? !slugOk : undefined}
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent focus:outline-none"
              style={{ color: "var(--ink)" }}
            />
          </div>
          <p
            id="ws-slug-feedback"
            aria-live="polite"
            className="text-xs"
            style={{
              color: !slug
                ? "var(--ink-quiet)"
                : slugOk
                  ? "var(--status-done)"
                  : "var(--alarm)",
            }}
          >
            {!slug
              ? "3–32 characters: lowercase letters, numbers, hyphens."
              : slugOk
                ? "Looks good."
                : "3–32 chars, lowercase letters/numbers/hyphens, not reserved."}
          </p>
        </div>

        {/* Error */}
        {state.error && (
          <div
            role="alert"
            className="rounded-lg border px-3.5 py-2.5 text-sm"
            style={{
              color: "var(--roadmap-red-fg)",
              background: "var(--roadmap-red-bg)",
              borderColor: "var(--roadmap-red-border)",
            }}
          >
            <p>{state.error}</p>
            {state.error.includes("signalstudio.ie/pricing") ? (
              <a
                href="https://signalstudio.ie/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium underline"
                style={{ color: "var(--roadmap-red-fg)" }}
              >
                See pricing →
              </a>
            ) : null}
          </div>
        )}

        {/* R6 fix: only dim when slug is invalid, not when pending.
            Pending = indigo fill + inline spinner so it reads "working",
            not "disabled". The token pairing passes WCAG AA. */}
        <button
          type="submit"
          disabled={pending || !slugOk || writesPaused}
          className="lift mt-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white"
          style={{
            background: "var(--brand)",
            opacity: (writesPaused || !slugOk) && !pending ? 0.4 : 1,
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
          {pending ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
