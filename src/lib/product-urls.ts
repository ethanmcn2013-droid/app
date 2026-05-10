export const TASKS_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tasks.signalstudio.ie";

export const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? "https://signalstudio.ie";

export const ROADMAP_URL =
  process.env.NEXT_PUBLIC_ROADMAP_URL ?? "https://roadmap.signalstudio.ie";

export const ANALYTICS_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_URL ?? "https://analytics.signalstudio.ie";

export const NOTES_URL =
  process.env.NEXT_PUBLIC_NOTES_URL ?? "https://notes.signalstudio.ie";

export const CONTACT_EMAIL = "hello@signalstudio.ie";

export const TASKS_DOMAIN = new URL(TASKS_URL).hostname;

export function taskUrl(path = ""): string {
  if (!path) return TASKS_URL;
  return `${TASKS_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
