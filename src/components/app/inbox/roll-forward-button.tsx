"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { rollForwardIncompleteAction } from "@/server/actions/roll-forward";
import { useToast } from "@/components/primitives/toast";

/**
 * End-of-day "Roll forward" button.
 *
 * Lives in the daily-digest header next to the celebratory share-this-
 * week button. The split is intentional: share-this-week is the brag,
 * roll-forward is the broom. Quiet styling, no icon, ink-quiet text —
 * this is utility, not a flourish.
 *
 * Two-step confirm matches the magic-link revoke pattern from cycle 16.
 *   - First click arms a 4s window and swaps copy to a rose-600
 *     "Confirm — roll {N} forward?".
 *   - Second click within the window fires the action.
 *   - Outside-click or the 4s timer cancels.
 *
 * The count comes from the server (the inbox page passes it as a
 * prop); when it's zero the button hides entirely so the surface
 * stays clean on a tidy day.
 */
export function RollForwardButton({ overdueCount }: { overdueCount: number }) {
  const { toast } = useToast();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel after 4s.
  useEffect(() => {
    if (!armed) return;
    timerRef.current = setTimeout(() => setArmed(false), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [armed]);

  // Outside-click cancels — mirrors the GitHub-style destructive
  // confirm idiom used elsewhere in the app.
  useEffect(() => {
    if (!armed) return;
    function handle(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setArmed(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [armed]);

  if (overdueCount <= 0) return null;

  function handleClick() {
    if (pending) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    startTransition(async () => {
      try {
        const result = await rollForwardIncompleteAction();
        const n = result.rolled;
        if (n === 0) {
          toast("Nothing to roll", {
            tone: "info",
            body: "Inbox is already clean.",
          });
          return;
        }
        toast(
          n === 1 ? "1 rolled to tomorrow." : `${n} rolled to tomorrow.`,
          { tone: "success" },
        );
      } catch (err) {
        console.warn("roll-forward: action failed", err);
        toast("Couldn’t roll forward", {
          tone: "warn",
          body: "Try again in a moment.",
        });
      }
    });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={
        armed
          ? `Confirm — roll ${overdueCount} forward to tomorrow`
          : `Roll ${overdueCount} overdue ${overdueCount === 1 ? "task" : "tasks"} forward to tomorrow`
      }
      className={
        "inline-flex flex-shrink-0 items-center rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors disabled:opacity-60 " +
        (armed
          ? "text-rose-600 hover:text-rose-700"
          : "text-ink-quiet hover:text-ink-soft")
      }
    >
      {pending
        ? "Rolling…"
        : armed
          ? `Confirm — roll ${overdueCount} forward?`
          : `Roll forward ${overdueCount}`}
    </button>
  );
}
