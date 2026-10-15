import "server-only";

import { Suspense } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { resolveThemeChoice } from "@/lib/theme-mode";
import { APP_THEME_RESOLVER, appThemeChoiceScript } from "@/lib/app-theme-bootstrap";
import { ThemeBootstrap } from "./theme-bootstrap";
import { getCurrentUserOrNull } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";

/**
 * App-only theme bootstrap: Dark by default, Light only by explicit choice.
 * The SSR parser resolves this browser's choice before paint; the account
 * preference streams behind Suspense and corrects a stale/shared browser.
 *
 * Both SSR strings and client entry use src/lib/app-theme-bootstrap.ts. The
 * client boundary preserves parser scripts in initial HTML but never inserts
 * raw scripts during navigation. Its layout effect installs the same runtime
 * before client paint, without evaluation or a relaxed content policy.
 *
 * The runtime owns one theme event listener and one leading browser-bar meta.
 * Repeated entry/hydration shares that runtime; the last app owner removes its
 * listener, pending transition and document attributes when leaving the app.
 */
export const RESOLVER = APP_THEME_RESOLVER;
export const applyMode = appThemeChoiceScript;

async function ChosenMode() {
  if (isDemoMode()) return null;
  let stored: string | null = null;
  try {
    const userId = await getCurrentUserOrNull();
    if (!userId) return null;
    stored = (await getUserPreferences(userId)).themeMode;
  } catch {
    // A preference read never prevents the app from opening.
    return null;
  }
  const mode = resolveThemeChoice(stored);
  return <ThemeBootstrap script={applyMode(mode)} mode={mode} />;
}

export function ThemeRuntime() {
  return <><ThemeBootstrap script={RESOLVER} /><Suspense fallback={null}><ChosenMode /></Suspense></>;
}
