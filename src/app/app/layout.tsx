import { Suspense } from "react";
import { ClerkRuntimeProvider } from "@/components/clerk-runtime-provider";
import { MobileSuiteNav } from "@/components/app/mobile-suite-nav";
import { ProductWorkspaceShell } from "@/components/app/product-workspace-shell";
import { SuiteCommandRoot } from "@/components/app/suite-command-root";
import { SuiteLoading } from "@/components/app/suite-loading";
import { StudioBar } from "@/components/studio-bar/studio-bar";
import { StudioRail } from "@/components/studio-bar/studio-rail";
import { StudioChromeProvider } from "@/components/studio-bar/studio-chrome-context";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccess } from "@/server/require-app-access";

export const dynamic = "force-dynamic";

async function SharedAppGate({ children }: { children: React.ReactNode }) {
  await requireAppAccess();
  return children;
}

/**
 * Shared Signal Studio application frame.
 *
 * This boundary deliberately owns only common access and chrome. Tasks data,
 * providers, first-run logic, panels, and project navigation live in the
 * Tasks-only nested runtime so one product cannot block its siblings.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = (
    <StudioChromeProvider>
      <div className="flex h-dvh w-full flex-col bg-[var(--paper)]">
        <a
          href="#app-main-content"
          className="fixed left-3 top-3 z-[200] -translate-y-[calc(100%+1rem)] rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg outline-none transition-transform focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-[var(--x-studio-accent)] focus-visible:ring-offset-2"
        >
          Skip to main content
        </a>
        <StudioBar />
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <StudioRail />
          <Suspense fallback={<SuiteLoading />}>
            <SharedAppGate>
              <ProductWorkspaceShell>{children}</ProductWorkspaceShell>
            </SharedAppGate>
          </Suspense>
        </div>
        <MobileSuiteNav />
        <SuiteCommandRoot />
      </div>
    </StudioChromeProvider>
  );

  return isDemoMode() ? shell : <ClerkRuntimeProvider>{shell}</ClerkRuntimeProvider>;
}
