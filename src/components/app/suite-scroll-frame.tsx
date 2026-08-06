"use client";

import { usePathname } from "next/navigation";
import { isBareChromePath } from "@/lib/bare-artifact-path";

/**
 * Who scrolls: the document, or the app frame.
 *
 * Every /app route is an application window. It is exactly one viewport tall,
 * it never lets the document scroll, and the product canvas inside it owns a
 * scroll container of its own. That is right for Tasks, Notes and the Timeline
 * owner views, where the chrome must hold still while the work moves.
 *
 * It is wrong for the chrome-free surfaces. The Timeline owner preview exists
 * to show the page an audience receives, and that page lives at /s/[token],
 * outside /app, where the document scrolls freely and the artifact is as tall
 * as its content. Nesting the same artifact inside a fixed-height frame gave
 * it a height it never asked for: `.artifact` carries an explicit
 * `min-height: 100dvh`, which overrides the automatic content minimum a flex
 * item would otherwise keep, so the frame squashed it to one viewport and
 * `overflow: clip` silently cut everything below the fold — six of nine
 * milestones, the whole detail panel and the footer at 390x844, with no scroll
 * bar anywhere to hint that they existed. Preview showed the owner a different
 * page from the one their guests get, which is the one thing preview may never
 * do.
 *
 * So on those paths the frame releases: the shell grows with its content and
 * the document scrolls, exactly as the public route does.
 *
 * Client components on purpose, for the same reason SuiteChromeGate is one:
 * the /app layout is a server component that runs on a document request and
 * not again, so a decision it made from a request header would stick for the
 * life of the document and be wrong the moment someone soft-navigates in or
 * out of the preview. `usePathname` re-evaluates on every client navigation.
 *
 * Non-bare routes get byte-identical class strings to the ones the layout used
 * before, so Tasks, Notes and every other /app surface are untouched.
 */

export function useBareChromeRoute(): boolean {
  return isBareChromePath(usePathname() ?? "");
}

/** The outer /app shell: one viewport tall, or as tall as the artifact. */
export function SuiteScrollFrame({ children }: { children: React.ReactNode }) {
  const bare = useBareChromeRoute();
  return (
    <div
      className={
        bare
          ? "flex min-h-dvh w-full flex-col bg-[var(--paper)]"
          : "flex h-dvh w-full flex-col bg-[var(--paper)]"
      }
      data-suite-frame={bare ? "document-scroll" : "app-window"}
    >
      {children}
    </div>
  );
}

/** The row that holds the product rail beside the product canvas. */
export function SuiteScrollFrameBody({ children }: { children: React.ReactNode }) {
  const bare = useBareChromeRoute();
  return (
    <div
      className={
        bare
          ? "flex min-w-0 flex-1"
          : "flex min-h-0 min-w-0 flex-1 overflow-hidden"
      }
    >
      {children}
    </div>
  );
}
