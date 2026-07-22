"use client";

/**
 * PublishControl, D6 two-gate, CREATIVE_SPEC §2.1/2.2.
 *
 * Publishing is the highest-value action in the product, turns a private plan
 * into a growth surface. It must feel like a threshold, not a toggle.
 *
 * Draft state → "Publish the plan" CTA pill (ink bg, paper text).
 * Transition → button fades out (160ms), published panel fades in (200ms),
 *              URL chip slides up (240ms). CREATIVE_SPEC §2.1 sequence.
 *
 * Published state → URL chip + Copy link + External link + Unpublish text link.
 *
 * D6 two-gate: promotion populates the PRIVATE draft. This action is the
 * SECOND gate, the explicit "yes, in public" decision. Never auto-publish
 * on sync. Never auto-refresh published output on sync.
 */

import { useState, useTransition } from "react";
import { publishWorkspaceAction, unpublishWorkspaceAction } from "@/modules/timeline/server/actions/workspaces";

export function PublishControl({
  workspaceSlug,
  initialPublished,
  publicUrl,
}: {
  workspaceSlug: string;
  initialPublished: boolean;
  /** The full public URL for the published chip. */
  publicUrl?: string;
}) {
  const [published, setPublished] = useState(initialPublished);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // DRAG: justPublished persisted to localStorage so the chip animation fires
  // on first load even after a page reload.
  // T6 (manifest): key renamed from `roadmap-publish-celebrated-{ws}` to
  // `signal-roadmap.publish-celebrated:{ws}`. Read the old key once and
  // migrate to the new key so returning users don't lose their celebrate state.
  const lsKey = `signal-roadmap.publish-celebrated:${workspaceSlug}`;
  const lsKeyLegacy = `roadmap-publish-celebrated-${workspaceSlug}`;
  const [justPublished, setJustPublished] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      // Read-old-migrate: check new key first, fall back to legacy key.
      const newVal = localStorage.getItem(lsKey);
      if (newVal !== null) return newVal === "1";
      const oldVal = localStorage.getItem(lsKeyLegacy);
      if (oldVal === "1") {
        // Migrate to new key, remove old.
        localStorage.setItem(lsKey, "1");
        localStorage.removeItem(lsKeyLegacy);
        return true;
      }
      return false;
    } catch { return false; }
  });

  const url = publicUrl ?? "";
  const displayUrl = url.replace(/^https?:\/\//, "");
  // The slug portion (after last /) is rendered with higher weight (CREATIVE_SPEC §2.2)
  const lastSlash = displayUrl.lastIndexOf("/");
  const urlBase = lastSlash >= 0 ? displayUrl.slice(0, lastSlash + 1) : "";
  const urlSlug = lastSlash >= 0 ? displayUrl.slice(lastSlash + 1) : displayUrl;

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishWorkspaceAction(workspaceSlug);
      if ("error" in result) {
        setError(result.error);
      } else {
        setPublished(true);
        setJustPublished(true);
        try { localStorage.setItem(lsKey, "1"); } catch { /* SSR / private browsing */ }
      }
    });
  }

  function handleUnpublish() {
    setError(null);
    setJustPublished(false);
    try { localStorage.removeItem(lsKey); } catch { /* SSR / private browsing */ }
    startTransition(async () => {
      const result = await unpublishWorkspaceAction(workspaceSlug);
      if ("error" in result) {
        setError(result.error);
      } else {
        setPublished(false);
      }
    });
  }

  if (!published) {
    return (
      <div
        style={{
          padding: "16px 20px",
          border: "1px solid var(--hairline)",
          borderRadius: 10,
          background: "var(--paper-deep, #f4f4f5)",
          maxWidth: 480,
        }}
      >
        {/* M3a: declarative two-sentence form. State the current state, then the action.
            No question marks (BRAND §3). D6 two-gate preserved. */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink, #111111)",
            marginBottom: 4,
          }}
        >
          This plan is private.
        </p>
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-quiet, #71717a)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Anyone who opens your link needs no account.
        </p>
        {error && (
          <p
            style={{
              fontSize: 12,
              color: "var(--alarm, #ef4444)",
              marginBottom: 10,
            }}
          >
            {error}
          </p>
        )}
        {/* CTA pill, CREATIVE_SPEC §2.1 button spec */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          style={{
            background: "var(--ink, #111111)",
            color: "var(--paper, #ffffff)",
            padding: "10px 20px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
            transition: "opacity 160ms ease-out",
          }}
        >
          {isPending ? "Publishing…" : "Publish the plan"}
        </button>
      </div>
    );
  }

  // Published state (CREATIVE_SPEC §2.1 published state + §2.2 chip)
  return (
    <div
      style={{
        padding: "16px 20px",
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        background: "var(--paper, #ffffff)",
        maxWidth: 480,
        animation: justPublished
          ? "rw-published-in 200ms ease-out both"
          : "none",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes rw-published-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rw-chip-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .rw-chip-animate { animation: none !important; }
}
          `.trim(),
        }}
      />

      {/* Published label */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ink, #111111)",
          marginBottom: 10,
        }}
      >
        Published.
      </p>

      {/* URL chip, CREATIVE_SPEC §2.2 */}
      {url && (
        <div
          className="rw-chip-animate"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
            animation: justPublished
              ? "rw-chip-in 240ms var(--ease-out, cubic-bezier(0,0,0.2,1)) 80ms both"
              : "none",
          }}
        >
          {/* Chip */}
          <span
            style={{
              fontFamily: "var(--font-mono-stack)",
              fontSize: 12,
              color: "var(--ink-soft, #3f3f46)",
              background: "var(--paper-soft, #fafafa)",
              border: "1px solid var(--hairline)",
              borderRadius: 6,
              padding: "6px 10px",
              display: "inline-block",
            }}
          >
            {urlBase}
            <strong style={{ fontWeight: 500, color: "var(--ink, #111111)" }}>
              {urlSlug}
            </strong>
          </span>

          {/* Copy link */}
          <CopyLinkButton url={url} />

          {/* External link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open published roadmap"
            style={{
              color: "var(--ink-quiet, #71717a)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}

      {/* Item 6: reassure the sharer, plain language, no hype. */}
      <p
        style={{
          fontSize: 12,
          color: "var(--ink-quiet, #71717a)",
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        Anyone with this link can read the plan, no account, no sign-up.
        Send it to a client or anyone following along.
      </p>

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "var(--alarm, #ef4444)",
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}

      {/* Unpublish, text link, quiet, never prominent (CREATIVE_SPEC §2.1) */}
      <button
        type="button"
        onClick={handleUnpublish}
        disabled={isPending}
        style={{
          fontSize: 12,
          color: "var(--ink-quiet, #71717a)",
          background: "none",
          border: "none",
          cursor: isPending ? "default" : "pointer",
          padding: 0,
          textDecoration: "none",
          opacity: isPending ? 0.5 : 1,
        }}
        onMouseEnter={(e) =>
          ((e.target as HTMLElement).style.textDecoration = "underline")
        }
        onMouseLeave={(e) =>
          ((e.target as HTMLElement).style.textDecoration = "none")
        }
      >
        {isPending ? "Updating…" : "Unpublish"}
      </button>
    </div>
  );
}

// ── Copy link button ──────────────────────────────────────────────────────────
// CREATIVE_SPEC §2.2: copy icon transitions to Check for 1600ms, then back.
// No toast. No "Copied!" text appearing elsewhere. The icon IS the feedback.

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy link"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid var(--hairline)",
        background: "var(--paper, #ffffff)",
        color: copied
          ? "var(--status-done, #10b981)"
          : "var(--ink-soft, #3f3f46)",
        cursor: "pointer",
        transition: "color 160ms",
      }}
    >
      {copied ? (
        <>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copy link
        </>
      )}
    </button>
  );
}
