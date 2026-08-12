"use client";

import { useRef, useState } from "react";
import type { AudienceActionState } from "@/modules/timeline/server/actions/audience-timeline";
import styles from "./share-controls.module.css";

/**
 * The three sharing controls, extracted from audience-manager.tsx so the
 * focused Share surface on a project page and the full shared-timelines
 * manager cannot drift apart. Behaviour is unchanged from the manager's own
 * copies; only their address moved.
 *
 * Measured 2026-08-06, recorded so it is not re-tried: this file is emitted
 * THREE times into `.next/static/chunks` — once as a chunk of its own for
 * `/app/timeline/[projectSlug]`, and once inlined into each of the chunks for
 * `/app/timeline` and `/app/timeline/audience` — because Turbopack does not
 * hoist a small module shared by three independent route trees. That costs
 * about 3.6 KB gzip. Removing the `"use client"` directive above (it is
 * redundant: both importers already carry one) was tried and changed the
 * output by nothing at all, so the duplication is chunk-group policy and not
 * a client-boundary artefact. The only ways out are merging the route trees or
 * letting the two share surfaces drift; neither is worth 3.6 KB.
 */

export const fieldClass =
  `${styles.focusable} min-h-10 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`;
export const quietButton =
  `${styles.focusable} min-h-10 rounded-lg border border-line-soft bg-white px-3 text-sm font-medium text-ink-soft hover:border-ink-ghost focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60`;
export const primaryButton =
  `${styles.focusable} inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60`;

/**
 * Two presses for actions that kill live links. The first press arms the
 * button and names the consequence; the second submits. Arming lapses on its
 * own, so an accidental click costs nothing and a modal never interrupts.
 */
export function ArmedSubmitButton({
  label,
  armedLabel,
  disabled,
}: {
  label: string;
  armedLabel: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-live="polite"
      className={quietButton}
      style={armed ? { borderColor: "var(--x-timeline-alarm)", color: "var(--x-timeline-alarm)" } : undefined}
      onClick={(event) => {
        if (armed) return;
        event.preventDefault();
        setArmed(true);
        if (disarmTimer.current) clearTimeout(disarmTimer.current);
        disarmTimer.current = setTimeout(() => setArmed(false), 4000);
      }}
      onBlur={() => {
        if (disarmTimer.current) clearTimeout(disarmTimer.current);
        setArmed(false);
      }}
    >
      {armed ? armedLabel : label}
    </button>
  );
}

export function ActionNotice({ state }: { state: AudienceActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className="mt-3 text-sm leading-6"
      style={{ color: state.status === "error" ? "var(--x-timeline-alarm)" : "var(--ink-soft)" }}
    >
      {state.message}
    </p>
  );
}

export function ShareReceipt({ state }: { state: AudienceActionState }) {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "manual"
  >("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  if (!state.shareUrl) return null;

  function selectLink() {
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function copyLink() {
    setCopyStatus("idle");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(state.shareUrl!);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("manual");
      requestAnimationFrame(selectLink);
    }
  }

  return (
    <div
      className="tl-rise-in mt-3 rounded-lg border border-line-soft bg-white p-3"
      style={{ boxShadow: "inset 2px 0 0 var(--accent)" }}
    >
      {/* Sans, sentence case: this is a label, not a string to be copied.
          The field below it keeps mono, which is the module's one remaining
          use for it — a URL is read character by character. */}
      <p
        className="text-[12px] font-medium"
        style={{ color: "var(--accent-hover)" }}
      >
        Your link
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          aria-label="Share link for this timeline"
          readOnly
          value={state.shareUrl}
          className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className={quietButton}
          onClick={() => void copyLink()}
        >
          {copyStatus === "copied" ? "Copied" : "Copy link"}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={
          copyStatus === "idle"
            ? "sr-only"
            : "mt-2 text-xs text-ink-soft"
        }
      >
        {copyStatus === "copied"
          ? "Share link copied."
          : copyStatus === "manual"
            ? "Automatic copy was blocked. The link is selected; use your device's copy command."
            : ""}
      </p>
      {copyStatus === "manual" ? (
        <button
          type="button"
          className={`${quietButton} mt-2`}
          onClick={selectLink}
        >
          Select link again
        </button>
      ) : null}
      <p className="mt-2 text-xs text-ink-quiet">
        Copy it now. The link is not kept here, so this is the only time it can
        be shown. If you lose it, make a new one. That stops this one working.
      </p>
    </div>
  );
}
