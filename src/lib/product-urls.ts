import suiteContracts from "./suite-contracts.v1.json";

export type ProductId = "notes" | "tasks" | "timeline" | "signal";
export type TasksViewId = "board" | "list" | "timeline" | "calendar";

const suiteProducts = suiteContracts.products;

export const STUDIO_ORIGIN = (
  process.env.NEXT_PUBLIC_STUDIO_URL ?? suiteContracts.origins.marketing
).replace(/\/$/, "");

export const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL ??
  suiteContracts.origins.app
).replace(/\/$/, "");

export const PRODUCT_MARKETING_URLS: Readonly<Record<ProductId, string>> =
  Object.freeze({
    notes: `${STUDIO_ORIGIN}/notes`,
    tasks: `${STUDIO_ORIGIN}/tasks`,
    timeline: `${STUDIO_ORIGIN}/timeline`,
    signal: `${STUDIO_ORIGIN}/signal`,
  });

export const PRODUCT_APP_PATHS: Readonly<Record<ProductId, string>> =
  Object.freeze({
    notes: "/app/notes",
    tasks: "/app/tasks",
    timeline: "/app/timeline",
    signal: "/app/signal",
  });

/**
 * Canonical Tasks view destinations.
 *
 * Keep this map explicit: `/app/timeline` belongs to the Timeline product,
 * while the Tasks timeline view lives at `/app/tasks/timeline`.
 */
export const TASKS_VIEW_PATHS: Readonly<Record<TasksViewId, string>> =
  Object.freeze({
    board: PRODUCT_APP_PATHS.tasks,
    list: `${PRODUCT_APP_PATHS.tasks}/list`,
    timeline: `${PRODUCT_APP_PATHS.tasks}/timeline`,
    calendar: `${PRODUCT_APP_PATHS.tasks}/calendar`,
  });

export const PRODUCT_APP_URLS: Readonly<Record<ProductId, string>> =
  Object.freeze({
    notes: `${APP_ORIGIN}${PRODUCT_APP_PATHS.notes}`,
    tasks: `${APP_ORIGIN}${PRODUCT_APP_PATHS.tasks}`,
    timeline: `${APP_ORIGIN}${PRODUCT_APP_PATHS.timeline}`,
    signal: `${APP_ORIGIN}${PRODUCT_APP_PATHS.signal}`,
  });

export const TASKS_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_TASKS_PUBLIC_URL ??
  suiteProducts.tasks.publicOrigin;

export const TIMELINE_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_TIMELINE_SITE_URL ??
  suiteProducts.timeline.publicOrigin;

export const STUDIO_URL = STUDIO_ORIGIN;
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL ?? `${STUDIO_ORIGIN}/ios`;
export const CONTACT_EMAIL = "hello@signalstudio.ie";
export const APP_DOMAIN = new URL(APP_ORIGIN).hostname;
export const TASKS_PUBLIC_DOMAIN = new URL(TASKS_PUBLIC_ORIGIN).hostname;

/**
 * Home — the authenticated front door. Not a product: Notes, Tasks and
 * Timeline are the products; Home is where the system says what matters
 * now (Today's Signal), with the Full Briefing one level deeper. The
 * legacy /app/signal routes permanently redirect into the briefing.
 */
export const HOME_APP_PATH = "/app/home";
export const HOME_APP_URL = `${APP_ORIGIN}${HOME_APP_PATH}`;
export const BRIEFING_APP_PATH = `${HOME_APP_PATH}/briefing`;

/** The authenticated suite surfaces the shell can mark as current. */
export type SuiteSurfaceId = "home" | ProductId;

function ownsPath(pathname: string, productPath: string): boolean {
  return pathname === productPath || pathname.startsWith(`${productPath}/`);
}

/**
 * Resolve the active product from a signed-in app pathname.
 *
 * Tasks owns shared operational routes such as `/app/inbox` and
 * `/app/settings`; sibling modules own only their explicit namespaces.
 */
export function productIdFromAppPath(pathname: string): ProductId {
  for (const productId of ["notes", "timeline", "signal"] as const) {
    if (ownsPath(pathname, PRODUCT_APP_PATHS[productId])) return productId;
  }
  return "tasks";
}

/**
 * Resolve the active suite surface (Home included) from a signed-in app
 * pathname. Shell chrome (pills, mobile nav) should prefer this over
 * productIdFromAppPath so Home and the briefing mark Home as current.
 */
export function suiteSurfaceFromAppPath(pathname: string): SuiteSurfaceId {
  if (ownsPath(pathname, HOME_APP_PATH)) return "home";
  return productIdFromAppPath(pathname);
}

export function taskUrl(path = ""): string {
  if (!path) return APP_ORIGIN;
  return `${APP_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Marketing deep link, pre-selects onboarding segment after sign-up. */
export function tasksSignUpUrl(useCase?: string | null): string {
  if (!useCase) return `${APP_ORIGIN}/sign-up`;
  return `${APP_ORIGIN}/sign-up?use=${encodeURIComponent(useCase)}`;
}

export function tasksWelcomeUrl(useCase?: string | null): string {
  if (!useCase) return `${APP_ORIGIN}/welcome`;
  return `${APP_ORIGIN}/welcome?use=${encodeURIComponent(useCase)}`;
}

/** @deprecated Use an explicit app, public, or marketing contract. */
export const TASKS_URL = TASKS_PUBLIC_ORIGIN;
/** @deprecated Use APP_DOMAIN or TASKS_PUBLIC_DOMAIN explicitly. */
export const TASKS_DOMAIN = TASKS_PUBLIC_DOMAIN;
/** @deprecated Use TIMELINE_PUBLIC_ORIGIN for artifacts. */
export const TIMELINE_URL = TIMELINE_PUBLIC_ORIGIN;
/** @deprecated Use PRODUCT_MARKETING_URLS or PRODUCT_APP_URLS. */
export const SIGNAL_URL = PRODUCT_MARKETING_URLS.signal;
/** @deprecated Use PRODUCT_MARKETING_URLS or PRODUCT_APP_URLS. */
export const NOTES_URL = PRODUCT_MARKETING_URLS.notes;
