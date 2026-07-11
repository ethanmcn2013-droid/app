import suiteContracts from "./suite-contracts.v1.json";

const suiteProducts = suiteContracts.products;

export const TASKS_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? suiteProducts.tasks.canonicalUrl;

export const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? suiteProducts.studio.canonicalUrl;

export const TIMELINE_URL =
  process.env.NEXT_PUBLIC_TIMELINE_URL ?? suiteProducts.timeline.canonicalUrl;

export const SIGNAL_URL =
  process.env.NEXT_PUBLIC_SIGNAL_URL ?? suiteProducts.signal.canonicalUrl;

export const NOTES_URL =
  process.env.NEXT_PUBLIC_NOTES_URL ?? suiteProducts.notes.canonicalUrl;

export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL ?? "https://signalstudio.ie/ios";

export const CONTACT_EMAIL = "hello@signalstudio.ie";

export const TASKS_DOMAIN = new URL(TASKS_URL).hostname;

export function taskUrl(path = ""): string {
  if (!path) return TASKS_URL;
  return `${TASKS_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Marketing deep link, pre-selects onboarding segment after sign-up. */
export function tasksSignUpUrl(useCase?: string | null): string {
  if (!useCase) return `${TASKS_URL}/sign-up`;
  return `${TASKS_URL}/sign-up?use=${encodeURIComponent(useCase)}`;
}

export function tasksWelcomeUrl(useCase?: string | null): string {
  if (!useCase) return `${TASKS_URL}/welcome`;
  return `${TASKS_URL}/welcome?use=${encodeURIComponent(useCase)}`;
}
