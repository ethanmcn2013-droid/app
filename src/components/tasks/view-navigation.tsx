"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { TasksViewId } from "@/lib/product-urls";

const ViewNavigation = createContext<{ view: TasksViewId; navigate: (href: string) => void } | null>(null);

/** Native history is integrated with Next's pathname hooks without requesting
 * a new page payload. The verified project and its Tasks providers stay mounted. */
export function TasksViewNavigation({ initialView, children }: { initialView: TasksViewId; children: ReactNode }) {
  const pathname = usePathname();
  const view: TasksViewId = pathname === "/app/tasks/list" ? "list" : pathname === "/app/tasks/calendar" ? "calendar" : pathname === "/app/tasks" ? "board" : initialView;
  return <ViewNavigation.Provider value={{ view, navigate: (href) => {
    const current = new URL(window.location.href);
    const next = new URL(href, current);
    // Keep the server snapshot's explicit/ambient representation stable.
    // Adding an explicit Project to a bare route would make the existing
    // RouteSync proof disagree with the URL even though its Project is unchanged.
    if (!current.searchParams.has("workspaceId")) next.searchParams.delete("workspaceId");
    window.history.pushState(null, "", `${next.pathname}${next.search}${next.hash}`);
  } }}>{children}</ViewNavigation.Provider>;
}

export function useTasksViewNavigation() {
  const value = useContext(ViewNavigation);
  if (!value) throw new Error("Tasks view navigation requires its workspace");
  return value;
}
