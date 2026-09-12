import { Suspense } from "react";
import { ClerkRuntimeProvider } from "@/components/clerk-runtime-provider";
import { MobileSuiteNav } from "@/components/app/mobile-suite-nav";
import { ProductWorkspaceShell } from "@/components/app/product-workspace-shell";
import { SuiteChromeGate } from "@/components/app/suite-chrome-gate";
import {
  SuiteScrollFrame,
  SuiteScrollFrameBody,
} from "@/components/app/suite-scroll-frame";
import { SuiteCommandRoot } from "@/components/app/suite-command-root";
import { SuiteLoading } from "@/components/app/suite-loading";
import { ThemeRuntime } from "./theme-runtime";
import { StudioBar } from "@/components/studio-bar/studio-bar";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import { StudioChromeProvider } from "@/components/studio-bar/studio-chrome-context";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccessTasks } from "@/server/app-access";
import { ActiveProjectProvider } from "@/components/app/active-project-provider";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import { readActiveProjectCookies } from "@/server/projects/active-project-cookie";
import { PAPER_LIGHT, PAPER_DARK } from "@/lib/document-paper";
import type { Viewport } from "next";

export const dynamic = "force-dynamic";

/**
 * The browser's own chrome, on the one segment that has two themes.
 *
 * Everything else the resolver reaches lives inside the document; the
 * phone's address bar does not, so it stayed white above a dark app. Next
 * merges viewport exports shallowly, so this replaces the root's single
 * theme-color for /app routes only and leaves width, initialScale and
 * viewportFit exactly as the root set them.
 *
 * KNOWN GAP, stated rather than hidden: a media query can only ask the
 * operating system, and this app's theme is a user CHOICE that defaults to
 * following the system. A user who has explicitly picked light on a dark
 * phone (or the reverse) gets a browser bar that disagrees with their
 * document. Closing that would mean reading the preference per request in
 * generateViewport — a database round-trip in front of every /app document,
 * which is the exact cost theme-runtime.tsx is built to avoid. Right for
 * everyone on "system", which is the default and the majority, and never
 * worse than the white bar it replaces.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAPER_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: PAPER_DARK },
  ],
};

async function SharedAppGate({ children }: { children: React.ReactNode }) {
  // Was requireAppAccess(), which is allowlist-only. That bounced every invited
  // and every redeemed user to /waitlist after their token had already been
  // burned — the exact failure app-access.ts was written to prevent, and which
  // its own header comment describes. The membership-aware gate was wired only
  // inside the nested Tasks shell, so this outer gate fired first and won.
  //
  // requireAppAccessTasks is a strict superset: same allowlist fast path, plus
  // a fallback for a user holding a workspace_members row. Both routes in
  // create that row — invite acceptance directly, and redemption via
  // ensureUserProvisioned(), which comp.ts calls before writing the entitlement
  // — so this covers the sponsored couple as well as the invited collaborator.
  await requireAppAccessTasks();
  return children;
}

/**
 * Active Project V3 mount point (WP2, plan §3.4).
 *
 * Off by default and byte-identical when off: the flag path returns `children`
 * untouched, so no provider, no context, and no extra client module reach the
 * tree. On, it mounts the shared provider here — at the `/app` shell, above
 * the chrome — with a **cheap validated-cookie bootstrap only**. No membership
 * query runs to render chrome: the bootstrap is a bare-entry preference, and
 * the provider's projection is written so it can never be painted as a Project
 * name. The authoritative Project arrives per route, from the server, through
 * `ActiveProjectRouteSync`.
 *
 * The legacy `tasks_active_ws` value is accepted as the bootstrap when the
 * unified cookie is absent — the migration read that ADR 0001 §4 step 3
 * requires, and the reason nobody's last-active preference is lost on cutover.
 */
async function ActiveProjectRuntime({ children }: { children: React.ReactNode }) {
  if (!isActiveProjectV3Enabled()) return children;
  const { unified, legacy } = await readActiveProjectCookies();
  return (
    <ActiveProjectProvider enabled bootstrapProjectId={unified ?? legacy}>
      {children}
    </ActiveProjectProvider>
  );
}

const SKIP_LINK_CLASS =
  // The label rides an --ink fill, so it takes --paper, not white: in dark
  // the fill IS near-white, and a white label on it is invisible. The first
  // control a keyboard user reaches is not a place to get that wrong.
  "fixed left-3 top-3 z-[200] -translate-y-[calc(100%+1rem)] rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)] shadow-lg outline-none transition-transform focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-[var(--x-studio-accent)] focus-visible:ring-offset-2";

/**
 * Shared Signal Studio application frame.
 *
 * This boundary deliberately owns only common access and chrome. Tasks data,
 * providers, first-run logic, panels, and project navigation live in the
 * Tasks-only nested runtime so one product cannot block its siblings.
 *
 * One tree, always. The chrome-free surfaces (today the Timeline owner
 * preview) are handled by SuiteChromeGate, a client component that withholds
 * the navigation on those paths, and by SuiteScrollFrame, which releases the
 * one-viewport window so the document scrolls the way the public /s/[token]
 * route does. Branching the tree here instead would look simpler and be wrong:
 * this layout is a server component shared by every /app route, so it does not
 * run again on a client navigation, and whichever branch the first document
 * happened to take would then be stuck for the rest of the session. Everything
 * the gates do not wrap — the access gate, the main landmark, the skip link —
 * is identical on every route, which is why Tasks and Notes see no change at
 * all.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = (
    <StudioChromeProvider>
      {/* First thing in the /app document body: the theme resolves before the
          app paints, and only documents that render THIS layout carry it. */}
      <ThemeRuntime />
      <ActiveProjectRuntime>
        <SuiteScrollFrame>
          <a href="#app-main-content" className={SKIP_LINK_CLASS}>
            Skip to main content
          </a>
          <SuiteChromeGate>
            <StudioBar />
          </SuiteChromeGate>
          <SuiteScrollFrameBody>
            <SuiteChromeGate>
              <StudioRail />
            </SuiteChromeGate>
            <Suspense fallback={<SuiteLoading />}>
              <SharedAppGate>
                <ProductWorkspaceShell>{children}</ProductWorkspaceShell>
              </SharedAppGate>
            </Suspense>
          </SuiteScrollFrameBody>
          <SuiteChromeGate>
            <MobileSuiteNav />
            <SuiteCommandRoot />
          </SuiteChromeGate>
        </SuiteScrollFrame>
      </ActiveProjectRuntime>
    </StudioChromeProvider>
  );

  return isDemoMode() ? shell : <ClerkRuntimeProvider>{shell}</ClerkRuntimeProvider>;
}
