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
  activeWorkspaceId: string;
  tree: ProjectsTreeData;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const tasksSurface = isTasksSurface(pathname);

  return (
    <RoomToolsProvider>
      {tasksSurface ? (
        <AppSidebar activeWorkspaceId={activeWorkspaceId} tree={tree} />
      ) : null}
      <main
        className={
          tasksSurface
            ? "flex min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--x-task-canvas)_72%,var(--x-task-surface))] pb-[60px] md:pb-0"
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-white"
        }
        data-product-canvas={tasksSurface ? "tasks" : "module"}
      >
        {children}
      </main>
    </RoomToolsProvider>
  );
}
