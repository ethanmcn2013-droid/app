/**
 * A signed-out visitor may resume only a known, local App page. This is a
 * navigation hint, never authorization; the destination still proves Clerk
 * identity, Project membership, and access to any selected Task.
 */
const STATIC_APP_PATHS = new Set([
  "/app", "/app/home", "/app/home/briefing", "/app/project",
  "/app/your-work", "/app/tasks", "/app/tasks/list",
  "/app/tasks/timeline", "/app/tasks/calendar", "/app/my-tasks",
  "/app/archived", "/app/messages", "/app/notes", "/app/timeline",
  "/app/inbox", "/app/settings", "/app/import",
]);
const FLOOR_PATHS = new Set([
  "/app/tasks", "/app/tasks/list", "/app/tasks/timeline", "/app/tasks/calendar",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const TASK_PATH = /^\/app\/task\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const TIMELINE_PATH = /^\/app\/timeline\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?:\/preview)?$/;
const AUDIENCE_PATH = /^\/app\/timeline\/audience\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function knownPath(pathname: string): boolean {
  return STATIC_APP_PATHS.has(pathname) || TASK_PATH.test(pathname) ||
    TIMELINE_PATH.test(pathname) || AUDIENCE_PATH.test(pathname);
}

function allowedQuery(pathname: string, key: string, value: string): boolean {
  if (key === "workspaceId") return SAFE_ID.test(value);
  if (key === "task" && FLOOR_PATHS.has(pathname)) return SAFE_ID.test(value);
  if (pathname === "/app/notes") {
    if (key === "view") return ["notebook", "review", "sent"].includes(value);
    if (key === "note") return SAFE_ID.test(value);
  }
  if (TIMELINE_PATH.test(pathname) && key === "mode") return value === "view" || value === "edit";
  if (pathname === "/app/home/briefing") {
    if (key === "contextVersion") return value === "2";
    if (key === "sourceProduct") return ["notes", "tasks", "timeline", "signal"].includes(value);
    if (key === "planningPeriodId") return SAFE_ID.test(value);
  }
  if (pathname === "/app/your-work" && key === "projectId") return SAFE_ID.test(value);
  return false;
}

export function appAuthReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) return null;
  if (!value.startsWith("/app") || value.startsWith("//") || /[\\#\u0000-\u001f\u007f]/.test(value)) return null;
  const question = value.indexOf("?");
  const pathname = question === -1 ? value : value.slice(0, question);
  const rawQuery = question === -1 ? "" : value.slice(question + 1);
  // Encoded separators, dots, and backslashes cannot change route identity.
  if (pathname.includes("%") || !knownPath(pathname) || rawQuery.includes("?")) return null;
  if (!rawQuery) return pathname;
  const params = new URLSearchParams(rawQuery);
  const seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key) || !allowedQuery(pathname, key, item)) return null;
    seen.add(key);
  }
  return `${pathname}?${params.toString()}`;
}

export function signInUrlForAppReturn(value: unknown): string {
  const path = appAuthReturnPath(value);
  return path ? `/sign-in?${new URLSearchParams({ redirect_url: path })}` : "/sign-in";
}
