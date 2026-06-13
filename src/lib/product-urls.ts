export const TASKS_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tasks.signalstudio.ie";

export const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://signalstudio.ie";

export const TIMELINE_URL =
  process.env.NEXT_PUBLIC_TIMELINE_URL ?? "https://timeline.signalstudio.ie";

export const SIGNAL_URL =
  process.env.NEXT_PUBLIC_SIGNAL_URL ?? "https://signal.signalstudio.ie";

export const NOTES_URL =
  process.env.NEXT_PUBLIC_NOTES_URL ?? "https://notes.signalstudio.ie";

export const CONTACT_EMAIL = "hello@signalstudio.ie";

export const TASKS_DOMAIN = new URL(TASKS_URL).hostname;

export function taskUrl(path = ""): string {
  if (!path) return TASKS_URL;
  return `${TASKS_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Marketing deep link — pre-selects onboarding segment after sign-up. */
export function tasksSignUpUrl(useCase?: string | null): string {
  if (!useCase) return `${TASKS_URL}/sign-up`;
  return `${TASKS_URL}/sign-up?use=${encodeURIComponent(useCase)}`;
}

export function tasksWelcomeUrl(useCase?: string | null): string {
  if (!useCase) return `${TASKS_URL}/welcome`;
  return `${TASKS_URL}/welcome?use=${encodeURIComponent(useCase)}`;
}
