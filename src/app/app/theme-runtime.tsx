import "server-only";

import { Suspense } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { getCurrentUserOrNull } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";

/**
 * Theme resolution for the signed-in app.
 *
 * WHERE IT APPLIES. This component is rendered by src/app/app/layout.tsx and
 * nowhere else, so only a document served from an /app route contains it at
 * all. Marketing, the public /s/[token] artifact, the auth stage and every
 * other public surface ship the same HTML they shipped yesterday — no
 * attribute, no script, no bytes — and stay light. That is the whole scoping
 * mechanism: not a pathname test at runtime, but which layout renders this.
 *
 * WHAT IT WRITES. The resolved value lands as data-theme on <html>, which is
 * where the design system's [data-theme="dark"] mapping and the UA's
 * color-scheme both need it: on any inner element the tokens would flip but
 * the document canvas, the scrollbars and the overscroll gutter would stay
 * white. Two attributes, one job each:
 *
 *   data-theme-mode  what the user CHOSE — system | light | dark
 *   data-theme       what that resolves to NOW — light | dark
 *
 * Keeping them apart is what makes "system" live: the resolver re-runs on
 * every prefers-color-scheme change without anything having to re-render, and
 * the settings control can change the choice by rewriting one attribute and
 * firing one event.
 *
 * WHY TWO SCRIPTS. The resolver has no data dependency, so it renders
 * immediately and settles the common case — mode "system", the default for
 * every user who has never opened settings — before the app paints. The
 * chosen mode needs the database, so it streams in behind a Suspense boundary
 * and corrects the attribute when it arrives. That ordering is deliberate:
 * the alternative is to await the preference in the layout itself, which puts
 * a query in front of the shell for every /app request, including the users
 * whose answer is the default. The correction lands ahead of the app's own
 * content, which sits behind a slower boundary (auth, then the product's own
 * data); what it cannot always beat is the chrome, so a user who has chosen
 * light-on-a-dark-OS or dark-on-a-light-OS can see the L-frame settle. The
 * frame is charcoal in both themes, which is why that is a settle and not a
 * flash.
 *
 * No library, no store, no CSS-in-JS: ~230 bytes of inline script, and the
 * preference itself rides the existing user_preferences write path.
 */

// Kept as one line each — these are inlined into the document verbatim.
//
// Exported so src/app/app/theme-resolver.test.ts can execute the exact string
// this file ships against a DOM stub, rather than a re-typed copy of it. An
// inline script is unreachable by every other kind of test in this repo: it is
// not a module, it never runs in a test renderer, and a source-text assertion
// on a minified one-liner proves the characters, not the resolution table.
export const RESOLVER = `(function(){var e=document.documentElement,q=matchMedia("(prefers-color-scheme:dark)"),a=function(){var m=e.getAttribute("data-theme-mode")||"system";e.setAttribute("data-theme",m==="dark"||(m!=="light"&&q.matches)?"dark":"light")};a();q.addEventListener("change",a);addEventListener("signal:theme",a)})();`;

export const applyMode = (mode: "light" | "dark") =>
  `document.documentElement.setAttribute("data-theme-mode","${mode}");dispatchEvent(new Event("signal:theme"));`;

/**
 * The chosen mode, read from the same user_preferences row the settings
 * screen writes. Demo and review modes never touch the database, and any
 * failure here is a theme question, never a reason to fail an app request —
 * both fall back to "system", which is also the column's default.
 */
async function ChosenMode() {
  if (isDemoMode()) return null;
  let mode: "system" | "light" | "dark" = "system";
  try {
    const userId = await getCurrentUserOrNull();
    if (userId) mode = (await getUserPreferences(userId)).themeMode;
  } catch {
    return null;
  }
  if (mode === "system") return null;
  return <script dangerouslySetInnerHTML={{ __html: applyMode(mode) }} />;
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
