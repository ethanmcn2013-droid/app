"use client";

/**
 * Studio Bar — the permanent production top chrome (T·94, 2026-07-17;
 * Phase 1 header cleanup 2026-07-18).
 *
 * Neutral black (the canonical rail charcoal, --x-studio-chrome), visually
 * continuous with the 60px product rail below-left so bar + rail draw a
 * deliberate L-shaped Signal Studio frame around the white working canvas.
 *
 * Column grid, aligned to the shell below it:
 *   60px   Signal Studio mark (over the product rail)
 *   248px  static "Tasks" wordmark + optional licence-edition slot (over the
 *          sidebar). Phase 1: the workspace/project *dropdown* that used to
 *          live here was removed — workspace switching now lives in the
 *          Projects sidebar and the ⌘K palette, so the upper-left reads as
 *          the product, not a stray project picker. No chevron, no menu.
 *   1fr    left-anchored universal command field with a reserved Signal
 *          pulse slot at the far edge
 *   auto   contextual create + mobile account
 *
 * Mobile touch targets are written in pixels, not scale steps. The suite
 * design tokens remap Tailwind's numeric spacing scale onto the semantic
 * base-4 steps in src/ds/tokens.css, so `h-11` resolves to --space-11 (80px),
 * not the 44px it means in stock Tailwind — an 80px control inside this 56px
 * bar overflows it top and bottom. Below md, use h-[44px] / min-h-[44px].
 *
 * Contract: content/hq/decisions/product-header-contract.md +
 * scripts/check-chrome-contract.mjs. The bar stays at z-40; only overlays
 * float above. The contract tokens (h-10, --x-studio-chrome, z-40,
 * w-[60px] mark cell, w-[248px] identity cell, signal-pulse slot) are all
 * preserved. The command-led treatment is the selected Signal Frame B
 * direction: search sits with the work, while the create action closes the
 * bar at the far right.
 */

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  PRODUCT_APP_PATHS,
  STUDIO_URL,
  productIdFromAppPath,
  type ProductId,
} from "@/lib/product-urls";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { StudioBarSearch } from "./studio-bar-search";
import {
  STUDIO_CREATE_EVENT,
  STUDIO_PALETTE_EVENT,
  useStudioChrome,
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

/**
 * Module identity for the 248px cell: the wordmark follows the ACTIVE module
 * (unified app, Phase 9) using the exact approved wordmark treatment — only
 * the string and its home link change. Tasks remains the default for all
 * Tasks-owned routes.
 */
const MODULE_LABELS: Readonly<Record<ProductId, string>> = Object.freeze({
  notes: "Notes",
  tasks: "Tasks",
  timeline: "Timeline",
  signal: "Signal",
});

function activeModuleIdentity(pathname: string): { word: string; home: string; label: string } {
  const productId = productIdFromAppPath(pathname);
  return {
    word: productId,
    home: PRODUCT_APP_PATHS[productId],
    label: MODULE_LABELS[productId],
  };
}

/**
 * Module wordmark + licence-edition slot. Occupies the 248px
 * identity cell over the sidebar. The wordmark is a plain link to the
 * active module's home (no dropdown behaviour, no chevron); the edition
 * label renders only when the account carries a named edition (bound to
 * real entitlement data — see editionLabel()), otherwise the slot is empty.
 */
function IdentityCell({ edition }: { edition: string | null }) {
  const pathname = usePathname();
  const identity = activeModuleIdentity(pathname ?? "");
  return (
    <div className="flex h-full min-w-0 flex-none items-center gap-2.5 border-r border-white/[0.07] px-3 md:w-[248px] md:px-4">
      <a
        href={identity.home}
        aria-label={identity.label}
        className="inline-flex min-h-[44px] flex-none select-none items-center rounded text-[20px] font-semibold lowercase leading-none text-[var(--x-studio-ink-strong)] outline-none transition-colors hover:text-white focus-visible:text-white md:min-h-0 md:text-[24px] md:pointer-coarse:min-h-[44px]"
        style={{ letterSpacing: "-0.045em" }}
      >
        {identity.word}
      </a>
      {edition ? (
        <span
          className="flex-none truncate rounded-full border border-white/[0.14] bg-white/[0.06] px-2 py-[3px] text-[10px] font-medium leading-none text-[var(--x-studio-ink-soft)]"
          title={`${edition} licence`}
        >
          {edition}
        </span>
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
  const pathname = usePathname() ?? "";
  const activeProduct = productIdFromAppPath(pathname);
  const tasksSurface =
    !pathname.startsWith("/app/notes") &&
    !pathname.startsWith("/app/timeline") &&
    !pathname.startsWith("/app/signal");
  const commandLabel = tasksSurface
    ? "Search tasks and projects"
    : "Search Signal Studio";

  return (
    // Bar *height* stays on the numeric scale on purpose. On this scale h-10
    // is 64px, not the 40px the chrome contract names, and h-11 is 80px — but
    // the bar's own controls (h-8 → 40px) are inflated by the same factor, so
    // dropping the shell to a literal 40px/44px without moving its contents
    // leaves the controls flush against the edges. Shell and contents have to
    // move together; that is the --spacing-* remap fix, not a local patch.
    // Tap targets *inside* the bar are absolute and were fixed to 44px.
    <header
      role="banner"
      className="relative z-40 flex h-14 w-full flex-none items-stretch bg-[var(--x-studio-chrome)] md:h-10 md:pointer-coarse:h-11"
    >
      {markCell()}

      <IdentityCell edition={data?.edition ?? null} />

      {/* Selected Signal Frame B: the command field begins where the working
          canvas begins instead of hiding in the far-right action cluster. */}
      <div className="flex min-w-0 flex-1 items-center px-3 md:px-6">
        <button
          type="button"
          aria-label={commandLabel}
          data-slot="command-field"
          onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_PALETTE_EVENT))}
          className="hidden h-8 w-full max-w-[480px] min-w-0 items-center gap-2.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 text-left outline-none transition-[background-color,border-color,transform] duration-150 hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.99] focus-visible:border-[var(--x-studio-accent)] md:flex pointer-coarse:h-[44px]"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="flex-none text-[var(--x-studio-ink-quiet)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--x-studio-ink-soft)]">
            {commandLabel}…
          </span>
          <kbd className="flex h-[18px] flex-none select-none items-center rounded border border-white/[0.12] px-1 font-mono text-[10px] tracking-[0.02em] text-[var(--x-studio-ink-soft)]">
            {keyLabel}
          </kbd>
        </button>

        {/* The reserved Signal pulse ("3 need you") keeps its contractual
            slot at the far edge — deliberately empty, deliberately no bell. */}
        <span
          aria-hidden="true"
          data-slot="signal-pulse"
          className="ml-auto hidden w-10 flex-none xl:block"
        />
      </div>

      <div className="flex flex-none items-center gap-2 pr-3">
        {/* Search-Expand affordance below md, where the full field is hidden:
            the icon morphs into an inline field that seeds the palette. */}
        <StudioBarSearch label={commandLabel} />

        {tasksSurface ? (
          <button
            type="button"
            aria-keyshortcuts="c"
            title="Add task (C)"
            onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_CREATE_EVENT))}
            className="flex h-[44px] min-w-[44px] flex-none items-center justify-center gap-2 rounded-md border border-[var(--x-studio-ink-strong)] bg-[var(--x-studio-ink-strong)] px-2.5 text-[13px] font-semibold text-[var(--x-studio-chrome)] outline-none transition-[background-color,border-color,transform] duration-150 hover:border-white hover:bg-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--x-studio-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--x-studio-chrome)] md:h-8 md:min-w-0 md:px-3 md:pointer-coarse:h-[44px] md:pointer-coarse:min-w-[44px]"
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
            <span className="hidden sm:block">Add task</span>
            <kbd className="hidden h-[18px] items-center rounded border border-black/15 px-1 font-mono text-[10px] font-medium text-zinc-600 lg:flex">
              C
            </kbd>
          </button>
        ) : null}
        {/* Account avatar. On desktop (md+) it lives at the foot of the
            product rail (bottom-left of the L-frame); here it renders only
            below md, where the rail is hidden and the bar owns account
            access. Quiet raised ring keeps the rail-account-chip register. */}
        <span className="flex flex-none items-center rounded-full bg-white/[0.06] p-px ring-1 ring-white/[0.12] md:hidden">
          <UserButtonWithSuite current={activeProduct} />
        </span>
      </div>
    </header>
  );
}
