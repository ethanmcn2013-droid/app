/* Text measuring for the layout, so rows get exactly the height their words need.
   On the server (and during hydration) a character estimate stands in. */

import { useSyncExternalStore } from "react";

const noop = () => () => {};

function onFonts(cb: () => void) {
  if (typeof document === "undefined" || !document.fonts) return noop();
  document.fonts.addEventListener("loadingdone", cb);
  return () => document.fonts.removeEventListener("loadingdone", cb);
}

/** 0 on the server and during hydration, 1 once live, 2 once the web fonts are in:
    each step re-measures the words. */
export function useIsClient() {
  return useSyncExternalStore(
    onFonts,
    () => (document.fonts?.status === "loaded" ? 2 : 1),
    () => 0,
  );
}

let ctx: CanvasRenderingContext2D | null = null;
let family = "";

export type Measure = (text: string, px: number, weight?: number) => number;

export const estimate: Measure = (text, px) => text.length * px * 0.5;

export const canvasMeasure: Measure = (text, px, weight = 400) => {
  if (typeof document === "undefined") return estimate(text, px);
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!family) family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  if (!ctx) return estimate(text, px);
  ctx.font = `${weight} ${px}px ${family}`;
  return ctx.measureText(text).width;
};
