import suiteContracts from "./suite-contracts.v1.json";

export type ProductId = "notes" | "tasks" | "timeline" | "signal";

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
    tasks: "/app/board",
    timeline: "/app/plan",
    signal: "/app/brief",
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
  process.env.NEXT_PUBLIC_TIMELINE_URL ??
  suiteProducts.timeline.publicOrigin;

export const STUDIO_URL = STUDIO_ORIGIN;
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL ?? `${STUDIO_ORIGIN}/ios`;
export const CONTACT_EMAIL = "hello@signalstudio.ie";
export const APP_DOMAIN = new URL(APP_ORIGIN).hostname;
export const TASKS_PUBLIC_DOMAIN = new URL(TASKS_PUBLIC_ORIGIN).hostname;

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
