"use client";

import { useCallback, useEffect, useState } from "react";
import { ShellIcon } from "@/components/shell/shell-icons";
import type { DirectedAttention } from "@/server/conversations/attention";

/*
 * Project messages card for the inbox: mentions and Task Discussion across
 * the Projects the reader can still open.
 *
 * Kept in its own module with Tailwind v3-token classes (no CSS module) so
 * the server-rendered attention test can import it under plain Node. The
 * classes mirror the inbox card, row and pill in inbox.module.css.
 */

const CARD =
  "overflow-hidden rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] shadow-[var(--v3-shadow-1)]";
const TEXT_BUTTON =
  "h-7 flex-shrink-0 rounded-[var(--v3-radius-sm)] px-2 text-[12.5px] font-medium text-[color:var(--v3-accent)] transition-colors hover:bg-[color:var(--v3-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--v3-accent)] disabled:opacity-60";
const BUTTON =
  "inline-flex h-[30px] flex-shrink-0 items-center rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] px-[11px] text-[12.5px] font-medium text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1)] transition-colors hover:border-[color:var(--v3-border-strong)] hover:bg-[color:var(--v3-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--v3-accent)]";

export function ConversationAttentionSection({ initial, available }: { initial: readonly DirectedAttention[]; available: boolean }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(!available);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/message-attention?action=list&limit=50", { cache: "no-store", credentials: "same-origin" });
      const result = await response.json() as { ok: boolean; value?: DirectedAttention[] };
      if (!response.ok || !result.ok || !result.value) throw new Error("attention_unavailable");
      setItems(result.value);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const markAll = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/message-attention", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark-all" }) });
      if (!response.ok) throw new Error("attention_unavailable");
      await refresh();
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  const unread = items.filter(item => item.seenAt === null).length;
  const status = unread ? `${unread} ${unread === 1 ? "message" : "messages"} for you.` : "No new Project messages.";

  return (
    <section aria-label="Project attention" data-project-attention className={CARD}>
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 pb-2 pt-3">
        <h2 id="inbox-attention" className="flex min-w-0 items-center gap-2 text-[14px] font-semibold leading-[1.3] text-[color:var(--v3-text)]">
          Project messages
          {!failed ? (
            <span
              className={
                "inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums " +
                (unread > 0
                  ? "bg-[color:var(--v3-accent-soft)] text-[color:var(--v3-accent)]"
                  : "bg-[color:var(--v3-sunken)] text-[color:var(--v3-text-2)]")
              }
            >
              <span className="sr-only">(</span>
              {unread}
              <span className="sr-only">)</span>
            </span>
          ) : null}
        </h2>
        {!failed && unread > 0 ? (
          <button type="button" disabled={busy} onClick={() => void markAll()} className={TEXT_BUTTON}>
            {busy ? "Checking…" : "Mark all seen"}
          </button>
        ) : null}
      </div>
      {failed ? (
        <div role="status" className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-[var(--v3-radius)] bg-[color:var(--v3-sunken)] px-3.5 py-3 text-[12.5px] text-[color:var(--v3-text-2)]">
          <span>Attention needs a fresh check.</span>
          <button type="button" onClick={() => void refresh()} className={BUTTON}>Try again</button>
        </div>
      ) : (
        <>
          <p className="-mt-0.5 px-4 pb-2 text-[12.5px] leading-normal text-[color:var(--v3-text-2)]">
            {status} Mentions and Task Discussion from Projects you can still open.
          </p>
          {items.length > 0 ? (
            <ul className="m-0 list-none px-1.5 pb-1.5">
              {items.map(item => (
                <li key={item.eventId}>
                  <a
                    href={item.href}
                    className="relative flex min-h-[44px] items-center gap-3 rounded-[var(--v3-radius)] px-2.5 py-2 text-[color:var(--v3-text)] transition-colors hover:bg-[color:var(--v3-hover)] focus-visible:shadow-[inset_0_0_0_2px_var(--v3-accent)] focus-visible:outline-none"
                  >
                    <span
                      className={
                        "grid h-7 w-7 flex-shrink-0 place-items-center rounded-[8px] " +
                        (item.seenAt === null
                          ? "bg-[color:var(--v3-accent-soft)] text-[color:var(--v3-accent)]"
                          : "bg-[color:var(--v3-sunken)] text-[color:var(--v3-text-2)]")
                      }
                    >
                      <ShellIcon.messages size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-medium leading-[1.4]">{item.projectName}</span>
                      <span className="mt-0.5 text-[12.5px] leading-normal text-[color:var(--v3-text-2)]">
                        {item.kind === "conversation" ? "Project message" : "Task Discussion"}
                      </span>
                    </span>
                    {item.seenAt === null ? (
                      <span className="inline-flex h-[22px] flex-shrink-0 items-center rounded-full bg-[color:var(--v3-accent-soft)] px-2 text-[11.5px] font-medium text-[color:var(--v3-accent)]">New</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="px-4 pb-3.5 text-[12px] leading-normal text-[color:var(--v3-text-3)]">
            Your read state is private.
            {items.length >= 50 ? " Showing 50 items, prioritizing unread messages. Older unread items may remain." : null}
          </p>
        </>
      )}
    </section>
  );
}
