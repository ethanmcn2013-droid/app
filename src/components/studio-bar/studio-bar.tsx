"use client";

/**
 * Studio Bar — the permanent production top chrome (T·94, 2026-07-17).
 *
 * Promoted from the Option B design lab's black header into the one
 * 48px bar every Signal Studio product will carry. Neutral black (the
 * canonical rail charcoal, --x-studio-chrome), visually continuous with
 * the 60px product rail below-left so bar + rail draw a deliberate
 * L-shaped Signal Studio frame around the white working canvas.
 *
 * Column grid, aligned to the shell below it:
 *   60px   Signal Studio mark (over the product rail)
 *   248px  workspace switcher (over the sidebar)
 *   1fr    scope capsule (planning period › workspace, the ONE off-white
 *          element on the bar) + universal command field (⌘K / Ctrl K)
 *   auto   contextual create + account
 *
 * A restrained Signal pulse ("3 need you") has reserved space beside the
 * command field; it ships later and is deliberately NOT a bell.
 *
 * Contract: content/hq/decisions/product-header-contract.md (amended
 * 2026-07-17) + scripts/check-chrome-contract.mjs. The bar stays at
 * z-40; only overlays float above.
 */

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { STUDIO_URL } from "@/lib/product-urls";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import {
  STUDIO_CREATE_EVENT,
  STUDIO_PALETTE_EVENT,
  useStudioChrome,
  type StudioWorkspaceOption,
} from "./studio-chrome-context";

/* Charcoal chrome canon (rail icon-system document) rides the
   --x-studio-* tokens in globals.css: chrome surface, raised popover,
   soft/quiet/bright ink steps, and the indigo accent off the ramp. */

function markCell() {
  return (
    <a
      href={STUDIO_URL}
      title="Signal Studio"
      className="flex h-full w-[60px] flex-none items-center justify-center border-r border-white/[0.07] outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
    >
      <span
        aria-hidden="true"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--x-studio-accent)]" />
      </span>
      <span className="sr-only">Signal Studio home</span>
    </a>
  );
}

function ChevronDown() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Workspace switcher — dark popover listbox. Desktop trigger is the
 * 248px cell; below md (where the cell and rail are hidden) a compact
 * chevron trigger beside the capsule keeps switching reachable.
 */
function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  compact = false,
}: {
  workspaces: readonly StudioWorkspaceOption[];
  activeWorkspaceId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: string) {
    setOpen(false);
    if (id === activeWorkspaceId) return;
    startTransition(async () => {
      await selectWorkspaceAction(id);
      router.refresh();
    });
  }

  return (
    <div
      ref={wrapRef}
      className={
        compact
          ? "relative h-full md:hidden"
          : "relative hidden h-full w-[248px] flex-none border-r border-white/[0.07] md:block"
      }
    >
      {compact ? (
        <button
          type="button"
          aria-label="Switch workspace"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full w-8 items-center justify-center text-[var(--x-studio-ink-quiet)] outline-none transition-colors hover:text-[var(--x-studio-ink)] focus-visible:text-[var(--x-studio-ink)] disabled:cursor-wait disabled:opacity-60"
        >
          <ChevronDown />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full w-full items-center gap-2 px-4 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
          title="Switch workspace"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-none text-[var(--x-studio-ink-mid)]">
            {active?.name ?? "Workspace"}
          </span>
          <span className="flex-none text-[var(--x-studio-ink-quiet)]">
            <ChevronDown />
          </span>
        </button>
      )}
      {open ? (
        <div
          role="listbox"
          aria-label="Switch workspace"
          className={
            "absolute top-full z-50 mt-1 w-[248px] overflow-hidden rounded-lg border border-white/[0.08] bg-[var(--x-studio-chrome-raised)] py-1 shadow-[0_24px_56px_-20px_rgba(0,0,0,0.65)] " +
            (compact ? "-left-32" : "left-2")
          }
        >
          {workspaces.map((w) => {
            const isActive = w.id === activeWorkspaceId;
            return (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => choose(w.id)}
                className={
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] outline-none transition-colors " +
                  (isActive
                    ? "font-medium text-[var(--x-studio-ink-strong)]"
                    : "text-[var(--x-studio-ink-soft)] hover:bg-white/[0.06] hover:text-[var(--x-studio-ink)] focus-visible:bg-white/[0.06]")
                }
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {isActive ? (
                  <span className="flex-none text-[var(--x-studio-accent)]">
                    <CheckGlyph />
                  </span>
                ) : null}
              </button>
            );
          })}
          <div className="mx-3 my-1 border-t border-white/[0.08]" />
          <a
            href="/app/your-work"
            className="flex w-full items-center px-3 py-2 text-[12px] text-[var(--x-studio-ink-soft)] outline-none transition-colors hover:bg-white/[0.06] hover:text-[var(--x-studio-ink)] focus-visible:bg-white/[0.06]"
          >
            Your work, across workspaces
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** ⌘K on Apple platforms, Ctrl K elsewhere. Server renders ⌘K; the
 *  client snapshot corrects it during hydration without a set-state. */
const subscribeNever = () => () => {};
function useCommandKeyLabel(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

export function StudioBar() {
  const { data } = useStudioChrome();
  const keyLabel = useCommandKeyLabel();

  return (
    <header
      role="banner"
      className="relative z-40 flex h-10 w-full flex-none items-stretch bg-[var(--x-studio-chrome)]"
    >
      {markCell()}

      {data ? (
        <WorkspaceSwitcher
          workspaces={data.workspaces}
          activeWorkspaceId={data.activeWorkspaceId}
        />
      ) : (
        <div
          aria-hidden="true"
          className="hidden h-full w-[248px] flex-none items-center border-r border-white/[0.07] px-4 md:flex"
        >
          <span className="h-2 w-24 animate-pulse rounded bg-white/[0.08]" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 md:px-4">
        {/* Scope capsule retired (T·97): the workspace name reads in the
            switcher cell and the brief's title; the capsule was redundant.
            The compact switcher stays as the mobile workspace control. */}
        {data ? (
          <WorkspaceSwitcher
            compact
            workspaces={data.workspaces}
            activeWorkspaceId={data.activeWorkspaceId}
          />
        ) : null}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_PALETTE_EVENT))}
          className="hidden h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 text-left outline-none transition-colors hover:border-white/[0.14] hover:bg-white/[0.07] focus-visible:border-[var(--x-studio-accent)] md:flex md:max-w-[430px]"
        >
          <svg
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="flex-none text-[var(--x-studio-ink-quiet)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* soft ink (not quiet): placeholder + kbd are real text on the
              raised field surface and must hold ≥4.5:1 for the Axe gate. */}
          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--x-studio-ink-soft)]">
            Search, jump or create…
          </span>
          <kbd className="flex h-[17px] flex-none select-none items-center rounded border border-white/[0.12] px-1 font-mono text-[9.5px] tracking-[0.02em] text-[var(--x-studio-ink-soft)]">
            {keyLabel}
          </kbd>
        </button>

        {/* Reserved: the restrained Signal pulse ("3 need you") docks here
            when it ships. Deliberately empty space, deliberately no bell. */}
        <span
          aria-hidden="true"
          data-slot="signal-pulse"
          className="hidden w-10 flex-none xl:block"
        />
      </div>

      <div className="flex flex-none items-center gap-2 pr-3">
        <button
          type="button"
          title="New task (C)"
          onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_CREATE_EVENT))}
          className="flex h-8 flex-none items-center gap-1.5 rounded-md border border-white/[0.09] bg-white/[0.06] px-2.5 text-[12px] font-medium text-[var(--x-studio-ink)] outline-none transition-colors hover:border-white/[0.14] hover:bg-white/[0.1] focus-visible:border-[var(--x-studio-accent)]"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden sm:block">New task</span>
        </button>
        {/* Quiet raised ring, the rail-account-chip register: the Clerk
            avatar keeps its menu; the chrome supplies the frame. */}
        <span className="flex flex-none items-center rounded-full bg-white/[0.06] p-px ring-1 ring-white/[0.12]">
          <UserButtonWithSuite current="tasks" />
        </span>
      </div>
    </header>
  );
}
