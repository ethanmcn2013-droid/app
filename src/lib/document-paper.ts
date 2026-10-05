/**
 * Shared by the pre-stylesheet paint guard and browser theme-color metadata,
 * which cannot read CSS variables. These mirror --paper in tokens.css.
 * Keep constants outside layout.tsx: Next only permits route entry exports.
 */
export const PAPER_LIGHT = "#ffffff";
export const PAPER_DARK = "#0f0f10";

/**
 * The phone browser bar above the signed-in app. They mirror --v3-canvas in
 * src/ds/v3.css, which is what the app's top bar is painted with, so the bar
 * and the page read as one surface. The app is dark unless a person chose
 * light; src/app/app/theme-runtime.tsx writes the matching one.
 */
export const APP_BAR_DARK = "#1c1c1c";
export const APP_BAR_LIGHT = "#f6f5f2";
