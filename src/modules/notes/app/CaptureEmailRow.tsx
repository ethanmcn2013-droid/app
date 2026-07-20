"use client";

import { useRef, useState } from "react";

type CaptureState =
  | { tier: "entitled"; address: string }
  | { tier: "free" };

const PRICING_URL = "https://signalstudio.ie/pricing";

/**
 * Inline footer-row beneath the stream surface. Reveals the user's
 * capture-by-email address (workspace+ tier) or the upgrade pitch
 * (free tier). Deliberately quiet, capture-by-email is a power-
 * user surface and shouldn't compete with the capture field.
 *
 * Click-to-copy mirrors the PRODUCT.md §5 budget: power users
 * already in muscle memory shouldn't need a modal.
 * Fallback: when navigator.clipboard is unavailable a selectable
 * readonly input is revealed so the address is never inaccessible.
 */
export function CaptureEmailRow({ state }: { state: CaptureState }) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLInputElement | null>(null);

  if (state.tier === "free") {
    return (
      <aside
        aria-label="Email capture availability"
        className="capture-email capture-email--free"
      >
        <span aria-hidden>✉</span>
        <span>Send notes by email. Available on the <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">Workspace plan</a>.</span>
      </aside>
    );
  }

  const address = state.address;
  function onCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }).catch(() => {
        setShowFallback(true);
        window.setTimeout(() => {
          fallbackRef.current?.select();
        }, 0);
      });
    } else {
      // Clipboard API unavailable, reveal a selectable readonly input.
      setShowFallback(true);
      window.setTimeout(() => {
        fallbackRef.current?.select();
      }, 0);
    }
  }

  return (
    <aside
      aria-label="Email capture address"
      className="capture-email capture-email--entitled"
    >
      <span aria-hidden>✉</span>
      <span>Email a note: </span>
      {showFallback ? (
        <input
          ref={fallbackRef}
          type="text"
          readOnly
          value={address}
          aria-label="Capture email address, select to copy"
          className="capture-email__fallback-input"
          onBlur={() => setShowFallback(false)}
        />
      ) : (
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy capture email address"
          className="capture-email__address"
        >
          <code>{address}</code>
          <span className="capture-email__hint">{copied ? "copied" : "copy"}</span>
        </button>
      )}
    </aside>
  );
}
