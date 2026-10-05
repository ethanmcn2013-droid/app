"use client";

import { useRef, useState } from "react";

import styles from "./CaptureEmailRow.module.css";

/**
 * The billing plan that unlocks email capture.
 *
 * Exported so every surface that names it reads the same string. This file
 * is the allowlisted owner of that name (see the vocabulary contract), which
 * is exactly why the name lives here and not in the surfaces that show it.
 * Renaming it is a pricing decision (docs/design/v3/launcher.md §12).
 */
export const CAPTURE_EMAIL_PLAN = "Workspace plan";

export type CaptureState =
  | { tier: "entitled"; address: string }
  | { tier: "free" };

type CaptureEmailFeedback = {
  state: "saved" | "error";
  message: string;
};

const PRICING_URL = "https://signalstudio.ie/pricing";

/**
 * Capture by email, as one quiet row inside the canvas's "More ways to
 * capture". An entitled account sees its address and a Copy button; a free
 * account sees the route, marked unavailable, and the plan that opens it.
 *
 * When the clipboard is blocked, a selectable read-only field takes the
 * button's place so the address is never out of reach.
 */
export function CaptureEmailRow({
  state,
  onFeedback,
}: {
  state: CaptureState;
  onFeedback?: (feedback: CaptureEmailFeedback) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLInputElement | null>(null);

  if (state.tier === "free") {
    return (
      <div className={styles.root} data-tier="free" aria-label="Email capture availability" role="group">
        <span className={styles.mark} aria-hidden="true">
          <MailGlyph />
        </span>
        <span className={styles.text}>
          <span className={styles.label}>Capture by email</span>
          <span className={styles.detail}>
            Not on this account.{" "}
            <a href={PRICING_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              Available on the Workspace plan
            </a>
          </span>
        </span>
      </div>
    );
  }

  const address = state.address;
  function fallBack() {
    setShowFallback(true);
    onFeedback?.({
      state: "error",
      message: "Copying is blocked here. The address is selected so you can copy it yourself.",
    });
    window.setTimeout(() => fallbackRef.current?.select(), 0);
  }
  function onCopy() {
    if (!navigator.clipboard) {
      fallBack();
      return;
    }
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setCopied(true);
        onFeedback?.({ state: "saved", message: "Capture address copied." });
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(fallBack);
  }

  return (
    <div className={styles.root} data-tier="entitled" aria-label="Email capture address" role="group">
      <span className={styles.mark} aria-hidden="true">
        <MailGlyph />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>Capture by email</span>
        <span className={styles.detail}>Send anything to this address and it arrives here as a private note.</span>
        {showFallback ? (
          <input
            ref={fallbackRef}
            type="text"
            readOnly
            value={address}
            aria-label="Capture email address, select to copy"
            className={styles.fallbackInput}
            onBlur={() => setShowFallback(false)}
          />
        ) : (
          <code className={styles.address}>{address}</code>
        )}
      </span>
      {showFallback ? null : (
        <button type="button" onClick={onCopy} aria-label="Copy capture email address" className={styles.copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

function MailGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.75" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}
