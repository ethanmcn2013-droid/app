import { APP_BAR_DARK, APP_BAR_LIGHT } from "./document-paper";
import { resolveThemeChoice, THEME_EVENT, THEME_STORAGE_KEY, type ThemeChoice } from "./theme-mode";

type ThemeConfiguration = Readonly<{ event: string; storageKey: string; darkBar: string; lightBar: string; metaProperty: string }>;
export type AppThemeRuntime = { apply: () => void; retain: () => () => void; dispose: () => void };
export type AppThemeHost = Pick<Window, "document" | "localStorage" | "matchMedia" | "setTimeout" | "clearTimeout" | "addEventListener" | "removeEventListener" | "dispatchEvent"> & {
  Event: typeof Event;
  __signalAppThemeRuntime?: AppThemeRuntime;
};

export const APP_THEME_CONFIGURATION: ThemeConfiguration = {
  event: THEME_EVENT, storageKey: THEME_STORAGE_KEY, darkBar: APP_BAR_DARK, lightBar: APP_BAR_LIGHT,
  metaProperty: "signal:app-theme",
};

/**
 * Self-contained so this exact function can also run in the parser's SSR
 * script. Keep dependencies explicit; client entry calls it as normal code.
 */
export function installAppTheme(host: AppThemeHost, config: ThemeConfiguration, resolve: typeof resolveThemeChoice): AppThemeRuntime {
  if (host.__signalAppThemeRuntime) {
    host.__signalAppThemeRuntime.apply();
    return host.__signalAppThemeRuntime;
  }
  const document = host.document;
  const element = document.documentElement;
  const motion = host.matchMedia("(prefers-reduced-motion:reduce)");
  // React includes `property` in a hoistable meta's identity. A data-* marker
  // alone is insufficient: React can adopt that node for Next's ordinary
  // viewport meta, then try to delete it after our cleanup already removed it.
  // This private identity belongs only to this runtime; Next's viewport meta
  // remains a separate resource, including when both colors are identical.
  const metaSelector = `meta[name="theme-color"][property="${config.metaProperty}"][data-app-theme]`;
  let ownedMeta: HTMLMetaElement | null = null;
  let timer: number | undefined;
  let owners = 0;
  let disposed = false;
  const runtime: AppThemeRuntime = {
    apply() {
      if (disposed) return;
      let choice = element.getAttribute("data-theme-mode");
      if (!choice) { try { choice = host.localStorage.getItem(config.storageKey); } catch { /* Storage can be blocked. */ } }
      const theme = resolve(choice);
      const previous = element.getAttribute("data-theme");
      if (previous !== theme) {
        if (previous && document.readyState !== "loading" && !motion.matches) {
          element.classList.add("theme-resolving");
          host.clearTimeout(timer);
          timer = host.setTimeout(function () { element.classList.remove("theme-resolving"); timer = undefined; }, 200);
        }
        element.setAttribute("data-theme", theme);
      }
      // Repair metadata even if the theme itself was already correct.
      ownedMeta = document.querySelector<HTMLMetaElement>(metaSelector);
      if (!ownedMeta && document.head) {
        ownedMeta = document.createElement("meta");
        ownedMeta.setAttribute("name", "theme-color");
        ownedMeta.setAttribute("property", config.metaProperty);
        ownedMeta.setAttribute("data-app-theme", "");
        document.head.insertBefore(ownedMeta, document.head.firstChild);
      }
      ownedMeta?.setAttribute("content", theme === "light" ? config.lightBar : config.darkBar);
    },
    retain() {
      owners += 1;
      let released = false;
      return function () {
        if (released) return;
        released = true; owners -= 1;
        if (owners === 0) runtime.dispose();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      host.removeEventListener(config.event, runtime.apply);
      host.clearTimeout(timer); element.classList.remove("theme-resolving");
      // Remove only the exact private resource this runtime used. A foreign
      // marker, or a node whose identity changed hands, is not ours to remove.
      if (ownedMeta?.getAttribute("name") === "theme-color"
        && ownedMeta.getAttribute("property") === config.metaProperty
        && ownedMeta.hasAttribute("data-app-theme")) ownedMeta.remove();
      ownedMeta = null;
      element.removeAttribute("data-theme"); element.removeAttribute("data-theme-mode");
      if (host.__signalAppThemeRuntime === runtime) delete host.__signalAppThemeRuntime;
    },
  };
  host.__signalAppThemeRuntime = runtime;
  runtime.apply(); host.addEventListener(config.event, runtime.apply);
  return runtime;
}

/** The account correction uses the same attribute/storage/event contract as controls. */
export function applyAppThemeChoice(host: AppThemeHost, choice: ThemeChoice, config: ThemeConfiguration) {
  host.document.documentElement.setAttribute("data-theme-mode", choice);
  try { host.localStorage.setItem(config.storageKey, choice); } catch { /* The choice still applies this visit. */ }
  host.dispatchEvent(new host.Event(config.event));
}

/** No evaluation on the client: these strings are only parsed in server HTML. */
export const APP_THEME_RESOLVER = `(${installAppTheme.toString()})(globalThis,${JSON.stringify(APP_THEME_CONFIGURATION)},${resolveThemeChoice.toString()});`;
export const appThemeChoiceScript = (mode: ThemeChoice) => `(${applyAppThemeChoice.toString()})(globalThis,${JSON.stringify(mode)},${JSON.stringify(APP_THEME_CONFIGURATION)});`;
