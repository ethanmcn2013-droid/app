/**
 * One create button per screen (founder, 6 Oct 2026): the top bar's New owns
 * creation, and what it starts follows the page you are on. Pure, so the
 * rule can be tested directly.
 */
import { AUTOMATIONS_APP_PATH } from "@/lib/product-urls";

export type CreateKind = "task" | "project" | "automation";

export const CREATE_LABEL: Readonly<Record<CreateKind, string>> = {
  task: "New task",
  project: "New project",
  automation: "New automation",
};

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** On Automations an automation, on Projects a project, otherwise a task. */
export function createKindForPath(pathname: string): CreateKind {
  if (under(pathname, AUTOMATIONS_APP_PATH)) return "automation";
  if (under(pathname, "/app/project") || under(pathname, "/app/archived")) return "project";
  return "task";
}

/** The Projects page opens its new-project form when it hears this. */
export const SHELL_CREATE_PROJECT_EVENT = "signal:create-project";
/** Set on <html> while the Projects page is listening. */
export const CREATE_PROJECT_READY_ATTRIBUTE = "data-create-project-ready";
/** Where to go when it is not: the page opens the form on arrival. */
export const CREATE_PROJECT_HREF = "/app/project?create=project";
/** The top bar's create button, so a closed form can hand focus back to it. */
export const SHELL_CREATE_ATTRIBUTE = "data-shell-create";

export function focusShellCreate(): void {
  document.querySelector<HTMLElement>(`[${SHELL_CREATE_ATTRIBUTE}]`)?.focus({ preventScroll: true });
}
