"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app/sidebar";
import { RoomToolsProvider } from "@/components/app/room/room-tools-context";
import { useBareChromeRoute } from "@/components/app/suite-scroll-frame";
import type { ProjectsTreeData } from "@/server/actions/projects-tree";

function isTasksSurface(pathname: string): boolean {
  return (
    !pathname.startsWith("/app/notes") &&
    !pathname.startsWith("/app/timeline") &&
    // Home and the Full Briefing are module canvases, not Tasks surfaces:
    // they take the module <main id="app-main-content"> landmark below
    // (Signal → Home consolidation; /app/signal stays for the redirects).
    !pathname.startsWith("/app/home") &&
    !pathname.startsWith("/app/signal")
  );
}

export function ProductWorkspaceShell({
  activeWorkspaceId,
  tree,
  children,
}: {
  activeWorkspaceId?: string;
  tree?: ProjectsTreeData;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const tasksSurface = isTasksSurface(pathname);
  // The chrome-free surfaces let the document scroll instead of holding a
  // scroll container of their own — see suite-scroll-frame.tsx. A canvas that
  // kept `overflow-y-auto` here would re-impose the one-viewport height the
  // frame just released, and the artifact's own `overflow: clip` would go on
  // cutting its content off below the fold.
  const bareChrome = useBareChromeRoute();

  // The shared /app layout calls this component without Tasks data. Let the
  // nested Tasks runtime provide its own sidebar/providers/main landmark.
  if (tasksSurface && (!activeWorkspaceId || !tree)) {
    return <>{children}</>;
  }

  if (!tasksSurface) {
    return (
      <main
        id="app-main-content"
        tabIndex={-1}
        className={
          bareChrome
            ? "flex min-w-0 flex-1 flex-col bg-[var(--paper)]"
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--paper)]"
        }
        data-product-canvas="module"
      >
        {children}
      </main>
    );
  }

  if (!activeWorkspaceId || !tree) {
    return <>{children}</>;
  }

  return (
    <RoomToolsProvider>
      <AppSidebar activeWorkspaceId={activeWorkspaceId} tree={tree} />
      <main
        id="app-main-content"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--x-task-canvas)_72%,var(--x-task-surface))] pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
        data-product-canvas="tasks"
      >
        {children}
      </main>
    </RoomToolsProvider>
  );
}
