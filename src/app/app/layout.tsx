import { Suspense } from "react";
import { ClerkRuntimeProvider } from "@/components/clerk-runtime-provider";
import { MobileSuiteNav } from "@/components/app/mobile-suite-nav";
import { ProductWorkspaceShell } from "@/components/app/product-workspace-shell";
import { SuiteChromeGate } from "@/components/app/suite-chrome-gate";
import { SuiteCommandRoot } from "@/components/app/suite-command-root";
import { SuiteLoading } from "@/components/app/suite-loading";
import { StudioBar } from "@/components/studio-bar/studio-bar";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import { StudioChromeProvider } from "@/components/studio-bar/studio-chrome-context";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccessTasks } from "@/server/app-access";

export const dynamic = "force-dynamic";

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

const SKIP_LINK_CLASS =
  "fixed left-3 top-3 z-[200] -translate-y-[calc(100%+1rem)] rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg outline-none transition-transform focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-[var(--x-studio-accent)] focus-visible:ring-offset-2";

/**
 * Shared Signal Studio application frame.
 *
 * This boundary deliberately owns only common access and chrome. Tasks data,
 * providers, first-run logic, panels, and project navigation live in the
 * Tasks-only nested runtime so one product cannot block its siblings.
 *
 * One tree, always. The chrome-free surfaces (today the Timeline owner
 * preview) are handled by SuiteChromeGate, a client component that withholds
 * the navigation on those paths. Branching the tree here instead would look
 * simpler and be wrong: this layout is a server component shared by every /app
 * route, so it does not run again on a client navigation, and whichever branch
 * the first document happened to take would then be stuck for the rest of the
 * session. Everything the gate does not wrap — the access gate, the main
 * landmark, the skip link — is identical on every route, which is why Tasks
 * and Notes see no change at all.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = (
    <StudioChromeProvider>
      <div className="flex h-dvh w-full flex-col bg-[var(--paper)]">
        <a href="#app-main-content" className={SKIP_LINK_CLASS}>
          Skip to main content
        </a>
        <SuiteChromeGate>
          <StudioBar />
        </SuiteChromeGate>
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <SuiteChromeGate>
            <StudioRail />
          </SuiteChromeGate>
          <Suspense fallback={<SuiteLoading />}>
            <SharedAppGate>
              <ProductWorkspaceShell>{children}</ProductWorkspaceShell>
            </SharedAppGate>
          </Suspense>
        </div>
        <SuiteChromeGate>
          <MobileSuiteNav />
          <SuiteCommandRoot />
        </SuiteChromeGate>
      </div>
    </StudioChromeProvider>
  );

  return isDemoMode() ? shell : <ClerkRuntimeProvider>{shell}</ClerkRuntimeProvider>;
}
