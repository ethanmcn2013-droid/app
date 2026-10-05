import "server-only";

import { Suspense } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { APP_BAR_DARK, APP_BAR_LIGHT } from "@/lib/document-paper";
import {
  THEME_EVENT,
  THEME_STORAGE_KEY,
  resolveThemeChoice,
  type ThemeChoice,
} from "@/lib/theme-mode";
import { getCurrentUserOrNull } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";

/**
 * Theme resolution for the signed-in app.
 *
 * DARK IS THE DEFAULT, LIGHT IS A CHOICE (founder instruction, 5 Oct 2026).
 * The app no longer follows the operating system. A person who has never
 * chosen gets Dark; a person who chose Light gets Light; nothing else exists.
 * The stored column keeps its three values and its default, so "system" in
 * the database now reads as "never chose" and resolves to Dark. The one rule
 * lives in src/lib/theme-mode.ts (resolveThemeChoice) and the inline script
 * below is its pre-paint twin.
 *
 * WHERE IT APPLIES. This component is rendered by src/app/app/layout.tsx and
 * nowhere else, so only a document served from an /app route contains it at
 * all. Marketing, the public /s/[token] artifact, the auth stage and every
 * other public surface ship the same HTML they shipped yesterday (no
 * attribute, no script, no bytes) and stay light. That is the whole scoping
 * mechanism: not a pathname test at runtime, but which layout renders this.
 *
 * WHAT IT WRITES. The resolved value lands as data-theme on <html>, which is
 * where the design system's [data-theme="dark"] mapping and the UA's
 * color-scheme both need it: on any inner element the tokens would flip but
 * the document canvas, the scrollbars and the overscroll gutter would stay
 * white. Two attributes, one job each:
 *
 *   data-theme-mode  what the user CHOSE: light | dark (absent: never chose)
 *   data-theme       what that resolves to: light | dark
 *
 * It also owns the phone browser bar. The bar is outside the document, and a
 * media query can only ask the operating system, which this app no longer
 * follows; so the resolver keeps one <meta name="theme-color"> of its own at
 * the front of <head>, where it outranks the static one the layout's
 * viewport export renders, and rewrites it with the theme.
 *
 * WHY TWO SCRIPTS, AND WHY NO FLASH. The resolver has no data dependency, so
 * it renders immediately and settles the first paint before the app paints.
 * It reads data-theme-mode, then this browser's own copy of the choice
 * (localStorage, written by the controls and by the streamed script below),
 * and anything that is not "light" is dark. So:
 *
 *   never chose                     dark from the first frame, no light flash
 *   chose Dark                      dark from the first frame
 *   chose Light, browser knows      light from the first frame
 *   chose Light, a new browser      dark, then light when the choice streams in
 *
 * The account's stored choice needs the database, so it streams in behind a
 * Suspense boundary and corrects both the attribute and this browser's copy
 * when it arrives. It always arrives resolved (light or dark), so a stale
 * copy left by another account on a shared browser is corrected too. The
 * alternative is to await the preference in the layout itself, which puts a
 * query in front of the shell for every /app request. The sidebar and the
 * frame are ink in both themes, which is why the last row is a settle and
 * not a flash.
 *
 * HOW IT MOVES. A theme change is a change of material, not a change of
 * state. Whenever the resolver changes data-theme on a LIVE document it adds
 * `theme-resolving` to <html> for the length of one brief resolve and takes
 * it off again; globals.css turns that class into a scoped colour transition
 * (background-color, color, border-color, fill, and nothing else) so the
 * whole document crosses together and then the class is gone. It is never
 * added on the first paint (there is no previous theme to leave), never on
 * the streamed correction that lands while the document is still parsing,
 * and never under prefers-reduced-motion.
 *
 * No library, no store, no CSS-in-JS: one inline script, and the preference
 * itself rides the existing user_preferences write path.
 */

// Kept as one line each: these are inlined into the document verbatim.
//
// Exported so src/app/app/theme-resolver.test.ts can execute the exact string
// this file ships against a DOM stub, rather than a re-typed copy of it. An
// inline script is unreachable by every other kind of test in this repo: it is
// not a module, it never runs in a test renderer, and a source-text assertion
// on a minified one-liner proves the characters, not the resolution table.
//
// Reading the one-liner: `m` is the choice (the attribute, else this
// browser's copy), `n` is what the theme resolves to now, `p` is what it said
// before. Equal means nothing to do. A `p` that exists, on a document past
// parsing, with motion allowed, is the one case that gets the transition
// class, and the timer that removes it is cleared first, so a viewer flipping
// the control twice in a second cannot strand the class on the document.
// Last, `k` is the resolver's own theme-color meta, made once and rewritten.
export const RESOLVER = `(function(){var d=document,e=d.documentElement,r=matchMedia("(prefers-reduced-motion:reduce)"),t,a=function(){var m=e.getAttribute("data-theme-mode"),n,p=e.getAttribute("data-theme"),k;if(!m)try{m=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(x){}n=m==="light"?"light":"dark";if(p===n)return;if(p&&d.readyState!=="loading"&&!r.matches){e.classList.add("theme-resolving");clearTimeout(t);t=setTimeout(function(){e.classList.remove("theme-resolving")},200)}e.setAttribute("data-theme",n);k=d.querySelector("meta[data-app-theme]");if(!k&&d.head){k=d.createElement("meta");k.setAttribute("name","theme-color");k.setAttribute("data-app-theme","");d.head.insertBefore(k,d.head.firstChild)}if(k)k.setAttribute("content",n==="light"?"${APP_BAR_LIGHT}":"${APP_BAR_DARK}")};a();addEventListener("${THEME_EVENT}",a)})();`;

export const applyMode = (mode: ThemeChoice) =>
  `document.documentElement.setAttribute("data-theme-mode","${mode}");try{localStorage.setItem("${THEME_STORAGE_KEY}","${mode}")}catch(x){}dispatchEvent(new Event("${THEME_EVENT}"));`;

/**
 * The chosen mode, read from the same user_preferences row the settings
 * screen writes, and always sent resolved: a stored "system" is a person who
 * never chose, and that is Dark. Demo and review modes never touch the
 * database, and any failure here is a theme question, never a reason to fail
 * an app request: both leave the resolver's own answer standing.
 */
async function ChosenMode() {
  if (isDemoMode()) return null;
  let stored: string | null = null;
  try {
    const userId = await getCurrentUserOrNull();
    if (!userId) return null;
    stored = (await getUserPreferences(userId)).themeMode;
  } catch {
    return null;
  }
  return <script dangerouslySetInnerHTML={{ __html: applyMode(resolveThemeChoice(stored)) }} />;
}

export function ThemeRuntime() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RESOLVER }} />
      <Suspense fallback={null}>
        <ChosenMode />
      </Suspense>
    </>
  );
}
