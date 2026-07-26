"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app/sidebar";
import { RoomToolsProvider } from "@/components/app/room/room-tools-context";
import type { ProjectsTreeData } from "@/server/actions/projects-tree";

function isTasksSurface(pathname: string): boolean {
  return (
    !pathname.startsWith("/app/notes") &&
    !pathname.startsWith("/app/timeline") &&
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
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--paper)]"
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
