/**
 * Shared by the pre-stylesheet paint guard and browser theme-color metadata,
 * which cannot read CSS variables. These mirror --paper in tokens.css.
 * Keep constants outside layout.tsx: Next only permits route entry exports.
 */
export const PAPER_LIGHT = "#ffffff";
export const PAPER_DARK = "#0f0f10";
