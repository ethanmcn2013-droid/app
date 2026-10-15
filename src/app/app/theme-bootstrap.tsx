"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { APP_THEME_CONFIGURATION, applyAppThemeChoice, installAppTheme } from "@/lib/app-theme-bootstrap";
import { resolveThemeChoice, type ThemeChoice } from "@/lib/theme-mode";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * The parser executes the SSR script before paint. A client navigation never
 * inserts a raw script: its layout effect installs the same runtime directly.
 */
export function ThemeBootstrap({ script, mode }: { script: string; mode?: ThemeChoice }) {
  const client = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  useLayoutEffect(() => {
    const release = installAppTheme(window, APP_THEME_CONFIGURATION, resolveThemeChoice).retain();
    if (mode !== undefined) applyAppThemeChoice(window, mode, APP_THEME_CONFIGURATION);
    return release;
  }, [mode]);
  return client ? null : <script dangerouslySetInnerHTML={{ __html: script }} />;
}
