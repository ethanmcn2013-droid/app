"use client";

import { useRef, useState } from "react";
import type { AudienceActionState } from "@/modules/timeline/server/actions/audience-timeline";

/**
 * The three sharing controls, extracted from audience-manager.tsx so the
 * focused Share surface on a project page and the full shared-timelines
 * manager cannot drift apart. Behaviour is unchanged from the manager's own
 * copies; only their address moved.
 */

export const fieldClass =
  "min-h-10 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
export const quietButton =
  "min-h-10 rounded-lg border border-line-soft bg-white px-3 text-sm font-medium text-ink-soft hover:border-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
export const primaryButton =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

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
      <p
        className="font-mono text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: "var(--accent-hover)" }}
      >
        One-time share link
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          aria-label="New Audience Timeline share link"
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
        Only a protected fingerprint is stored. If this receipt is lost, rotate the link.
      </p>
    </div>
  );
}
