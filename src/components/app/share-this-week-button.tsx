"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/primitives/toast";

/**
 * "Share this week" button.
 *
 * Lives next to the daily-digest header in the inbox. Copies the
 * share-card PNG URL — `${origin}/share-card/{workspaceId}/opengraph-image` —
 * to the clipboard so the user can paste it straight into Slack or
 * Twitter; the unfurl does the celebrating.
 *
 * Behavior:
 *   - Renders nothing when `closedThisWeek <= 0`. There's nothing to
 *     celebrate, so the button doesn't audition for relevance.
 *   - On click, writes the URL to the clipboard and pops a toast.
 *   - The route itself is reachable regardless — sometimes you want
 *     a placeholder card. The button is the celebratory affordance.
 */
export function ShareThisWeekButton({
  workspaceId,
  closedThisWeek,
}: {
  workspaceId: string;
  closedThisWeek: number;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/share-card/${workspaceId}/opengraph-image`;
    const finish = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      toast("Link copied — drop it in Slack", {
        tone: "success",
        body:
          closedThisWeek === 1
            ? "1 task closed this week. Show it off."
            : `${closedThisWeek} tasks closed this week. Show it off.`,
      });
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(finish, () => {
        // Clipboard refused (focus loss / permissions). Fall back to a
        // best-effort textarea + execCommand path so the user still
        // gets the URL onto their clipboard.
        try {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          finish();
        } catch {
          toast("Couldn't copy the link", { tone: "warn" });
        }
      });
    } else {
      // Older browsers without async clipboard.
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        finish();
      } catch {
        toast("Couldn't copy the link", { tone: "warn" });
      }
    }
  }, [workspaceId, closedThisWeek, toast]);

  if (closedThisWeek <= 0) return null;

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy share-card link for this week"
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-line-soft bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
    >
      {copied ? (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share this week
        </>
      )}
    </button>
  );
}
