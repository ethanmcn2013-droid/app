"use client";

/**
 * TipCard — a quiet, dismissible inline tip line.
 *
 * Mounts after content to avoid shifting layout or delaying paint.
 * State is persisted to localStorage ("tasks.tips.v1") and a session
 * flag in sessionStorage ("tasks.tips.session").
 *
 * Listens for a window CustomEvent "tips:reset" to clear state and
 * re-evaluate, so the Settings "Show tips again" button works without
 * a full page reload.
 *
 * When enabled===false renders nothing.
 */

import { useEffect, useState } from "react";
import { nextTip } from "@/lib/tips";
import type { Tip, TipContext } from "@/lib/tips";
import { getPersonalityPrefs } from "@/server/actions/personality";

// Module-memoized so a surface that self-gates (no explicit `enabled` prop,
// e.g. the task panel) fetches the tips preference at most once per page
// session rather than once per mount. Reset by the "tips:reset" event so a
// preference change takes effect without a reload.
let cachedTipsEnabled: Promise<boolean> | null = null;

function resolveTipsEnabled(): Promise<boolean> {
  if (!cachedTipsEnabled) {
    cachedTipsEnabled = getPersonalityPrefs()
      .then((prefs) => prefs.tips)
      .catch(() => true); // fail open: a prefs read error should not hide tips
  }
  return cachedTipsEnabled;
}

const LS_KEY = "tasks.tips.v1";
const SS_SESSION_KEY = "tasks.tips.session";

type TipsStore = {
  seen: Record<string, number>;
  lastShownAt: number | null;
};

function readStore(): TipsStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { seen: {}, lastShownAt: null };
    const parsed = JSON.parse(raw) as Partial<TipsStore>;
    return {
      seen: parsed.seen && typeof parsed.seen === "object" ? parsed.seen : {},
      lastShownAt: typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : null,
    };
  } catch {
    return { seen: {}, lastShownAt: null };
  }
}

function writeStore(store: TipsStore): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private-mode errors
  }
}

function readSessionShown(): boolean {
  try {
    return sessionStorage.getItem(SS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setSessionShown(): void {
  try {
    sessionStorage.setItem(SS_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

function clearTipsState(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(SS_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function TipCard({
  context,
  enabled,
}: {
  context: TipContext;
  /**
   * When a boolean is passed (e.g. the inbox, which already holds the
   * preference server-side), it governs directly. When omitted (e.g. the
   * task panel, which has no prefs in scope), the card self-gates on the
   * "Tips while you work" preference via a memoized fetch.
   */
  enabled?: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  function show(effectiveEnabled: boolean) {
    if (!effectiveEnabled) {
      setTip(null);
      return;
    }
    const store = readStore();
    const sessionShown = readSessionShown();
    const candidate = nextTip({
      context,
      seen: store.seen,
      lastShownAt: store.lastShownAt,
      now: Date.now(),
      sessionShown,
    });
    setTip(candidate);
  }

  function evaluate() {
    if (typeof enabled === "boolean") {
      show(enabled);
      return;
    }
    // Self-gate: resolve the tips preference (memoized) then evaluate.
    void resolveTipsEnabled().then(show);
  }

  useEffect(() => {
    // Defer to after first paint so the card doesn't delay content.
    const timer = window.setTimeout(evaluate, 0);

    function onReset() {
      clearTipsState();
      // A preference may have changed: drop the memoized flag so the next
      // evaluate re-reads it.
      cachedTipsEnabled = null;
      // Small delay to let the storage clear settle before re-evaluating.
      window.setTimeout(evaluate, 0);
    }

    window.addEventListener("tips:reset", onReset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("tips:reset", onReset);
    };
    // evaluate is stable within the effect; context/enabled are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, enabled]);

  function dismiss() {
    if (!tip) return;
    const store = readStore();
    store.seen[tip.id] = tip.version;
    store.lastShownAt = Date.now();
    writeStore(store);
    setSessionShown();
    setTip(null);
  }

  if (!tip) return null;

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-line-soft bg-bg-elevated px-4 py-3"
    >
      <p className="flex-1 text-[12.5px] leading-[1.5] text-ink-quiet">
        {tip.body}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="flex-shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:bg-bg-sunken hover:text-ink-quiet focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </div>
  );
}
