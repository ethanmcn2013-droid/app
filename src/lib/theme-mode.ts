/**
 * The signed-in app's theme choice: Dark by default, Light on request
 * (founder instruction, 5 Oct 2026).
 *
 * The stored preference column keeps its three values and its default
 * ("system"), so no schema change carries this. A stored "system" now means
 * "never chose", and never chose means Dark. Only an explicit "light" is
 * light. The operating system's own scheme is no longer consulted.
 *
 * Client-safe on purpose: the server resolver (src/app/app/theme-runtime.tsx),
 * the sidebar control and the Appearance settings all read the same rule from
 * here, so the three cannot drift.
 */

/** What a person can choose. */
export type ThemeChoice = "dark" | "light";

/** Any stored or attribute value, resolved: only "light" is light. */
export function resolveThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === "light" ? "light" : "dark";
}

/**
 * This browser's copy of the choice. The inline resolver reads it before the
 * first paint, so a person who chose Light never sees the dark default flash
 * while their saved preference streams in.
 */
export const THEME_STORAGE_KEY = "signal:theme-mode";

/** The event the inline resolver re-resolves on. */
export const THEME_EVENT = "signal:theme";

/**
 * Apply a choice to the live document: the attribute the resolver reads,
 * this browser's copy, then the event. Saving it to the account is the
 * caller's job.
 */
export function applyThemeChoice(choice: ThemeChoice) {
  document.documentElement.setAttribute("data-theme-mode", choice);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private windows: the choice still holds for this visit and on the account.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** The theme the document is showing now. */
export function readThemeChoice(): ThemeChoice {
  return resolveThemeChoice(document.documentElement.getAttribute("data-theme"));
}

/** Subscribes to the resolved theme changing, for useSyncExternalStore. */
export function subscribeThemeChoice(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
