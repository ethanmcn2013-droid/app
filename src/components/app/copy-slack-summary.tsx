"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/primitives/toast";
import { TASKS_PUBLIC_DOMAIN } from "@/lib/product-urls";

/**
 * "Copy as Slack" button.
 *
 * Sibling to {@link ShareThisWeekButton} on the inbox daily-digest
 * header. Where that button copies the share-card PNG URL (cycle 22),
 * this one copies a *text* summary, markdown bullets of the tasks
 * that closed this week, suitable for pasting into a Friday team
 * channel update.
 *
 * Slack renders `*bold*` markdown when pasted into the message
 * composer, and the `•` glyph stays readable as a list. The trailing
 * link unfurls to the published-workspace page when present.
 *
 * Behavior matches share-this-week-button:
 *   - Renders nothing when `closedThisWeek <= 0` (nothing to brag
 *     about, no audition for relevance).
 *   - On click, writes the markdown to the clipboard and pops a toast.
 *   - "Copied" confirmation flips on for 1.4s after a successful copy.
 *   - Falls back to a hidden-textarea + `execCommand("copy")` path if
 *     `navigator.clipboard.writeText` rejects (focus loss, permissions).
 *
 * Compactness: at most 12 bulleted titles. If there are more, we
 * append a single "+ N more closed" bullet so the paste stays small
 * enough that nobody scrolls past it in #team-room.
 */
export function CopySlackSummary({
  workspaceName,
  workspaceSlug,
  closedThisWeek,
  closedTitles,
}: {
  workspaceName: string;
  workspaceSlug: string;
  closedThisWeek: number;
  /** Titles of the tasks closed this week, in display order. May
   *  be shorter than `closedThisWeek` (the snapshot caps at 8); the
   *  count drives the headline regardless. */
  closedTitles: string[];
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const buildMarkdown = useCallback(() => {
    const MAX_BULLETS = 12;
    const visible = closedTitles.slice(0, MAX_BULLETS);
    const remaining = Math.max(0, closedThisWeek - visible.length);

    const headline = `${closedThisWeek} ${closedThisWeek === 1 ? "task" : "tasks"} closed:`;
    const bullets = visible.map((t) => `• ${t}`);
    if (remaining > 0) {
      bullets.push(
        `• + ${remaining} more closed`,
      );
    }
    const link = `Made with Signal Tasks → ${TASKS_PUBLIC_DOMAIN}/p/${workspaceSlug}`;

    return [
      `*This week in ${workspaceName}*`,
      "",
      headline,
      ...bullets,
      "",
      link,
    ].join("\n");
  }, [workspaceName, workspaceSlug, closedThisWeek, closedTitles]);

  const onCopy = useCallback(() => {
    if (typeof window === "undefined") return;
    const text = buildMarkdown();
    const finish = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      toast("Slack-ready text copied", {
        tone: "success",
        body: "Paste into your team channel.",
      });
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(finish, () => {
        // Clipboard refused (focus loss / permissions). Fall back to
        // a best-effort textarea + execCommand path so the user
        // still gets the markdown onto their clipboard.
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          finish();
        } catch {
          toast("Couldn’t copy the summary", { tone: "warn" });
        }
      });
    } else {
      // Older browsers without async clipboard.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        finish();
      } catch {
        toast("Couldn’t copy the summary", { tone: "warn" });
      }
    }
  }, [buildMarkdown, toast]);

  if (closedThisWeek <= 0) return null;

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy this week as Slack-ready text"
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
          {/* Speech-bubble glyph, signals "for chat" without leaning
              on a Slack-branded mark. Stroke-based to match the
              share-this-week button's clipboard icon. */}
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
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          Copy as Slack
        </>
      )}
    </button>
  );
}
