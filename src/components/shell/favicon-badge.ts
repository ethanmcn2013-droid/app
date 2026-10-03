"use client";

/**
 * The tab icon carries a red dot while anything is waiting (Inbox, Chat), the
 * way mail and chat apps mark a background tab. The badged icon is drawn as
 * vector geometry at 64px (sharp on high-density tab strips) from the same
 * metrics as the served mark, with a transparent cut-out around the dot so it
 * reads on light and dark tabs alike. With nothing waiting the original
 * links come back untouched.
 */

import { useEffect } from "react";
import { SIGNAL_INDIGO, suiteMarkMetrics } from "@/lib/brand/suite-mark";

const ORIGINAL = "data-original-href";
const NOTIFY_RED = "#e5322d";
let badged: string | null = null;

function iconLinks(): HTMLLinkElement[] {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
}

function drawBadged(): string | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // The mark at 32px proportions (heavier ring), scaled to 64px.
  const scale = size / 32;
  const { stroke, ring, dot } = suiteMarkMetrics(32);
  const c = size / 2;
  context.strokeStyle = SIGNAL_INDIGO;
  context.lineWidth = stroke * scale;
  context.beginPath();
  context.arc(c, c, ring * scale, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = SIGNAL_INDIGO;
  context.beginPath();
  context.arc(c, c, dot * scale, 0, Math.PI * 2);
  context.fill();
  // The red dot, top right, with a transparent cut-out around it.
  const radius = size * 0.2;
  const cx = size - radius - 1;
  const cy = radius + 1;
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(cx, cy, radius + size * 0.06, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = NOTIFY_RED;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function apply(on: boolean) {
  const links = iconLinks();
  if (!on) {
    for (const link of links) {
      const original = link.getAttribute(ORIGINAL);
      if (original) {
        link.href = original;
        link.removeAttribute(ORIGINAL);
      }
    }
    return;
  }
  badged ??= drawBadged();
  if (!badged) return;
  for (const link of links) {
    if (!link.hasAttribute(ORIGINAL)) link.setAttribute(ORIGINAL, link.href);
    link.href = badged;
  }
}

/** Marks the tab icon while `count` is above zero. */
export function useFaviconBadge(count: number): void {
  const on = count > 0;
  useEffect(() => {
    apply(on);
  }, [on]);
  useEffect(() => () => apply(false), []);
}
