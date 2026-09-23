import { TASKS_VIEW_PATHS, type TasksViewId } from "@/lib/product-urls";

/** Only the four canonical task views own board sharing, exports and view tabs. */
export function pageHeaderTaskView(pathname: string | null): TasksViewId | null {
  for (const view of Object.keys(TASKS_VIEW_PATHS) as TasksViewId[]) {
    if (pathname === TASKS_VIEW_PATHS[view]) return view;
  }
  return null;
}

export function pageHeaderTitle(pathname: string | null, projectName: string): string {
  if (pathname === "/app/settings" || pathname?.startsWith("/app/settings/")) return "Settings";
  if (pathname === "/app/inbox") return "Inbox";
  if (pathname === "/app/my-tasks") return "My work";
  if (pathname === "/app/archived") return "Archived";
  return projectName;
}
